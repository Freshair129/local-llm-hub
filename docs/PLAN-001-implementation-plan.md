# PLAN-001 — Implementation Plan: Multi-Agent Microtask Breakdown

| Field | Value |
|---|---|
| **Document ID** | PLAN-001 |
| **Title** | Comprehensive Implementation Plan via Local Multi-Agent Workflow |
| **Version** | 1.0.0 |
| **Status** | Active / Execution-Ready |
| **Author** | Boss |
| **Created** | 2026-09-28 |
| **Standard & Governance** | [STD-003 (Implementation Unit & Packet Standard)](standards/STD-003-implementation-unit-and-packet.md), [ANN-001 (STD-002)](annotations/ANN-001-annotation-language.md), [ARCHITECTURE.md](adr/ARCHITECTURE.md) (ADR-100, ARCH-001 §4) |
| **Traceability Target** | [PRD-SDD-v1.0](PRD-SDD-v1.0.md), [TASKS.md](TASKS.md), [TEST-SPEC-001](tests/TEST-SPEC-001-traceability.md) |

---

## 1. Executive Summary & Multi-Agent Protocol

แผนงานฉบับนี้กำหนดการแปลงข้อกำหนดทั้งหมดของ **Local LLM Hub** ให้กลายเป็น **Microtasks** ที่พร้อมส่งมอบให้ AI Agents ประมวลผลแบบอัตโนมัติ ภายใต้ข้อกำหนดบังคับของ **STD-003**:

- **Atomic Decomposition (R1)**: แตกทุก Functional Requirement (FR) ออกเป็น 4 Packets ตาม Layer:
  $$\text{Packet} = \text{FR} \times \{\text{schema}, \text{service}, \text{contract/route}, \text{ui}\}$$
- **Microtask Granularity**: แต่ละ Packet ถูกย่อยเป็น 4 Microtasks ตามลำดับบทบาท:
  1. `[Architect]` Skeleton & Interface Lock (CMP, Signature, Structs, Port)
  2. `[Tester]` Test-First Unit Test ตาม AC (`// trace:verifies FR-xxx`) $\rightarrow$ Red Phase
  3. `[Coder (Local LLM)]` Implementation ในขอบเขต CMP (`// trace:implements FR-xxx`) $\rightarrow$ Green Phase
  4. `[Reviewer]` ตรวจสอบ R4 Definition of Done (DoD: tests pass, trace valid, validate-docs 0/0, zero file leak)
- **Feature Integration Gate**: เมื่อครบ 4 layer packets รัน `[Tester/Architect]` Integration Test (`TC`) และบันทึกลง `docs/lineage/packet-lineage.jsonl` (R6)
- **Topological Sequencing (R5)**: เริ่มต้นจาก Foundation (`PRJ`) $\rightarrow$ Core State $\rightarrow$ เรียงตาม Dependency Graph

```
                                  [ FEATURE SPRINT ]
                                          │
    ┌─────────────────────────────────────┴─────────────────────────────────────┐
    ▼                                     ▼                                     ▼
[Packet 1: SCHEMA]                  [Packet 2: SERVICE]                 [Packet 3: ROUTE]
  ├─ MT.1 Architect Lock              ├─ MT.1 Architect Lock              ├─ MT.1 Architect Lock
  ├─ MT.2 Tester (AC Test)            ├─ MT.2 Tester (AC Test)            ├─ MT.2 Tester (AC Test)
  ├─ MT.3 Coder (Local LLM)           ├─ MT.3 Coder (Local LLM)           ├─ MT.3 Coder (Local LLM)
  └─ MT.4 Reviewer (DoD)              └─ MT.4 Reviewer (DoD)              └─ MT.4 Reviewer (DoD)
    │                                     │                                     │
    └─────────────────────────────────────┬─────────────────────────────────────┘
                                          ▼
                                  [Packet 4: UI]
                                    ├─ MT.1 Architect Lock
                                    ├─ MT.2 Tester (DOM Test)
                                    ├─ MT.3 Coder (Local LLM)
                                    └─ MT.4 Reviewer (DoD)
                                          │
                                          ▼
                             [Feature Integration Gate]
                               ├─ MT.5 Integration TC Run
                               └─ MT.6 Ledger Lineage Append
```

---

## 2. Phase 0 — Foundation & Shared Infrastructure (PRJ)

ก่อนเริ่มรัน FR packets ต้องล็อก Foundation ตามกฎ R5:

### 2.1 PRJ-001: Cargo Dependencies & Core Crates
- **Target CMP**: `src-tauri/Cargo.toml`
- **Microtasks**:
  - `MT-PRJ-01.1 [Architect]`: ระบุ dependency crates ที่อนุญาต: `reqwest` (json, stream), `serde` (derive), `serde_json`, `tokio` (full), `sysinfo` (0.30), `tauri-plugin-store`, `tauri-plugin-shell`, `regex`
  - `MT-PRJ-01.2 [Coder]`: แก้ไข `src-tauri/Cargo.toml` และรัน `cargo check`
  - `MT-PRJ-01.3 [Reviewer]`: ตรวจสอบ build artifacts, version constraints, และ dependency tree (Zero duplicate/conflicting crates)

