# trace:implements FR-023
import asyncio
import hmac
import json
import logging
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress
from typing import Any, Literal
from uuid import uuid4

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import Field
from starlette.types import ASGIApp, Receive, Scope, Send
from starlette.types import Message as ASGIMessage

from .agents import AgentRuntime
from .config import HubConfig
from .errors import HubError
from .models import InferenceRequest, Message, RouteRequest, StrictModel

logger = logging.getLogger('local_llm_hub')
BODY_LIMIT = 262144


class RunInput(StrictModel):
    input: str = Field(min_length=1, max_length=65536)
    session_id: str | None = Field(default=None, max_length=80)


class TextMessage(StrictModel):
    role: Literal['system', 'user', 'assistant']
    content: str = Field(max_length=65536)


class ChatInput(StrictModel):
    model: str = Field(default='auto', max_length=80)
    messages: list[TextMessage] = Field(min_length=1, max_length=256)
    temperature: float = Field(default=0.2, ge=0, le=2)
    max_tokens: int = Field(default=1024, gt=0, le=131072)
    stream: Literal[False] = False


class RequestBoundary:
    """Bound bytes even for chunked bodies; cancellation owns the request's whole run."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope['type'] != 'http':
            await self.app(scope, receive, send)
            return
        request_id = uuid4().hex
        scope.setdefault('state', {})['request_id'] = request_id
        chunks: list[ASGIMessage] = []
        size = 0
        while True:
            message = await receive()
            if message['type'] == 'http.disconnect':
                return
            size += len(message.get('body', b''))
            if size > BODY_LIMIT:
                await JSONResponse({'error': {'code': 'REQUEST_TOO_LARGE', 'message': 'Request body limit exceeded',
                    'request_id': request_id}}, status_code=413)(scope, receive, send)
                return
            chunks.append(message)
            if not message.get('more_body', False):
                break
        delivered = False
        disconnected = asyncio.Event()
        async def body() -> ASGIMessage:
            nonlocal delivered
            if not delivered:
                delivered = True
                return {'type': 'http.request', 'body': b''.join(c.get('body', b'') for c in chunks), 'more_body': False}
            await disconnected.wait()
            return {'type': 'http.disconnect'}
        async def watch_disconnect() -> None:
            while True:
                if (await receive())['type'] == 'http.disconnect':
                    disconnected.set()
                    return
        async def with_headers(message: ASGIMessage) -> None:
            if message['type'] == 'http.response.start':
                message['headers'] = [*message.get('headers', []), (b'x-request-id', request_id.encode())]
            await send(message)
        async def invoke() -> None:
            await self.app(scope, body, with_headers)
        app_task = asyncio.create_task(invoke())
        watcher = asyncio.create_task(watch_disconnect())
        try:
            done, _ = await asyncio.wait({app_task, watcher}, return_when=asyncio.FIRST_COMPLETED)
            if app_task in done:
                await app_task
            else:
                app_task.cancel()
        finally:
            for task in (app_task, watcher):
                if not task.done():
                    task.cancel()
            await asyncio.gather(app_task, watcher, return_exceptions=True)


def create_app(config: HubConfig, runtime: AgentRuntime | None = None) -> FastAPI:
    hub = runtime or AgentRuntime(config)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        async def monitor() -> None:
            while True:
                await hub.router.probe()
                await asyncio.sleep(config.runtime.health_interval)
        task = asyncio.create_task(monitor())
        try:
            yield
        finally:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task
            await hub.close()

    app = FastAPI(title='Local LLM Hub', version='0.1.0', lifespan=lifespan,
                  docs_url=None, redoc_url=None, openapi_url=None)
    app.state.hub = hub
    app.add_middleware(RequestBoundary)

    async def authorized(request: Request) -> None:
        token = request.headers.get('authorization', '')
        expected = 'Bearer ' + config.runtime.token.get_secret_value()
        if not hmac.compare_digest(token.encode(), expected.encode()):
            raise HubError('AUTH_REQUIRED', 'A valid bearer token is required', 401)

    secured = [Depends(authorized)]

    @app.get('/v1/capabilities', dependencies=secured)
    async def capabilities() -> dict[str, Any]:
        return {'contract_version': '0.2.0', 'native_agents': True, 'transport': 'buffered',
            'structured_output': 'tool_schema', 'run_evidence_version': '0.1.0',
            'inference_settings': ['temperature', 'top_p', 'presence_penalty', 'reasoning_effort']}

    @app.exception_handler(HubError)
    async def hub_error(request: Request, error: HubError) -> JSONResponse:
        rid = request.state.request_id
        logger.warning(json.dumps({'event': 'request_failed', 'request_id': rid, 'code': error.code}))
        return JSONResponse({'error': {'code': error.code, 'message': error.message,
            'request_id': rid, 'details': error.details}}, status_code=error.status)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, error: RequestValidationError) -> JSONResponse:
        fields = ['.'.join(map(str, item['loc'])) for item in error.errors()]
        code = 'UNSUPPORTED_PARAMETER' if any(e['type'] == 'extra_forbidden' for e in error.errors()) else 'INVALID_REQUEST'
        return await hub_error(request, HubError(code, 'Request fields failed validation', 422, details={'fields': fields}))

    @app.exception_handler(Exception)
    async def unexpected_error(request: Request, error: Exception) -> JSONResponse:
        # Do not expose exception text/tracebacks, which may include provider bodies or prompt data.
        return await hub_error(request, HubError('INTERNAL_ERROR', 'Runtime operation failed', 500))

    @app.get('/health')
    async def health() -> dict[str, str]:
        return {'status': 'ok', 'service': 'local-llm-hub'}

    @app.get('/v1/health', dependencies=secured)
    async def detailed_health() -> dict[str, Any]:
        return {'status': 'ok', 'models': [hub.router.health(m.id) for m in hub.router.registry.list()],
                'agent_queue': hub.queued, 'sessions': len(hub.sessions)}

    @app.get('/models', dependencies=secured)
    @app.get('/v1/models', dependencies=secured)
    async def models() -> dict[str, Any]:
        return {'object': 'list', 'data': [{'id': m.id, 'object': 'model', 'owned_by': 'local-llm-hub',
            'aliases': m.aliases, 'roles': m.roles, 'capabilities': m.capabilities.model_dump(),
            'enabled': m.enabled} for m in hub.router.registry.list()]}

    @app.get('/models/{model_id}/health', dependencies=secured)
    @app.get('/v1/models/{model_id}/health', dependencies=secured)
    async def model_health(model_id: str) -> dict[str, Any]:
        return hub.router.health(model_id)

    @app.get('/v1/agents', dependencies=secured)
    async def agents() -> dict[str, Any]:
        return {'data': [{'id': a.id, 'role': a.role, 'model': a.model, 'tools': a.tools}
                        for a in config.agents.values()]}

    @app.post('/v1/agents/{agent_id}/sessions', dependencies=secured, status_code=201)
    async def sessions(agent_id: str, request: Request) -> dict[str, str]:
        if await request.body() not in (b'', b'{}'):
            raise HubError('UNSUPPORTED_PARAMETER', 'Session creation accepts no parameters', 422)
        session = hub.create_session(agent_id)
        return {'session_id': session.id, 'agent_id': agent_id}

    @app.post('/v1/agents/{agent_id}/run', dependencies=secured)
    async def run(agent_id: str, body: RunInput, request: Request) -> dict[str, Any]:
        result = await hub.run(agent_id, body.input, body.session_id, request.state.request_id)
        output = result.model_dump(exclude_none=True)
        if result.evidence is not None:
            evidence = result.evidence.model_dump()
            for attempt, original in zip(evidence['provider_attempts'], result.evidence.provider_attempts, strict=True):
                attempt['sent_settings'] = original.sent_settings.model_dump(exclude_none=True)
            output['evidence'] = evidence
        return output

    @app.post('/v1/chat/completions', dependencies=secured)
    async def chat(body: ChatInput, request: Request) -> dict[str, Any]:
        result = await hub.router.complete(RouteRequest(model=body.model,
            inference=InferenceRequest(messages=[Message(role=m.role, content=m.content) for m in body.messages],
                temperature=body.temperature, max_tokens=body.max_tokens), timeout=config.runtime.run_timeout))
        response = result.response
        if response.tool_calls:
            raise HubError('MODEL_RESPONSE_INVALID', 'Unexpected tools in text-only completion', 502)
        output: dict[str, Any] = {'id': f'chatcmpl-{request.state.request_id}', 'object': 'chat.completion',
            'created': int(time.time()), 'model': result.model_id, 'choices': [{'index': 0,
                'message': {'role': 'assistant', 'content': response.content}, 'finish_reason': response.finish_reason}]}
        if response.usage:
            output['usage'] = {'prompt_tokens': response.usage.input_tokens, 'completion_tokens': response.usage.output_tokens,
                'total_tokens': response.usage.input_tokens + response.usage.output_tokens}
        return output

    return app
