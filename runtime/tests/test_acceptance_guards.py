# trace:verifies FR-018
# trace:verifies FR-019
# trace:verifies FR-020
# trace:verifies FR-023
import asyncio
import json
import time

import httpx
import pytest
import yaml
from local_llm_hub.agents import AgentRuntime
from local_llm_hub.api import create_app
from local_llm_hub.config import EndpointDefinition, load_config
from local_llm_hub.context import ContextManager
from local_llm_hub.errors import HubError
from local_llm_hub.models import (
    InferenceRequest,
    InferenceResponse,
    Message,
    RouteRequest,
    ToolCall,
)
from local_llm_hub.providers import MockProvider, OpenAICompatibleProvider
from local_llm_hub.router import ModelRouter
from test_configuration_registry import write_config


@pytest.mark.parametrize('case', ['cycle', 'unknown_fallback', 'missing_context', 'missing_env', 'invalid_root', 'unknown_agent', 'secret_in_yaml', 'invalid_schema'])
def test_startup_cross_references_fail_closed(tmp_path, case):
    write_config(tmp_path)
    data = {name: yaml.safe_load((tmp_path / f'{name}.yaml').read_text()) for name in ('models', 'agents', 'permissions', 'runtime')}
    model = data['models']['models']['demo']
    if case == 'cycle':
        model['fallbacks'] = ['demo']
    elif case == 'unknown_fallback':
        model['fallbacks'] = ['missing']
    elif case == 'missing_context':
        model['capabilities'].pop('context_length')
    elif case == 'missing_env':
        model['model'] = '${MISSING_VALUE}'
    elif case == 'invalid_root':
        data['permissions']['projects']['demo']['roots'] = ['missing']
    elif case == 'unknown_agent':
        data['agents']['agents']['assistant']['delegate_to'] = ['missing']
    elif case == 'secret_in_yaml':
        data['models']['endpoints']['cpu']['api_key'] = 'CANARY'
    else:
        data['agents']['agents']['assistant']['output_schema'] = {'type': 'not-a-type'}
    for name, value in data.items():
        (tmp_path / f'{name}.yaml').write_text(yaml.safe_dump(value))
    with pytest.raises(HubError, match='CONFIG_INVALID') as error:
        load_config(tmp_path, {'HUB_TEST_KEY': 'unit-test-key-long-enough'})
    assert 'CANARY' not in str(error.value)


async def test_aliases_share_pool_and_other_endpoint_runs(config):
    entered, release = asyncio.Event(), asyncio.Event()
    class Holding(MockProvider):
        active = 0
        peak = 0
        async def complete(self, request, model):
            self.active += 1
            self.peak = max(self.peak, self.active)
            entered.set()
            try:
                await release.wait()
                return InferenceResponse(content='held')
            finally:
                self.active -= 1
    config.endpoints['other'] = EndpointDefinition(provider='mock')
    config.models['same'] = config.models['demo'].model_copy(update={'id': 'same', 'aliases': ()})
    config.models['other'] = config.models['demo'].model_copy(update={'id': 'other', 'endpoint': 'other', 'aliases': ()})
    hold = Holding()
    router = ModelRouter(config, {'cpu': hold, 'other': MockProvider()})
    inference = InferenceRequest(messages=[Message(role='user', content='echo:ok')])
    first = asyncio.create_task(router.complete(RouteRequest(model='chat', inference=inference)))
    await entered.wait()
    second = asyncio.create_task(router.complete(RouteRequest(model='same', inference=inference)))
    await asyncio.sleep(0)
    assert router.scheduler.snapshot('cpu')['queued_requests'] == 1
    # Load-aware auto selection must use the idle independent endpoint.
    assert (await router.complete(RouteRequest(inference=inference))).model_id == 'other'
    release.set()
    await asyncio.gather(first, second)
    assert hold.peak == 1
    await router.close()


