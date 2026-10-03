# trace:verifies FR-019
import asyncio

import httpx
import pytest
from local_llm_hub.config import EndpointDefinition, HubConfig
from local_llm_hub.context import ContextManager
from local_llm_hub.errors import HubError
from local_llm_hub.models import (
    Capabilities,
    InferenceRequest,
    InferenceResponse,
    Message,
    ModelDefinition,
    RouteRequest,
)
from local_llm_hub.providers import MockProvider, OpenAICompatibleProvider
from local_llm_hub.router import ModelRouter
from local_llm_hub.scheduler import EndpointScheduler


def request(model='auto', required=()) -> RouteRequest:
    return RouteRequest(model=model, required=required,
                        inference=InferenceRequest(messages=[Message(role='user', content='echo:hello')]))


async def test_role_alias_and_capability(config: HubConfig) -> None:
    router = ModelRouter(config)
    assert (await router.complete(request('chat'))).model_id == 'demo'
    assert (await router.complete(request())).response.content == 'hello'
    with pytest.raises(HubError, match='MODEL_CAPABILITY_MISMATCH'):
        await router.complete(request(required=('vision',)))
    assert router.health('demo')['last_success'] is not None
    await router.close()


async def test_fallback_and_error_policy(config: HubConfig) -> None:
    class Failing(MockProvider):
        async def complete(self, request, model):
            raise HubError('MODEL_TIMEOUT', 'timed out', 504, retryable=True)
    models = dict(config.models)
    models['demo'] = models['demo'].model_copy(update={'fallbacks': ('backup',)})
    models['backup'] = ModelDefinition(id='backup', endpoint='other', model='backup',
        capabilities=Capabilities(tool_calling=True, context_length=8192))
    config = config.model_copy(update={'models': models, 'endpoints': {
        **config.endpoints, 'other': EndpointDefinition(provider='mock')}})
    router = ModelRouter(config, {'cpu': Failing(), 'other': MockProvider()})
    assert (await router.complete(request('chat', ('tool_calling',)))).model_id == 'backup'
    assert router.health('demo')['failure_count'] == 1
    config = config.model_copy(update={'endpoints': {
        **config.endpoints, 'other': EndpointDefinition(provider='mock', cloud=True)}})
    router2 = ModelRouter(config, {'cpu': Failing(), 'other': MockProvider()})
    with pytest.raises(HubError, match='MODEL_TIMEOUT'):
        await router2.complete(request('chat'))


async def test_shared_pool_queue_cancel_and_cleanup() -> None:
    scheduler = EndpointScheduler({'cpu': EndpointDefinition(provider='mock', max_queue=1)})
    entered, release = asyncio.Event(), asyncio.Event()
    async def hold():
        async with scheduler.lease('cpu', 1):
            entered.set()
            await release.wait()
    first = asyncio.create_task(hold())
    await entered.wait()
    second = asyncio.create_task(hold())
    await asyncio.sleep(0)
    assert scheduler.snapshot('cpu') == {'active_requests': 1, 'queued_requests': 1}
    with pytest.raises(HubError, match='MODEL_BUSY'):
        async with scheduler.lease('cpu', 0.01):
            pytest.fail('must not enter')
    second.cancel()
    with pytest.raises(asyncio.CancelledError):
        await second
    with pytest.raises(HubError, match='MODEL_TIMEOUT'):
        async with scheduler.lease('cpu', 0.01):
            pytest.fail('must not enter')
    first.cancel()
    with pytest.raises(asyncio.CancelledError):
        await first
    assert scheduler.snapshot('cpu') == {'active_requests': 0, 'queued_requests': 0}


def test_context_evicts_complete_old_turns_and_pins_latest() -> None:
    ctx = ContextManager()
    messages = [Message(role='system', content='policy'), Message(role='user', content='a' * 2000),
                Message(role='assistant', content='old'), Message(role='user', content='latest')]
    result = ctx.prepare(InferenceRequest(messages=messages, max_tokens=50), 600)
    assert [m.content for m in result.messages] == ['policy', 'latest']
    with pytest.raises(HubError, match='CONTEXT_LIMIT'):
        ctx.prepare(InferenceRequest(messages=[Message(role='user', content='x' * 1000)], max_tokens=50), 600)


@pytest.mark.parametrize('status,code', [(401, 'MODEL_AUTH_ERROR'), (429, 'MODEL_UNAVAILABLE'), (500, 'MODEL_UNAVAILABLE')])
async def test_http_errors_never_echo_provider_body(status, code) -> None:
    client = httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(status, text='SECRET-CANARY')))
    provider = OpenAICompatibleProvider(EndpointDefinition(provider='openai-compatible', base_url='http://provider.invalid/v1'), client)
    with pytest.raises(HubError, match=code) as error:
        await provider.complete(request().inference, ModelDefinition(id='x', endpoint='e', model='x'))
    assert 'SECRET-CANARY' not in str(error.value)
    await provider.close()


async def test_http_transport_request_and_malformed_reply() -> None:
    requests = []
    def respond(req):
        requests.append(req)
        return httpx.Response(200, json={'choices': [{'message': {'content': 'ok'}, 'finish_reason': 'stop'}]})
    provider = OpenAICompatibleProvider(EndpointDefinition(provider='openai-compatible', base_url='http://provider.invalid/v1'),
        httpx.AsyncClient(transport=httpx.MockTransport(respond)))
    response = await provider.complete(request().inference, ModelDefinition(id='x', endpoint='e', model='upstream'))
    assert response == InferenceResponse(content='ok')
    assert str(requests[0].url) == 'http://provider.invalid/v1/chat/completions'
    await provider.close()
