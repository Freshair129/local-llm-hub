# Implementation Task List — Local LLM Hub v1.0

| Field | Value |
|-------|-------|
| **Version** | 1.1.0 |
| **Status** | In Progress (Backend & Frontend MVP Verified) |
| **Author** | Boss |
| **Created** | 2026-09-28 |
| **References** | [PRD-SDD-v1.0.md](PRD-SDD-v1.0.md) |

---

## Phase 1 — Rust Backend Foundation

- [x] **1.1** Setup Cargo dependencies
  - เพิ่ม `reqwest`, `serde`, `serde_json`, `tokio`, `tauri-plugin-store`, `tauri-plugin-shell` ใน `Cargo.toml`
  - _Requirements: FR-001, FR-002, FR-005, FR-006, FR-008_

- [x] **1.2** Create AppState struct
  - `src-tauri/src/state.rs`: `AppState` ที่มี `BackendConfig`, `Vec<UnifiedModel>`, `LiteLLMStatus`
  - Wrap ด้วย `Mutex<AppState>` สำหรับ thread safety
  - _Requirements: FR-001 to FR-009_

- [x] **1.3** Implement `probe_backends` command
  - `src-tauri/src/commands/backends.rs`
  - HTTP GET timeout 5s สำหรับแต่ละ backend
  - Return `Vec<ProbeResult>` with status + latency
  - _Requirements: FR-001, AC-001_

- [x] **1.4** Implement model normalization + dedup
  - `src-tauri/src/commands/models.rs`
  - `normalize_model_name()` function ตาม BR-002
  - `dedup_models()` ที่ group by canonical name + mark preferred ตาม BR-001
  - Unit tests ครบ
  - _Requirements: FR-002, FR-003, AC-002_

- [x] **1.5** Implement `list_all_models` command
  - Aggregate จาก Ollama `/api/tags`, vLLM `/v1/models`
  - Call dedup engine
  - Return `Vec<UnifiedModel>`
  - _Requirements: FR-002, FR-003_

- [x] **1.6** Implement `read_model_card` command
  - Fetch จาก HuggingFace API (with HF token ถ้ามี)
  - Fallback: read local README.md สำหรับ GGUF
  - Parse YAML frontmatter
  - _Requirements: FR-004, AC-003_

- [x] **1.7** Implement `get_gpu_stats` command
  - `src-tauri/src/commands/gpu.rs`
  - Run `nvidia-smi --query-gpu=... --format=csv,noheader,nounits`
  - Parse output เป็น `GpuStats`
  - RAM stats ผ่าน `sysinfo` crate
  - Graceful fallback ถ้า nvidia-smi ไม่พบ
  - _Requirements: FR-006, AC-005_

- [x] **1.8** Implement `start_model` / `stop_model` commands
  - Ollama: POST `/api/generate` พร้อม `keep_alive: "5m"` (start) หรือ `keep_alive: 0` (stop)
  - vLLM: แสดง instruction ว่า vLLM ต้อง restart server
  - _Requirements: FR-005_

- [x] **1.9** Implement `scan_gguf` command
  - Walk directory recursively (depth limit 5)
  - อ่าน GGUF header สำหรับ metadata
  - Run ใน background thread
  - _Requirements: FR-009_

- [x] **1.10** Implement LiteLLM sidecar management
  - `src-tauri/src/commands/litellm.rs`
  - Generate `config.yaml` จาก `BackendConfig`
  - Spawn Python process ผ่าน `tauri-plugin-shell`
  - Poll `/health` endpoint
  - Auto-restart logic (3 ครั้ง)
  - Cleanup process ตอน app close
  - _Requirements: FR-008, AC-006_

- [x] **1.11** Implement `save_settings` / `load_settings`
  - JSON ใน Tauri app data directory
  - HF token ผ่าน Tauri keychain plugin
  - Default values ถ้า config ไม่มี
  - _Requirements: NFR-002_

---

## Phase 2 — LiteLLM Sidecar (Python)

