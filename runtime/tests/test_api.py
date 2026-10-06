# trace:verifies FR-023
import json
import logging

import httpx
from local_llm_hub.api import create_app
from local_llm_hub.config import HubConfig


async def test_api_full_mock_path_auth_compatibility_and_logs(config: HubConfig, caplog) -> None:
    app = create_app(config)
    caplog.set_level(logging.INFO, logger='local_llm_hub')
    async with app.router.lifespan_context(app), httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
        assert (await client.get('/health')).json() == {'status': 'ok', 'service': 'local-llm-hub'}
        assert (await client.get('/v1/models')).status_code == 401
        client.headers['Authorization'] = 'Bearer ' + config.runtime.token.get_secret_value()
        assert (await client.get('/v1/models')).json()['data'][0]['id'] == 'demo'
        session = (await client.post('/v1/agents/assistant/sessions')).json()['session_id']
        result = await client.post('/v1/agents/assistant/run', json={'input': 'echo:PROMPT_CANARY', 'session_id': session})
        assert result.status_code == 200 and result.json()['output'] == 'PROMPT_CANARY'
        assert result.headers['x-request-id'] == result.json()['request_id']
        response = await client.post('/v1/chat/completions', json={'model': 'chat',
            'messages': [{'role': 'user', 'content': 'echo:compatible'}]})
        assert response.json()['choices'][0]['message']['content'] == 'compatible'
        assert 'usage' not in response.json()
        for extra in ({'stream': True}, {'tools': []}, {'n': 2}, {'response_format': {}}):
            invalid = await client.post('/v1/chat/completions', json={'messages': [{'role': 'user', 'content': 'x'}], **extra})
            assert invalid.status_code == 422
        invalid = await client.post('/v1/agents/assistant/run', json={'input': 'hello', 'permissions': 'admin'})
        assert invalid.status_code == 422
        missing = await client.post('/v1/agents/missing/run', json={'input': 'hello'})
        assert missing.json()['error']['code'] == 'AGENT_NOT_FOUND'
        detail = await client.get('/v1/health')
        assert detail.json()['models'][0]['last_success']
        assert str(config.runtime.state_path) not in json.dumps(detail.json())
        large = await client.post('/v1/agents/assistant/run', content=b'x' * 262145)
        assert large.status_code == 413
    assert 'PROMPT_CANARY' not in caplog.text
    assert config.runtime.token.get_secret_value() not in caplog.text


async def test_native_capability_discovery(config: HubConfig) -> None:
    app = create_app(config)
    async with app.router.lifespan_context(app), httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
        assert (await client.get('/v1/capabilities')).status_code == 401
        client.headers['Authorization'] = 'Bearer ' + config.runtime.token.get_secret_value()
        response = await client.get('/v1/capabilities')
        assert response.status_code == 200
        assert response.json() == {'contract_version': '0.2.0', 'native_agents': True,
            'transport': 'buffered', 'structured_output': 'tool_schema', 'run_evidence_version': '0.1.0',
            'inference_settings': ['temperature', 'top_p', 'presence_penalty', 'reasoning_effort']}


async def test_native_client_mock_workflow(config: HubConfig, tmp_path) -> None:
    import hashlib

    from test_agent_runtime import scripted_runtime

    (tmp_path / 'context.txt').write_bytes(b'synthetic context')
    runtime, captured = scripted_runtime(config, [{'read': 'context.txt'}, {'raw': '{ "answer": 42 }'}])
    app = create_app(config, runtime)
    # No lifespan health probes: all HTTP is explicit in-process ASGI/MockTransport.
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test',
                headers={'Authorization': 'Bearer ' + config.runtime.token.get_secret_value()}) as client:
            assert (await client.get('/v1/capabilities')).json()['contract_version'] == '0.2.0'
            session = (await client.post('/v1/agents/assistant/sessions')).json()['session_id']
            response = await client.post('/v1/agents/assistant/run', json={'input': 'read fixture', 'session_id': session})
            assert response.status_code == 200, response.text
            body = response.json()
            assert body['output'] == {'answer': 42}
            assert body['evidence']['session_id'] == session
            assert body['evidence']['request_id'] == response.headers['x-request-id'] == body['request_id']
            assert body['evidence']['reads'][0]['sha256'] == hashlib.sha256(b'synthetic context').hexdigest()
            assert len(captured) == 2
    finally:
        await runtime.close()


async def test_legacy_api_and_isolation_regression(config: HubConfig) -> None:
    app = create_app(config)
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test',
                headers={'Authorization': 'Bearer ' + config.runtime.token.get_secret_value()}) as client:
            first = (await client.post('/v1/agents/assistant/run', json={'input': 'echo:legacy'})).json()
            assert set(first) == {'request_id', 'session_id', 'agent_id', 'model_id', 'output'}
            for extra in ({'inference_settings': {}}, {'emit_run_evidence': True}, {'output_schema': {}}):
                assert (await client.post('/v1/agents/assistant/run', json={'input': 'x', **extra})).status_code == 422
            response = await client.post('/v1/agents/reviewer/run', json={'input': 'x', 'session_id': first['session_id']})
            assert response.status_code == 404
            for extra in ({'stream': True}, {'tools': []}, {'response_format': {}}):
                assert (await client.post('/v1/chat/completions', json={
                    'messages': [{'role': 'user', 'content': 'x'}], **extra})).status_code == 422
    finally:
        await app.state.hub.close()
