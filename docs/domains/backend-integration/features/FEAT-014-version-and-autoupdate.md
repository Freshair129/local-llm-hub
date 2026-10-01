# FEAT-014: In-App Version Registry & Auto-Updater Engine

| Field | Value |
|---|---|
| **Feature ID** | `FEAT-014` |
| **Domain** | Backend Integration |
| **Status** | Implemented & Verified |
| **Requirements** | [FR-014](../../../requirements/FR-014-version-and-autoupdate.md) |
| **Rust Component** | [`src-tauri/src/commands/updater.rs`](file:///d:/local-llm-hub/src-tauri/src/commands/updater.rs) |
| **Frontend Component** | [`src/js/updater.js`](file:///d:/local-llm-hub/src/js/updater.js) |
| **Test Suite** | Unit tests in `src-tauri/src/commands/updater.rs` |

---

## 1. Overview

FEAT-014 จัดการระบบตรวจสอบเวอร์ชันของแอปพลิเคชันและการอัปเดตแบบอัตโนมัติ:
1. **Version Registry**: ดึงหมายเลขเวอร์ชันของโปรแกรม (`0.1.0`), แพลตฟอร์มปลายทาง (`windows-x86_64`), และสถานะ git commit hash
2. **Update Checker**: ยิงตรวจสอบ GitHub Releases API โดยเปรียบเทียบ Semantic Versioning (`is_newer_version(current, candidate)`)
3. **Zero-Panic Fallback**: หากต่ออินเทอร์เน็ตไม่ได้ จะไม่เกิดข้อผิดพลาดรุนแรงและคืนค่า `has_update: false` อย่างปลอดภัย
4. **Update Modal**: แสดง Release Notes และปุ่มคลิกดาวน์โหลดแพ็กเกจใหม่
