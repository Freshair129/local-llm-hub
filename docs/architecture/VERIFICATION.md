---
id: HUB-VERIFICATION
version: 0.5.0
status: active
superseded_by: null
date: 2026-10-05
baseline_commit: 12e84fc87c0bbccac3bccf0405382db541d7ef85
scope: local engineering checkpoint
---

# Implemented checkpoint and verification receipt

## Approved repair checkpoint, 2026-10-05

Current repair source: desktop fixes `6c62285` and verification checkpoint `52a668c` on `feat/local-llm-agent-harness`; the R5 runner's exact SHA-256 is in its receipt. User approval covers [HUB-ACCEPTANCE-REPAIR](../plans/HUB-ACCEPTANCE-REPAIR.md). The approved repair scope is **PASS as a local checkpoint**. The historical 2026-10-04 formatting and native-GUI failures below are superseded by this section, not silently erased.

| Gate | Current outcome and scope |
|---|---|
| R1 Rust formatting | PASS; 23 files normalized in their own commit; `cargo fmt --all -- --check` clean |
| Rust library | PASS 61/61, including logical/legacy catalog mapping, malformed catalog and unavailable Hub |
| Focused JS | PASS 7/7: canonical Arena payload/response, unavailable usage, fail-closed Chat/catalog, refresh race, duplicate send, concurrent error guard and non-overlapping telemetry batches |
| Existing Node suite | PASS 7 runner entries (evaluation wrapper includes its existing five assertions) |
| Python | PASS 61, SKIP 6: five explicitly opt-in real-provider cases and one Windows symlink privilege condition. Ruff and strict mypy (20 modules) PASS |
| Documentation | PASS: metadata/links/fences for 37 documents; graph 118 nodes/175 edges; dependency checks and source trace annotations |
| Native Tauri | PASS seven real WebDriver checks through native IPC and authenticated Hub HTTP, explicit CPU mock provider; Chat, Arena, both outage paths and fail-closed catalog. This is desktop functional evidence, not real-model/GPU or installer evidence |
| R5 Docker | PASS 8/8: Ubuntu 26.04 WSL2, Docker Engine 29.8.2, Compose 5.6.0; CPU mock health/auth/catalog/chat, unprivileged/read-only/capability/loopback checks, Linux symlink escape rejection and project-memory persistence across restart. Compose containers/network removed; named volumes and image retained; Docker units left inactive/disabled; port 8787 has no listener |
| R6 Cancellation | Preserved Ollama log correlates cancelled task 674, slot stop/release and successful recovery task 704. GPU kernel stop latency NOT_MEASURED; no inference rerun for documentation |
| Model metadata | Exact existing local 407-byte SHA-256 copy restored; real Ollama `/api/show` returns 200 for MaralGPT. `/api/ps` empty: no 9B inference or weights download. Owned listener subsequently verified closed |

The native test uses tauri-driver 2.1.0 and Microsoft EdgeDriver/WebView2 154.0.4258.53, a separate app identifier and an explicit task-local profile. Run9 and run10 pass; earlier failed receipts are preserved. The canonical source-linked final receipt is `.hub/desktop/acceptance-final/receipt.json`, with executable SHA-256, elapsed checkpoints, screenshots and process/port cleanup. The R5 Docker receipt is `.hub/container/20261005T090831Z-ef4243c8.json` (SHA-256 `FD4D45F3B840BC7A72D0CD7B686926C99771B80E59CB3F37C37FE722D9006ED5`); it binds the tested Compose, Dockerfile and runner hashes to the built image. Raw receipts are local ignored artifacts; hashes and source identity are appended to [packet lineage](../lineage/packet-lineage.jsonl).

Native testing uncovered two additional causes documented in [RCA-002](../../.brain/rca/RCA-002-DESKTOP-ACCEPTANCE-GAPS.md): a missing Hardware subpanel closing tag hid subsequent peer views, and synchronous sensor reads combined with overlapping polling starved IPC. The markup now gives every peer view the same parent. Sensor reads run on a blocking worker behind async IPC; a telemetry batch completes before another poll begins. The two-second cadence, sensor payloads and backend contracts remain intact. Run7 previously timed out on Arena outage; run9 completes all seven checks at 21.48 seconds from launch. These are functional observations, not a latency benchmark.