async def test_nonretryable_failure_health_and_transient_attempt_limit(config):
    class ErrorProvider(MockProvider):
        calls = 0
        async def complete(self, request, model):
            self.calls += 1
            raise HubError('MODEL_AUTH_ERROR', 'Authorization failed', 502)
    error = ErrorProvider()
    config.models['demo'] = config.models['demo'].model_copy(update={'retries': 3})
    router = ModelRouter(config, {'cpu': error})
    with pytest.raises(HubError, match='MODEL_AUTH_ERROR'):
        await router.complete(RouteRequest(inference=InferenceRequest(messages=[Message(role='user', content='hi')])))
    assert error.calls == 1
    assert router.health('demo')['failure_count'] == 1
    assert router.health('demo')['last_success'] is None
    await router.probe()
    assert router.health('demo')['status'] == 'available'
    assert router.health('demo')['last_success'] is None
    await router.close()


@pytest.mark.parametrize('failure', ['malformed', 'timeout', 'connection'])
async def test_provider_failure_normalization(config, failure):
    def transport(request):
        if failure == 'timeout':
            raise httpx.ReadTimeout('SECRET_CANARY')
        if failure == 'connection':
            raise httpx.ConnectError('SECRET_CANARY')
        return httpx.Response(200, text='SECRET_CANARY')
    provider = OpenAICompatibleProvider(EndpointDefinition(provider='openai-compatible', base_url='http://test/v1'),
        httpx.AsyncClient(transport=httpx.MockTransport(transport)))
    with pytest.raises(HubError) as error:
        await provider.complete(InferenceRequest(messages=[Message(role='user', content='x')]), config.models['demo'])
    assert error.value.code == {'malformed': 'MODEL_RESPONSE_INVALID', 'timeout': 'MODEL_TIMEOUT', 'connection': 'MODEL_UNAVAILABLE'}[failure]
    assert 'SECRET_CANARY' not in str(error.value)
    await provider.close()


def test_context_pairs_remain_atomic_and_dangling_results_fail():
    messages = [Message(role='system', content='policy'), Message(role='user', content='x' * 1500),
        Message(role='assistant', tool_calls=[ToolCall(id='old', name='read', arguments={})]),
        Message(role='tool', tool_call_id='old', content='old data'), Message(role='user', content='latest')]
    result = ContextManager().prepare(InferenceRequest(messages=messages, max_tokens=50), 650)
    assert [m.role for m in result.messages] == ['system', 'user']
    with pytest.raises(HubError, match='CONTEXT_INVALID'):
        ContextManager().prepare(InferenceRequest(messages=[Message(role='tool', tool_call_id='missing')]), 8192)


async def test_child_cannot_gain_write_and_sessions_expire(config, tmp_path):
    config.agents['reviewer'] = config.agents['reviewer'].model_copy(update={
        'tools': ('filesystem.read', 'agent.delegate'), 'delegate_to': ('assistant',), 'policy': 'limited'})
    config.policies['limited'] = config.policies['reader'].model_copy(update={'grants': ('filesystem.read', 'agent.delegate')})
    runtime = AgentRuntime(config)
    child = 'tool:' + json.dumps({'name': 'filesystem.write', 'arguments': {'path': 'denied.txt', 'content': 'bad'}})
    task = 'tool:' + json.dumps({'name': 'agent.delegate', 'arguments': {'agent_id': 'assistant', 'task': child}})
    try:
        with pytest.raises(HubError):
            await runtime.run('reviewer', task)
        assert not (tmp_path / 'denied.txt').exists()
        session = runtime.create_session('assistant')
        session.updated = time.monotonic() - config.runtime.session_ttl - 1
        with pytest.raises(HubError, match='SESSION_NOT_FOUND'):
            await runtime.run('assistant', 'hello', session.id)
    finally:
        await runtime.close()