### 2.2 PRJ-002: AppState & Thread-Safe Core Store
- **Target CMP**: `src-tauri/src/state.rs`
- **Microtasks**:
  - `MT-PRJ-02.1 [Architect]`: ออกแบบ Struct `AppState` ห่อด้วย `tokio::sync::Mutex`:
    ```rust
    pub struct AppState {
        pub backends: BackendConfig,
        pub models: Vec<UnifiedModel>,
        pub litellm_process: Option<u32>,
        pub litellm_status: LiteLLMStatus,
    }
    ```
  - `MT-PRJ-02.2 [Tester]`: เขียน Unit Test ตรวจสอบ Thread-safe mutex lock/unlock concurrent read-write
  - `MT-PRJ-02.3 [Coder]`: Implement `src-tauri/src/state.rs` พร้อม Default traits
  - `MT-PRJ-02.4 [Reviewer]`: ยืนยัน Memory Safety (ADR-100), ไม่มี raw pointer, derive Clone/Debug ครบถ้วน

### 2.3 PRJ-003: Frontend Skeleton & Design System Tokens
- **Target CMP**: `src/index.html`, `src/css/main.css`, `src/js/app.js`
- **Microtasks**:
  - `MT-PRJ-03.1 [Architect]`: วางผัง CSS Custom Properties สำหรับ Dark Glassmorphism (`--bg-primary: #0f1117`, `--glass-bg: rgba(22, 27, 34, 0.7)`, `--border-glass: rgba(255,255,255,0.08)`) และ DOM layout
  - `MT-PRJ-03.2 [Tester]`: ตรวจสอบ DOM structure elements: `#sidebar`, `#main-content`, `#model-grid`, `#gpu-bar`, `#chat-drawer`
  - `MT-PRJ-03.3 [Coder]`: เขียน `src/css/main.css` และโครงร่าง HTML5 Semantic
  - `MT-PRJ-03.4 [Reviewer]`: ตรวจสอบ Responsive Layout, Google Fonts (Inter/JetBrains Mono), Zero Tailwind dependency (ADR-002)

---

## 3. Detailed FR Microtask Breakdown (Phase 1 – Phase 6)

---

### Feature 1: Backend Probe (FR-001)
> **Goal**: ตรวจจับและวัด latency ของ Ollama, vLLM, HuggingFace, GGUF paths  
> **Domain**: `backend-integration` | **Priority**: P0 | **Feature ID**: `FEAT-001`

#### Packet 1: `PKT-FR001-SCHEMA`
- **Target CMP**: `src-tauri/src/models/types.rs::ProbeResult`
- `MT-001.1 [Architect]`: ล็อก Struct `ProbeResult { backend: String, status: BackendStatus, latency_ms: Option<u64>, endpoint: String }`
- `MT-001.2 [Tester]`: เขียน Unit test serialize/deserialize JSON format ของ `ProbeResult`
- `MT-001.3 [Coder]`: Implement struct พร้อม `#[derive(Serialize, Deserialize, Clone, Debug)]`, ใส่ `// trace:implements FR-001`
- `MT-001.4 [Reviewer]`: ตรวจสอบ R4 DoD (tests pass, trace valid, no leak)

#### Packet 2: `PKT-FR001-SERVICE`
- **Target CMP**: `src-tauri/src/commands/backends.rs::probe_single_backend`
- `MT-001.5 [Architect]`: ล็อก Signature: `pub async fn probe_single_backend(client: &reqwest::Client, name: &str, url: &str) -> ProbeResult` พร้อม timeout 5s
- `MT-001.6 [Tester]`: Mock HTTP server ทดสอบ timeout 5s, 200 OK, Connection Refused
- `MT-001.7 [Coder]`: Implement async HTTP GET probe, error mapping, stopwatch latency calculation
- `MT-001.8 [Reviewer]`: ยืนยันว่าไม่มี unwrap() (ADR-100), ตรวจสอบ error handling

#### Packet 3: `PKT-FR001-ROUTE`
- **Target CMP**: `src-tauri/src/lib.rs::probe_backends`
- `MT-001.9 [Architect]`: ล็อก Tauri command signature `#[tauri::command] pub async fn probe_backends(state: tauri::State<'_, Mutex<AppState>>) -> Result<Vec<ProbeResult>, String>`
- `MT-001.10 [Tester]`: เขียน command invocation integration test
- `MT-001.11 [Coder]`: Implement loop probe all backends concurrently ผ่าน `tokio::join!`, อัปเดต `AppState`
- `MT-001.12 [Reviewer]`: ตรวจสอบ IPC error wrapping `Result<T, String>`