Architecture review: the new catalog derives selection from the same Hub/legacy mode as execution, exposes no endpoint URL or token, and fails closed. Physical inventory stays separate. Buffering remains explicit; TTFT, missing tokens and GPU activity are not fabricated by Chat/Arena. Original source/installed application remain untouched; this is a local branch, with no merge, push, deployment or release.

Known remaining limits: the Windows true-symlink fixture remains SKIP because this host lacks the existing privilege; Linux symlink escape rejection and the Windows junction check pass. Streaming, live MCP, other providers and signed installer remain deferred/unverified. The pre-existing topbar overflows at a 1200-pixel window (native refresh check widens to 1600); responsive redesign and legacy simulated hardware/seeded analytics surfaces are outside this approved repair and are not accepted as measurements. LHM pipe reads still lack an intrinsic deadline; the worker isolation prevents them blocking the UI, but sidecar recovery is separate work.

Version diff 0.4.0 -> 0.5.0: close the approved Docker gate with 8/8 bounded container checks, Linux symlink coverage and explicit cleanup evidence; update the harness document/graph count. The previous checkpoint history follows.

## Historical runtime checkpoint

The approved runtime is implemented on local branch `feat/local-llm-agent-harness` in the isolated checkout `O:\local-llm-hub-worktrees\harness-design`. The original source checkout is `D:\local-llm-hub`; the installed application in `O:\local-llm-hub` was not replaced. No pull, reset, merge, deployment or remote publication occurred. User approval was recorded on 2026-10-03 after architecture/RCA review.

Runtime flow: authorized HTTP client or opt-in desktop bridge -> native API -> isolated AgentRuntime -> PydanticDriver -> owned ModelRouter/context policy -> endpoint scheduler -> mock/OpenAI-compatible provider. Tools execute outside inference leases through policy checks and scoped SQLite memory; delegation uses separate child context and shared root budgets.

Implemented: portable validated YAML/env config; model/capability registry; alias/role/capability/load/fallback routing; bounded retries/queues/timeouts; health metrics; configurable agents; temporary sessions; bounded context; native file/search/shell/HTTP/memory/delegation tools; inherited deny-first permissions; persistent SQLite project/agent memory; authenticated API; limited text chat-completions compatibility; opt-in Tauri bridge; mock evaluation and truthful UAT failure reporting. The MCP boundary, summarization, capability-probe and routing-policy protocols are extension points with only the stated initial implementation.

## Initial checkpoint checks (2026-10-03)

Commands run from the isolated checkout. Python commands used `.venv\Scripts\python.exe`, `ruff.exe` and `mypy.exe`; the documented `uv run --locked` form selects the same locked environment. Python 3.13.7, uv 0.11.2, Pydantic AI slim 2.54.0. Final test counts include documentation graph/link/trace checks.

| Check | Result | Evidence |
|---|---|---|
| Locked install | PASS | `uv sync --python <installed Python313> --cache-dir .uv-cache`; 51 packages resolved; private environment/token created without printing it |
| Python lint | PASS | `ruff check runtime`: zero findings |
| Python strict typecheck | PASS | `mypy`: no issues in 20 source files |
| Python tests | PASS_WITH_SKIPS | 61 passed, 2 skipped, 0 failed; `.hub/pytest.xml` is the local machine-readable receipt |
| Documentation graph/links/trace | PASS | 32 harness documents; graph 115 nodes / 167 edges; no missing paths, dangling/duplicate edges, metadata/link/trace errors or requirement cycles; all 83 baseline nodes and 120 edges preserved |
| First-party JavaScript syntax | PASS | `node --check` across 65 JS/MJS files outside vendor code |
| Node regressions | PASS | `node --test eval/tests/*.test.mjs`: 7 runner entries, comprising 6 new UAT tests plus the existing harness's 5 assertions |
| Rust bridge tests | PASS | 2 focused tests: disabled/misconfigured settings, actual loopback HTTP success and explicit service outage |
| Rust full library suite | PASS | `cargo test --manifest-path src-tauri/Cargo.toml --lib`: 59 passed, 0 failed |
| Desktop executable compilation | PASS | `cargo build --manifest-path src-tauri/Cargo.toml --bins`: finished dev build; no GUI launched |
| Python wheel | PASS | `python -m build --wheel --outdir .hub/dist`: runtime wheel built; config is operator-supplied |
| Real loopback mock API + curl | PASS | CLI service launched; authenticated curl returned `hello from hub` with model `mock-local`; file-read, delegation and structured-output requests passed; owned service stopped |
| Deterministic evaluation | PASS | Five executed cases, zero failed/skipped; `mode=mock-contract`; TTFT/tokens-sec null |
| UAT against running mock API | PASS_WITH_SKIPS | 4 executed PASS, 0 FAIL, 4 legacy scenarios SKIP; historical reports unchanged |
| Real model inference | NOT_RUN | Explicit opt-in integration test skipped; no real endpoint/model configured for this run. Baseline loopback Ollama/vLLM/proxy probes timed out |
| Filesystem link coverage | PASS_WITH_LIMITATIONS | Windows junction escape rejected; true symlink fixture skipped because host privileges do not permit creation |
| Docker build/start/restart | NOT_RUN | Docker CLI absent from PATH and standard Docker Desktop location; Compose/Dockerfile supplied but execution unverified |
| GUI/hardware/installer acceptance | NOT_RUN | Building the executable does not verify WebView interaction, GPU drivers, installer or signing |
| Repository-wide Rust formatting | FAIL (baseline) | Existing `cargo fmt --check` produced 2,160 diagnostic lines before code changes; broad formatting left out of scope. New bridge is rustfmt-clean |

