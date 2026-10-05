---
id: RCA-002-DESKTOP-ACCEPTANCE-GAPS
version: 0.7.0
status: active
superseded_by: null
author: ATHER
date: 2026-10-04
source_commit: 0c6af1d
root_cause_status: confirmed for the listed source contracts
remediation_status: approved repairs and R5 container acceptance verified locally; Windows true-symlink fixture remains skipped
---

# Desktop contract failures and remaining acceptance gaps

## Symptom

The real Hub API passes its five model tests, but this does not exercise the desktop selectors or Arena caller. With the Hub bridge enabled, a physical provider model name can be rejected by the Hub registry. Arena uses a different IPC payload and response shape from the command it invokes. Repository-wide Rust formatting also fails. Docker and native desktop execution remain unverified.

## Evidence

All observations below are from source commit 0c6af1d and read-only probes on 2026-10-04. Diagnostic artifacts are local, ignored files under `.hub/fix-triage/`.

| Finding | Source or executed observation |
|---|---|
| Chat catalog and execution target disagree | [chat.js](../../src/js/chat.js) initializes selection from physical `models[].name`. [list_all_models](../../src-tauri/src/lib.rs) discovers legacy backends, while send_chat_message switches execution to Hub when configured. [HubBridge::chat](../../src-tauri/src/commands/hub.rs) forwards that name unchanged. [ModelRegistry::resolve](../../runtime/local_llm_hub/registry.py) accepts only configured logical IDs/aliases. |
| Reproduced model rejection | In-memory execution of the real Hub API with default config returns 200 for mock-local and 404 / MODEL_NOT_FOUND for qwen3.5:4b. Receipt: desktop-model-contract.json. This proves the contract mismatch for an unregistered physical name, not a native GUI execution. |
| Arena argument mismatch | [executeModelInference](../../src/js/arena.js) sends `req.model_id`; the Rust command requires `request.model`, per [ChatRequest](../../src-tauri/src/models/types.rs). It also hardcodes the Ollama backend. |
| Arena response mismatch | The same function reads `res.response` and `res.eval_count`; ChatResponse supplies `content` and `completion_tokens`. Executing the unchanged JS function with a canonical ChatResponse produces `TypeError: Cannot read properties of undefined (reading 'length')`. Receipt: arena-contract.json, including the captured request. This is an isolated JS contract reproduction, not a native IPC pass. |
| Fabricated metrics | Arena assigns TTFT using Math.random and estimates missing token counts from response length. The approved transport is buffered, so neither constitutes observed TTFT or provider token usage. Chat records the literal CUDA Active without GPU evidence. |
| Formatting | cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check exits 1: 160 diff regions across 23 files, 2,160 diagnostic lines. rustfmt-check.txt contains the exact changes requested by the formatter. |
| Missing test environment | Docker CLI/Desktop and tauri-driver/EdgeDriver are absent from Windows discovery. Registered Ubuntu is WSL2, Ubuntu 26.04; its VHD location is on C:. A read-only shell probe finds neither docker nor podman nor a Docker socket. No packages were installed. |

## Root Cause

1. The desktop migration switches the inference destination without switching the model catalog and selection namespace. Physical inventory and executable Hub model IDs are different contracts.
2. Arena was authored against a req/model_id/response/eval_count interface, while its actual command exposes request/model/content/completion_tokens. No adapter reconciles them.
3. Metrics presentation substitutes invented values for unavailable measurements. Buffered completion duration cannot establish time to first token.
4. Existing Rust source is not normalized to the installed rustfmt output. This is a formatting failure, not evidence of a Rust runtime defect.

Docker and WebDriver absence are environment blockers. No container runtime or native GUI failure is claimed without executing those paths.

## Why the issue escaped detection

The existing Rust bridge test calls HubBridge directly with a matching model ID. Live Python tests use known registry IDs and do not run the JS selectors or Arena. They therefore cannot catch frontend argument names, rendering fields or source-selection drift. Compiling Rust does not enforce rustfmt output. The repository has no .github workflow directory at this checkpoint; historical human review practices are unknown.

## Proposed prevention

- Introduce one explicit chat catalog contract for Chat and Arena, keeping physical model-management inventory separate. Hub errors must not silently switch catalog or inference back to legacy backends.
- Keep the existing ChatRequest/ChatResponse contract and correct both callers. Test the actual exported UI behavior with a canonical command response, including failure and unavailable-metric cases.
- Show unavailable TTFT/token metrics as unavailable. Label measured total response duration and any end-to-end rate accurately; remove random values and inferred GPU activity.
- Run rustfmt check as a documented acceptance command. Apply only mechanical formatting to the 23 affected files.
- Execute native desktop and container acceptance after preparing their explicit prerequisites, retaining distinct PASS/FAIL/NOT_RUN results.

