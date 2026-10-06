---
id: HUB-IMPLEMENTATION-PLAN
version: 0.3.0
status: active
superseded_by: null
owner: Boss
author: ATHER
date: 2026-10-03
complexity: C-3
risk: HIGH
approval: approved by user on 2026-10-03
---

# Incremental implementation and acceptance plan

This plan implements the [target architecture](TARGET-ARCHITECTURE.md). The engineering checkpoint is implemented; [VERIFICATION](VERIFICATION.md) maps these criteria to actual results and remaining environment limits. The user approved implementation on 2026-10-03; execute the approved checkpoints and record actual results.

## Ordered checkpoints

| Stage | Deliverable | Verification / exit |
|---|---|---|
| 1. Audit | Repository identity, parent/peer review, measured baseline, reusable components and RCA | Source-backed observations and explicit PASS/FAIL/NOT_RUN table; no existing WIP changed. |
| 2. Architecture | Target, five scoped ADRs, threat model, contracts and this plan | User approval required before implementation; record accepted version and any changed assumptions. |
| 3. Foundation | New Python package, strict config, registry/capabilities, mock and compatible provider, router, endpoint scheduler and health | H01-H08 and H20 below, CPU-only; adapters do not bypass scheduling. |
| 4. Harness | Agent definitions, session store, Pydantic driver, context, native tool registry, permissions, SQLite memory, delegation, MCP boundary | H09-H18 and H21-H24; policy and isolation failures are tested, not just happy paths. |
| 5. API and client integration | Authenticated native API, text chat-completions subset, opt-in Rust client bridge, documented quick start and separate runtime container | H19-H23 and H25-H27; old IPC signatures preserved. |
| 6. Validation | Deterministic evaluation tasks, UAT failure reporting repair, test receipts, packaging and documentation | H28-H30; no changed-scope failures, no fake live verification, exact final diff and results. |

Follow STD-003 before each code unit: register the feature/FR ownership, document an interface-locked packet (`FR × layer`), list dependencies/CMP paths/input-output types/error contract/AC/token ceiling/invariants/tests/rollback, then implement that bounded unit. Those detailed packet amendments must remain inside the approved architecture; material contract changes return for review. Do not add empty code skeletons as evidence of completed functionality.

Run sequentially where files overlap. Use deterministic mock providers first; no GPU model loads are needed to complete the foundation or harness. Do not run existing model-generation scripts as a shortcut to validation.

## Acceptance criteria and required evidence

| ID | Acceptance criterion | Minimum meaningful proof |
|---|---|---|
| H01 | Configuration fails closed | Invalid YAML, duplicate keys, unknown fields, missing environment references, invalid roots and cross-reference cycles cause sanitized startup errors. |
| H02 | Model registration and aliases are deterministic | Duplicate IDs/aliases rejected; two aliases resolve the same model; unknown IDs produce a typed error. |
| H03 | Routing honors explicit selection and role | Controlled candidates and a load snapshot select the expected eligible model. |
| H04 | Capability filtering never downgrades | Tool/vision/structured-output requirements exclude false/unknown capabilities; an empty match returns mismatch. |
| H05 | Fallback is bounded and authorized | Fake timeout/transient failure reaches a compatible fallback; incompatible/local-only violations are rejected; nonretryable errors are not retried. |
| H06 | Endpoint concurrency is shared | Two model IDs/aliases in one pool never exceed its limit; distinct pools proceed independently; agent count does not create provider/model copies. |
| H07 | Queue and cancellation are reliable | Full queue, expired wait, cancellation while queued/in-flight and provider exception leave active/queued counts correct and leak no permits. |
| H08 | Provider handling is truthful | Local fake HTTP server exercises response parsing, tool calls, HTTP errors, malformed JSON, timeout and transport cancellation without GPU access. |
| H09 | Agent definitions validate | YAML loads typed agents; unknown tools/models/policies and privilege mismatches fail startup. |
| H10 | Sessions isolate state | Two sessions sharing a provider cannot see each other's history/memory; wrong-agent/project access denied; same-session concurrent turns rejected. |
| H11 | Context is bounded before each model call | Account for instructions, history, tool schemas/results, memory and output reserve; preserve tool-call/result pairs; too-large pinned input fails. |
| H12 | Tool registry and permission checks are independent | Valid schema plus missing grant still denies; malformed inputs rejected; output schema and bounded output handling verified. |
| H13 | Workspace paths cannot escape by ordinary arguments | Traversal, absolute/UNC/device paths, sibling-prefix roots, missing parents, symlinks/junctions and Windows alternate streams tested. Unsupported link creation is reported as SKIP, never PASS. |
| H14 | Shell execution enforces its declared policy | Disallowed executable/arguments denied; allowed argv yields stdout/stderr/exit code; owned process tree ends on timeout; no shell interpolation or credential inheritance. |
| H15 | HTTP tools enforce egress | Disallowed destination, DNS-resolved address and redirects denied; explicitly allowed local service works; size/time limits enforced. |
| H16 | Delegation terminates and cannot elevate | Depth 0 through 3 succeeds, depth 4 fails; total fan-out/run/tool budgets enforced; child grants are an intersection. |
| H17 | Shared-model delegation cannot deadlock | Parent and child complete with endpoint concurrency 1 and root-run concurrency 1; parent holds no inference permit during tool execution. |
| H18 | Memory abstraction is persistent and scoped | Store/retrieve/search/update/delete, transactional updates, reopen persistence for project/agent scopes, expiry, and cross-scope denials with temporary SQLite. |
| H19 | Full mock API path works | HTTP request → session/agent → execution adapter → router → mock provider → response; include one tool round trip and one bounded delegation case. |
| H20 | Health reflects real observations | Success/failure/cancellation updates status, timestamps, latency and counts accurately; liveness does not claim provider readiness. |
| H21 | Native API enforces authentication | Missing/wrong credentials denied; project/root/agent identity cannot be overridden through request fields; sensitive metadata redacted. |
| H22 | OpenAI compatibility is explicitly bounded | Conventional nonstreaming text completion response; unsupported fields return errors; missing token usage is omitted rather than fabricated. |
| H23 | Errors and logs are safe | Required normalized errors, request IDs and cancellation outcomes; secret/prompt/tool-output canaries absent from default success and error logs. |
| H24 | MCP is optional and cannot bypass policy | Fake adapter discovery/call/schema/timeout/permission tests; native tools run with no MCP dependency or server. |
| H25 | Desktop bridge preserves working contracts | Bridge disabled uses existing path; enabled mock service succeeds; service outage produces an explicit error; existing IPC shapes stay compatible. |
| H26 | Runtime installs and packages cleanly | Pinned dependency environment, strict typecheck/lint, unit/API tests and wheel build; isolated mock launch and documented curl succeed. |
| H27 | Docker separates runtime and model serving | CPU runtime image starts with mock config, health passes, persistent memory volume survives restart; no GPU weights or server baked in. |
| H28 | Evaluation status comes from assertions | JSON results for instruction/tool/schema/coding/reasoning tasks; real denominators; absent TTFT/decode rates are null. |
| H29 | UAT reporting defect is fixed | Network failure, invalid JSON and failing assertions cannot produce PASS; disabled live checks are SKIP/NOT_RUN; counts reflect executed cases. |
| H30 | Optional real integration is independently reported | `LOCAL_LLM_INTEGRATION_TEST=1` plus explicit endpoint/model; record actual request/result. Disabled or unavailable setup is not a passed integration. |