The loopback smoke invoked curl via `curl.exe --config -`, sending `header = "Authorization: Bearer <private token>"` through stdin and posting `{"input":"echo:hello from hub"}` to `/v1/agents/assistant/run`. Tokens were not included in captured output. Smoke output was `CURL_AGENT_PASS mock-local`, then API passes for coder/orchestrator/structured. The generated UAT JSON reports real executed/skipped denominators.

## Real-provider continuation (2026-10-04)

User authorized the next live acceptance step and explicitly selected a temporary loopback Ollama server with the existing `qwen3.5:4b` model. No product runtime or desktop code changed in this continuation. The previous direct-provider greeting test was replaced by five cases through a real authenticated HTTP Hub API, the Pydantic driver, router and OpenAI-compatible provider. Fixtures use temporary roots/database/token and grant only filesystem.read where needed.

Result: **5 PASS, 0 FAIL, 0 SKIP**, exit 0, JUnit suite time **115.561 seconds**. Command: `.venv\Scripts\python.exe -m pytest runtime/tests/test_live_integration.py -v --tb=short -o junit_family=xunit1 --junitxml=.hub/live/2026-10-04-run1.xml`. Raw local metadata and lifecycle receipt: `.hub/live/2026-10-04-run1-metadata.json`. The appended packet-lineage entry preserves the result summary and raw receipt hashes; local `.hub` artifacts remain ignored.

| Case | Result | Observed evidence | JUnit case time |
|---|---|---|---|
| Text | PASS | Actual answer contains READY; one provider request; reported usage 39 input / 136 output tokens | 99.271 s |
| Filesystem tool round trip | PASS | Model calls filesystem__read for a fresh nonce.txt; matching tool-call ID/result contains the nonce; second model request consumes it and returns it; usage totals 757 / 196 | 4.153 s |
| Structured output | PASS | Output tool returns the validated object `{"answer":42,"label":"ready"}`; one provider request; usage 325 / 112 | 2.696 s |
| Shared endpoint concurrency | PASS | Two simultaneous agent requests use distinct model IDs on the same endpoint; provider/scheduler peak active 1, observed queued 1, both complete and counters return to zero; usages 39 / 127 and 39 / 92 | 4.420 s |
| Disconnect and recovery | PASS | A real HTTP request is cancelled while the provider is active; transport task cancels, permits return, session busy clears and history remains empty; same session then answers READY, usage 39 / 135 | 3.575 s |

Disconnect-to-Hub-cleanup measurement was **29.21 ms**. This is client/transport/task cleanup, not a measurement of GPU cancellation latency. No usage is fabricated for the aborted generation. Structured output exercises the SDK output tool and Hub schema checking, not provider-native `response_format`. Case times include test setup/teardown; the first case includes a cold model load. They are not TTFT, decode throughput or a controlled performance comparison. There was other GPU activity on this host.

Observed server: **Ollama 0.35.1**, model family qwen35, **4.7B / Q4_K_M**, manifest digest `2a654d98e6fba55d452b7043684e9b57a947e393bbffa62485a7aac05ee4eefd`. Advertised capabilities were completion, vision, tools and thinking; only behavior in the five executed cases was validated. Model metadata reports a 262,144-token maximum; the actual loaded model from `/api/ps` reports **8,192 context**, matching the test configuration. Output budget was 2,048 tokens per request, endpoint concurrency one. `/api/ps` reported 3,341,958,511 bytes of VRAM for the loaded model; this is a server-reported snapshot, not a peak process measurement.

