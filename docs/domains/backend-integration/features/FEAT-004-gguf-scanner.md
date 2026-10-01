# FEAT-004: GGUF Binary Parser & Filesystem Scanner

| Field | Value |
|---|---|
| **Feature ID** | `FEAT-004` |
| **Domain** | Backend Integration |
| **Status** | Implemented & Verified |
| **Requirements** | [FR-009](../../../requirements/FR-009-gguf-scanner.md) |
| **Rust Component** | [`src-tauri/src/commands/scanner.rs`](file:///d:/local-llm-hub/src-tauri/src/commands/scanner.rs) |
| **Test Suite** | [`tests/test_scanner.rs`](file:///d:/local-llm-hub/src-tauri/tests/test_scanner.rs) |

---

## 1. Overview

FEAT-004 ให้บริการสแกนระบบไฟล์ภายในเครื่องเพื่อค้นหาไฟล์โมเดล GGUF (`.gguf`) ขนาดใหญ่ โดยทำหน้าที่:
1. ทำการอ่าน Binary Header ของไฟล์โมเดลโดยตรง โดยอ่านเพียง 4,096 ไบต์แรก ไม่โหลดทั้งไฟล์เข้า RAM
2. ตรวจสอบ Magic Bytes `0x47, 0x47, 0x55, 0x46` (`GGUF`)
3. ดึง metadata สำคัญ:
   - Version หมายเลขเวอร์ชัน (v1, v2, v3)
   - Tensor Count (จำนวน tensor parameters)
   - KV Metadata Count (คู่ key-value config)
   - Architecture Name (เช่น `llama`, `qwen2`, `gemma2`)
   - Quantization Type (เช่น `Q4_K_M`, `Q8_0`, `BF16`)
4. ป้องกัน Path Traversal และไม่อนุญาตให้สแกนระบบโฟลเดอร์หวงห้ามของ Windows (เช่น `C:\Windows`, `C:\Program Files`)

---

## 2. Technical Contracts & IPC Interface

### 2.1 IPC Command (`scan_directory_for_gguf`)
```rust
#[tauri::command]
pub async fn scan_directory_for_gguf(path: String) -> Result<Vec<GgufMetadata>, String>
```

### 2.2 Security Policies
- ไม่อนุญาต path traversal (`..`)
- บังคับใช้ directory allowlist / blacklist กรอง system root
- คืนค่า error ที่ปลอดภัย ไม่เปิดเผยข้อมูล credentials ในระบบ
