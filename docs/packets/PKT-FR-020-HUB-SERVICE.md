---
id: PKT-FR-020-HUB-SERVICE
fr_id: FR-020
layer: service
version: 0.2.0
status: active
superseded_by: null
interface: LOCKED
---

# Agent sessions and bounded delegation implementation packet

## 1. Statement
Implement agent sessions and bounded delegation within the approved harness boundary.

## 2. Acceptance criteria
H09 H10 H16 H17 H19; expected outcomes are specified in [H01-H30](../architecture/IMPLEMENTATION-PLAN.md). Add focused regression tests before implementation.

## 3. Relevant SDD
[Target architecture](../architecture/TARGET-ARCHITECTURE.md) and [FR-020](../requirements/FR-020-agent-sessions.md); only the matching subsystem applies.

## 4. API and schemas
AgentRuntime.create_session(agent_id: str) -> Session; AgentRuntime.run(agent_id: str, text: str, session_id: str | None = None) -> RunResult; ExecutionDriver.run(definition, session, text, execution) -> RunResult. Typed DTOs and error codes follow the target. Establish schema definitions before service logic.

## 5. Business and security rules
Single runtime process; deny-first; bounded deadlines and output; no secret/prompt logging; no model loading implied by session creation.

## 6. Guard rails and CMP
runtime/local_llm_hub/agent_driver.py; runtime/local_llm_hub/pydantic_driver.py; runtime/local_llm_hub/agents.py; runtime/local_llm_hub/driver.py; related focused runtime tests; package bootstrap __init__.py; acceptance and user documentation for this unit. Preserve ADR-100, existing IPC signatures and original checkout WIP. No adjacent reformatting.

## 7. Current CMP code
New runtime modules do not exist at baseline 12e84fc. Existing Rust send_chat_message calls commands::chat::execute_chat. Existing UAT defects and exact source lines are captured in [RCA-001](../../.brain/rca/RCA-001-UAT-EVIDENCE.md).

## 8. Target integration test
TC-HUB-MOCK-001: authenticated HTTP API -> agent -> router -> deterministic provider. Also run the packet's focused failure/isolation tests. Rollback: disable the opt-in service bridge; preserve memory and legacy source.

## 9. Token ceiling and ordering
8,000 tokens per implementation unit; split internal work without changing locked contracts. Configuration schemas first; then registry/routing, memory/permission boundaries, execution driver, API. Single writer per file.

## Version diff
New bounded packet under user approval dated 2026-10-03. No closure claimed until its tests and documentation checks pass.
