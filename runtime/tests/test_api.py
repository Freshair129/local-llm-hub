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
