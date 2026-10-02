# 🔬 Microtask & Subtask Breakdown Specification (P2 Roadmap)
## แผนการแตกงานระดับ Subtask และ Microtask ตามมาตรฐาน STD-003 & SPEC-WORKFLOW-001

| ข้อมูลเอกสาร | รายละเอียด |
|---|---|
| **Document ID** | `SPEC-MICROTASKS-P2-001` |
| **System** | Local LLM Hub — Phase 6 Execution Breakdown |
| **Version** | `1.0.0` |
| **Status** | `Execution-Ready / Deterministic Specification` |
| **Standard** | [`STD-003 (Packet System)`](../standards/STD-003-implementation-unit-and-packet.md), [`SPEC-WORKFLOW-001`](MULTI_AGENT_WORKFLOW_SPEC.md), [`EXEC-DAG-WAVE-001`](EXECUTION_DAG_WAVES.md) |
| **Scope** | [`FEAT-023`](../domains/inference-gateway/features/FEAT-023-chat-preflight-token-counter.md), [`FEAT-024`](../domains/network-distribution/features/FEAT-024-lan-ephemeral-pin-auth.md), [`FEAT-025`](../domains/model-management/features/FEAT-025-model-tag-taxonomy-filter.md), [`GAP-OBS-01`](../GAP-ANALYSIS.md) |

---

## 1. ลำดับชั้นการแตกงาน (Decomposition Hierarchy)

เพื่อให้ Local LLM บนการ์ดจอ RTX 3060 12GB สามารถประมวลผลได้อย่างแม่นยำ ไม่เกิดภาพหลอน (Hallucination) และไม่กิน Token เกินขีดจำกัด Context Window ระบบได้แตกงานออกเป็น 4 ระดับ:

```
[Level 1: Feature / Epic] (FEAT-023, FEAT-024, FEAT-025)
       │
       ▼
[Level 2: Wave & Packet] (Packet = FR × Layer: Schema, Service, Route, UI)
       │
       ▼
[Level 3: Subtask (ST)] (โมดูลย่อยและคอมโพเนนต์เฉพาะจุด)
       │
       ▼
[Level 4: Microtask (MT)] (หน่วยงานอะตอมิก: 1 ฟังก์ชัน / 1 Unit Test / 1 DTO)
         ├─ MT.1 [Architect] Interface & Contract Lock
         ├─ MT.2 [Tester] TDD Unit Test (Red Phase)
         ├─ MT.3 [Coder Local LLM] Implementation (Green Phase)
         └─ MT.4 [Verifier/Reviewer] Definition of Done (DoD Audit)
```

---

## 2. โครงสร้าง Microtask Checklist แบ่งตาม Wave

---

### 🌊 WAVE 1: Schema & Data Contracts (Layer 1)