#### Packet 4: `PKT-FR001-UI`
- **Target CMP**: `src/js/backends.js::updateBackendStatusUI`
- `MT-001.13 [Architect]`: กำหนด Event listener และ DOM container `#backend-status-list`
- `MT-001.14 [Tester]`: เขียน DOM test ตรวจสอบ status dot (`.status-online`, `.status-offline`) และตัวเลข latency
- `MT-001.15 [Coder]`: Implement Tauri IPC invoke `probe_backends` ทุก 30 วินาที และ render UI
- `MT-001.16 [Reviewer]`: ตรวจสอบ Zero direct network call from JS (ต้องผ่าน Tauri IPC)

#### Feature Gate FEAT-001:
- `MT-001.TC [Tester]`: รัน `TC-FEAT-001-INTEG` ตรวจสอบ end-to-end probe flow
- `MT-001.LEDGER [Reviewer]`: บันทึก Lineage record ลง `docs/lineage/packet-lineage.jsonl`

---

### Feature 2: Model Aggregation & Normalization (FR-002)
> **Goal**: ดึงรายการโมเดลจากทุก backend และแปลงชื่อเข้าสู่ Canonical Name  
> **Domain**: `model-management` | **Priority**: P0 | **Feature ID**: `FEAT-005` | **Depends on**: `FR-001`

#### Packet 1: `PKT-FR002-SCHEMA`
- **Target CMP**: `src-tauri/src/models/types.rs::UnifiedModel`
- `MT-002.1 [Architect]`: ล็อก Struct `UnifiedModel` (fields: `id`, `name`, `canonical_name`, `backend`, `size_bytes`, `parameter_count`, `quantization`, `modified_at`)
- `MT-002.2 [Tester]`: เขียน Unit test serialize/deserialize ครบทุก field
- `MT-002.3 [Coder]`: Implement Struct ใน `types.rs`, ใส่ `// trace:implements FR-002`
- `MT-002.4 [Reviewer]`: ตรวจสอบ R4 DoD

#### Packet 2: `PKT-FR002-SERVICE`
- **Target CMP**: `src-tauri/src/commands/models.rs::normalize_model_name`
- `MT-002.5 [Architect]`: ล็อก Signature: `pub fn normalize_model_name(raw: &str) -> String` ตามกฎ BR-002 (lowercase, strip registry, strip quantization tag)
- `MT-002.6 [Tester]`: เขียน Unit test 10 cases (e.g. `library/llama3:8b-instruct-q4_0` $\rightarrow$ `llama3:8b-instruct`)
- `MT-002.7 [Coder]`: Implement regex normalization logic
- `MT-002.8 [Reviewer]`: ตรวจสอบ Regex performance และ edge cases

#### Packet 3: `PKT-FR002-ROUTE`
- **Target CMP**: `src-tauri/src/lib.rs::list_raw_models`
- `MT-002.9 [Architect]`: ล็อก Tauri command `pub async fn list_raw_models(...) -> Result<Vec<UnifiedModel>, String>`
- `MT-002.10 [Tester]`: Mock response จาก Ollama `/api/tags` และ vLLM `/v1/models`
- `MT-002.11 [Coder]`: Implement fetch loop, parse JSON, map to `UnifiedModel`, call `normalize_model_name`
- `MT-002.12 [Reviewer]`: ตรวจสอบ Error propagation เมื่อ backend ใด backend หนึ่ง unreachable

#### Packet 4: `PKT-FR002-UI`
- **Target CMP**: `src/js/models.js::renderModelTable`
- `MT-002.13 [Architect]`: กำหนด Table/Grid layout structure สำหรับแสดง UnifiedModel
- `MT-002.14 [Tester]`: ตรวจสอบ table row rendering, formatting ขนาดไฟล์ (MB/GB)
- `MT-002.15 [Coder]`: Implement DOM builder แสดงชื่อโมเดล, ขนาด, backend tag
- `MT-002.16 [Reviewer]`: ตรวจสอบ XSS prevention (ใช้ `textContent` แทน `innerHTML`)

#### Feature Gate FEAT-005:
- `MT-002.TC [Tester]`: รัน `TC-FEAT-005-INTEG`
- `MT-002.LEDGER [Reviewer]`: บันทึก Lineage record

---

### Feature 3: Duplicate Detection (FR-003)
> **Goal**: จัดกลุ่มโมเดลที่ซ้ำข้าม backend และเลือก preferred backend ตาม Priority Matrix (BR-001)  
> **Domain**: `model-management` | **Priority**: P0 | **Feature ID**: `FEAT-006` | **Depends on**: `FR-002`

