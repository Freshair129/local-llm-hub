---
id: PKT-FR-023-HUB-ROUTE
fr_id: FR-023
layer: route
version: 0.4.0
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

### TC-HUB-LIVE-001 (continuation authorized 2026-10-04)

Extend the existing opt-in integration test under H30 to check a single explicitly selected OpenAI-compatible endpoint and model: ordinary text, a real filesystem.read tool round trip with a fresh fixture nonce, typed object output, shared endpoint admission for two simultaneous requests, and cancellation while inference is active followed by successful recovery. Reuse the actual API, Pydantic driver, router and provider; record case duration (including fixture setup/teardown) and nullable usage without estimating request-only latency, TTFT or decode rate. Temporary workspace/database and a process-local token isolate the fixture. No cloud fallback, shell or HTTP tool grants are needed.

The test suite takes base URL/model/context settings from environment, skips when opt-in is disabled, and fails enabled tests when setup/capabilities are missing. Inference uses the existing model only; tests never download models, alter firewall/global binding, stop unrelated processes, or change production catalogs. An operator-approved temporary local server, if necessary, must bind loopback, use existing model files, remain task-owned and be stopped afterwards. Client cancellation proves transport/task/permit cleanup and a subsequent successful inference; backend GPU work cancellation is a separate observation, not inferred from semaphore release.

CMP addition: runtime/tests/test_live_integration.py and related focused validation fixtures; docs/local-deployment.md; docs/architecture/VERIFICATION.md. No public runtime contract change. Complexity C-2; risk MEDIUM for live compute usage. Exit: executed machine-readable live receipt plus unchanged default-suite behavior, or exact environment blocker with NOT_RUN status.

## 9. Token ceiling and ordering
8,000 tokens per implementation unit; split internal work without changing locked contracts. Configuration schemas first; then registry/routing, memory/permission boundaries, execution driver, API. Single writer per file.

## Version diff
New bounded packet under user approval dated 2026-10-03. No closure claimed until its tests and documentation checks pass.

0.2.0 -> 0.3.0: user requested the next live-provider verification step; specify executable capability/concurrency/cancellation checks within the previously approved H30 scope.

## Approved acceptance repair (2026-10-05)

The user approved [repair plan 0.2.0](../plans/HUB-ACCEPTANCE-REPAIR.md). Extend the interface lock with get_chat_catalog(state) -> Result<ChatCatalog, String>, serialized as mode plus models containing id/name/model/backend strings. Hub catalog uses only enabled logical IDs; legacy uses cached physical inventory. Errors fail closed. Preserve ChatRequest/ChatResponse and list_all_models. CMP additionally includes src/main.js, src/js/chat.js, src/js/arena.js, src/js/state.js, a shared inference-catalog module, focused JS/Rust regression tests and desktop/container acceptance runners. R1 mechanical formatting is isolated from behavioral commits. Parent H25-H27/H30 and peer FR-007/FR-011 contracts are reconciled by the approved plan. Target cases R1-R6 and rollback are defined there; no production automation plugin, global bind change, new model weights or unrelated refactor.

Version diff 0.3.0 -> 0.4.0: approved catalog IPC and executable desktop/container acceptance repairs.
