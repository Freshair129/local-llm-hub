# trace:implements FR-020
from typing import Any

import jsonschema
from pydantic_ai import Agent, StructuredDict
from pydantic_ai.exceptions import UnexpectedModelBehavior, UsageLimitExceeded
from pydantic_ai.messages import (
    ModelMessage,
    ModelRequest,
    ModelResponse,
    ModelResponsePart,
    RetryPromptPart,
    SystemPromptPart,
    TextPart,
    ToolCallPart,
    ToolReturnPart,
    UserPromptPart,
)
from pydantic_ai.models import Model, ModelRequestParameters
from pydantic_ai.settings import ModelSettings
from pydantic_ai.tools import Tool
from pydantic_ai.usage import RequestUsage, UsageLimits

from .agent_driver import DriverResult, RunBudget
from .config import AgentDefinition
from .errors import HubError
from .models import InferenceRequest, Message, RouteRequest, ToolCall, ToolSchema
from .router import ModelRouter
from .tools import ToolContext, ToolRegistry


def to_domain(messages: list[ModelMessage]) -> list[Message]:
    result: list[Message] = []
    for message in messages:
        if isinstance(message, ModelResponse):
            result.append(Message(role='assistant', content=''.join(p.content for p in message.parts if isinstance(p, TextPart)),
                tool_calls=[ToolCall(id=p.tool_call_id, name=p.tool_name, arguments=p.args_as_dict())
                            for p in message.parts if isinstance(p, ToolCallPart)]))
        else:
            for part in message.parts:
                if isinstance(part, SystemPromptPart):
                    result.append(Message(role='system', content=part.content))
                elif isinstance(part, UserPromptPart):
                    if not isinstance(part.content, str):
                        raise HubError('UNSUPPORTED_PARAMETER', 'Only text prompts are supported', 422)
                    result.append(Message(role='user', content=part.content))
                elif isinstance(part, ToolReturnPart):
                    result.append(Message(role='tool', content=part.model_response_str(), tool_call_id=part.tool_call_id))
                elif isinstance(part, RetryPromptPart):
                    result.append(Message(role='tool' if part.tool_name else 'user', content=part.model_response(),
                                          tool_call_id=part.tool_call_id if part.tool_name else None))
    return result


def to_sdk(messages: list[Message]) -> list[ModelMessage]:
    result: list[ModelMessage] = []
    names: dict[str, str] = {}
    for message in messages:
        if message.role == 'assistant':
            parts: list[ModelResponsePart] = [TextPart(message.content)] if message.content else []
            for call in message.tool_calls:
                names[call.id] = call.name
                parts.append(ToolCallPart(call.name, call.arguments, call.id))
            result.append(ModelResponse(parts))
        elif message.role == 'tool':
            call_id = message.tool_call_id or ''
            result.append(ModelRequest([ToolReturnPart(names.get(call_id, ''), message.content, call_id)]))
        elif message.role == 'system':
            result.append(ModelRequest([SystemPromptPart(message.content)]))
        else:
            result.append(ModelRequest([UserPromptPart(message.content)]))
    return result


class RoutedModel(Model):
    def __init__(self, router: ModelRouter, agent: AgentDefinition, budget: RunBudget) -> None:
        super().__init__()
        self.router, self.agent, self.budget = router, agent, budget
        self.selected = ''

    @property
    def model_name(self) -> str:
        return 'hub-router'

    @property
    def system(self) -> str:
        return 'local-llm-hub'

    async def request(self, messages: list[ModelMessage], model_settings: ModelSettings | None,
                      model_request_parameters: ModelRequestParameters) -> ModelResponse:
        settings, parameters = self.prepare_request(model_settings, model_request_parameters)
        self.budget.consume('requests')
        domain = to_domain(messages)
        if parameters.instruction_parts:
            domain = [Message(role='system', content=p.content) for p in parameters.instruction_parts] + domain
        response = await self.router.complete(RouteRequest(
            inference=InferenceRequest(messages=domain,
                tools=[ToolSchema(name=t.name, description=t.description or '', parameters=t.parameters_json_schema)
                       for t in [*parameters.function_tools, *parameters.output_tools]],
                max_tokens=self.agent.max_tokens,
                temperature=(settings or {}).get('temperature', 0.2)),
            model=self.agent.model, role=self.agent.role, required=(*self.agent.requires, *(('structured_output',) if self.agent.output_schema else ())),
            allow_cloud=self.agent.allow_cloud, context_budget=self.agent.context_budget,
            timeout=self.budget.remaining()))
        self.selected = response.model_id
        body = response.response
        self.budget.usages.append(body.usage)
        parts: list[ModelResponsePart] = [TextPart(body.content)] if body.content else []
        parts.extend(ToolCallPart(c.name, c.arguments, c.id) for c in body.tool_calls)
        # SDK accounting requires integers. Public metrics use the independently retained nullable usage.
        usage = RequestUsage(input_tokens=body.usage.input_tokens, output_tokens=body.usage.output_tokens) if body.usage else RequestUsage()
        return ModelResponse(parts, model_name=response.model_id, provider_name=self.system,
                             usage=usage, finish_reason='tool_call' if body.finish_reason == 'tool_calls' else body.finish_reason)


class PydanticDriver:
    def __init__(self, router: ModelRouter, tools: ToolRegistry) -> None:
        self.router, self.tools = router, tools

    async def run(self, agent: AgentDefinition, text: str, history: list[Message],
                  context: ToolContext, budget: RunBudget) -> DriverResult:
        selected_tools: list[Tool[Any]] = []
        for name in agent.tools:
            if name not in context.identity.grants:
                continue
            definition = self.tools.definitions[name]
            def make_handler(tool_name: str) -> Any:
                async def call(**arguments: Any) -> dict[str, Any]:
                    budget.consume('tools')
                    result = await self.tools.execute(tool_name, arguments, context)
                    return result.model_dump()
                return call
            selected_tools.append(Tool.from_schema(make_handler(name), name=name.replace('.', '__'),
                description=definition.description, json_schema=definition.input_schema, sequential=True))
        model = RoutedModel(self.router, agent, budget)
        output: Any = StructuredDict(agent.output_schema) if agent.output_schema else str
        runner: Agent[None, Any] = Agent(model, output_type=output, system_prompt=agent.instructions,
                                        tools=selected_tools, retries=0)
        try:
            result = await runner.run(text, message_history=to_sdk(history),
                usage_limits=UsageLimits(request_limit=budget.settings.max_model_requests,
                                         tool_calls_limit=budget.settings.max_tool_calls))
        except UsageLimitExceeded as error:
            raise HubError('AGENT_BUDGET_EXCEEDED', 'Agent execution limit exceeded', 429) from error
        except UnexpectedModelBehavior as error:
            raise HubError('MODEL_RESPONSE_INVALID', 'Agent output or tool call failed validation', 502) from error
        if agent.output_schema:
            try:
                jsonschema.validate(result.output, agent.output_schema)
            except jsonschema.ValidationError as error:
                raise HubError('MODEL_RESPONSE_INVALID', 'Structured output failed schema validation', 502) from error
        messages = to_domain(result.all_messages())
        selected = self.router.registry.resolve(model.selected)
        bounded = self.router.context.prepare(InferenceRequest(messages=messages, max_tokens=agent.max_tokens),
            min(agent.context_budget, selected.capabilities.context_length))
        return DriverResult(result.output, bounded.messages, model.selected)
