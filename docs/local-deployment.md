---
id: HUB-DEPLOYMENT-GUIDE
version: 0.3.0
status: active
superseded_by: null
---

# Local deployment and verification

The [README quick start](../README.md#agent-runtime-quick-start) starts a CPU mock service. Python 3.11+ and uv are required. This checkpoint was verified with Python 3.13.7 and uv 0.11.2 on Windows. `uv.lock` pins the environment, including Pydantic AI slim 2.54.0. The wheel contains the runtime and CLI; configuration/workspace files are supplied separately by the operator.

```powershell
uv sync --locked
uv run --locked ruff check runtime
uv run --locked mypy
uv run --locked pytest -q
uv run --locked python -m build --wheel --outdir .hub/dist
node --test eval/tests/*.test.mjs
cargo test --manifest-path src-tauri/Cargo.toml --lib
cargo build --manifest-path src-tauri/Cargo.toml --bins
```

Use `uv run --locked local-llm-hub evaluate` for machine-readable `.hub/evaluation.json`. Its five cases assert instruction following, an actual memory tool side effect, structured output, a coding AST and a reasoning answer. It never executes generated code. Mock mode is labeled `mock-contract`; provider mode is a small task evaluation, not a comprehensive benchmark. Latency is measured wall time. TTFT and decode tokens/sec remain null because the transport is buffered. Error rate uses executed cases, excluding skips.

With the mock service running and URL/token set in the current environment, `LOCAL_LLM_UAT=1` enables `node scripts/run_local_llm_uat.mjs`. It writes a fresh JSON report under `.hub/reports`. Four API assertions can pass; four historical hardware/proxy/UI scenarios stay SKIP until executable fixtures exist. Disabled execution is NOT_RUN. Network, HTTP, JSON or assertion failure creates FAIL and a nonzero exit status. Historical persona reports are preserved but cannot be used as acceptance proof.

The live pytest integration requires an explicitly selected, already served local model. It starts a temporary authenticated Hub API on an ephemeral loopback port and uses the real Pydantic driver, router and HTTP provider. Its five cases check a text answer, a fresh filesystem nonce read plus model follow-up, validated structured output, two model IDs sharing a single endpoint slot, and an actual HTTP disconnect followed by successful reuse of the same session. Structured output uses the SDK's output tool with independent schema validation; this does not test provider-native `response_format`. Tool access is read-only inside a temporary workspace; the database and bearer token are temporary too.

Run from a dedicated PowerShell session after the selected model server is ready. Set `LOCAL_MODEL_CONTEXT` to the context actually served, not the model's theoretical maximum. This example targets the operator-approved temporary Ollama profile used for the recorded acceptance run:

```powershell
$env:LOCAL_LLM_INTEGRATION_TEST = '1'
$env:LOCAL_MODEL_BASE_URL = 'http://127.0.0.1:11435/v1'
$env:LOCAL_MODEL_NAME = 'qwen3.5:4b'
$env:LOCAL_MODEL_CONTEXT = '8192'
$env:LOCAL_MODEL_MAX_TOKENS = '2048'
$env:LOCAL_MODEL_TIMEOUT = '180'
uv run --locked pytest runtime/tests/test_live_integration.py -v --tb=short -o junit_family=xunit1 --junitxml=.hub/live-acceptance.xml
```

`LOCAL_MODEL_API_KEY` is optional for servers that require it; do not put it in YAML, command arguments or reports. Maximum output defaults to 2,048 tokens per provider request, allowing room for thinking models, and provider timeout defaults to 180 seconds. The fixture requires context greater than output budget plus 2,048 tokens for input/schema space. Runtime run/queue limits also bound the suite. Without opt-in all five tests skip; missing setup, absent model or unsupported requested behavior fails enabled tests. No fallback model or mock result can satisfy a live case. Default tests do not need a GPU.

JUnit properties record selected model/context, elapsed time, real provider call counts, reported nullable token usage, observed queue/concurrency and disconnect cleanup time. A cancelled request must release the provider task, endpoint permit and session busy state before recovery. These observations do not prove when GPU computation stopped; TTFT and decode rate are not measured. Preserve failed receipts as well as passing ones and distinguish setup failure from model/runtime failure.

The tests never start model servers, download models, modify production catalogs or change global binding/firewall settings. The temporary server for this checkpoint used only process-local `OLLAMA_HOST=127.0.0.1:11435`, the existing `O:\.ollama\models`, context 8,192, one parallel request and one loaded model. Cloud access and startup blob pruning were disabled; a task-owned Windows Job Object contained the server and its runner descendants and was closed after testing. The [Ollama FAQ](https://docs.ollama.com/faq) documents binding, context, concurrency and cloud controls; [Ollama environment configuration](https://github.com/ollama/ollama/blob/main/envconfig/config.go) documents `OLLAMA_NOPRUNE`. These are operator lifecycle details, not a new Hub server-management feature. See the [verification receipt](architecture/VERIFICATION.md) for executed results and limits.

The optional `compose.yaml` builds only the CPU agent runtime, exposes port 8787 on host loopback, runs as UID 10001, and persists state/workspace in separate named volumes. Run `docker compose up --build -d` after generating `.env`. The container listens on all interfaces internally; host publishing remains loopback. Model servers stay external and independently replaceable. Docker startup, image health and persistence restart are NOT_RUN on the current host because Docker is unavailable. To use real endpoints, provide reviewed container config/paths and a reachable server URL; container loopback refers to the container itself.

Stopping the service or clearing the opt-in desktop bridge environment returns to the legacy desktop route. Preserve `.hub` and operator config; no reset or data deletion is required. The desktop executable build is verified separately from GUI/hardware interaction and installer signing.

Version diff: new repeatable local workflow, evaluation semantics and explicit deployment limits.

0.1.0 -> 0.2.0: expand opt-in live acceptance from one direct completion into five assertions through a real HTTP Hub API, document the served context/output budget and limit cancellation/structured-output claims to what is measured.

## Native desktop repair acceptance

Run `npm run desktop:test` for seven focused JS contract tests, and `node --test eval/tests/*.test.mjs` for the existing evaluation/UAT suite. The VM module flag is scoped to the desktop test script. Run `cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check` and `cargo test --manifest-path src-tauri/Cargo.toml --locked --lib` separately.

The opt-in [native runner](../eval/desktop/native_smoke.py) requires Windows, the runtime virtual environment, a distinct acceptance build, tauri-driver and matching EdgeDriver. The WebDriver capability webviewOptions.userDataFolder pins the profile location (the driver otherwise creates its own temporary profile). See [Microsoft capability reference](https://learn.microsoft.com/en-us/microsoft-edge/webdriver/capabilities-edge-options). It starts a real authenticated Hub with the explicit mock provider, exercises real Tauri IPC/HTTP through UI controls, and uses Windows job containment for cleanup. It never substitutes a mock IPC bridge. Native functional results do not establish GPU inference, installer signing or performance acceptance.

Verified tools: tauri-driver 2.1.0 installed with `cargo install --version 2.1.0 --locked` into the task-local `.hub/tools`; Microsoft EdgeDriver 154.0.4258.53 matched WebView2 154.0.4258.53. The downloaded executable's Authenticode signature is valid, Microsoft Corporation; SHA-256 `008115b68b38437b1c0138f3cced648f61f333cf4623a9895296e7c1c01abcb8`. Follow [official manual setup](https://v2.tauri.app/develop/tests/webdriver/manual-setup/); do not assume a later installed WebView2 still matches this pin.

```powershell
# Keep tools, caches and profiles on the workspace drive.
$env:TEMP="$PWD\.hub\tmp"
$env:TMP=$env:TEMP
$env:TAURI_CONFIG='{"identifier":"com.localllm.hub.acceptance","productName":"Local LLM Hub Acceptance"}'
cargo build --manifest-path src-tauri/Cargo.toml --locked
# Check success, copy the acceptance executable into .hub/desktop/app, then:
.venv/Scripts/python.exe eval/desktop/native_smoke.py --application .hub/desktop/app/tauri-app.exe --driver .hub/tools/bin/tauri-driver.exe --edge-driver .hub/tools/edge-154.0.4258.53/msedgedriver.exe --output .hub/desktop/fresh-run
Remove-Item Env:TAURI_CONFIG
```

Every output directory must be new: previous failures and screenshots are preserved. The runner creates isolated config, SQLite state and a WebView2 profile below it. Do not run against the installed `O:\local-llm-hub\tauri-app.exe`. Client waits allow the bridge's existing 125-second completion deadline; they are not performance thresholds.

### Container prerequisite blocker, 2026-10-05

Ubuntu 26.04 WSL2 is present with systemd and no Docker/Podman/socket or conflicting Docker package. Its registered VHD is on C:, whose measured free space was 370,077,696 bytes (approximately 353 MiB), later 361,238,528 bytes. The guest filesystem's large virtual free capacity is not host capacity. Installing packages/images could exhaust the host. Per the approved repair's prerequisite stop rule, Docker installation/build/start/restart and Linux symlink acceptance are **NOT_RUN / BLOCKED**. No package installation, distro relocation, firewall change, startup enablement or cleanup was performed. Free sufficient host capacity and recheck before continuing the approved isolated Compose acceptance; moving the distro requires separate scope.

0.2.0 -> 0.3.0: add reproducible native test setup and the actual host-storage blocker; preserve the distinction between test provider and real-model acceptance.
