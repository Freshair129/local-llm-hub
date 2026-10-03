---
id: PKT-FR-023-HUB-ROUTE
fr_id: FR-023
layer: route
version: 0.2.0
status: active
superseded_by: null
interface: LOCKED
---

# Hub API, packaging and truthful evaluation implementation packet

## 1. Statement
Implement hub api, packaging and truthful evaluation within the approved harness boundary.

## 2. Acceptance criteria
H19 H21 H22 H25 H26 H27 H28 H29 H30; expected outcomes are specified in [H01-H30](../architecture/IMPLEMENTATION-PLAN.md). Add focused regression tests before implementation.

## 3. Relevant SDD
[Target architecture](../architecture/TARGET-ARCHITECTURE.md) and [FR-023](../requirements/FR-023-hub-api-evaluation.md); only the matching subsystem applies.

## 4. API and schemas
create_app(config: HubConfig, runtime: AgentRuntime | None = None) -> FastAPI; routes and payloads in approved target; Rust send_chat_message(request: ChatRequest) -> Result<ChatResponse,String> preserved; new run_hub_agent(agent_id,input,session_id) returns JSON Result. Typed DTOs and error codes follow the target. Establish schema definitions before service logic.

## 5. Business and security rules
Single runtime process; deny-first; bounded deadlines and output; no secret/prompt logging; no model loading implied by session creation.

## 6. Guard rails and CMP
runtime/local_llm_hub/api.py; runtime/local_llm_hub/cli.py; runtime/local_llm_hub/evaluation.py; runtime/local_llm_hub/logging.py; src-tauri/src/commands/hub.rs; src-tauri/src/commands/mod.rs; src-tauri/src/lib.rs; scripts/run_local_llm_uat.mjs; runtime/Dockerfile; compose.yaml; .dockerignore; README.md; docs/*.md; related focused runtime tests; package bootstrap __init__.py; acceptance and user documentation for this unit. Preserve ADR-100, existing IPC signatures and original checkout WIP. No adjacent reformatting.

## 7. Current CMP code
New runtime modules do not exist at baseline 12e84fc. Existing Rust send_chat_message calls commands::chat::execute_chat. Existing UAT defects and exact source lines are captured in [RCA-001](../../.brain/rca/RCA-001-UAT-EVIDENCE.md).

## 8. Target integration test
TC-HUB-MOCK-001: authenticated HTTP API -> agent -> router -> deterministic provider. Also run the packet's focused failure/isolation tests. Rollback: disable the opt-in service bridge; preserve memory and legacy source.

## 9. Token ceiling and ordering
8,000 tokens per implementation unit; split internal work without changing locked contracts. Configuration schemas first; then registry/routing, memory/permission boundaries, execution driver, API. Single writer per file.

## Version diff
New bounded packet under user approval dated 2026-10-03. No closure claimed until its tests and documentation checks pass.
