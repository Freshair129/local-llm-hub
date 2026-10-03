---
id: HUB-DEPLOYMENT-GUIDE
version: 0.1.0
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

The live pytest integration requires `LOCAL_LLM_INTEGRATION_TEST=1`, explicit `LOCAL_MODEL_BASE_URL`/`LOCAL_MODEL_NAME`, and optional key. It makes a real short inference request. Without opt-in it skips; enabled but missing setup fails. Configure an already served model before running it. Default tests do not need a GPU.

The optional `compose.yaml` builds only the CPU agent runtime, exposes port 8787 on host loopback, runs as UID 10001, and persists state/workspace in separate named volumes. Run `docker compose up --build -d` after generating `.env`. The container listens on all interfaces internally; host publishing remains loopback. Model servers stay external and independently replaceable. Docker startup, image health and persistence restart are NOT_RUN on the current host because Docker is unavailable. To use real endpoints, provide reviewed container config/paths and a reachable server URL; container loopback refers to the container itself.

Stopping the service or clearing the opt-in desktop bridge environment returns to the legacy desktop route. Preserve `.hub` and operator config; no reset or data deletion is required. The desktop executable build is verified separately from GUI/hardware interaction and installer signing.

Version diff: new repeatable local workflow, evaluation semantics and explicit deployment limits.
