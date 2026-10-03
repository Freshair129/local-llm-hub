# trace:implements FR-019
import json
import time
from typing import Any, Protocol
from uuid import uuid4

import httpx
from pydantic import ValidationError

from .config import EndpointDefinition
from .errors import HubError
from .models import (
    InferenceRequest,
    InferenceResponse,
    ModelDefinition,
    ProbeResult,
    ToolCall,
    Usage,
)


class Provider(Protocol):
    async def complete(self, request: InferenceRequest, model: ModelDefinition) -> InferenceResponse: ...
    async def health(self, model: ModelDefinition) -> ProbeResult: ...
    async def close(self) -> None: ...


class CapabilityProbe(Protocol):
    """Opt-in probe boundary; discovery does not authorize capabilities or tools."""

    async def probe(self, provider: Provider, model: ModelDefinition) -> dict[str, bool | None]: ...


class MockProvider:
    """Explicit CPU test/demo provider. Directives are only interpreted in mock mode."""

    async def complete(self, request: InferenceRequest, model: ModelDefinition) -> InferenceResponse:
        last = request.messages[-1] if request.messages else None
        if last and last.role == 'tool':
            return InferenceResponse(content=f'Tool result: {last.content}')
        text = next((m.content for m in reversed(request.messages) if m.role == 'user'), '')
        if text.startswith('tool:'):
            try:
                data = json.loads(text[5:])
                call = ToolCall(id=uuid4().hex, name=data['name'].replace('.', '__'), arguments=data.get('arguments', {}))
            except (ValueError, TypeError, KeyError, ValidationError) as error:
                raise HubError('MODEL_RESPONSE_INVALID', 'Invalid mock tool directive', 502) from error
            return InferenceResponse(tool_calls=[call], finish_reason='tool_calls')
        if text.startswith('json:'):
            try:
                value = json.loads(text[5:])
            except ValueError as error:
                raise HubError('MODEL_RESPONSE_INVALID', 'Invalid mock JSON directive', 502) from error
            output_tool = next((t for t in request.tools if t.name.startswith('final_result')), None)
            if output_tool and isinstance(value, dict):
                return InferenceResponse(tool_calls=[ToolCall(id=uuid4().hex, name=output_tool.name, arguments=value)], finish_reason='tool_calls')
            return InferenceResponse(content=json.dumps(value))
        return InferenceResponse(content=text[5:] if text.startswith('echo:') else f'Mock: {text}')

    async def health(self, model: ModelDefinition) -> ProbeResult:
        return ProbeResult(available=True, latency_ms=0)

    async def close(self) -> None:
        pass


class OpenAICompatibleProvider:
    def __init__(self, endpoint: EndpointDefinition, client: httpx.AsyncClient | None = None) -> None:
        self.endpoint = endpoint
        self.client = client or httpx.AsyncClient(trust_env=False, follow_redirects=False)

    def headers(self) -> dict[str, str]:
        key = self.endpoint.api_key
        return {'Authorization': f'Bearer {key.get_secret_value()}'} if key else {}

    async def complete(self, request: InferenceRequest, model: ModelDefinition) -> InferenceResponse:
        messages: list[dict[str, Any]] = []
        for message in request.messages:
            item: dict[str, Any] = {'role': message.role, 'content': message.content}
            if message.tool_call_id:
                item['tool_call_id'] = message.tool_call_id
            if message.tool_calls:
                item['tool_calls'] = [{'id': t.id, 'type': 'function', 'function': {
                    'name': t.name, 'arguments': json.dumps(t.arguments)}} for t in message.tool_calls]
            messages.append(item)
        payload: dict[str, Any] = {'model': model.model, 'messages': messages, 'stream': False,
            'temperature': request.temperature, 'max_tokens': request.max_tokens}
        if request.tools:
            payload['tools'] = [{'type': 'function', 'function': t.model_dump()} for t in request.tools]
        try:
            async with self.client.stream('POST', f'{self.endpoint.base_url}/chat/completions',
                    headers=self.headers(), json=payload, timeout=model.timeout) as response:
                self._check_status(response.status_code)
                body = bytearray()
                async for chunk in response.aiter_bytes():
                    body.extend(chunk)
                    if len(body) > 2_000_000:
                        raise HubError('MODEL_RESPONSE_INVALID', 'Provider response exceeds byte limit', 502)
            data = json.loads(body)
            choice = data['choices'][0]
            message = choice['message']
            calls = [ToolCall(id=t['id'], name=t['function']['name'],
                arguments=json.loads(t['function']['arguments'])) for t in message.get('tool_calls', [])]
            content = message.get('content')
            if not calls and not isinstance(content, str):
                raise ValueError('Missing content')
            usage = data.get('usage')
            return InferenceResponse(content=content or '', tool_calls=calls,
                finish_reason=choice.get('finish_reason') or ('tool_calls' if calls else 'stop'),
                usage=Usage(input_tokens=usage['prompt_tokens'], output_tokens=usage['completion_tokens']) if usage else None)
        except httpx.TimeoutException as error:
            raise HubError('MODEL_TIMEOUT', 'Provider request timed out', 504, retryable=True) from error
        except httpx.TransportError as error:
            raise HubError('MODEL_UNAVAILABLE', 'Provider transport failed', 503, retryable=True) from error
        except (ValueError, KeyError, IndexError, TypeError) as error:
            raise HubError('MODEL_RESPONSE_INVALID', 'Invalid provider response', 502) from error

    @staticmethod
    def _check_status(status: int) -> None:
        if 200 <= status < 300:
            return
        if status in {401, 403}:
            raise HubError('MODEL_AUTH_ERROR', 'Provider authorization failed', 502)
        retry = status == 429 or 500 <= status <= 599
        raise HubError('MODEL_UNAVAILABLE' if retry else 'MODEL_REQUEST_REJECTED',
                       'Provider rejected request', 503 if retry else 502, retryable=retry,
                       details={'provider_status': status})

    async def health(self, model: ModelDefinition) -> ProbeResult:
        start = time.monotonic()
        try:
            async with self.client.stream('GET', f'{self.endpoint.base_url}/models', headers=self.headers(), timeout=2) as response:
                # Reachability only: do not buffer an unbounded discovery body or infer capabilities.
                return ProbeResult(available=response.is_success, latency_ms=(time.monotonic() - start) * 1000)
        except httpx.TransportError:
            return ProbeResult(available=False)

    async def close(self) -> None:
        await self.client.aclose()
