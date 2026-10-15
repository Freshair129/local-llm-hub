# Local LLM Hub readiness fixes — 2026-10-15

| Field | Value |
|---|---|
| Issue | [#3 — Correct lifecycle state and hardware readings before unified local workflow](https://github.com/Freshair129/local-llm-hub/issues/3) |
| Branch | `codex/readiness-fixes-20261015` |
| Base revision | `b6e66e400bfa52166d8d208978061660bf088c36` |
| Scope | Model lifecycle truth, GPU telemetry truth, and isolated desktop mock acceptance |
| Acceptance | Focused tests and native mock UI passed; real model lifecycle and GPU inference remain unverified |

## Changes

- Ollama inventory now distinguishes full model identities, including version and quantization tags. If `/api/ps` is unavailable or malformed, the loaded state is unknown and lifecycle actions are disabled. Start and unload require a valid JSON acknowledgement (`done: true`, without an error) and a follow-up `/api/ps` state match before the UI reports success. See [models.rs](../../src-tauri/src/commands/models.rs#L150), [backends.rs](../../src-tauri/src/commands/backends.rs#L201), and [model.js](../../src/js/model.js#L24).
- Lifecycle actions are offered only where Hub owns and supports the operation. vLLM remains an externally managed server, and local files do not imply a running process. Both appear without Hub start/stop controls. The list, grid, and detail card show unknown or unsupported state explicitly; absent model statistics render as unavailable rather than invented counts, rates, context limits, or quotas. See [types.rs](../../src-tauri/src/models/types.rs#L78), [model_lifecycle.js](../../src/js/model_lifecycle.js#L1), and [card.js](../../src/js/card.js#L58).
- A missing, failed, timed out, or malformed `nvidia-smi` result now produces no GPU readings. The timed-out child process is killed. GPU surfaces preserve real zero readings and show unavailable fields when no reading exists. The change covers the header, observability, process views, sensor panels, tuning panels, downloader estimates, and digital-twin labels; CPU/RAM simulation and fallback behavior outside these GPU fields is not claimed as fixed. See [gpu.rs](../../src-tauri/src/commands/gpu.rs#L56), [gpu_telemetry_view.js](../../src/js/gpu_telemetry_view.js#L4), and [observability.js](../../src/js/observability.js#L22).
- The existing native smoke harness now creates its EdgeDriver temp directory under the unique acceptance output. It checks service loss, fail-closed model selection, mock Hub recovery, and successful Chat/Arena use after recovery. It keeps WebView2 data, config, workspace, database, and temporary files in the verification directory.

## Verification

| Check | Result | Evidence |
|---|---|---|
| JS lifecycle/telemetry helpers | 6 passed, 0 failed | `G:\AI-Studio\verification\2026-10-15-readiness-fixes\local-llm-hub\parent-helper-tests.log` |
| Desktop bridge contracts | 7 passed, 0 failed | `G:\AI-Studio\verification\2026-10-15-readiness-fixes\local-llm-hub\desktop-contract-tests.log` |
| Changed JS syntax | Passed with `node --check` on edited JS modules | `G:\AI-Studio\verification\2026-10-15-readiness-fixes\local-llm-hub\node-check.log` |
| Rust format | Passed with `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check` | `G:\AI-Studio\verification\2026-10-15-readiness-fixes\local-llm-hub\cargo-fmt-final.log` |
| Ollama catalog and identity tests | 11 passed, 0 failed | `G:\AI-Studio\verification\2026-10-15-readiness-fixes\local-llm-hub\cargo-model-tests-final.log` |
| Model start/unload HTTP fixture tests | 14 passed, 0 failed | `G:\AI-Studio\verification\2026-10-15-readiness-fixes\local-llm-hub\cargo-backend-tests-final.log` |
| Reported NVIDIA telemetry parser | 1 passed, 0 failed | `G:\AI-Studio\verification\2026-10-15-readiness-fixes\local-llm-hub\cargo-gpu-parser-test-final.log` |
| Missing/malformed NVIDIA telemetry parser | 1 passed, 0 failed | `G:\AI-Studio\verification\2026-10-15-readiness-fixes\local-llm-hub\cargo-gpu-unavailable-test.log` |
| Isolated native Tauri build | Passed; debug executable SHA-256 `707BF1795022DBFAF1D2A6DE6C1470F4CD57D2F001682AA253941817073AAA69` | `G:\AI-Studio\verification\2026-10-15-readiness-fixes\local-llm-hub\cargo-native-build.log`; executable at `G:\AI-Studio\verification\2026-10-15-readiness-fixes\local-llm-hub\native\app\tauri-app.exe` |
| Native Tauri/WebView2 UI using mock Hub over loopback | 9 passed, 0 failed | `G:\AI-Studio\verification\2026-10-15-readiness-fixes\local-llm-hub\native-smoke-recovery.log`; receipt and screenshots in `G:\AI-Studio\verification\2026-10-15-readiness-fixes\local-llm-hub\native\recovery-run-logged` |
| Whitespace/diff validation | Passed with `git diff --check` | command run from repository root |

The native UI checks exercised model catalog rendering, peer view layout, Chat and Arena mock responses, visible service loss, cleared stale selections, restored controls after the Hub service returned, and a second successful Arena response. The first attempt exposed a test-harness `TEMP` path that did not exist; the failure receipt is retained in `native/fresh-run/`. The next attempt exposed an assertion that expected Arena to re-enable while its model catalog was unavailable; the harness now checks the fail-closed state and then verifies recovery. The final nine-check run passed.

Rust lifecycle HTTP tests use local fixture servers. They validate response acknowledgements and state reconciliation without using the installed Ollama service.

## Acceptance boundary and remaining work

- No model generation, Ollama load/unload, vLLM process control, or GPU inference was performed. Real Ollama lifecycle behavior in the native UI remains **NOT RUN**. A local Rust fixture proves the request/acknowledgement/state-check path; UI helper tests prove rendering and gating.
- This patch does not add a cross-application VRAM owner or scheduler. Endpoint queues remain scoped to each configured endpoint, so Hub does not coordinate memory release with Blender, ComfyUI, ACE-Step, or other processes. The current native backend configuration has no acceptance-only endpoint override; a future real native lifecycle test needs that configuration surface or explicit release of the GPU reservation.
- vLLM and GGUF/local-file start/stop are deliberately reported as unsupported because Hub does not own their process lifecycle. A separate service manager is needed before those actions can be offered.
- `nvidia-smi` polling is observational only. It does not reserve VRAM or prove a model will fit. GPU sensor values were not used to start, stop, or unload a model during acceptance.
- The app uses static frontend files and has no standalone `npm run build` script. The native Tauri build packaged those files. Targeted Rust tests ran; the entire Rust test suite was not run in this pass.

## Verification setup correction

`eval/desktop/native_smoke.py` now assigns `TEMP` and `TMP` to the newly created `<output>/tmp` directory. This removes its dependency on the absent repository-local `.hub/tmp` path and keeps EdgeDriver's extension extraction inside the disposable acceptance tree.