- [x] **2.1** Create `sidecar/requirements.txt`
  - `litellm`, `uvicorn`, `pyyaml`

- [x] **2.2** Create `sidecar/litellm_proxy.py`
  - อ่าน ENV vars: `OLLAMA_URL`, `VLLM_URL`, `GGUF_MODELS`, `LITELLM_PORT`
  - Generate `generated_config.yaml`
  - Start litellm server

- [x] **2.3** Create Tauri capabilities สำหรับ shell spawn
  - `src-tauri/capabilities/default.json`

---

## Phase 3 — Frontend Design System
 
- [x] **3.1** Create CSS design system (`src/styles.css`)
  - CSS custom properties: colors, typography, spacing, shadows
  - Dark glassmorphism theme
  - Google Fonts: JetBrains Mono (code), Inter (UI)
  - Color palette: deep navy background, neon indigo accent, glass surfaces

- [x] **3.2** Create component CSS (`src/styles.css`)
  - `.model-card` — glassmorphism cards
  - `.badge-backend` — Ollama/vLLM/HF/GGUF colored badges
  - `.badge-duplicate` — warning badge
  - `.badge-preferred` — preferred badge
  - `.btn-primary`, `.btn-ghost`, `.btn-danger`
  - `.status-dot` — online/offline animated indicator
  - `.gauge-track`, `.gauge-fill` — telemetry bars

- [x] **3.3** Create animations (`src/styles.css`)
  - `@keyframes pulse-online` — breathing green dot
  - `@keyframes slide-in-right` — model card drawer
  - `@keyframes fade-in` — page transitions
  - Toast enter/exit animations

- [x] **3.4** Inline SVG icons in `src/index.html`
  - icons: dashboard, models, chat, monitor, settings, ollama, vllm, hf, gguf, duplicate, play, stop, refresh, share

---

## Phase 4 — Frontend Pages

- [x] **4.1** Create `src/index.html` + sidebar layout
  - Sidebar navigation (icons + labels)
  - Main content area
  - Global telemetry bar (VRAM & RAM meters)

- [x] **4.2** Create reactive store (`src/js/state.js`)
  - Centralized reactive state definition
  - `subscribe()` / `setState()` pattern
  - Eliminates God Object anti-pattern

- [x] **4.3** Create app navigation in `src/main.js`
  - Tab switching: Models, Analytics & ROI, Hardware/VRAM, LiteLLM Gateway, Chat, LAN Share
  - Active nav highlight & panel visibility toggling

- [x] **4.4** Build Dashboard / Analytics view (`src/js/stats.js`)
  - Model Analytics & ROI stats cards (Total Tasks, Success Rate, Tokens Processed, Speed Champion)
  - Execution leaderboard table
  - Real-time VRAM tracking

- [x] **4.5** Build Models page (`src/js/model.js`)
  - Unified model list
  - Duplicate group highlight & canonical tags
  - Model card open drawer on click
  - Preferred backend indicators

- [x] **4.6** Build ModelCard component (`src/js/card.js`)
  - Slide-in drawer from right
  - Parse YAML frontmatter & markdown README
  - Tags: size, parameters, quantization, family

- [x] **4.7** Build Chat page (`src/js/chat.js`)
  - Model selector dropdown
  - Direct local low-latency streaming inference
  - Markdown message rendering
  - Chat history container

- [x] **4.8** Build Monitor view (`src/js/observability.js`)
  - GPU VRAM gauge bar
  - Host RAM bar
  - CUDA core load & GPU temperature
  - Polling interval 2000ms

- [x] **4.9** Build LAN Drive Share view (`src/main.js` + `src/commands/share.rs`)
  - Built-in HTTP streaming server with HTTP 206 Partial Content (Resume)
  - Network IP endpoint display
  - One-click Start/Stop toggle button with state rollback

- [x] **4.10** Build GPUGauge component
  - Telemetry bars in header and dedicated hardware view
  - Animated transitions & percentage fills

