# trace:verifies FR-023
import os

import pytest
from local_llm_hub.config import EndpointDefinition
from local_llm_hub.models import InferenceRequest, Message, ModelDefinition
from local_llm_hub.providers import OpenAICompatibleProvider
from pydantic import SecretStr


@pytest.mark.integration
@pytest.mark.skipif(os.environ.get('LOCAL_LLM_INTEGRATION_TEST') != '1', reason='Live inference explicitly disabled')
async def test_real_openai_compatible_endpoint():
    base = os.environ.get('LOCAL_MODEL_BASE_URL')
    model = os.environ.get('LOCAL_MODEL_NAME')
    assert base and model, 'Enabled integration requires explicit endpoint and model'
    key = os.environ.get('LOCAL_MODEL_API_KEY')
    provider = OpenAICompatibleProvider(EndpointDefinition(provider='openai-compatible', base_url=base,
        api_key=SecretStr(key) if key else None))
    try:
        result = await provider.complete(InferenceRequest(messages=[Message(role='user', content='Reply with a short greeting.')],
            max_tokens=32), ModelDefinition(id='live', endpoint='live', model=model, timeout=30))
        assert result.content.strip()
    finally:
        await provider.close()