#### Packet 1: `PKT-FR003-SCHEMA`
- **Target CMP**: `src-tauri/src/models/types.rs::UnifiedModel`
- `MT-003.1 [Architect]`: เพิ่มฟิลด์ `is_duplicate: bool`, `is_preferred: bool`, `duplicate_group: Option<String>`
- `MT-003.2 [Tester]`: เขียน test default value serialization (`is_duplicate: false`)
- `MT-003.3 [Coder]`: เพิ่ม fields ใน Struct `UnifiedModel`
- `MT-003.4 [Reviewer]`: ตรวจสอบ Backward compatibility กับ JSON เดิม

#### Packet 2: `PKT-FR003-SERVICE`
- **Target CMP**: `src-tauri/src/commands/models.rs::dedup_models`
- `MT-003.5 [Architect]`: ล็อก Signature: `pub fn dedup_models(models: Vec<UnifiedModel>) -> Vec<UnifiedModel>`
- `MT-003.6 [Tester]`: เขียน test cases ตาม BR-001 (Ollama vs vLLM vs GGUF vs HF) ยืนยัน preferred selection
- `MT-003.7 [Coder]`: Implement Grouping by `canonical_name`, Priority sort, flag assignment
- `MT-003.8 [Reviewer]`: ตรวจสอบ Pure function logic, no mutation leaks

#### Packet 3: `PKT-FR003-ROUTE`
- **Target CMP**: `src-tauri/src/lib.rs::list_all_models`
- `MT-003.9 [Architect]`: รวม `list_raw_models` เข้ากับ `dedup_models` ในคำสั่ง `list_all_models`
- `MT-003.10 [Tester]`: Integration test invoke `list_all_models` ได้ output ที่ติด duplicate flags ถูกต้อง
- `MT-003.11 [Coder]`: Implement command handler, บันทึกผลลง `state.models`
- `MT-003.12 [Reviewer]`: ตรวจสอบ Mutex lock duration (ห้าม lock ค้างขณะ await I/O)

#### Packet 4: `PKT-FR003-UI`
- **Target CMP**: `src/js/models.js::renderDuplicateBadge`
- `MT-003.13 [Architect]`: กำหนด Badge CSS: `.badge-duplicate` (สีเหลืองอำพัน `#e3b341`), `.badge-preferred` (สีเขียวมรกต `#2ea043`)
- `MT-003.14 [Tester]`: ตรวจสอบ DOM element class และ Tooltip text ระบุ backends อื่นในกลุ่ม
- `MT-003.15 [Coder]`: Implement badge DOM injection และ hover tooltip
- `MT-003.16 [Reviewer]`: ตรวจสอบ UI contrast ratio และ dark mode readability

#### Feature Gate FEAT-006:
- `MT-003.TC [Tester]`: รัน `TC-FEAT-006-INTEG`
- `MT-003.LEDGER [Reviewer]`: บันทึก Lineage record

---

### Feature 4: Model Card Reader (FR-004)
> **Goal**: ดึงและแสดง Model Card (Markdown + YAML Frontmatter) จาก HuggingFace API หรือไฟล์ในเครื่อง  
> **Domain**: `model-management` | **Priority**: P1 | **Feature ID**: `FEAT-007` | **Depends on**: `FR-002`

#### Packet 1: `PKT-FR004-SCHEMA`
- **Target CMP**: `src-tauri/src/models/types.rs::ModelCard`
- `MT-004.1 [Architect]`: ล็อก Struct `ModelCard { model_id: String, license: Option<String>, parameters: Option<String>, raw_markdown: String }`
- `MT-004.2 [Tester]`: เขียน test serialize ModelCard struct
- `MT-004.3 [Coder]`: Implement struct ใน `types.rs`
- `MT-004.4 [Reviewer]`: ตรวจสอบ R4 DoD

#### Packet 2: `PKT-FR004-SERVICE`
- **Target CMP**: `src-tauri/src/commands/model_card.rs::fetch_hf_model_card`
- `MT-004.5 [Architect]`: ล็อก Signature fetch Markdown จาก HF endpoint `https://huggingface.co/api/models/{id}/raw/README.md`
- `MT-004.6 [Tester]`: Mock HF API response 200, 404 (fallback local README.md)
- `MT-004.7 [Coder]`: Implement reqwest client with optional `HF_TOKEN` header, parse frontmatter
- `MT-004.8 [Reviewer]`: ตรวจสอบ token security (ห้าม log token ลง console ตาม ADR-100)

#### Packet 3: `PKT-FR004-ROUTE`
- **Target CMP**: `src-tauri/src/lib.rs::read_model_card`
- `MT-004.9 [Architect]`: ล็อก Tauri command `pub async fn read_model_card(model_id: String) -> Result<ModelCard, String>`
- `MT-004.10 [Tester]`: เขียน test command invocation
- `MT-004.11 [Coder]`: Implement command handler เชื่อม service
- `MT-004.12 [Reviewer]`: ตรวจสอบ R4 DoD

