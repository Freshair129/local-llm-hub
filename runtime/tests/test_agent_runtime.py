# trace:verifies FR-020
import asyncio
import json

import pytest
from local_llm_hub.agents import AgentRuntime
from local_llm_hub.config import HubConfig
from local_llm_hub.errors import HubError
from local_llm_hub.models import InferenceResponse
from local_llm_hub.providers import MockProvider
from local_llm_hub.router import ModelRouter


def tool(name: str, **arguments: object) -> str:
    return 'tool:' + json.dumps({'name': name, 'arguments': arguments})


async def test_real_sdk_loop_tools_sessions_and_structured_output(config: HubConfig) -> None:
    runtime = AgentRuntime(config)
    try:
        first = await runtime.run('assistant', 'echo:hello')
        second = await runtime.run('assistant', 'echo:separate')
        assert first.output == 'hello' and second.output == 'separate'
        assert first.session_id != second.session_id and first.usage is None
        stored = await runtime.run('assistant', tool('memory.store', key='x', value='secret'), first.session_id)
        assert 'secret' in stored.output
        with pytest.raises(HubError, match='MEMORY_NOT_FOUND'):
            await runtime.run('assistant', tool('memory.retrieve', key='x'), second.session_id)
        with pytest.raises(HubError, match='SESSION_NOT_FOUND'):
            await runtime.run('reviewer', 'hello', first.session_id)
        configured = config.agents['assistant'].model_copy(update={'tools': (), 'output_schema': {
            'type': 'object', 'properties': {'count': {'type': 'integer'}}, 'required': ['count'], 'additionalProperties': False}})
        runtime.config.agents['json'] = configured.model_copy(update={'id': 'json'})
        result = await runtime.run('json', 'json:{"count": 3}')
        assert result.output == {'count': 3}
        with pytest.raises(HubError, match='MODEL_RESPONSE_INVALID'):
            await runtime.run('json', 'json:{"count": "invalid"}')
    finally:
        await runtime.close()


async def test_delegation_releases_single_endpoint_and_limits_depth(config: HubConfig) -> None:
    runtime = AgentRuntime(config)
    try:
        result = await asyncio.wait_for(runtime.run('assistant', tool('agent.delegate', agent_id='reviewer', task='echo:child')), 3)
        assert 'child' in result.output
        assert runtime.router.scheduler.snapshot('cpu') == {'active_requests': 0, 'queued_requests': 0}
        nested = 'echo:end'
        for _ in range(3):
            nested = tool('agent.delegate', agent_id='assistant', task=nested)
            assert 'end' in (await runtime.run('assistant', nested)).output
        nested = tool('agent.delegate', agent_id='assistant', task=nested)
        with pytest.raises(HubError, match='DELEGATION_DEPTH_EXCEEDED'):
            await runtime.run('assistant', nested)
        assert not any(s.busy for s in runtime.sessions.values())
        assert not any(s.delegated for s in runtime.sessions.values())
    finally:
        await runtime.close()


async def test_busy_session_cancellation_and_root_budget(config: HubConfig) -> None:
    started = asyncio.Event()
    class Slow(MockProvider):
        async def complete(self, request, model):
            started.set()
            await asyncio.sleep(10)
            return InferenceResponse(content='late')
    runtime = AgentRuntime(config, ModelRouter(config, {'cpu': Slow()}))
    session = runtime.create_session('assistant')
    task = asyncio.create_task(runtime.run('assistant', 'hello', session.id))
    await started.wait()
    with pytest.raises(HubError, match='SESSION_BUSY'):
        await runtime.run('assistant', 'hello', session.id)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert not session.busy and runtime.capacity._value == 1
    assert runtime.router.scheduler.snapshot('cpu')['active_requests'] == 0
    await runtime.close()
    limited = config.model_copy(update={'runtime': config.runtime.model_copy(update={'max_model_requests': 1})})
    runtime = AgentRuntime(limited)
    try:
        with pytest.raises(HubError, match='AGENT_BUDGET_EXCEEDED'):
            await runtime.run('assistant', tool('agent.delegate', agent_id='reviewer', task='echo:child'))
    finally:
        await runtime.close()