The concrete contracts, change map, environment actions and exit criteria are in the [repair proposal](../../docs/plans/HUB-ACCEPTANCE-REPAIR.md). No product code is changed by this RCA.

## Version diff

### Native execution finding, 2026-10-05

Native run7 additionally records Chat completion at 23.69 seconds, Arena completion at 46.08 seconds, and visible Chat outage only at 130.51 seconds; Arena's outage exceeds its 145-second wait. This is a failed desktop acceptance, not model slowness (provider is deterministic mock). `get_sensor_tree` is a synchronous Tauri command performing sysinfo disk enumeration and blocking LHM pipe reads on the UI command thread. `updateTelemetryDOM` dispatches three additional sensor reads every two seconds without awaiting them; the installed LHM sidecar is actually launched in the native run. These unbounded overlapping synchronous requests can starve unrelated IPC dispatch and result delivery. Prevention within R4: move sensor reads to a blocking worker behind an async IPC command and await the modular refresh batch before allowing the next telemetry poll. Preserve sensor payloads and hardware behavior; do not redesign telemetry or invent sensor values. The native default-cadence outage test is the regression check. A diagnostic pause late in run7 did not drain its existing backlog before the deadline.

Symptom: WebDriver selects Chat but its input is not interactable. Evidence: `.hub/desktop/run4/receipt.json` records `view-chat` and its input at 0x0; its parent is `view-gpu` with computed `display:none`. The screenshot shows the selected Chat navigation with an empty content area. Root cause: the Hardware view's missing closing div nests subsequent peer view panels inside it. Navigation correctly hides Hardware, consequently hiding Chat and Arena too. Source compilation and isolated JS tests never inspect the parsed document hierarchy. Prevention: close the Hardware panel before the next peer panel and assert every `.view-panel` is a direct child of `views-container` in native acceptance, alongside real interactability. This minimal markup correction is necessary for approved R4 Chat/Arena acceptance; it is not a layout redesign.

New 0.1.0: source-backed desktop RCA, isolated reproductions, formatter baseline and environment blockers. Remediation awaits review of the proposed contract changes.

0.1.0 -> 0.2.0: approved repairs implemented. Run9 passes seven native checks at the unchanged 2-second polling cadence: Chat at 9.61 seconds from launch, Arena at 9.93, Chat outage at 12.41, Arena outage at 14.86 and catalog failure at 21.48. This before/after evidence confirms the IPC starvation repair; it is a functional run, not a performance benchmark. The HTML correction closes tm-panel-sectors before its performance sibling, allowing the existing later close tag to close view-gpu. Current evidence and remaining gates are in [verification](../../docs/architecture/VERIFICATION.md).

### WSL acceptance runner path finding, 2026-10-05

**Symptom:** the first container-runner invocation exited before Compose configuration or image build.

**Evidence:** WSL Git reported `fatal: not a git repository: /mnt/o/local-llm-hub-worktrees/harness-design/D:/local-llm-hub/.git/worktrees/harness-design` while resolving `git rev-parse HEAD`. No Docker resources were created by that invocation.

**Root cause:** the Windows worktree's `.git` pointer contains host-specific `D:` metadata. Linux in WSL resolves that pointer using Linux path rules, so it cannot discover the Windows Git common directory from the mounted O: checkout.

**Why it escaped detection:** the runner was authored and linted on Windows, where Git resolves the worktree pointer. The container acceptance executor is Ubuntu WSL, a separate filesystem/path environment.

**Proposed prevention:** obtain the source commit in the Windows checkout and pass the non-secret commit ID to the Linux runner through its environment; keep Docker build and service lifecycle actions inside WSL. This does not alter Git metadata or the worktree.

0.2.0 -> 0.3.0: record the WSL-only Git metadata failure before changing the acceptance runner.

### Docker daemon lifecycle finding, 2026-10-05

**Symptom:** the second runner invocation exited before Compose configuration or image build because the Docker CLI could not connect to `/var/run/docker.sock`.

**Evidence:** `systemctl is-active docker.service docker.socket containerd.service` returned `inactive` for all three units, and the Docker socket did not exist. Docker Engine and Compose packages were installed; the daemon had intentionally been left stopped after package verification. The failed runner entered its cleanup path and left the units inactive.

**Root cause:** the acceptance runner queried server version before starting the task-authorized temporary Docker service. Installing the Engine does not imply that its daemon is running.

**Why it escaped detection:** the earlier preflight verified package candidates, CLI/Compose versions and Compose configuration, but did not execute a server request after a managed service start. The first runner ordering also placed the server-version query before service startup.

**Proposed prevention:** start `docker.service` inside the runner's guarded lifecycle, execute acceptance only after it responds, then stop Docker-related units in `finally` and verify all are inactive.