Lifecycle verification: the owned server bound only `127.0.0.1:11435`, began with no loaded models and ended with only the selected model loaded. Its process environment disabled cloud access and startup pruning. Closing the task-owned Windows Job Object stopped the server/runner; the listener was absent afterwards and no Ollama inference process remained in the GPU process inventory. Existing process/user `OLLAMA_HOST=0.0.0.0:11434` values were unchanged. No models were downloaded; no global environment, firewall, startup task, installed application or production catalog was modified. The original `D:\local-llm-hub` main checkout remains clean.

Current regression checks: default Python suite **61 PASS / 6 SKIP / 0 FAIL** (five live tests intentionally disabled plus one privileged symlink fixture); lint PASS; strict typecheck PASS for 20 runtime source files. An enabled live test with missing endpoint/model/context was also executed and failed at setup as required; the outer negative check PASS confirms fail-closed behavior. Rust/Node/build results above are retained from the initial checkpoint and were not rerun because this continuation changes only tests and documentation. Docker, live MCP, interactive GUI, other providers/models, and backend GPU cancellation timing remain NOT_RUN. The baseline Rust formatting failure remains unresolved and out of scope.

Out-of-scope observations: model discovery emitted warnings about missing templates on some unrelated installed models and a missing blob for `hf.co/MaralGPT/MaralGPT-Mythos-9B-2606-GGUF:Q4_K_M`. The selected qwen3.5:4b files and executed cases succeeded; unrelated models were not repaired or removed. The absent pre-existing inference listener and the current global bind preference were recorded but not diagnosed or changed.

## Acceptance mapping

### Follow-up audit, 2026-10-04

The user's request to fix all remaining items triggered a source/contract audit, recorded in [RCA-002](../../.brain/rca/RCA-002-DESKTOP-ACCEPTANCE-GAPS.md) and the [draft repair plan](../plans/HUB-ACCEPTANCE-REPAIR.md). Confirmed findings are mismatched desktop/Hub model namespaces, Arena request/response field mismatches and fabricated unavailable metrics. Isolated reproductions returned MODEL_NOT_FOUND for an unregistered physical model name and a JS TypeError when Arena consumed the canonical ChatResponse. These are not native GUI execution results. Formatting remains FAIL across 23 files; Docker and WebDriver prerequisites are absent. No product fix is claimed at this stage.

Retrospective inspection of the preserved live Ollama log provides additional server-side cancellation evidence: lines 832-834 record the cancelled request, `cancel task, id_task = 674`, and `stop processing` for that same slot/task; lines 862-877 record task 704 completing the recovery request. This confirms server-task cancellation/slot release in the existing run, beyond the client cleanup assertion. The slot messages lack precise timestamps, so GPU kernel cancellation latency remains unmeasured. No new inference was run for this audit.

The unrelated MaralGPT model warning was narrowed to a missing 407-byte config blob, not missing weights: its 5,629,109,248-byte model layer exists. No model files were changed. The draft plan records bounded metadata recovery, environment setup and the explicit remaining limits.

| Criteria | Proof and limit |
|---|---|
| H01-H02 | Configuration/registry tests: malformed/duplicate/unknown fields, missing secret/env, invalid root/context/schema, aliases, cycles and missing references |
| H03-H05 | Routing/guard tests: explicit/role/alias selection, idle endpoint selection, capability rejection, local-only fallback, transient attempts, nonretryable auth failure |
| H06-H08 | Shared-model endpoint pool, distinct endpoint progress, bounded queue, queued/in-flight cancellation, actual provider/root deadlines and permit cleanup |
| H09-H10 | Definition loading, separate prompts/history/memory, wrong-agent session rejection, per-session busy guard and expiry |
| H11 | Full-turn eviction, system/latest pinning, byte/schema/output budget, tool-pair preservation and orphan rejection |
| H12-H15 | Native/MCP grant/schema/output bounds; traversal/UNC/ADS/device/junction rejection; exact argv/environment; normal descendant cleanup after timeout/parent exit; local HTTP/DNS/redirect denial. True symlink test SKIP |
| H16-H17 | Depth 1-3 passes, depth 4 fails; shared root request budget; inherited write/cloud authority; same endpoint/root concurrency of one completes delegation |
| H18 | SQLite CRUD, scope isolation, literal search, transactional key uniqueness, reopen persistence and expiry |
| H19-H23 | HTTP API through real SDK/owned router/mock; authenticated catalogs/runs, unsupported fields and large-body rejection, nullable usage, secret/prompt log canaries, client disconnect cancellation |
| H24 | Fake MCP adapter discovery/call/schema/permission/timeout/output-limit tests. Real MCP transport NOT_RUN and not bundled |
| H25 | Rust HTTP bridge unit/integration tests and whole library/executable build. Interactive desktop smoke NOT_RUN |
| H26 | Locked environment, lint/typecheck/tests/wheel and real CLI/curl launch |
| H27 | Runtime-only container/volumes/loopback publishing defined. Image/start/restart acceptance NOT_RUN |
| H28-H29 | Assertion-derived five-case evaluation; six UAT regression cases plus real mock-service acceptance. Old hardware/UI scenarios remain SKIP |
| H30 | Five opt-in real-provider cases PASS on the explicitly selected Ollama/qwen3.5:4b profile; other models/backends and native structured decoding remain unverified |