#### Packet 4: `PKT-FR004-UI`
- **Target CMP**: `src/js/modal.js::showModelCardModal`
- `MT-004.13 [Architect]`: ออกแบบ Glassmorphism Modal Drawer สำหรับแสดง Model Card
- `MT-004.14 [Tester]`: ตรวจสอบ Modal open/close trigger และ escape key listener
- `MT-004.15 [Coder]`: Implement Markdown render (ใช้ sanitize parser เพื่อความปลอดภัย)
- `MT-004.16 [Reviewer]`: ตรวจสอบ XSS sanitize สำหรับ raw markdown

#### Feature Gate FEAT-007:
- `MT-004.TC [Tester]`: รัน `TC-FEAT-007-INTEG`
- `MT-004.LEDGER [Reviewer]`: บันทึก Lineage record

---

### Feature 5: Model Start/Stop Control (FR-005)
> **Goal**: ควบคุมการโหลดเข้า VRAM และปลดปล่อยหน่วยความจำ (Keep-alive)  
> **Domain**: `backend-integration` | **Priority**: P1 | **Feature ID**: `FEAT-001` | **Depends on**: `FR-001`

#### Packet 1: `PKT-FR005-SCHEMA`
- **Target CMP**: `src-tauri/src/models/types.rs::ModelControlResponse`
- `MT-005.1 [Architect]`: ล็อก Struct `ModelControlResponse { success: bool, message: String, active: bool }`
- `MT-005.2 [Tester]`: เขียน test serialization
- `MT-005.3 [Coder]`: Implement struct ใน `types.rs`
- `MT-005.4 [Reviewer]`: ตรวจสอบ R4 DoD

#### Packet 2: `PKT-FR005-SERVICE`
- **Target CMP**: `src-tauri/src/commands/control.rs::set_model_lifecycle`
- `MT-005.5 [Architect]`: ล็อก Signature: Ollama POST `/api/generate` with `keep_alive: "5m"` (start) หรือ `keep_alive: 0` (stop/unload)
- `MT-005.6 [Tester]`: Mock Ollama API test payload verify
- `MT-005.7 [Coder]`: Implement HTTP call สั่ง unload VRAM
- `MT-005.8 [Reviewer]`: ตรวจสอบ error handling กรณี backend ไม่รองรับ

#### Packet 3: `PKT-FR005-ROUTE`
- **Target CMP**: `src-tauri/src/lib.rs::start_model / stop_model`
- `MT-005.9 [Architect]`: ล็อก Tauri command `start_model(model_name: String)` และ `stop_model(model_name: String)`
- `MT-005.10 [Tester]`: เขียน test invoke command
- `MT-005.11 [Coder]`: Implement routing command handlers
- `MT-005.12 [Reviewer]`: ตรวจสอบ R4 DoD

#### Packet 4: `PKT-FR005-UI`
- **Target CMP**: `src/js/models.js::toggleModelPower`
- `MT-005.13 [Architect]`: ออกแบบปุ่ม Power/Play/Stop บน Model Card item
- `MT-005.14 [Tester]`: ตรวจสอบปุ่ม Loading state (spinner) ระหว่างรอคำสั่ง
- `MT-005.15 [Coder]`: Implement click handler invoke `start_model`/`stop_model` และ trigger refresh GPU stats
- `MT-005.16 [Reviewer]`: ตรวจสอบ Micro-animation และ feedback ชัดเจน

#### Feature Gate FEAT-001 (Part B):
- `MT-005.TC [Tester]`: รัน `TC-FEAT-001-CONTROL-INTEG`
- `MT-005.LEDGER [Reviewer]`: บันทึก Lineage record

---

### Feature 6: GPU & RAM Observability (FR-006)
> **Goal**: ติดตามการใช้งาน VRAM, อุณหภูมิ GPU และ RAM ระบบแบบ Real-time  
> **Domain**: `observability` | **Priority**: P1 | **Feature ID**: `FEAT-010`, `FEAT-011`

#### Packet 1: `PKT-FR006-SCHEMA`
- **Target CMP**: `src-tauri/src/models/types.rs::SystemStats`
- `MT-006.1 [Architect]`: ล็อก Struct `SystemStats { gpu_name: String, vram_used_mb: u64, vram_total_mb: u64, gpu_temp_c: u32, gpu_util_pct: u32, sys_ram_used_mb: u64, sys_ram_total_mb: u64 }`
- `MT-006.2 [Tester]`: เขียน test serialization ของ `SystemStats`
- `MT-006.3 [Coder]`: Implement struct ใน `types.rs`
- `MT-006.4 [Reviewer]`: ตรวจสอบ R4 DoD

