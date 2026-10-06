# trace:verifies FR-019
# trace:verifies FR-020
# trace:verifies FR-021
# trace:verifies FR-023
"""Opt-in acceptance against an already served model; never starts or downloads one."""
import asyncio
import json
import os
import secrets
import socket
import time
from dataclasses import dataclass
from urllib.parse import urlsplit

import httpx
import pytest
import uvicorn
from local_llm_hub.agents import AgentRuntime
from local_llm_hub.api import create_app
from local_llm_hub.config import (
    AgentDefinition,
    EndpointDefinition,
    HubConfig,
    PolicyDefinition,
    ProjectDefinition,
    RuntimeSettings,
)
from local_llm_hub.models import Capabilities, ModelDefinition
from local_llm_hub.providers import OpenAICompatibleProvider
from local_llm_hub.router import ModelRouter
from pydantic import SecretStr

pytestmark = [pytest.mark.integration, pytest.mark.skipif(
    os.environ.get('LOCAL_LLM_INTEGRATION_TEST') != '1', reason='Live inference explicitly disabled')]


class ObservedProvider(OpenAICompatibleProvider):
    """Observe actual provider calls without replacing transport or generation."""

    def __init__(self, endpoint):
        super().__init__(endpoint)
        self.started = asyncio.Event()
        self.cancelled = asyncio.Event()
        self.active = 0
        self.peak = 0
        self.calls = 0

    async def complete(self, request, model):
        self.active += 1
        self.calls += 1
        self.peak = max(self.peak, self.active)
        self.started.set()
        try:
            return await super().complete(request, model)
        except asyncio.CancelledError:
            self.cancelled.set()
            raise
        finally:
            self.active -= 1


@dataclass
class LiveHub:
    client: httpx.AsyncClient
    runtime: AgentRuntime
    provider: ObservedProvider
    nonce: str


async def wait_until(predicate):
    async with asyncio.timeout(10):
        while not predicate():  # noqa: ASYNC110 - Uvicorn/session public state exposes no event.
            await asyncio.sleep(0.01)


@pytest.fixture
async def live_hub(tmp_path, record_property):
    base = os.environ.get('LOCAL_MODEL_BASE_URL', '').rstrip('/')
    model = os.environ.get('LOCAL_MODEL_NAME')
    context = os.environ.get('LOCAL_MODEL_CONTEXT')
    assert base and model and context, 'Enabled integration requires endpoint, model and served context'
    parsed = urlsplit(base)
    assert parsed.scheme in {'http', 'https'} and parsed.hostname, 'HTTP(S) endpoint required'
    assert not (parsed.username or parsed.password or parsed.query or parsed.fragment), 'Use the key environment variable for credentials'
    max_tokens = int(os.environ.get('LOCAL_MODEL_MAX_TOKENS', '2048'))
    timeout = float(os.environ.get('LOCAL_MODEL_TIMEOUT', '180'))
    assert int(context) > max_tokens + 2048, 'Context must leave space for tool schemas and output'
    key = os.environ.get('LOCAL_MODEL_API_KEY')
    endpoint = EndpointDefinition(provider='openai-compatible', base_url=base,
        api_key=SecretStr(key) if key else None, max_concurrency=1)
    definition = ModelDefinition(id='live', endpoint='live', model=model, timeout=timeout,
        capabilities=Capabilities(tool_calling=True, structured_output=True, context_length=int(context)))
    agent = AgentDefinition(id='text', model='live', context_budget=int(context), max_tokens=max_tokens,
        instructions='Follow the task precisely. Give a short final answer unless a longer answer is requested.')
    config = HubConfig(
        endpoints={'live': endpoint},
        models={'live': definition, 'same-endpoint': definition.model_copy(update={'id': 'same-endpoint'})},
        agents={
            'text': agent,
            'other': agent.model_copy(update={'id': 'other', 'model': 'same-endpoint'}),
            'reader': agent.model_copy(update={'id': 'reader', 'tools': ('filesystem.read',)}),
            'structured': agent.model_copy(update={'id': 'structured', 'output_schema': {
                'type': 'object', 'properties': {'answer': {'type': 'integer'}, 'label': {'type': 'string'}},
                'required': ['answer', 'label'], 'additionalProperties': False}}),
        },
        projects={'demo': ProjectDefinition(roots=[tmp_path])},
        policies={'reader': PolicyDefinition(grants=('filesystem.read',))},
        runtime=RuntimeSettings(token=SecretStr(secrets.token_urlsafe(32)),
            state_path=tmp_path / '.state' / 'memory.sqlite3', agent_concurrency=2,
            queue_timeout=timeout, run_timeout=min(timeout * 3, 3600)),
    )
    nonce = secrets.token_hex(16)
    (tmp_path / 'nonce.txt').write_text(nonce, encoding='utf-8')
    provider = ObservedProvider(endpoint)
    runtime = AgentRuntime(config, ModelRouter(config, {'live': provider}))
    server = uvicorn.Server(uvicorn.Config(create_app(config, runtime), host='127.0.0.1',
        port=0, log_level='error', access_log=False, timeout_graceful_shutdown=5))
    task = None
    started = time.monotonic()
    record_property('model', model)
    record_property('served_context', context)
    record_property('max_tokens_per_request', max_tokens)
    try:
        discovery = await provider.client.get(f'{base}/models', headers=provider.headers(), timeout=5)
        assert discovery.status_code == 200, f'Model discovery status: {discovery.status_code}'
        assert model in {m['id'] for m in discovery.json()['data']}, 'Selected model is absent from endpoint'
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as listener:
            listener.bind(('127.0.0.1', 0))
            port = listener.getsockname()[1]
            task = asyncio.create_task(server.serve(sockets=[listener]))
            await wait_until(lambda: server.started or task.done())
            assert server.started, 'Temporary Hub API failed to start'
            async with httpx.AsyncClient(base_url=f'http://127.0.0.1:{port}', trust_env=False,
                    timeout=config.runtime.run_timeout + 10,
                    headers={'Authorization': f'Bearer {config.runtime.token.get_secret_value()}'}) as client:
                yield LiveHub(client, runtime, provider, nonce)
            server.should_exit = True
            await asyncio.wait_for(task, 10)
    finally:
        server.should_exit = True
        if task is not None and not task.done():
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)
        await runtime.close()
        record_property('elapsed_ms', round((time.monotonic() - started) * 1000, 2))
        record_property('provider_calls', provider.calls)
        record_property('provider_peak_active', provider.peak)


