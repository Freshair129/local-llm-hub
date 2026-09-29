# ADR-007: Single-Source Push-Based Telemetry via Tauri Events

| Field | Value |
|-------|-------|
| **ADR ID** | ADR-007 |
| **Status** | Accepted |
| **Date** | 2026-09-30 |
| **Author** | Boss / Core Architecture |
| **Domain** | Observability & Telemetry |
| **Related** | [FR-006](../requirements/FR-006-gpu-monitor.md), [FR-016](../requirements/FR-016-3d-hardware-digital-twin.md), [SPEC-002](../domains/observability/SPEC-002-hardware-telemetry-sensors.md), [ADR-008](ADR-008-typed-ipc-contracts.md) |

---

## 1. Context & Problem Statement

In desktop LLM management and monitoring applications, hardware and inference telemetry was historically polled from multiple independent locations:
1. **Frontend UI Polling**: The UI timer periodically executed `invoke("get_telemetry_stats")` every 2000–2200ms.
2. **Background Logging / Recorder Threads**: A separate background task or recording thread independently sampled system metrics at its own cadence.

Every time an on-demand full system snapshot was triggered:
- The system re-instantiated `sysinfo::System::new_all()` or executed expensive process and disk enumerations from scratch.
- The command frequently included blocking waits or sleep intervals (e.g. 200ms) to compute CPU deltas inside the IPC request path.
- **Overhead on Local LLM Compute**: Because this workstation runs resource-intensive local LLMs (Ollama, vLLM, llama.cpp on NVIDIA RTX 3060 and Intel i7-8700K), collector CPU overhead directly interferes with and perturbs the inference metrics being measured.
- **Data Skew**: The UI display and recorded telemetry logs observed desynchronized snapshots taken at slightly different instants.

---

## 2. Decision

We adopt a **Single-Source Push-Based Telemetry Architecture**:

1. **Persistent Sampler in AppState**:
   - A single persistent `sysinfo::System` instance is managed in Rust `AppState` (guarded by `tokio::sync::Mutex` or thread-safe atomic references).
   - Metrics are refreshed incrementally on a single background cadence (`SAMPLE_INTERVAL_MS = 2000`).
   - Blocking sleeps are removed from the IPC request path; CPU usage deltas are computed across the natural 2-second background refresh interval.

2. **Push Event via Tauri `emit`**:
   - Each tick of the background sampler emits the Tauri event `telemetry://snapshot` containing the complete `TelemetrySnapshot` payload.
   - The frontend registers a listener via `listen('telemetry://snapshot', callback)` to update hardware meters, graphs, and the 3D Digital Twin simulation reactively.

3. **Atomic Recording Flag**:
   - Telemetry recording is controlled by an atomic flag (`AtomicBool`). When enabled, the sampler appends the exact same snapshot to rotation logs (`JSONL`) without spawning separate concurrent sampling loops.

4. **Cached Fallback for Initial Paint**:
   - The `get_gpu_stats` / `get_telemetry_snapshot` commands remain available for the first initial UI paint before the first push event arrives, returning the cached latest snapshot instantly without blocking.

---

## 3. Options Considered

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Option A: Single-source Push via Tauri Events (Selected)** | Zero duplicate sampling; no blocking sleep in IPC; UI and logs perfectly synchronized; scales cleanly to multiple UI subscribers (Digital Twin, monitors). | Requires managing shared `AppState` with short lock holding times. | **Accepted** |
| **Option B: Retain Polling with Shared System Cache** | Simpler refactor without Tauri event listener requirements. | Still incurs request-driven latency; multiple cadences drift; subscriber scale multiplies IPC overhead. | Rejected |
| **Option C: Client-Side Web API Telemetry** | No backend IPC required. | Web browsers/WebView2 cannot access hardware sensors, NVML, or OS process lists. | Impossible |

---

## 4. Consequences & Guard Rails

- **Lock Duration Guard Rail**: Mutex locks on `sysinfo::System` or GPU metric caches must be held for the minimum duration required to refresh and clone the snapshot DTO; lock release occurs *before* event emission.
- **Event Contract Seam**: Event name `telemetry://snapshot` and its JSON payload structure are frozen and mirrored via typed contracts (see [ADR-008](ADR-008-typed-ipc-contracts.md)).
- **Zero Panic Compliance (ADR-100)**: Any sensor query failures degrade gracefully with `Option<T>` or `null` fields without panicking the background sampler.
