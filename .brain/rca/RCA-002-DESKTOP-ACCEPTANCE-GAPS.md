---
id: RCA-002-DESKTOP-ACCEPTANCE-GAPS
version: 0.2.0
status: active
superseded_by: null
author: ATHER
date: 2026-10-04
source_commit: 0c6af1d
root_cause_status: confirmed for the listed source contracts
remediation_status: implemented locally; Docker acceptance blocked by host capacity
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
