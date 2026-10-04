---
id: HUB-DEPLOYMENT-GUIDE
version: 0.2.0
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