async def test_api_disconnect_cancels_provider_and_returns_permits(config):
    started, released = asyncio.Event(), asyncio.Event()
    class Slow(MockProvider):
        async def complete(self, request, model):
            started.set()
            try:
                await asyncio.sleep(10)
            finally:
                released.set()
            return InferenceResponse(content='late')
    runtime = AgentRuntime(config, ModelRouter(config, {'cpu': Slow()}))
    app = create_app(config, runtime)
    calls = 0
    async def receive():
        nonlocal calls
        calls += 1
        if calls == 1:
            return {'type': 'http.request', 'body': b'{"input":"hello"}', 'more_body': False}
        await started.wait()
        return {'type': 'http.disconnect'}
    async def send(message):
        pass
    scope = {'type': 'http', 'asgi': {'version': '3.0'}, 'http_version': '1.1', 'method': 'POST',
        'scheme': 'http', 'path': '/v1/agents/assistant/run', 'query_string': b'',
        'headers': [(b'authorization', ('Bearer ' + config.runtime.token.get_secret_value()).encode()),
                    (b'content-type', b'application/json')], 'server': ('test', 80), 'client': ('test', 1)}
    await asyncio.wait_for(app(scope, receive, send), 3)
    assert released.is_set()
    assert runtime.router.scheduler.snapshot('cpu') == {'active_requests': 0, 'queued_requests': 0}
    assert not any(s.busy for s in runtime.sessions.values())
    await runtime.close()


async def test_child_cloud_permission_never_exceeds_parent(config):
    class Cloud(MockProvider):
        calls = 0
        async def complete(self, request, model):
            self.calls += 1
            return await super().complete(request, model)
    config.endpoints['cloud'] = EndpointDefinition(provider='mock', cloud=True)
    config.models['cloud'] = config.models['demo'].model_copy(update={
        'id': 'cloud', 'endpoint': 'cloud', 'roles': ('cloud-only',), 'aliases': ()})
    config.agents['reviewer'] = config.agents['reviewer'].model_copy(update={
        'model': 'cloud', 'role': 'cloud-only', 'allow_cloud': True})
    provider = Cloud()
    runtime = AgentRuntime(config, ModelRouter(config, {'cpu': MockProvider(), 'cloud': provider}))
    task = 'tool:' + json.dumps({'name': 'agent.delegate', 'arguments': {'agent_id': 'reviewer', 'task': 'echo:child'}})
    try:
        with pytest.raises(HubError, match='MODEL_UNAVAILABLE'):
            await runtime.run('assistant', task)
        assert provider.calls == 0
        assert (await runtime.run('reviewer', 'echo:explicit-root-opt-in')).output == 'explicit-root-opt-in'
        assert provider.calls == 1
    finally:
        await runtime.close()


async def test_transient_retry_count(config):
    class Transient(MockProvider):
        calls = 0
        async def complete(self, request, model):
            self.calls += 1
            raise HubError('MODEL_UNAVAILABLE', 'Temporary failure', 503, retryable=True)
    config.models['demo'] = config.models['demo'].model_copy(update={'retries': 1})
    provider = Transient()
    router = ModelRouter(config, {'cpu': provider})
    with pytest.raises(HubError, match='MODEL_UNAVAILABLE'):
        await router.complete(RouteRequest(inference=InferenceRequest(messages=[Message(role='user', content='hello')])))
    assert provider.calls == 2 and router.health('demo')['failure_count'] == 2
    assert router.scheduler.snapshot('cpu')['active_requests'] == 0
    await router.close()


@pytest.mark.parametrize('deadline', ['provider', 'root'])
async def test_actual_deadline_releases_inference_and_agent_capacity(config, deadline):
    stopped = asyncio.Event()
    class Slow(MockProvider):
        async def complete(self, request, model):
            try:
                await asyncio.sleep(10)
            finally:
                stopped.set()
            return InferenceResponse(content='late')
    config = config.model_copy(update={'runtime': config.runtime.model_copy(update={'run_timeout': .1 if deadline == 'root' else 5})})
    config.models['demo'] = config.models['demo'].model_copy(update={'timeout': .03 if deadline == 'provider' else 5})
    runtime = AgentRuntime(config, ModelRouter(config, {'cpu': Slow()}))
    try:
        with pytest.raises(HubError, match='MODEL_TIMEOUT' if deadline == 'provider' else 'AGENT_TIMEOUT'):
            await runtime.run('assistant', 'hello')
        assert stopped.is_set()
        assert not any(s.busy for s in runtime.sessions.values())
        assert runtime.router.scheduler.snapshot('cpu')['active_requests'] == 0
        assert runtime.capacity._value == 1
    finally:
        await runtime.close()