#### 📦 Packet 1: `PKT-F023-SCHEMA` (Chat Token Counter DTOs)
- **ST-023-1.1**: โครงสร้างข้อมูลประเมินบริบทข้อความและเกณฑ์ความจุ
  - [x] **MT-023-1.1.1 [Architect Lock]**: กำหนด struct `TokenEstimateRequest`, `TokenEstimateResult`, `ContextThresholdLevel` ใน [`src-tauri/src/models/types.rs`](file:///d:/local-llm-hub/src-tauri/src/models/types.rs)
    - *Signature*:
      ```rust
      pub struct TokenEstimateResult {
          pub estimated_tokens: usize,
          pub max_context_length: usize,
          pub usage_percentage: f32,
          pub threshold: ContextThresholdLevel, // Safe, Warning, Danger
      }
      ```
    - *Target File*: `src-tauri/src/models/types.rs`
    - *Assigned Model*: `MODEL-MELLUM2-INST` (Prompt Budget: 450 tokens)
  - [x] **MT-023-1.1.2 [Tester TDD Red]**: เขียน Unit Test ตรวจสอบ Serde JSON Serialization/Deserialization
    - *Test Name*: `test_token_estimate_result_serde`
    - *Target File*: `src-tauri/src/models/types.rs` (in `mod tests`)
    - *Verification*: `cargo test test_token_estimate_result_serde`
  - [x] **MT-023-1.1.3 [Coder Green]**: สั่ง Worker สร้าง Code ตาม struct และ derive `(Debug, Clone, Serialize, Deserialize)`
    - *Assigned Model*: `MODEL-MELLUM2-INST`
  - [x] **MT-023-1.1.4 [Verifier DoD]**: ตรวจสอบ Zero Panic, zero compiler warning, AC-01 match
    - *Assigned Model*: `MODEL-SUSHI-CODER` (@ temp: 0.0)

#### 📦 Packet 2: `PKT-F024-SCHEMA` (LAN Ephemeral PIN & Session Record)
- **ST-024-1.1**: โครงสร้างสถานะ Session และรหัส PIN ชั่วคราว
  - [x] **MT-024-1.1.1 [Architect Lock]**: กำหนด struct `LanSharePinSession`, `LanPinVerificationResult` ใน [`src-tauri/src/models/types.rs`](file:///d:/local-llm-hub/src-tauri/src/models/types.rs)
    - *Signature*:
      ```rust
      pub struct LanSharePinSession {
          pub pin: String,
          pub expires_at: u64,
          pub failed_attempts: u32,
          pub is_locked: bool,
      }
      ```
  - [x] **MT-024-1.1.2 [Tester TDD Red]**: เขียน Unit Test ตรวจสอบสถานะการหมดอายุและความถูกต้องของ PIN
    - *Test Name*: `test_lan_pin_session_expiration_logic`
  - [x] **MT-024-1.1.3 [Coder Green]**: สร้างโค้ด struct พร้อมฟังก์ชัน `is_valid(&self, candidate_pin: &str, now: u64) -> bool`
  - [x] **MT-024-1.1.4 [Verifier DoD]**: ตรวจสอบ Constant-Time comparison ป้องกัน Timing Attacks

#### 📦 Packet 3: `PKT-F025-SCHEMA` (Model Tag Taxonomy Schema)
- **ST-025-1.1**: แท็กหมวดหมู่โมเดลและฟิลด์ขยายใน UnifiedModel
  - [x] **MT-025-1.1.1 [Architect Lock]**: เพิ่ม Enum `ModelCategoryTag` (`Coding`, `Reasoning`, `Chat`, `Vision`, `Edge`) และเพิ่ม field `pub tags: Vec<String>` ใน `UnifiedModel`
  - [x] **MT-025-1.1.2 [Tester TDD Red]**: อัปเดต unit test `test_unified_model_serialization` ให้รองรับ field `tags`
  - [x] **MT-025-1.1.3 [Coder Green]**: อัปเดต `src-tauri/src/models/types.rs` ให้ backwards-compatible ด้วย `#[serde(default)]`
  - [x] **MT-025-1.1.4 [Verifier DoD]**: รัน `cargo test --lib` ยืนยันว่า 48 unit tests เดิมไม่พัง

---

### 🌊 WAVE 2: Service & Logic Engines (Layer 2)

#### 📦 Packet 4: `PKT-F023-SERVICE` (Token Estimator Algorithm)
- **ST-023-2.1**: Hybrid BPE Token Counting Logic
  - [x] **MT-023-2.1.1 [Architect Lock]**: กำหนด signature บริสุทธิ์ `estimate_tokens_heuristic(text: &str, context_window: usize) -> TokenEstimateResult`
  - [x] **MT-023-2.1.2 [Tester TDD Red]**: เขียน Unit Test ทดสอบข้อความภาษาอังกฤษ (code snippet) และข้อความภาษาไทย
  - [x] **MT-023-2.1.3 [Coder Green]**: สร้าง logic คำนวณอัตราส่วน ~3.9 chars/token (Latin) และ ~1.8 chars/token (Thai/CJK)
  - [x] **MT-023-2.1.4 [Verifier DoD]**: ตรวจสอบ Bounds Checking ไม่เกิด integer overflow

#### 📦 Packet 5: `PKT-F024-SERVICE` (Axum Ephemeral PIN Middleware)
- **ST-024-2.1**: Axum Middleware & In-Memory Rate Limiting
  - [x] **MT-024-2.1.1 [Architect Lock]**: กำหนด Axum middleware handler `validate_lan_pin_middleware` ใน [`src-tauri/src/commands/share.rs`](file:///d:/local-llm-hub/src-tauri/src/commands/share.rs)
  - [x] **MT-024-2.1.2 [Tester TDD Red]**: เพิ่ม Integration Test `test_lan_pin_auth_rejection_and_success` ใน `tests/test_lan_share.rs`
  - [x] **MT-024-2.1.3 [Coder Green]**: สร้างฟังก์ชันสุ่ม PIN 4 หลัก (`rand` or pseudo-entropy), rate limiter พยายามผิดเกิน 5 ครั้งล็อก 60s
  - [x] **MT-024-2.1.4 [Verifier DoD]**: ยืนยัน Zero Panic และ HTTP 401 Unauthorized ตอบกลับอย่างถูกต้อง

#### 📦 Packet 6: `PKT-F025-SERVICE` (Model Tag Heuristic Classifier)
- **ST-025-2.1**: Automatic Model Tag Classifier
  - [x] **MT-025-2.1.1 [Architect Lock]**: กำหนดฟังก์ชัน `classify_model_tags(model_name: &str, raw_info: &str) -> Vec<String>` ใน [`src-tauri/src/commands/models.rs`](file:///d:/local-llm-hub/src-tauri/src/commands/models.rs)
  - [x] **MT-025-2.1.2 [Tester TDD Red]**: เขียน Unit Test ตรวจสอบโมเดลยอดนิยม:
    - `qwen3.5-9b-coder` $\rightarrow$ `["Coding"]`
    - `mellum2-12b-thinking` $\rightarrow$ `["Reasoning", "Coding"]`
    - `llama-3.2-1b` $\rightarrow$ `["Edge", "Chat"]`
  - [x] **MT-025-2.1.3 [Coder Green]**: Implement regex keyword pattern matcher
  - [x] **MT-025-2.1.4 [Verifier DoD]**: ตรวจสอบ Case-Insensitive matching

---

### 🌊 WAVE 3: IPC Routes & Tauri Commands (Layer 3)

#### 📦 Packet 7: `PKT-F023-ROUTE` (Chat Token Counter IPC)
- **ST-023-3.1**: Tauri Command Exposure
  - [x] **MT-023-3.1.1 [Architect Lock]**: ประกาศ command `#[tauri::command] pub async fn estimate_chat_tokens(prompt: String, model_id: String, state: State<'_, AppState>) -> Result<TokenEstimateResult, String>`
  - [x] **MT-023-3.1.2 [Coder Green]**: เชื่อมต่อ command เข้ากับ logic ใน Layer 2 และลงทะเบียนใน `src-tauri/src/lib.rs`
  - [x] **MT-023-3.1.3 [Verifier DoD]**: ตรวจสอบ IPC error isolation

#### 📦 Packet 8: `PKT-F024-ROUTE` (LAN Share PIN IPC)
- **ST-024-3.1**: LAN PIN Management Commands
  - [x] **MT-024-3.1.1 [Architect Lock]**: ประกาศ command `generate_lan_pin()`, `verify_lan_pin()`, `get_lan_share_status()`
  - [x] **MT-024-3.1.2 [Coder Green]**: สั่ง Worker สร้าง Tauri commands ใน `src-tauri/src/commands/share.rs`
  - [x] **MT-024-3.1.3 [Verifier DoD]**: ตรวจสอบการห่อหุ้ม Shared State ด้วย `Mutex` ไม่เกิด Deadlock

---

### 🌊 WAVE 4: Bento UI Presentation (Layer 4)

#### 📦 Packet 9: `PKT-F023-UI` (Chat Live Token Meter)
- **ST-023-4.1**: Frontend Live Token Meter & Badges
  - [x] **MT-023-4.1.1 [Architect Lock]**: ออกแบบ HTML structure และ CSS Badge ใน [`src/index.html`](file:///d:/local-llm-hub/src/index.html) (`view-chat`)
  - [x] **MT-023-4.1.2 [Coder Green]**: เพิ่ม Event Listener `input` ใน [`src/js/chat.js`](file:///d:/local-llm-hub/src/js/chat.js) เรียก `estimateTokenCount(text)` แบบ 0ms latency
  - [x] **MT-023-4.1.3 [Verifier DoD]**: ทดสอบการสลับสี 🟢 (<70%), 🟡 (70-90%), 🔴 (>90%)

#### 📦 Packet 10: `PKT-F024-UI` (LAN Share PIN & QR Dialog)
- **ST-024-4.1**: PIN Display & QR Modal
  - [x] **MT-024-4.1.1 [Architect Lock]**: ออกแบบปุ่มสลับ "Require PIN", ป้าย PIN 4 หลักตัวหนา, และ QR SVG Modal ใน `view-share`
  - [x] **MT-024-4.1.2 [Coder Green]**: เชื่อมต่อ JavaScript controller ใน [`src/js/share.js`](file:///d:/local-llm-hub/src/js/share.js)
  - [x] **MT-024-4.1.3 [Verifier DoD]**: ตรวจสอบปุ่ม "Copy PIN" และการแสดงผลบน mobile view

#### 📦 Packet 11: `PKT-F025-UI` (Bento Model Tag Filter Bar)
- **ST-025-4.1**: Tag Pills Filter UI
  - [x] **MT-025-4.1.1 [Architect Lock]**: ออกแบบ Filter Bar: `[All]`, `[💻 Coding]`, `[🧠 Reasoning]`, `[💬 Chat]`, `[👁️ Vision]`, `[⚡ Small]`
  - [x] **MT-025-4.1.2 [Coder Green]**: เพิ่ม filter predicate ใน `renderModelGrid()` ใน [`src/js/model.js`](file:///d:/local-llm-hub/src/js/model.js)
  - [x] **MT-025-4.1.3 [Verifier DoD]**: ตรวจสอบ dynamic count badge แสดงจำนวนโมเดลถูกต้อง

#### 📦 Packet 12: `PKT-OBS-UI` (Thermal Hotspot Alert Toast)
- **ST-OBS-4.1**: Thermal Threshold Banner
  - [x] **MT-OBS-4.1.1 [Architect Lock]**: กำหนดเกณฑ์เตือน: GPU Hotspot > 88°C หรือ VRAM > 95%
  - [x] **MT-OBS-4.1.2 [Coder Green]**: เพิ่ม event listener ตรวจสอบ `telemetry://snapshot` ใน [`src/js/sensors.js`](file:///d:/local-llm-hub/src/js/sensors.js) แสดง toast สีส้ม/แดง
  - [x] **MT-OBS-4.1.3 [Verifier DoD]**: ตรวจสอบ debounce toast ไม่ให้แสดงซ้ำรัวๆ

---

### 🌊 WAVE 5: Integration Gates & Verification Harness

- [x] **MT-INT-5.1 [Test Gate]**: รัน `cargo test --tests` และ `cargo test --lib` (ต้องผ่าน 100% Green, 0 errors)
- [x] **MT-INT-5.2 [Review Gate]**: รัน `Mellum2 12B Thinking` ตรวจสอบ concurrency, deadlocks และ zero-panic guarantees
- [x] **MT-INT-5.3 [Lineage Ledger]**: บันทึก hash ของทุก packet ลงใน [`docs/lineage/packet-lineage.jsonl`](file:///d:/local-llm-hub/docs/lineage/packet-lineage.jsonl)
- [x] **MT-INT-5.4 [Git Release]**: Commit ตรงเข้า branch `main` โดยไม่สร้าง release tag
