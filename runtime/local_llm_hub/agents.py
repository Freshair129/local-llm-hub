# trace:implements FR-020
import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from uuid import uuid4

from .agent_driver import AgentDriver, RunBudget
from .config import AgentDefinition, HubConfig, PolicyDefinition
from .errors import HubError
from .memory import MemoryStore, SQLiteMemory
from .models import Message, RunResult
from .permissions import ExecutionIdentity, PermissionPolicy, denied
from .pydantic_driver import PydanticDriver
from .router import ModelRouter
from .tools import ToolContext, ToolRegistry

logger = logging.getLogger('local_llm_hub')


@dataclass
class Session:
    id: str
    identity: ExecutionIdentity
    updated: float = field(default_factory=time.monotonic)
    messages: list[Message] = field(default_factory=list)
    busy: bool = False
    delegated: bool = False
    allow_cloud: bool = False


class AgentRuntime:
    def __init__(self, config: HubConfig, router: ModelRouter | None = None,
                 memory: MemoryStore | None = None, driver: AgentDriver | None = None) -> None:
        self.config = config
        self.router = router or ModelRouter(config)
        self.memory = memory or SQLiteMemory(config.runtime.state_path)
        self.tools = ToolRegistry(config)
        self.permissions = PermissionPolicy(config)
        self.driver = driver or PydanticDriver(self.router, self.tools)
        self.sessions: dict[str, Session] = {}
        self.capacity = asyncio.Semaphore(config.runtime.agent_concurrency)
        self.queued = 0

    def definition(self, agent_id: str) -> AgentDefinition:
        if agent_id not in self.config.agents:
            raise HubError('AGENT_NOT_FOUND', 'Unknown agent', 404)
        return self.config.agents[agent_id]

    def create_session(self, agent_id: str, parent: ExecutionIdentity | None = None) -> Session:
        agent = self.definition(agent_id)
        now = time.monotonic()
        for sid, session in list(self.sessions.items()):
            if not session.busy and now - session.updated >= self.config.runtime.session_ttl:
                del self.sessions[sid]
        if len(self.sessions) >= self.config.runtime.max_sessions:
            raise HubError('SESSION_LIMIT', 'Session capacity reached', 429)
        policy = self.config.policies[agent.policy]
        grants = frozenset(agent.tools) & frozenset(policy.grants)
        policies: tuple[PolicyDefinition, ...] = (policy,)
        if parent:
            if parent.project != agent.project:
                raise denied()
            grants &= parent.grants
            policies = (*parent.policies, policy)
        sid = uuid4().hex
        identity = ExecutionIdentity(agent.id, sid, agent.project, policies, grants)
        session = Session(sid, identity, delegated=parent is not None, allow_cloud=agent.allow_cloud)
        self.sessions[sid] = session
        return session

    async def run(self, agent_id: str, text: str, session_id: str | None = None,
                  request_id: str | None = None) -> RunResult:
        self.definition(agent_id)
        session = self.create_session(agent_id) if session_id is None else self.sessions.get(session_id)
        if (session is None or session.identity.agent_id != agent_id or session.delegated or
            (not session.busy and time.monotonic() - session.updated >= self.config.runtime.session_ttl)):
            raise HubError('SESSION_NOT_FOUND', 'Session not available for this agent', 404)
        if session.busy:
            raise HubError('SESSION_BUSY', 'Session already has an active run', 409)
        if self.queued >= self.config.runtime.max_sessions:
            raise HubError('AGENT_BUSY', 'Agent queue capacity reached', 429)
        session.busy = True
        self.queued += 1
        acquired = False
        rid = request_id or uuid4().hex
        budget = RunBudget(self.config.runtime, time.monotonic() + self.config.runtime.run_timeout)
        try:
            async with asyncio.timeout(min(self.config.runtime.queue_timeout, budget.remaining())):
                await self.capacity.acquire()
            acquired = True
            self.queued -= 1
            async with asyncio.timeout(budget.remaining()):
                result = await self._execute(session, text, budget, 0, rid)
            logger.info(json.dumps({'event': 'run_completed', 'request_id': rid, 'session_id': session.id,
                'agent_id': agent_id, 'model_id': result.model_id}))
            return result
        except TimeoutError as error:
            raise HubError('AGENT_TIMEOUT', 'Agent queue or execution deadline exceeded', 504) from error
        except asyncio.CancelledError:
            logger.info(json.dumps({'event': 'run_cancelled', 'request_id': rid, 'session_id': session.id, 'agent_id': agent_id}))
            raise
        finally:
            if acquired:
                self.capacity.release()
            else:
                self.queued -= 1
            session.busy = False
            session.updated = time.monotonic()

    async def _execute(self, session: Session, text: str, budget: RunBudget, depth: int, request_id: str) -> RunResult:
        agent = self.definition(session.identity.agent_id).model_copy(update={'allow_cloud': session.allow_cloud})
        async def delegate(child_id: str, task: str) -> str:
            if child_id not in agent.delegate_to:
                raise denied()
            if depth >= self.config.runtime.max_depth:
                raise HubError('DELEGATION_DEPTH_EXCEEDED', 'Delegation depth exceeded', 422)
            budget.consume('delegations')
            child = self.create_session(child_id, session.identity)
            child.allow_cloud = child.allow_cloud and session.allow_cloud
            child.busy = True
            try:
                result = await self._execute(child, task, budget, depth + 1, request_id)
                return result.output if isinstance(result.output, str) else json.dumps(result.output)
            finally:
                # Child task context is ephemeral; scoped memory has its own expiry.
                self.sessions.pop(child.id, None)
        context = ToolContext(session.identity, self.permissions, self.memory, delegate, request_id)
        result = await self.driver.run(agent, text, session.messages, context, budget)
        session.messages = result.messages
        return RunResult(request_id=request_id, session_id=session.id, agent_id=agent.id,
                         model_id=result.model_id, output=result.output, usage=budget.usage(), evidence=result.evidence)

    async def close(self) -> None:
        await self.router.close()
        await self.memory.close()