#### Packet 2: `PKT-FR006-SERVICE`
- **Target CMP**: `src-tauri/src/commands/gpu.rs::parse_nvidia_smi`
- `MT-006.5 [Architect]`: ล็อก Signature: `pub fn parse_nvidia_smi(csv_output: &str) -> Result<GpuInfo, String>` ตาม ADR-005
- `MT-006.6 [Tester]`: เขียน test case ทดสอบ parse CSV string จาก nvidia-smi 3 รูปแบบ
- `MT-006.7 [Coder]`: Implement CLI executor `nvidia-smi` พร้อม fallback graceful หากไม่มี GPU NVIDIA
- `MT-006.8 [Reviewer]`: ตรวจสอบว่าไม่ crash บนเครื่องที่ไม่มีการ์ดจอ NVIDIA (CPU fallback)

#### Packet 3: `PKT-FR006-ROUTE`
- **Target CMP**: `src-tauri/src/lib.rs::get_gpu_stats`
- `MT-006.9 [Architect]`: ล็อก Tauri command `pub async fn get_gpu_stats() -> Result<SystemStats, String>`
- `MT-006.10 [Tester]`: เขียน test command invocation
- `MT-006.11 [Coder]`: รวม GPU stats เข้ากับ sysinfo crate (RAM usage) ใน command handler
- `MT-006.12 [Reviewer]`: ตรวจสอบ Execution duration (ต้องเร็วกว่า 200ms ตาม NFR-001)

#### Packet 4: `PKT-FR006-UI`
- **Target CMP**: `src/js/gpu.js::renderGpuMeter`
- `MT-006.13 [Architect]`: ออกแบบ Glassmorphism Hardware Monitor Bar ด้านล่างหน้าจอ
- `MT-006.14 [Tester]`: ตรวจสอบ Gauge progress bar width percentage calculation
- `MT-006.15 [Coder]`: Implement polling ทุก 2 วินาที, update gauge และ dynamic color (เขียว <70%, ส้ม 70-90%, แดง >90%)
- `MT-006.16 [Reviewer]`: ตรวจสอบ Smooth CSS transition (ป้องกันการกระตุก)

#### Feature Gate FEAT-010/FEAT-011:
- `MT-006.TC [Tester]`: รัน `TC-FEAT-010-INTEG`
- `MT-006.LEDGER [Reviewer]`: บันทึก Lineage record

---

### Feature 7: LiteLLM Unified Proxy Gateway (FR-008)
> **Goal**: จัดการ Python LiteLLM Sidecar process เพื่อทำหน้าที่เป็น OpenAI-compatible proxy  
> **Domain**: `inference-gateway` | **Priority**: P0 | **Feature ID**: `FEAT-008` | **Depends on**: `FR-001`

#### Packet 1: `PKT-FR008-SCHEMA`
- **Target CMP**: `src-tauri/src/models/types.rs::LiteLLMConfig`
- `MT-008.1 [Architect]`: ล็อก Struct `LiteLLMConfig { port: u16, host: String, model_list: Vec<LiteLLMModelEntry> }`
- `MT-008.2 [Tester]`: เขียน test YAML config serialization
- `MT-008.3 [Coder]`: Implement struct พร้อม serde yaml support
- `MT-008.4 [Reviewer]`: ตรวจสอบ R4 DoD

#### Packet 2: `PKT-FR008-SERVICE`
- **Target CMP**: `src-tauri/src/commands/litellm.rs::generate_litellm_config`
- `MT-008.5 [Architect]`: ล็อก Signature: `pub fn generate_litellm_config(models: &[UnifiedModel]) -> String`
- `MT-008.6 [Tester]`: เขียน test ตรวจสอบ config YAML ที่ generated ต้อง map Ollama, vLLM ถูกตามสเปก
- `MT-008.7 [Coder]`: Implement config generator และ process spawner (`std::process::Command` รัน python litellm)
- `MT-008.8 [Reviewer]`: ตรวจสอบ Process lifecycle management (ต้อง kill child process เมื่อ app ปิด ตาม ARCH-001 §4)

#### Packet 3: `PKT-FR008-ROUTE`
- **Target CMP**: `src-tauri/src/lib.rs::start_litellm / stop_litellm`
- `MT-008.9 [Architect]`: ล็อก Tauri command ควบคุม sidecar process
- `MT-008.10 [Tester]`: เขียน test start/stop lifecycle
- `MT-008.11 [Coder]`: Implement command handler, เก็บ process ID ใน `AppState`
- `MT-008.12 [Reviewer]`: ตรวจสอบ Port conflict handling (fallback ไปยัง port ถัดไปหาก 8000 ไม่ว่าง)

#### Packet 4: `PKT-FR008-UI`
- **Target CMP**: `src/js/proxy.js::renderProxyStatus`
- `MT-008.13 [Architect]`: ออกแบบส่วนแสดง Proxy URL (`http://127.0.0.1:8000/v1`) พร้อมปุ่ม Copy
- `MT-008.14 [Tester]`: ตรวจสอบ Clipboard copy event และ status indicator
- `MT-008.15 [Coder]`: Implement DOM status widget และ copy endpoint button
- `MT-008.16 [Reviewer]`: ตรวจสอบ Accessibility และ Toast notification