Each implemented requirement gets its own trace annotation and executed evidence. These rows define required behavior; they are not completed test results. New tests should exercise the real boundary, not mirror implementation branches.

## Planned repository changes

| Location | Scope |
|---|---|
| `runtime/`, package manifest and lock file | Typed Python service and adapters; isolated from old sidecars. |
| `config/`, `.env.example`, scoped ignore rules | Portable mock-first configuration; secrets and operator overrides excluded from Git. |
| New runtime tests and evaluation fixtures | Unit, fake HTTP, API and opt-in live integration; no dependency on a GPU for default tests. |
| `src-tauri/src/commands/` client adapter and narrow IPC wiring | Opt-in service connection; preserve legacy DTOs and device commands. |
| `scripts/run_local_llm_uat.mjs` | Narrow repair of the confirmed acceptance-reporting defect, with failure regression evidence. |
| Runtime Dockerfile and Compose | Separate optional runtime container; externally configured model servers. |
| README and `docs/architecture.md`, `agent-runtime.md`, `model-router.md`, `providers.md`, `tools.md`, `permissions.md`, `memory.md`, `configuration.md`, `local-deployment.md` | Actual supported behavior, Windows quick start, mock curl, threat limits, compatibility and deployment boundaries. Do not publish executable setup instructions before they are verified. |
| Feature/requirement/packet docs and lineage | Approved contracts, AC mappings, finite execution units and actual receipts under existing standards. |

Exclude broad Rust formatting, UI redesign, storage-offload changes, GPU driver changes, old secret-history cleanup and rewriting existing benchmark reports. Record unrelated findings without silently repairing them.

## Validation reporting

Proposed Python checks are lint (`ruff check`), strict type checking (`mypy`), tests (`pytest`), wheel build (`python -m build`), and a mock service/API smoke. Final paths and commands belong in the package metadata and verified README. Native bridge changes additionally require focused Rust tests/compilation and a Tauri build or an explicit environment-specific NOT_RUN explanation. A successful Python build cannot be reported as a desktop build.

Record each command, cwd, Git revision, exit code, counts/skips and duration. Report build, lint, typecheck, unit tests, fake-provider/API integration, real integration, Docker and desktop smoke separately. Keep the existing formatting failure visible unless an explicitly scoped fix resolves it.

## Definition of done and rollback

The requested engineering checkpoint is complete only when the required subsystems and mock end-to-end path are implemented and verified, the quick start has actually run, documentation matches the code, and changed-scope regressions are resolved. A document graph check or generated report alone does not satisfy this criterion.

Real providers, live MCP, GPU performance and desktop/hardware validation may retain explicit NOT_RUN limitations when their environments are unavailable. Such limits prevent any broader production/deployment acceptance claim.

Rollback disables the opt-in bridge and stops the runtime, preserving its data and the existing checkout. Do not reset/stash/clean user work or delete database files. This proposal requests no merge, deployment or remote publication.

## Version diff

New plan 0.1.0 introduces six ordered checkpoints, H01-H30 acceptance criteria, bounded repository scope and explicit evidence requirements. This sentence described the original documentation-only 0.1.0 checkpoint; implementation was approved subsequently.

Approval delta 0.1.0 → 0.2.0: user approved the design on 2026-10-03; implementation is authorized within these boundaries.

Implementation delta 0.2.0 -> 0.3.0: owned runtime/API, opt-in bridge, tools/memory/delegation and truthful evaluation implemented; see the verification receipt for PASS/FAIL/NOT_RUN boundaries.