## Architecture review

Reviewed dependency direction, process ownership and failure boundaries against the approved parent/peer docs. Provider code knows no agent policies/memory; SDK types remain inside the execution adapter; raw completions and agents share one router/scheduler. No inference permit is held across tools/delegation. Descendants cannot gain parent-denied tools, project scope or cloud egress. During verification, independent output-schema checking and inherited cloud authority were added and covered by regressions. The default service does not log prompts or upstream bodies; CLI suppresses transport INFO logs that could expose URL query data. This is author review, not an independent security audit.

Known boundaries: one service worker; trusted local operator; exact-command policy is not an arbitrary-code OS sandbox; path checks assume trusted roots without hostile races/hard links; buffered transport; byte-based context approximation; ephemeral conversation sessions; no transactional rollback of completed tool side effects. See [permissions](../permissions.md) and [providers](../providers.md).

## Version diff and remaining work

| Baseline 12e84fc | This checkpoint |
|---|---|
| Desktop/script-specific inference | Separate runnable runtime with opt-in desktop bridge |
| Inventory/tags | Model and capability registry, routing and shared endpoint limits |
| Script/global contexts | Isolated bounded sessions, tools, memory and delegation |
| Persona-generated UAT verdicts | Actual assertions, errors, executed denominators and explicit skips |
| Architecture draft 0.1.0 | Approved 0.2.0, implemented architecture/ADRs 0.3.0 and this evidence receipt |

Partially implemented: MCP has an adapter interface and fake adapter verification, without a shipped live transport; Docker packaging is written but not executed. Planned: streaming/TTFT, model tokenizers/summarization, capability probing, alternative routing/memory backends, distributed coordination and durable session resumption. Existing unrelated frontend streaming claims and historical generated reports are not acceptance evidence. No UI redesign or GPU model lifecycle migration was attempted.

Completed continuation: the selected real-provider matrix now passes. Remaining acceptance work includes an interactive desktop bridge/GUI smoke and Docker execution on a host with Docker available; neither is implied by these live API results.

0.1.0 -> 0.2.0: preserve initial evidence and add actual real-provider results, model/context identity, bounded claim semantics, cleanup proof and current default-suite skip counts. No runtime API or behavior change.

0.2.0 -> 0.3.0: add confirmed desktop contract findings, distinguish server-task cancellation evidence from unmeasured GPU timing, and link the reviewable repair proposal. Documentation and diagnostic observations only; remediation is not yet implemented.

## Source and receipt identity

Implementation commit: `2349906a7f5f4c71f0badd3f542d3295b8abf3d9`. The append-only [packet lineage](../lineage/packet-lineage.jsonl) references this source and records the shared executed suite (63 collected, 61 PASS, 2 SKIP, zero failures/errors; 6,131 ms JUnit suite time). These are local-checkpoint receipts, not merged/released packet closure or independent review. The final repository diff is relative to baseline `12e84fc`. The original main checkout remained clean at that baseline.

Live acceptance source commit: `3d7c0c3ff17e40bc573e65a6ed46fc7033de7cf1`. The subsequent `TC-HUB-LIVE-001` lineage entry records five real-provider passes, individual observations, model digest, served context, lifecycle cleanup, default-suite results and SHA-256 hashes of local raw receipts. The product runtime is unchanged from implementation commit `2349906a7f5f4c71f0badd3f542d3295b8abf3d9`.
