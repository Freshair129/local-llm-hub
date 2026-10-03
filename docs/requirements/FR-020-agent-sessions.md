---
id: FR-020
domain: inference-gateway
owner: Boss
status: active
superseded_by: null
version: 0.2.0
priority: P0
features: [CROSS-FEAT-002]
depends_on:
  - FR-018
  - FR-019
  - FR-021
  - FR-022
---

# Agent sessions and bounded delegation

Deliver the corresponding approved [target contracts](../architecture/TARGET-ARCHITECTURE.md) with acceptance criteria H09 H10 H16 H17 H19 in the [acceptance plan](../architecture/IMPLEMENTATION-PLAN.md). No full OpenAI parity, public multi-tenancy, arbitrary sandbox claim or hidden cloud fallback.

## Interface lock

AgentRuntime.create_session(agent_id: str) -> Session; AgentRuntime.run(agent_id: str, text: str, session_id: str | None = None) -> RunResult; ExecutionDriver.run(definition, session, text, execution) -> RunResult

Component scope: runtime/local_llm_hub/agents.py; runtime/local_llm_hub/driver.py. Tests live in runtime/tests/test_agent_sessions.py and focused integration fixtures.

## Verification

Map the listed H criteria to executed deterministic tests, including failure paths. Record actual results in the verification report; source presence is not acceptance.

## Version diff

New requirement derived from the approved 0.2.0 architecture.
