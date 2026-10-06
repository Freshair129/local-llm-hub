# trace:implements FR-019
import json
from typing import Protocol

from .errors import HubError
from .models import InferenceRequest, Message


class Summarizer(Protocol):
    async def summarize(self, messages: list[Message], budget: int) -> str: ...


class ContextManager:
    """Conservative UTF-8-byte estimator; does not pretend to be a model tokenizer."""

    def prepare(self, request: InferenceRequest, budget: int) -> InferenceRequest:
        pending: set[str] = set()
        for message in request.messages:
            if message.role == 'tool':
                if not message.tool_call_id or message.tool_call_id not in pending:
                    raise HubError('CONTEXT_INVALID', 'Tool result has no matching call', 422)
                pending.remove(message.tool_call_id)
            elif message.role != 'system':
                if pending:
                    raise HubError('CONTEXT_INVALID', 'Tool calls must finish before another turn', 422)
                calls = [call.id for call in message.tool_calls]
                if len(calls) != len(set(calls)):
                    raise HubError('CONTEXT_INVALID', 'Duplicate tool call identifiers', 422)
                pending.update(calls)
        if pending:
            raise HubError('CONTEXT_INVALID', 'Tool call is missing its result', 422)
        systems = [m for m in request.messages if m.role == 'system']
        groups: list[list[Message]] = []
        for message in request.messages:
            if message.role == 'system':
                continue
            if message.role == 'user' or not groups:
                groups.append([])
            groups[-1].append(message)
        schema_bytes = len(json.dumps([t.model_dump() for t in request.tools]).encode('utf-8'))
        available = budget - request.max_tokens - 128 - schema_bytes
        def cost(messages: list[Message]) -> int:
            return sum(len(m.model_dump_json().encode('utf-8')) + 8 for m in messages)
        while len(groups) > 1 and cost(systems + [m for g in groups for m in g]) > available:
            groups.pop(0)
        result = systems + [m for g in groups for m in g]
        if cost(result) > available:
            raise HubError('CONTEXT_LIMIT', 'Pinned context and output reserve exceed model budget', 413)
        return request.model_copy(update={'messages': result})
