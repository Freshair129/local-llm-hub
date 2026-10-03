# trace:implements FR-019
import asyncio
from collections.abc import AsyncIterator, Mapping
from contextlib import asynccontextmanager
from dataclasses import dataclass, field

from .config import EndpointDefinition
from .errors import HubError


@dataclass
class Pool:
    limit: int
    max_queue: int
    active: int = 0
    queued: int = 0
    semaphore: asyncio.Semaphore = field(init=False)

    def __post_init__(self) -> None:
        self.semaphore = asyncio.Semaphore(self.limit)


class EndpointScheduler:
    def __init__(self, endpoints: Mapping[str, EndpointDefinition]) -> None:
        self.pools = {k: Pool(v.max_concurrency, v.max_queue) for k, v in endpoints.items()}

    def snapshot(self, endpoint_id: str) -> dict[str, int]:
        pool = self.pools[endpoint_id]
        return {'active_requests': pool.active, 'queued_requests': pool.queued}

    @asynccontextmanager
    async def lease(self, endpoint_id: str, timeout: float) -> AsyncIterator[None]:  # noqa: ASYNC109 - bounded queue wait, not handler timeout
        pool = self.pools[endpoint_id]
        if pool.semaphore.locked() and pool.queued >= pool.max_queue:
            raise HubError('MODEL_BUSY', 'Endpoint queue is full', 429)
        pool.queued += 1
        try:
            try:
                async with asyncio.timeout(timeout):
                    await pool.semaphore.acquire()
            except TimeoutError as error:
                raise HubError('MODEL_TIMEOUT', 'Inference queue deadline exceeded', 504) from error
        finally:
            pool.queued -= 1
        pool.active += 1
        try:
            yield
        finally:
            pool.active -= 1
            pool.semaphore.release()
