# trace:implements FR-020
import time
from dataclasses import dataclass, field
from typing import Any, Protocol

from .config import AgentDefinition, RuntimeSettings
from .errors import HubError
from .models import Message, RunEvidence, Usage
from .tools import ToolContext


@dataclass
class RunBudget:
    settings: RuntimeSettings
    deadline: float
    requests: int = 0
    tools: int = 0
    delegations: int = 0
    usages: list[Usage | None] = field(default_factory=list)

    def remaining(self) -> float:
        remaining = self.deadline - time.monotonic()
        if remaining <= 0:
            raise HubError('AGENT_TIMEOUT', 'Agent deadline exceeded', 504)
        return remaining

    def consume(self, counter: str) -> None:
        self.remaining()
        limits = {'requests': self.settings.max_model_requests, 'tools': self.settings.max_tool_calls,
                  'delegations': self.settings.max_delegations}
        if getattr(self, counter) >= limits[counter]:
            raise HubError('AGENT_BUDGET_EXCEEDED', f'Run {counter} limit exceeded', 429)
        setattr(self, counter, getattr(self, counter) + 1)

    def usage(self) -> Usage | None:
        if not self.usages or any(u is None for u in self.usages):
            return None
        return Usage(input_tokens=sum(u.input_tokens for u in self.usages if u is not None),
                     output_tokens=sum(u.output_tokens for u in self.usages if u is not None))


@dataclass
class DriverResult:
    output: Any
    messages: list[Message]
    model_id: str
    evidence: RunEvidence | None = None


class AgentDriver(Protocol):
    async def run(self, agent: AgentDefinition, text: str, history: list[Message],
                  context: ToolContext, budget: RunBudget) -> DriverResult: ...