async def run_agent(hub, agent, prompt, session_id=None):
    body = {'input': prompt}
    if session_id:
        body['session_id'] = session_id
    response = await hub.client.post(f'/v1/agents/{agent}/run', json=body)
    assert response.status_code == 200, response.text
    data = response.json()
    assert response.headers['x-request-id'] == data['request_id']
    return data


async def test_live_text(live_hub, record_property):
    result = await run_agent(live_hub, 'text', 'Reply with the single word READY.')
    assert isinstance(result['output'], str) and 'READY' in result['output'].upper()
    assert result['model_id'] == 'live'
    record_property('usage', json.dumps(result.get('usage')))


async def test_live_filesystem_tool_round_trip(live_hub, record_property):
    result = await run_agent(live_hub, 'reader',
        'Use filesystem__read to read nonce.txt in root 0. Return its exact contents in your final answer. '
        'The file is the only source; do not invent its contents.')
    assert live_hub.nonce in result['output']
    messages = live_hub.runtime.sessions[result['session_id']].messages
    calls = [call for message in messages for call in message.tool_calls
        if call.name == 'filesystem__read' and call.arguments.get('path') == 'nonce.txt']
    assert calls, 'A plausible answer alone does not prove tool execution'
    assert any(m.role == 'tool' and m.tool_call_id in {call.id for call in calls}
        and live_hub.nonce in m.content for m in messages)
    assert live_hub.provider.calls >= 2, 'A real model follow-up must consume the tool result'
    record_property('usage', json.dumps(result.get('usage')))


async def test_live_structured_output(live_hub, record_property):
    result = await run_agent(live_hub, 'structured',
        'Calculate 6 multiplied by 7. Return answer as an integer and label as the string ready, '
        'using the provided structured output tool.')
    assert result['output'] == {'answer': 42, 'label': 'ready'}
    record_property('usage', json.dumps(result.get('usage')))


async def test_live_shared_endpoint_concurrency(live_hub, record_property):
    tasks = [asyncio.create_task(run_agent(live_hub, agent,
        'Reply with the single word READY.')) for agent in ('text', 'other')]
    peak_active = peak_queued = 0
    try:
        while not all(task.done() for task in tasks):
            snapshot = live_hub.runtime.router.scheduler.snapshot('live')
            peak_active = max(peak_active, snapshot['active_requests'])
            peak_queued = max(peak_queued, snapshot['queued_requests'])
            await asyncio.sleep(0.01)
        results = await asyncio.gather(*tasks)
        assert all(isinstance(r['output'], str) and 'READY' in r['output'].upper() for r in results)
        assert {r['model_id'] for r in results} == {'live', 'same-endpoint'}
        assert peak_active == live_hub.provider.peak == 1
        assert peak_queued == 1, 'Both requests must overlap and share the endpoint pool'
        assert live_hub.runtime.router.scheduler.snapshot('live') == {'active_requests': 0, 'queued_requests': 0}
        record_property('scheduler_peak_active', peak_active)
        record_property('scheduler_peak_queued', peak_queued)
        record_property('usage', json.dumps([r.get('usage') for r in results]))
    finally:
        for task in tasks:
            if not task.done():
                task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)


async def test_live_disconnect_cleanup_and_recovery(live_hub, record_property):
    response = await live_hub.client.post('/v1/agents/text/sessions', json={})
    assert response.status_code == 201
    sid = response.json()['session_id']
    task = asyncio.create_task(run_agent(live_hub, 'text',
        'Write a long, detailed essay of at least 3000 words about the history of mathematics.', sid))
    try:
        await asyncio.wait_for(live_hub.provider.started.wait(), 10)
        await asyncio.sleep(0.5)
        assert not task.done() and live_hub.provider.active == 1, 'Cancel only an active request'
        started = time.monotonic()
        task.cancel()  # Close a real HTTP client request, causing ASGI http.disconnect.
        with pytest.raises(asyncio.CancelledError):
            await task
        await asyncio.wait_for(live_hub.provider.cancelled.wait(), 10)
        await wait_until(lambda: not live_hub.runtime.sessions[sid].busy)
        assert live_hub.runtime.router.scheduler.snapshot('live') == {'active_requests': 0, 'queued_requests': 0}
        assert live_hub.runtime.queued == 0 and live_hub.provider.active == 0
        assert live_hub.runtime.sessions[sid].messages == [], 'Cancelled run must not commit history'
        record_property('disconnect_cleanup_ms', round((time.monotonic() - started) * 1000, 2))
        result = await run_agent(live_hub, 'text', 'Reply with the single word READY.', sid)
        assert 'READY' in result['output'].upper()
        record_property('recovery_usage', json.dumps(result.get('usage')))
        record_property('backend_gpu_cancellation', 'NOT_INFERRED_FROM_CLIENT_CLEANUP')
    finally:
        if not task.done():
            task.cancel()
        await asyncio.gather(task, return_exceptions=True)
