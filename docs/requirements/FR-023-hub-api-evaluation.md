---
id: FR-023
domain: inference-gateway
owner: Boss
status: active
superseded_by: null
version: 0.4.0
priority: P0
features: [CROSS-FEAT-002]
depends_on:
  - FR-018
  - FR-019
  - FR-020
  - FR-021
  - FR-022
---

# Hub API, packaging and truthful evaluation

Deliver the corresponding approved [target contracts](../architecture/TARGET-ARCHITECTURE.md) with acceptance criteria H19 H21 H22 H25 H26 H27 H28 H29 H30 in the [acceptance plan](../architecture/IMPLEMENTATION-PLAN.md). No full OpenAI parity, public multi-tenancy, arbitrary sandbox claim or hidden cloud fallback.

## Interface lock

Approved additive command: `get_chat_catalog(state) -> Result<ChatCatalog,String>` returns `{mode,models:[{id,name,model,backend}]}`. Authenticated `GET /v1/models` supplies enabled Hub logical IDs only; endpoint URLs and credentials never reach the catalog DTO. Invalid/unavailable Hub catalogs fail closed. Unconfigured Hub uses existing cached legacy inventory. Existing chat and model-management commands retain their signatures. See [repair contract](../plans/HUB-ACCEPTANCE-REPAIR.md) and [native test runner](../../eval/desktop/native_smoke.py).

create_app(config: HubConfig, runtime: AgentRuntime | None = None) -> FastAPI; routes and payloads in approved target; Rust send_chat_message(request: ChatRequest) -> Result<ChatResponse,String> preserved; new run_hub_agent(agent_id,input,session_id) returns JSON Result

Component scope: runtime/local_llm_hub/api.py; runtime/local_llm_hub/cli.py; runtime/local_llm_hub/evaluation.py; runtime/local_llm_hub/logging.py; src-tauri/src/commands/hub.rs; src-tauri/src/commands/mod.rs; src-tauri/src/lib.rs; scripts/run_local_llm_uat.mjs; runtime/Dockerfile; compose.yaml; .dockerignore; README.md; docs/*.md. Tests live in runtime/tests/test_hub_api_evaluation.py and focused integration fixtures.

## Verification

Map the listed H criteria to executed deterministic tests, including failure paths. Record actual results in the verification report; source presence is not acceptance.

Approved R5 container packaging acceptance passed locally on 2026-10-05: the locked CPU image built; health, authentication, catalog/chat, unprivileged runtime controls, Linux symlink escape rejection and project-memory restart persistence passed; task containers/network were removed and named volumes preserved. The source-linked receipt and exact limits are in [verification](../architecture/VERIFICATION.md).

## Version diff

New requirement derived from the approved 0.2.0 architecture.

0.2.0 -> 0.3.0: approved additive catalog IPC and native desktop acceptance; no streaming or provider extension.

0.3.0 -> 0.4.0: record the executed R5 container packaging acceptance without widening runtime/API contracts.
