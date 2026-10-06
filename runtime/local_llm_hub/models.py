# trace:implements FR-018
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, StrictBool

Identifier = Annotated[str, Field(pattern=r'^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$')]
Capability = Literal['tool_calling', 'structured_output', 'vision', 'coding', 'reasoning']


class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid', frozen=True, validate_default=True)


class Capabilities(StrictModel):
    tool_calling: StrictBool | None = None
    structured_output: StrictBool | None = None
    vision: StrictBool | None = None
    coding: StrictBool | None = None
    reasoning: StrictBool | None = None
    context_length: int = Field(default=8192, gt=0)
    provenance: Literal['configured', 'probe'] = 'configured'
    observed_at: str | None = None

    def supports(self, required: tuple[Capability, ...]) -> bool:
        return all(getattr(self, name) is True for name in required)


class ModelDefinition(StrictModel):
    id: Identifier
    endpoint: Identifier
    model: str = Field(min_length=1)
    aliases: tuple[Identifier, ...] = ()
    roles: tuple[str, ...] = ()
    capabilities: Capabilities = Field(default_factory=Capabilities)
    enabled: bool = True
    priority: int = 0
    fallbacks: tuple[Identifier, ...] = ()
    timeout: float = Field(default=60, gt=0, le=600)
    retries: int = Field(default=0, ge=0, le=3)
    max_concurrency: int | None = Field(default=None, gt=0)


class ToolCall(StrictModel):
    id: str
    name: str
    arguments: dict[str, Any] = Field(default_factory=dict)
    arguments_sha256: str | None = Field(default=None, exclude=True)


class Message(StrictModel):
    role: Literal['system', 'user', 'assistant', 'tool']
    content: str = ''
    tool_calls: list[ToolCall] = Field(default_factory=list)
    tool_call_id: str | None = None


class ToolSchema(StrictModel):
    name: str
    description: str = ''
    parameters: dict[str, Any]


class InferenceSettings(StrictModel):
    temperature: float = Field(default=0.2, ge=0, le=2, strict=True, allow_inf_nan=False)
    top_p: float | None = Field(default=None, gt=0, le=1, strict=True, allow_inf_nan=False)
    presence_penalty: float | None = Field(default=None, ge=-2, le=2, strict=True, allow_inf_nan=False)
    reasoning_effort: Literal['none'] | None = None

    def optional_settings(self) -> set[str]:
        return {name for name in ('top_p', 'presence_penalty', 'reasoning_effort')
                if getattr(self, name) is not None}


class SentSettings(InferenceSettings):
    max_tokens: int = Field(gt=0)


class ProviderAttempt(StrictModel):
    model_id: str
    ordinal: int = Field(gt=0)
    sent_settings: SentSettings
    outcome: Literal['success', 'error']


class ReadEvidence(StrictModel):
    root: int = Field(ge=0)
    path: str
    tool_call_id: str
    sha256: str
    returned_bytes: int = Field(ge=0)
    truncated: bool


class RunEvidence(StrictModel):
    version: Literal['0.1.0'] = '0.1.0'
    request_id: str
    session_id: str
    agent_id: str
    input_sha256: str
    output_schema_sha256: str | None
    output_kind: Literal['text', 'tool_schema']
    provider_attempts: list[ProviderAttempt]
    reads: list[ReadEvidence]
    final_arguments_sha256: str | None


class InferenceRequest(InferenceSettings):
    messages: list[Message]
    tools: list[ToolSchema] = Field(default_factory=list)
    max_tokens: int = Field(default=1024, gt=0)

    def sent_settings(self) -> SentSettings:
        return SentSettings(temperature=self.temperature, top_p=self.top_p,
            presence_penalty=self.presence_penalty, reasoning_effort=self.reasoning_effort,
            max_tokens=self.max_tokens)


class Usage(StrictModel):
    input_tokens: int = Field(ge=0)
    output_tokens: int = Field(ge=0)


class InferenceResponse(StrictModel):
    content: str = ''
    tool_calls: list[ToolCall] = Field(default_factory=list)
    usage: Usage | None = None
    finish_reason: Literal['stop', 'length', 'tool_calls'] = 'stop'


class RouteRequest(StrictModel):
    inference: InferenceRequest
    model: str = 'auto'
    role: str = 'general'
    required: tuple[Capability, ...] = ()
    allow_cloud: bool = False
    context_budget: int = Field(default=8192, gt=0)
    timeout: float = Field(default=120, gt=0)


class RoutedResponse(StrictModel):
    model_id: str
    response: InferenceResponse
    messages: list[Message]


class ProbeResult(StrictModel):
    available: bool
    latency_ms: float | None = None


class RunResult(StrictModel):
    request_id: str
    session_id: str
    agent_id: str
    model_id: str
    output: Any
    usage: Usage | None = None
    evidence: RunEvidence | None = None


BUILTIN_TOOLS = frozenset({
    'filesystem.read', 'filesystem.write', 'filesystem.list', 'search.grep',
    'shell', 'http', 'memory.store', 'memory.retrieve', 'memory.search',
    'memory.update', 'memory.delete', 'agent.delegate',
})