#### Feature Gate FEAT-008:
- `MT-008.TC [Tester]`: รัน `TC-FEAT-008-INTEG`
- `MT-008.LEDGER [Reviewer]`: บันทึก Lineage record

---

### Feature 8: Chat Interface (FR-007)
> **Goal**: หน้าจอ Chat ทดสอบคุยกับโมเดล พร้อม Streaming SSE (Server-Sent Events)  
> **Domain**: `inference-gateway` | **Priority**: P1 | **Feature ID**: `FEAT-009` | **Depends on**: `FR-008`

#### Packet 1: `PKT-FR007-SCHEMA`
- **Target CMP**: `src-tauri/src/models/types.rs::ChatMessage`
- `MT-007.1 [Architect]`: ล็อก Struct `ChatMessage { role: String, content: String, timestamp: u64 }`
- `MT-007.2 [Tester]`: เขียน test serialize message history
- `MT-007.3 [Coder]`: Implement struct ใน `types.rs`
- `MT-007.4 [Reviewer]`: ตรวจสอบ R4 DoD

#### Packet 2: `PKT-FR007-SERVICE`
- **Target CMP**: `src-tauri/src/commands/chat.rs::prepare_chat_payload`
- `MT-007.5 [Architect]`: ล็อก format OpenAI-compatible chat payload
- `MT-007.6 [Tester]`: เขียน test payload generation
- `MT-007.7 [Coder]`: Implement helper จัดการ message history
- `MT-007.8 [Reviewer]`: ตรวจสอบ Token length sanity check

#### Packet 3: `PKT-FR007-ROUTE`
- **Target CMP**: `src-tauri/src/lib.rs::send_chat_stream`
- `MT-007.9 [Architect]`: ล็อก Tauri event channel สำหรับ stream SSE chunk สู่ UI (`tauri::Emitter`)
- `MT-007.10 [Tester]`: Test mock SSE stream emission
- `MT-007.11 [Coder]`: Implement reqwest stream consumer ยิงผ่าน LiteLLM proxy และ emit chunks
- `MT-007.12 [Reviewer]`: ตรวจสอบ Network error reconnection logic

#### Packet 4: `PKT-FR007-UI`
- **Target CMP**: `src/js/chat.js::initChatDrawer`
- `MT-007.13 [Architect]`: ออกแบบ Glassmorphism Chat Drawer ด้านขวา พร้อม Markdown bubble message
- `MT-007.14 [Tester]`: ตรวจสอบ Auto-scroll to bottom เมื่อมี stream chunk เข้ามา
- `MT-007.15 [Coder]`: Implement SSE listener, bubble render, textarea auto-expand
- `MT-007.16 [Reviewer]`: ตรวจสอบ Input sanitization ป้องกัน script injection

#### Feature Gate FEAT-009:
- `MT-007.TC [Tester]`: รัน `TC-FEAT-009-INTEG`
- `MT-007.LEDGER [Reviewer]`: บันทึก Lineage record

---

### Feature 9: GGUF File Scanner (FR-009)
> **Goal**: ค้นหาไฟล์ .gguf ในไดเรกทอรีที่กำหนด และอ่าน GGUF header metadata  
> **Domain**: `backend-integration` | **Priority**: P1 | **Feature ID**: `FEAT-004`

#### Packet 1: `PKT-FR009-SCHEMA`
- **Target CMP**: `src-tauri/src/models/types.rs::GgufMetadata`
- `MT-009.1 [Architect]`: ล็อก Struct `GgufMetadata { architecture: String, context_length: u32, quantization: String }`
- `MT-009.2 [Tester]`: เขียน test serialization
- `MT-009.3 [Coder]`: Implement struct ใน `types.rs`
- `MT-009.4 [Reviewer]`: ตรวจสอบ R4 DoD

#### Packet 2: `PKT-FR009-SERVICE`
- **Target CMP**: `src-tauri/src/commands/gguf.rs::parse_gguf_header`
- `MT-009.5 [Architect]`: ล็อก Signature: `pub fn parse_gguf_header(path: &Path) -> Result<GgufMetadata, String>` อ่าน byte magic `GGUF`
- `MT-009.6 [Tester]`: เขียน test อ่าน mock GGUF file bytes header
- `MT-009.7 [Coder]`: Implement binary header parser (อ่านเฉพาะ 4KB แรก ห้ามโหลดทั้งไฟล์)
- `MT-009.8 [Reviewer]`: ยืนยัน Memory safety และ buffer limit

#### Packet 3: `PKT-FR009-ROUTE`
- **Target CMP**: `src-tauri/src/lib.rs::scan_gguf_directory`
- `MT-009.9 [Architect]`: ล็อก Tauri command `pub async fn scan_gguf_directory(dir_path: String) -> Result<Vec<UnifiedModel>, String>`
- `MT-009.10 [Tester]`: Test directory walk recursion และ filter `.gguf` extension
- `MT-009.11 [Coder]`: Implement async directory scan, parse header, map to `UnifiedModel`
- `MT-009.12 [Reviewer]`: ตรวจสอบ Symlink loop prevention และ permission error handling