0.3.0 -> 0.4.0: document the daemon-state prerequisite before adding temporary service startup to the runner.

### Container health retry and cleanup-state findings, 2026-10-05

**Symptom:** Compose build/start returned successfully, but the runner reported failure on its first health probe. It also reported cleanup-state failure although Docker units were stopped.

**Evidence:** receipt `.hub/container/20261005T085057Z-1d7e0d4a.json` records Docker 29.8.2, Compose 5.6.0, successful `compose down` (exit 0), preserved named volumes, and port 8787 closed. Runner control flow reached the health wait only after `docker compose up --build --detach` returned zero. The probe error is `ConnectionResetError: [Errno 104] Connection reset by peer`. `systemctl is-active` called once per unit returned `inactive` for all three units. The multi-unit `systemctl show --property=ActiveState --value ...` output instead included blank separators; the runner stored five lines for three units and falsely failed its exact comparison.

**Root Cause:** the health loop retried URL/timeout/JSON errors but omitted Python `ConnectionError`, so a transient connection reset aborted health polling before the deadline. The cleanup check assumed one output line per unit from a multi-unit systemctl query, while systemd emits blank separators between records.

**Why the issue escaped detection:** lint and Compose configuration validation do not exercise container startup resets or systemd's multi-unit output format. The first real run reached both paths.

**Proposed prevention:** retry connection errors until the bounded health deadline and capture short, token-redacted container state/log diagnostics only if the deadline expires. Query each unit separately and verify its trimmed state.

0.4.0 -> 0.5.0: record the observed first-run health and shutdown-check failures before changing the runner.

### Port-closure probe finding, 2026-10-05

**Symptom:** all seven runtime acceptance checks passed, but the cleanup receipt reported port 8787 occupied.

**Evidence:** receipt `.hub/container/20261005T085431Z-be821dc3.json` records all seven checks PASS, Compose down exit 0, preserved volumes and all Docker units inactive. Its post-cleanup bind probe returned an `OSError`. A follow-up `ss` query found no listening socket or remaining TCP state on port 8787; a fresh bind succeeded; Windows also reported no listener. The original bind exception was not retained, so its transient kernel-level cause is indeterminate.

**Root Cause:** the runner treated any failure to bind as proof of an active listener. Bindability is not a listener-specific check, so a transient post-teardown socket condition can create a false cleanup failure even when no listener remains.

**Why the issue escaped detection:** before running the full lifecycle, only a pre-start bind was exercised. The post-shutdown branch had not been validated against a listener-table observation.

**Proposed prevention:** inspect the Linux LISTEN table for the exact loopback port after Compose and service shutdown; do not infer a listener from a generic bind error.

0.5.0 -> 0.6.0: document the false-negative cleanup probe and the limit on what the captured evidence can establish.

### R5 capacity and container acceptance result, 2026-10-05

**Symptom:** Docker acceptance could not initially run because C: had only 590,536,704 free bytes while the Ubuntu WSL2 VHD was stored on C:.

**Evidence:** the approved exact pip-cache purge removed 1,012 HTTP entries and measured 4,720,885,760 reclaimed bytes. The final `.hub/container/20261005T090831Z-ef4243c8.json` receipt (SHA-256 `FD4D45F3B840BC7A72D0CD7B686926C99771B80E59CB3F37C37FE722D9006ED5`) records eight PASS checks, image/source hashes, preserved volumes, zero remaining task containers/networks, inactive/disabled units and zero port-8787 listeners. The final C: recheck reported 7,608,295,424 free bytes. Linux symlink escape was denied by `PermissionPolicy`; the Windows true-symlink fixture remains SKIP because host privilege is unavailable.

**Root Cause:** the initial blocker was physical host capacity, not guest filesystem capacity: the dynamically growing WSL VHD consumed C: while the Linux guest reported a much larger virtual free-space value. The cache purge made the already approved Docker installation/build feasible.

**Why the issue escaped detection:** this did not escape detection; the host-capacity prerequisite was measured and stopped before package installation. The corrective process preserves separate Windows host and WSL guest measurements.

**Proposed prevention:** check Windows free space and WSL VHD placement/size before installing or building; never use guest `df` as a substitute for host capacity. Keep the exact-cache scope and recheck physical free space after builds.

**Outcome:** Docker Engine 29.8.2 and Compose 5.6.0 passed the approved 8/8 CPU-mock container acceptance. Services are left inactive/disabled, task containers/network are removed, and the image and named volumes remain for reproducible reruns. Broader live-provider/GPU, streaming, MCP and installer claims remain unverified.

0.6.0 -> 0.7.0: close the measured C:-capacity Docker blocker with 8/8 R5 acceptance; retain the Windows true-symlink SKIP and deferred-runtime limits.
