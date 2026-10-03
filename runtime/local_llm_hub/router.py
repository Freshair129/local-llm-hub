# trace:implements FR-019
import asyncio
import time
from collections.abc import Mapping
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from typing import Any, Protocol

from .config import HubConfig
from .context import ContextManager
from .errors import HubError
from .models import ModelDefinition, RoutedResponse, RouteRequest
from .providers import MockProvider, OpenAICompatibleProvider, Provider
from .registry import ModelRegistry
from .scheduler import EndpointScheduler


@dataclass
class Health:
    status: str = 'unknown'
    last_success: str | None = None
    latency_ms: float | None = None
    failure_count: int = 0


class RoutingPolicy(Protocol):
    def rank(self, candidates: list[ModelDefinition], scheduler: EndpointScheduler) -> list[ModelDefinition]: ...


class LeastLoaded:
    def rank(self, candidates: list[ModelDefinition], scheduler: EndpointScheduler) -> list[ModelDefinition]:
        def score(model: ModelDefinition) -> tuple[float, int, str]:
            pool = scheduler.pools[model.endpoint]
            return ((pool.active + pool.queued) / pool.limit, model.priority, model.id)
        return sorted(candidates, key=score)


class ModelRouter:
    def __init__(self, config: HubConfig, providers: Mapping[str, Provider] | None = None,
                 policy: RoutingPolicy | None = None) -> None:
        self.config = config
        self.registry = ModelRegistry(config.models)
        self.scheduler = EndpointScheduler(config.endpoints)
        self.policy = policy or LeastLoaded()
        self.context = ContextManager()
        self.providers: dict[str, Provider] = dict(providers) if providers is not None else {
            name: MockProvider() if endpoint.provider == 'mock' else OpenAICompatibleProvider(endpoint)
            for name, endpoint in config.endpoints.items()}
        self.states = {name: Health(status='available' if config.endpoints[m.endpoint].provider == 'mock' else 'unknown')
                       for name, m in config.models.items()}

    def health(self, name: str) -> dict[str, Any]:
        model = self.registry.resolve(name)
        return {'model_id': model.id, **asdict(self.states[model.id]), **self.scheduler.snapshot(model.endpoint)}

    def candidates(self, request: RouteRequest) -> list[ModelDefinition]:
        initial = ([self.registry.resolve(request.model)] if request.model != 'auto' else
                   self.policy.rank([m for m in self.registry.list() if request.role in m.roles], self.scheduler))
        candidates: list[ModelDefinition] = []
        seen: set[str] = set()
        def add(model: ModelDefinition) -> None:
            if model.id in seen:
                return
            seen.add(model.id)
            candidates.append(model)
            for fallback in model.fallbacks:
                add(self.registry.resolve(fallback))
        for model in initial:
            add(model)
        required = request.required + (('tool_calling',) if request.inference.tools else ())
        compatible = [m for m in candidates if m.capabilities.supports(required)]
        if not compatible:
            raise HubError('MODEL_CAPABILITY_MISMATCH', 'No model satisfies required capabilities', 422)
        eligible = [m for m in compatible if m.enabled and
                    (request.allow_cloud or not self.config.endpoints[m.endpoint].cloud) and
                    self.states[m.id].status != 'unavailable']
        if not eligible:
            raise HubError('MODEL_UNAVAILABLE', 'No permitted model is currently available', 503)
        return eligible

    async def complete(self, request: RouteRequest) -> RoutedResponse:
        candidates = self.candidates(request)
        deadline = time.monotonic() + request.timeout
        last: HubError | None = None
        attempted: list[str] = []
        for model in candidates:
            try:
                prepared = self.context.prepare(request.inference,
                    min(request.context_budget, model.capabilities.context_length))
            except HubError as error:
                last = error
                continue
            for attempt in range(model.retries + 1):
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise HubError('MODEL_TIMEOUT', 'Routing deadline exceeded', 504)
                attempted.append(model.id)
                started = time.monotonic()
                dispatched = False
                try:
                    async with asyncio.timeout(remaining):
                        async with self.scheduler.lease(model.endpoint, min(self.config.runtime.queue_timeout, remaining)):
                            async with asyncio.timeout(model.timeout):
                                dispatched = True
                                response = await self.providers[model.endpoint].complete(prepared, model)
                    state = self.states[model.id]
                    state.status = 'available'
                    state.last_success = datetime.now(UTC).isoformat()
                    state.latency_ms = (time.monotonic() - started) * 1000
                    return RoutedResponse(model_id=model.id, response=response, messages=prepared.messages)
                except TimeoutError:
                    last = HubError('MODEL_TIMEOUT', 'Provider deadline exceeded', 504, retryable=True)
                except HubError as error:
                    if not dispatched:
                        raise
                    last = error
                if not dispatched:
                    raise HubError('MODEL_TIMEOUT', 'Routing queue deadline exceeded', 504)
                self.states[model.id].failure_count += 1
                self.states[model.id].status = 'unavailable'
                if not last.retryable:
                    raise last
                if attempt < model.retries:
                    await asyncio.sleep(min(0.05 * 2 ** attempt, max(0, deadline - time.monotonic())))
        if last:
            raise HubError(last.code, last.message, last.status, details={'attempted_models': attempted})
        raise HubError('MODEL_UNAVAILABLE', 'No eligible provider', 503)

    async def probe(self) -> None:
        for model in self.registry.list():
            if not model.enabled:
                continue
            result = await self.providers[model.endpoint].health(model)
            state = self.states[model.id]
            state.status = 'available' if result.available else 'unavailable'
            # A probe is not a successful generation and does not change last_success.

    async def close(self) -> None:
        for provider in self.providers.values():
            await provider.close()
