# trace:verifies FR-020
import asyncio
import hashlib
import json

import httpx
import pytest
from local_llm_hub.agents import AgentRuntime
from local_llm_hub.config import HubConfig
from local_llm_hub.errors import HubError
from local_llm_hub.models import InferenceResponse
from local_llm_hub.providers import MockProvider, OpenAICompatibleProvider
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


def scripted_runtime(config, steps, *, schema=True, evidence=True):
    """Real SDK/HTTP adapter; synthetic in-process upstream, never a live model."""
    agent = config.agents['assistant']
    config.agents['assistant'] = agent.model_copy(update={'emit_run_evidence': evidence,
        'output_schema': {'type': 'object', 'properties': {'answer': {'type': 'integer'}},
            'required': ['answer'], 'additionalProperties': False} if schema else None})
    captured = []
    def respond(req):
        payload = json.loads(req.content)
        captured.append(payload)
        step = steps.pop(0)
        if 'status' in step:
            return httpx.Response(step['status'], text='PRIVATE_PROVIDER_CANARY')
        if 'text' in step:
            message = {'content': step['text']}
        else:
            calls = []
            if 'read' in step:
                calls.append({'id': 'read-' + str(len(captured)), 'type': 'function', 'function': {
                    'name': 'filesystem__read', 'arguments': json.dumps({'path': step['read']})}})
            if 'raw' in step:
                name = next(t['function']['name'] for t in payload['tools'] if t['function']['name'].startswith('final_result'))
                calls.append({'id': 'final', 'type': 'function', 'function': {'name': name, 'arguments': step['raw']}})
                if step.get('duplicate'):
                    calls.append({**calls[-1], 'id': 'second-final'})
            message = {'content': None, 'tool_calls': calls}
        return httpx.Response(200, json={'choices': [{'message': message,
            'finish_reason': step.get('finish', 'stop' if 'text' in step else 'tool_calls')}]})
    endpoint = config.endpoints['cpu'].model_copy(update={'provider': 'openai-compatible',
        'base_url': 'http://provider.invalid/v1'})
    config.endpoints['cpu'] = endpoint
    provider = OpenAICompatibleProvider(endpoint, httpx.AsyncClient(transport=httpx.MockTransport(respond)))
    return AgentRuntime(config, ModelRouter(config, {'cpu': provider})), captured


@pytest.mark.parametrize('step,valid', [
    ({'raw': '{ "answer": 42 }'}, True), ({'text': '```json\n{"answer":42}\n```'}, False),
    ({'raw': '{"answer":"bad"}'}, False), ({'raw': '{"answer":42}', 'duplicate': True}, False),
    ({'raw': '{"answer":42}', 'read': 'missing.txt'}, False),
    ({'raw': '{"answer":42}', 'finish': 'length'}, False),
])
async def test_structured_final_boundary(config, step, valid) -> None:
    runtime, captured = scripted_runtime(config, [step])
    try:
        if valid:
            assert (await runtime.run('assistant', 'fixture')).output == {'answer': 42}
        else:
            with pytest.raises(HubError, match='MODEL_RESPONSE_INVALID'):
                await runtime.run('assistant', 'fixture')
        assert len(captured) == 1
    finally:
        await runtime.close()


