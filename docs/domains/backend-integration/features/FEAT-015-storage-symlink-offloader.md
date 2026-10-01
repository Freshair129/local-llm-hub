# FEAT-015: Storage Symlink & Directory Junction Offloader

| Field | Value |
|---|---|
| **Feature ID** | `FEAT-015` |
| **Domain** | Backend Integration & Storage |
| **Status** | Implemented & Verified |
| **Requirements** | [FR-015](../../../requirements/FR-015-storage-symlink-offloader.md) |
| **Rust Component** | [`src-tauri/src/commands/storage.rs`](file:///d:/local-llm-hub/src-tauri/src/commands/storage.rs) |
| **Frontend Component** | [`src/js/storage.js`](file:///d:/local-llm-hub/src/js/storage.js) |
| **Test Suite** | Unit tests in `src-tauri/src/commands/storage.rs` |

---

## 1. Overview

FEAT-015 จัดการการประหยัดพื้นที่ดิสก์หลัก (`C:\`) โดยการตรวจสอบและย้ายโฟลเดอร์เก็บ Model Blobs ของ Ollama (`~/.ollama/models/blobs`) ไปยังไดรฟ์ภายนอกความจุสูง (เช่น `G:\.ollama_blobs_root`) ผ่าน NTFS Directory Junctions:
1. **Audit Phase**: สำรวจไฟล์ blob ทั้งหมดในโฟลเดอร์ คำนวณขนาดรวมและตรวจสอบว่าโฟลเดอร์ใดเป็น symlink / junction อยู่แล้ว
2. **Offload Phase**: ย้ายไฟล์โมเดลขนาดใหญ่ไปยังดิสก์ปลายทางอย่างปลอดภัย พร้อมสร้าง junction point แทนที่แบบ atomic
3. **Health Check**: ตรวจสอบสถานะการอ่าน/เขียนข้อมูลผ่าน junction เพื่อรับประกันว่า Ollama จะยังสามารถโหลดโมเดลได้ตามปกติ 100%

---

## 2. Technical Contracts & IPC Interface

### 2.1 IPC Commands
```rust
#[tauri::command]
pub async fn audit_blob_symlinks(custom_path: Option<String>) -> Result<SymlinkHealth, String>;

#[tauri::command]
pub async fn execute_blob_offload(target_dir: String, custom_source: Option<String>) -> Result<OffloadResult, String>;
```

### 2.2 Safety Guarantees
- ไม่ลบไฟล์ต้นทางจนกว่าจะคัดลอกไฟล์ไปยังปลายทางเสร็จสมบูรณ์และตรวจสอบ SHA256 / File Size ครบถ้วน
- ตรวจสอบสิทธิ์การเข้าถึง (Permission check) ก่อนเริ่มกระบวนการ
