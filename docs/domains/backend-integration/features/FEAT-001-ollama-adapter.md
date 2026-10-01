# FEAT-001: Ollama Backend Adapter & Model Lifecycle Controller

| Field | Value |
|---|---|
| **Feature ID** | `FEAT-001` |
| **Domain** | Backend Integration |
| **Status** | Implemented & Verified |
| **Requirements** | [FR-001](../../../requirements/FR-001-backend-probe.md), [FR-005](../../../requirements/FR-005-model-control.md), [FR-012](../../../requirements/FR-012-model-downloader.md) |
| **Rust Component** | [`src-tauri/src/commands/backends.rs`](file:///d:/local-llm-hub/src-tauri/src/commands/backends.rs) |
| **Frontend Component** | [`src/js/model.js`](file:///d:/local-llm-hub/src/js/model.js) |
| **Test Suite** | [`tests/test_backend_probe.rs`](file:///d:/local-llm-hub/src-tauri/tests/test_backend_probe.rs), [`tests/test_model_control.rs`](file:///d:/local-llm-hub/src-tauri/tests/test_model_control.rs) |

---

## 1. Overview

FEAT-001 ให้บริการเชื่อมต่อกับ Ollama Daemon (`http://localhost:11434`) ผ่าน Asynchronous HTTP Protocol โดยทำหน้าที่:
1. Probe ตรวจสอบสถานะการทำงานของ Ollama daemon และดึงหมายเลขเวอร์ชัน
2. ดึงรายการโมเดลที่ติดตั้งอยู่ในระบบ (`/api/tags`) พร้อมขนาดไฟล์ (byte size) และ digest hash
3. สั่ง Start / Stop (Evict) โมเดลออกจากหน่วยความจำ VRAM ผ่าน API parameter `keep_alive: 0`
4. รองรับการดาวน์โหลดโมเดลใหม่ผ่าน `/api/pull` ด้วย streaming progress updates

---

## 2. Technical Contracts & IPC Interface

### 2.1 Backend Probe IPC (`probe_backends`)
```rust
#[tauri::command]
pub async fn probe_backends(state: State<'_, AppState>) -> Result<Vec<BackendStatus>, String>
```
- **Timeout**: 2,500 ms per probe เพื่อไม่ให้กระทบ UI responsiveness
- **Status Mapping**:
  - `Online`: HTTP 200 OK จาก `/api/version` พร้อมค่า version string
  - `Offline`: Connection refused / Timeout พร้อมข้อความ error ภาษาอังกฤษที่เป็นมิตร

### 2.2 Model Lifecycle Control (`start_model`, `stop_model`)
```rust
#[tauri::command]
pub async fn start_model(model_name: String, backend_type: String) -> Result<String, String>;

#[tauri::command]
pub async fn stop_model(model_name: String, backend_type: String) -> Result<String, String>;
```
- เมื่อสั่ง `stop_model` สำหรับ Ollama:
  - ยิง POST ไปที่ `/api/generate` ด้วย `{"model": "<name>", "keep_alive": 0}`
  - ทำให้ Ollama คืน VRAM ทันที โดยไม่ต้อง restart daemon

### 2.3 Model Pulling (`pull_model`)
```rust
#[tauri::command]
pub async fn pull_model(model_name: String) -> Result<String, String>;
```

---

## 3. Reliability & Zero-Panic Guarantees
- ป้องกัน Network Partition หรือ Ollama Crash ไม่ให้แอปพลิเคชันพัง (Zero-Panic ตาม ADR-100)
- ตัดคำนำหน้าหรือ suffix ของ tag อย่างปลอดภัยด้วย UTF-8 boundary checks