- [x] **4.11** LiteLLM proxy toggle + config generator
  - Dynamic `config.yaml` generation
  - Config preview display in UI
  - Unified port 4000 routing instructions

---

## Phase 5 — Integration & Polish

- [x] **5.1** Wire frontend ↔ Rust IPC
  - `src/main.js` + `src/js/backend.js` + `src/js/model.js`
  - Error handling with non-blocking toast notifications
  - Button loading states & double-click protection

- [x] **5.2** Auto-refresh telemetry loop
  - Telemetry polling interval 2000ms via `startTelemetryPolling()`

- [x] **5.3** Notification system (`src/js/toast.js`)
  - Non-blocking glassmorphic toasts: success / error / info / warning
  - Replaces blocking `window.alert()`

- [x] **5.4** Error state handling
  - Empty states for model cards and chat
  - Graceful fallback for mock dev invoke

- [x] **5.5** Tauri window configuration
  - `src-tauri/tauri.conf.json`: window title "Local LLM Hub", dark background

---

## Phase 6 — Testing & Verification

- [x] **6.1** Unit tests: `normalize_model_name()` + `dedup_models()`
- [x] **6.2** Unit tests: `generate_litellm_config()`
- [x] **6.3** Unit tests: GGUF header scanner & parsing
- [x] **6.4** Integration test: `test_mvp_e2e.rs` (100% test pass rate)
- [x] **6.5** Model Benchmark Fleet on RTX 3060 CUDA (Mellum2, Sushi Coder, Gemma 4, Qwen 14B)

---

## Phase 7 — Advanced Observability & GHT Command Center Architecture

- [x] **7.1** GHT Command Center 2-Tier Architecture
  - Top Tier: Floating Pill Island (`.topbar`) centered horizontally (`margin: 12px auto 0; width: max-content;`) across 5 core domains:
    1. Model Management (`model-management`)
    2. Backend Integration (`backend-integration`)
    3. Inference Gateway (`inference-gateway`)
    4. Observability (`observability`)
    5. Network Share (`network-distribution`)
  - Sidebar Tier: Floating Collapsible Rail (`.sidebar`) centered vertically in viewport (`top: 50%; transform: translateY(-50%); align-self: center; position: sticky;`) collapsing to 50px icon rail and expanding to 260px on hover/pin.
  - Eliminated legacy flat layout variations and temporary Design Studio workbench.
  - _Requirements: FR-006, ARCH-001_

- [x] **7.2** 3D Hardware Digital Twin Simulation (`src/js/digital_twin_3d.js`)
  - WebGL Three.js interactive physical hardware model: Motherboard PCB, CPU heatsink tower with spinning 120mm PWM fan and dynamic thermal color gradient (Cyan ⟷ Amber ⟷ Red), NVIDIA GeForce RTX 3060 with dual spinning cooling fans, RAM sticks, M.2 NVMe SSD with activity LED.
  - OrbitControls (left-click rotate, right-click pan, scroll-wheel zoom) + 4 Camera Presets (`Isometric`, `RTX 3060 Focus`, `CPU Cooler`, `Top-Down PCB`).
  - Wired directly into real-time telemetry polling.
  - _Requirements: FR-006, FR-016, FEAT-018_

- [x] **7.3** Storage & Symlink Offloader (FR-015)
  - Inspect Ollama blob pointers on Drive C:, discover candidates across secondary storage drives (e.g. G: NVMe), offload heavy weights atomically with 0-byte Windows symlinks without breaking Ollama daemon.
  - _Requirements: FR-015, FEAT-017_

---

## Definition of Done

Task ถือว่า Done เมื่อ:
- [x] ทำงานถูกต้องตาม requirement ที่ reference (FR-001 ถึง FR-016)
- [x] Error states handled (ADR-100 zero panic)
- [x] ไม่มี console errors
- [x] Code ผ่าน `cargo test` 100% pass (38/38 unit tests green)
- [x] Browser layout verification verified with subagent screenshots