#### Packet 4: `PKT-FR009-UI`
- **Target CMP**: `src/js/settings.js::renderFolderPicker`
- `MT-009.13 [Architect]`: ออกแบบปุ่ม Browse Folder เพื่อเลือกไดเรกทอรี GGUF
- `MT-009.14 [Tester]`: ตรวจสอบ Folder selection event trigger
- `MT-009.15 [Coder]`: Implement Tauri dialog plugin integration และ scan progress indicator
- `MT-009.16 [Reviewer]`: ตรวจสอบ Dialog permission security

#### Feature Gate FEAT-004:
- `MT-009.TC [Tester]`: รัน `TC-FEAT-004-INTEG`
- `MT-009.LEDGER [Reviewer]`: บันทึก Lineage record

---

## 4. Phase 7 — Cross-Domain Integration (CROSS-FEAT-001)

หลังจากทุก FR ผ่าน Feature Integration Gate ครบถ้วน:

### 4.1 Unified Model Dashboard End-to-End
- `MT-CROSS-01.1 [Architect]`: ตรวจสอบ Inter-domain Contract ระหว่าง `backend-integration`, `model-management`, `inference-gateway`, และ `observability`
- `MT-CROSS-01.2 [Tester]`: รัน Suite `TEST-SPEC-001-traceability.md` (T-CHAIN, T-ANN, T-ERR) ยืนยัน coverage 100%
- `MT-CROSS-01.3 [Reviewer]`: รัน `validate-docs` ตรวจสอบ 0 Errors / 0 Warnings ทั่วทั้งระบบ
- `MT-CROSS-01.4 [Architect]`: ปิด Sprint v1.0.0 และประทับตรา Release Candidate

---

## 5. ตารางสรุปรวม Microtasks และการจัดสรร Agent

| สเตจ / Feature | รหัส FR | จำนวน Packets | จำนวน Microtasks | โมเดล Coder ที่แนะนำ | เพดาน Token / Packet |
|---|:---:|:---:|:---:|---|:---:|
| **Phase 0: Foundation** | PRJ-001..003 | 3 Skeletons | 11 Tasks | Claude 3.5 / Human | 8,000 |
| **Feature 1: Probe** | FR-001 | 4 Packets | 18 Tasks | Qwen2.5-Coder-7B | 6,000 |
| **Feature 2: Aggregation**| FR-002 | 4 Packets | 18 Tasks | Qwen2.5-Coder-7B | 6,000 |
| **Feature 3: Dedup** | FR-003 | 4 Packets | 18 Tasks | DeepSeek-Coder-6.7B | 6,000 |
| **Feature 4: Model Card** | FR-004 | 4 Packets | 18 Tasks | Qwen2.5-Coder-7B | 5,000 |
| **Feature 5: Control** | FR-005 | 4 Packets | 18 Tasks | Qwen2.5-Coder-7B | 5,000 |
| **Feature 6: GPU Monitor** | FR-006 | 4 Packets | 18 Tasks | DeepSeek-Coder-6.7B | 6,000 |
| **Feature 7: LiteLLM** | FR-008 | 4 Packets | 18 Tasks | Claude 3.5 / Local | 7,000 |
| **Feature 8: Chat** | FR-007 | 4 Packets | 18 Tasks | Qwen2.5-Coder-7B | 6,000 |
| **Feature 9: GGUF Scan** | FR-009 | 4 Packets | 18 Tasks | DeepSeek-Coder-6.7B | 6,000 |
| **Feature 10: LAN Share** | FR-010 | 4 Packets | 18 Tasks | Mellum2 Thinking / Instruct | 6,000 |
| **Phase 7: Cross-Domain**| CROSS-001 | 1 Master | 4 Tasks | Architect / Reviewer | 8,000 |
| **รวมทั้งสิ้น** | **All FRs** | **40 Packets** | **191 Microtasks** | **Multi-Agent Swarm** | — |

---

## 6. ลำดับการสั่งรัน Microtasks (Execution Runbook)

```bash
# 1. ตรวจสอบคิวลำดับงานตาม R5
npm run packet -- --queue

# 2. เริ่มดำเนินการ Feature 1: FR-001 (Backend Probe)
npm run packet -- --feature FEAT-001

# 3. ตรวจสอบ DoD ของแต่ละ microtask packet หลัง Coder ส่งมอบ
npm run packet -- --verify PKT-FR-001-SCHEMA
npm run packet -- --verify PKT-FR-001-SERVICE
npm run packet -- --verify PKT-FR-001-ROUTE
npm run packet -- --verify PKT-FR-001-UI

# 4. ตรวจสอบสถานะ Lineage Ledger
cat docs/lineage/packet-lineage.jsonl
```