async def test_run_evidence_binding_and_opt_out(config) -> None:
    raw = '{ "answer" : 42 }'
    runtime, _ = scripted_runtime(config, [{'raw': raw}, {'raw': raw}], evidence=True)
    try:
        result = await runtime.run('assistant', 'ข้อมูล fixture', request_id='known-request')
        ev = result.evidence
        assert ev.request_id == result.request_id == 'known-request'
        assert ev.session_id == result.session_id and ev.agent_id == result.agent_id
        assert ev.input_sha256 == hashlib.sha256('ข้อมูล fixture'.encode()).hexdigest()
        schema = config.agents['assistant'].output_schema
        assert ev.output_schema_sha256 == hashlib.sha256(json.dumps(schema,
            sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode()).hexdigest()
        assert ev.final_arguments_sha256 == hashlib.sha256(raw.encode()).hexdigest()
        assert ev.output_kind == 'tool_schema' and ev.version == '0.1.0'
        config.agents['assistant'] = config.agents['assistant'].model_copy(update={'emit_run_evidence': False})
        assert 'evidence' not in (await runtime.run('assistant', 'again')).model_dump(exclude_none=True)
    finally:
        await runtime.close()


async def test_current_run_read_evidence(config, tmp_path) -> None:
    content = 'บริบท current run\r\n'
    (tmp_path / 'input.txt').write_bytes(content.encode())
    runtime, captured = scripted_runtime(config, [{'read': './input.txt'}, {'raw': '{"answer":42}'},
        {'raw': '{"answer":42}'}])
    try:
        result = await runtime.run('assistant', 'read then answer')
        read = result.evidence.reads[0]
        assert read.path == 'input.txt' and read.root == 0 and read.tool_call_id == 'read-1'
        assert read.sha256 == hashlib.sha256(content.encode()).hexdigest()
        assert read.returned_bytes == len(content.encode()) and read.truncated is False
        observed = next(m for m in captured[1]['messages'] if m['role'] == 'tool')
        assert json.loads(observed['content'])['data']['text'] == content
        second = await runtime.run('assistant', 'again', result.session_id)
        assert second.evidence.reads == []
    finally:
        await runtime.close()


async def test_attempt_accounting_and_privacy(config, caplog) -> None:
    config.models['demo'] = config.models['demo'].model_copy(update={'retries': 1})
    runtime, captured = scripted_runtime(config, [{'status': 500}, {'raw': '{"answer":42}'}])
    try:
        result = await runtime.run('assistant', 'PRIVATE_INPUT_CANARY')
        attempts = result.evidence.provider_attempts
        assert [a.outcome for a in attempts] == ['error', 'success']
        assert [a.ordinal for a in attempts] == [1, 2]
        assert all(a.model_id == 'demo' and a.sent_settings.temperature == 0.2 for a in attempts)
        assert len(captured) == 2 and result.usage is None
        public = result.model_dump_json() + caplog.text
        for private in ('PRIVATE_INPUT_CANARY', 'PRIVATE_PROVIDER_CANARY',
                config.runtime.token.get_secret_value(), str(config.projects['demo'].roots[0])):
            assert private not in public
    finally:
        await runtime.close()


async def test_schema_pass_is_not_business_acceptance(config) -> None:
    schema = {'type': 'object', 'properties': {'headline': {'type': 'string'}, 'source': {'type': 'string'}},
        'required': ['headline', 'source'], 'additionalProperties': False}
    raw = '{"headline":"unchanged original","source":"not in context"}'
    runtime, _ = scripted_runtime(config, [{'raw': raw}])
    config.agents['assistant'] = config.agents['assistant'].model_copy(update={'output_schema': schema})
    try:
        result = await runtime.run('assistant', 'synthetic editing fixture')
        assert result.output == json.loads(raw)
        assert result.evidence.output_kind == 'tool_schema'
        assert not {'marketing_pass', 'approved', 'business_pass'} & result.model_dump().keys()
        assert not {'marketing_pass', 'approved', 'business_pass'} & result.evidence.model_dump().keys()
    finally:
        await runtime.close()


async def test_agent_settings_survive_sdk_and_context(config) -> None:
    from local_llm_hub.models import InferenceSettings

    runtime, captured = scripted_runtime(config, [{'raw': '{"answer":42}'}])
    config.endpoints['cpu'] = config.endpoints['cpu'].model_copy(update={
        'supported_inference_settings': ('top_p', 'presence_penalty', 'reasoning_effort')})
    runtime.router.providers['cpu'].endpoint = config.endpoints['cpu']
    config.agents['assistant'] = config.agents['assistant'].model_copy(update={
        'inference_settings': InferenceSettings(temperature=1, top_p=0.95,
            presence_penalty=1.5, reasoning_effort='none'), 'max_tokens': 2048})
    try:
        result = await runtime.run('assistant', 'x')
        expected = {'temperature': 1, 'top_p': 0.95, 'presence_penalty': 1.5,
            'reasoning_effort': 'none', 'max_tokens': 2048}
        assert {k: captured[0][k] for k in expected} == expected
        assert result.evidence.provider_attempts[0].sent_settings.model_dump(exclude_none=True) == expected
    finally:
        await runtime.close()


async def test_delegated_reads_are_not_parent_evidence(config, tmp_path) -> None:
    (tmp_path / 'child.txt').write_text('child-only')
    config.agents['assistant'] = config.agents['assistant'].model_copy(update={'emit_run_evidence': True})
    config.agents['reviewer'] = config.agents['reviewer'].model_copy(update={'emit_run_evidence': True})
    runtime = AgentRuntime(config)
    try:
        result = await runtime.run('assistant', tool('agent.delegate', agent_id='reviewer',
            task=tool('filesystem.read', path='child.txt')))
        assert 'child-only' in result.output
        assert result.evidence.reads == []
        assert len(result.evidence.provider_attempts) == 2
        assert result.evidence.output_schema_sha256 is None and result.evidence.final_arguments_sha256 is None
        assert not any(s.delegated for s in runtime.sessions.values())
    finally:
        await runtime.close()


async def test_concurrent_evidence_isolated_and_bounded(config, tmp_path) -> None:
    (tmp_path / 'a.txt').write_text('alpha')
    (tmp_path / 'b.txt').write_text('beta')
    config.agents['assistant'] = config.agents['assistant'].model_copy(update={'emit_run_evidence': True})
    config = config.model_copy(update={'runtime': config.runtime.model_copy(update={'agent_concurrency': 2})})
    runtime = AgentRuntime(config)
    try:
        a, b = await asyncio.gather(runtime.run('assistant', tool('filesystem.read', path='a.txt')),
            runtime.run('assistant', tool('filesystem.read', path='b.txt')))
        assert a.evidence.session_id != b.evidence.session_id
        assert [r.path for r in a.evidence.reads] == ['a.txt']
        assert [r.path for r in b.evidence.reads] == ['b.txt']
        for result in (a, b):
            assert len(result.evidence.provider_attempts) == 2
            assert [x.ordinal for x in result.evidence.provider_attempts] == [1, 2]
            assert len(result.evidence.reads) <= config.runtime.max_tool_calls
    finally:
        await runtime.close()


async def test_evidence_budget_discards_failed_run(config) -> None:
    config.agents['assistant'] = config.agents['assistant'].model_copy(update={'emit_run_evidence': True})
    limited = config.model_copy(update={'runtime': config.runtime.model_copy(update={'max_model_requests': 1})})
    runtime = AgentRuntime(limited)
    try:
        with pytest.raises(HubError, match='AGENT_BUDGET_EXCEEDED'):
            await runtime.run('assistant', tool('agent.delegate', agent_id='reviewer', task='echo:child'))
        assert (await runtime.run('assistant', 'echo:next')).evidence.provider_attempts[0].ordinal == 1
    finally:
        await runtime.close()


async def test_fallback_attempt_evidence(config) -> None:
    from local_llm_hub.config import EndpointDefinition

    class Failing(MockProvider):
        async def complete(self, request, model):
            raise HubError('MODEL_TIMEOUT', 'mock timeout', 504, retryable=True)
    config.agents['assistant'] = config.agents['assistant'].model_copy(update={'emit_run_evidence': True, 'model': 'demo'})
    config.endpoints['other'] = EndpointDefinition(provider='mock')
    config.models['demo'] = config.models['demo'].model_copy(update={'fallbacks': ('backup',)})
    config.models['backup'] = config.models['demo'].model_copy(update={
        'id': 'backup', 'endpoint': 'other', 'aliases': (), 'fallbacks': ()})
    runtime = AgentRuntime(config, ModelRouter(config, {'cpu': Failing(), 'other': MockProvider()}))
    try:
        result = await runtime.run('assistant', 'echo:done')
        assert result.model_id == 'backup' and result.output == 'done'
        assert [(a.model_id, a.outcome) for a in result.evidence.provider_attempts] == [
            ('demo', 'error'), ('backup', 'success')]
    finally:
        await runtime.close()


async def test_cancelled_evidence_does_not_leak_into_next_run(config) -> None:
    entered = asyncio.Event()
    class OnceSlow(MockProvider):
        async def complete(self, request, model):
            if not entered.is_set():
                entered.set()
                await asyncio.sleep(10)
            return await super().complete(request, model)
    config.agents['assistant'] = config.agents['assistant'].model_copy(update={'emit_run_evidence': True})
    runtime = AgentRuntime(config, ModelRouter(config, {'cpu': OnceSlow()}))
    session = runtime.create_session('assistant')
    try:
        task = asyncio.create_task(runtime.run('assistant', 'echo:cancel', session.id))
        await entered.wait()
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
        result = await runtime.run('assistant', 'echo:next', session.id)
        assert result.output == 'next'
        assert len(result.evidence.provider_attempts) == 1
        assert result.evidence.provider_attempts[0].ordinal == 1
        assert result.evidence.provider_attempts[0].outcome == 'success'
        assert result.evidence.reads == [] and runtime.capacity._value == 1
        assert runtime.router.scheduler.snapshot('cpu')['active_requests'] == 0
    finally:
        await runtime.close()


@pytest.mark.parametrize('raw', ['{"answer":1,"answer":42}', '{"answer":NaN}'])
async def test_mock_structured_json_uses_same_strict_boundary(config, raw) -> None:
    config.agents['assistant'] = config.agents['assistant'].model_copy(update={
        'output_schema': {'type': 'object', 'properties': {'answer': {'type': 'number'}}, 'required': ['answer']}})
    runtime = AgentRuntime(config)
    try:
        with pytest.raises(HubError, match='MODEL_RESPONSE_INVALID'):
            await runtime.run('assistant', 'json:' + raw)
    finally:
        await runtime.close()
