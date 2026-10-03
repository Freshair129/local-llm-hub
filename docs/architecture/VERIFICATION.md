---
id: HUB-VERIFICATION
version: 0.1.0
status: active
superseded_by: null
date: 2026-10-03
baseline_commit: 12e84fc87c0bbccac3bccf0405382db541d7ef85
scope: local engineering checkpoint
---

# Implemented checkpoint and verification receipt

The approved runtime is implemented on local branch `feat/local-llm-agent-harness` in the isolated checkout `O:\local-llm-hub-worktrees\harness-design`. The original source checkout is `D:\local-llm-hub`; the installed application in `O:\local-llm-hub` was not replaced. No pull, reset, merge, deployment or remote publication occurred. User approval was recorded on 2026-10-03 after architecture/RCA review.

Runtime flow: authorized HTTP client or opt-in desktop bridge -> native API -> isolated AgentRuntime -> PydanticDriver -> owned ModelRouter/context policy -> endpoint scheduler -> mock/OpenAI-compatible provider. Tools execute outside inference leases through policy checks and scoped SQLite memory; delegation uses separate child context and shared root budgets.

Implemented: portable validated YAML/env config; model/capability registry; alias/role/capability/load/fallback routing; bounded retries/queues/timeouts; health metrics; configurable agents; temporary sessions; bounded context; native file/search/shell/HTTP/memory/delegation tools; inherited deny-first permissions; persistent SQLite project/agent memory; authenticated API; limited text chat-completions compatibility; opt-in Tauri bridge; mock evaluation and truthful UAT failure reporting. The MCP boundary, summarization, capability-probe and routing-policy protocols are extension points with only the stated initial implementation.

## Executed checks

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

## Acceptance mapping

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
| H30 | Live integration exists behind explicit env flag; it was NOT_RUN, never counted as a passed real model test |

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

Next highest-value task: run the opt-in real-provider acceptance matrix against one explicitly configured, already served local model, validating tool calls, structured output, cancellation and concurrency using its actual capability/context settings.

## Source and receipt identity

Implementation commit: `2349906a7f5f4c71f0badd3f542d3295b8abf3d9`. The append-only [packet lineage](../lineage/packet-lineage.jsonl) references this source and records the shared executed suite (63 collected, 61 PASS, 2 SKIP, zero failures/errors; 6,131 ms JUnit suite time). These are local-checkpoint receipts, not merged/released packet closure or independent review. The final repository diff is relative to baseline `12e84fc`. The original main checkout remained clean at that baseline.
