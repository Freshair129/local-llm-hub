---
id: FR-014
title: In-App Version Registry & Auto-Updater Engine
domain: backend-integration
owner: Boss
status: implemented
priority: P1
features:
  - FEAT-016
cross_domains:
  - observability
implements_test:
  - TC-FEAT-016-INTEG
---

# FR-014: In-App Version Registry & Auto-Updater Engine

## 1. Description
ระบบตรวจสอบหมายเลขเวอร์ชันของแอปพลิเคชัน (Semantic Versioning) และระบบตรวจสอบอัปเดตอัตโนมัติ (Auto-Updater) ที่เปิดโอกาสให้ผู้ใช้งานตรวจสอบเวอร์ชันใหม่ อ่าน Release Notes / Changelog และสั่งดาวน์โหลดหรือสลับไปยังเวอร์ชันล่าสุดได้โดยตรงจากหน้าต่างโปรแกรม

## 2. Acceptance Criteria (AC)
- **AC-1**: มีฟังก์ชัน IPC `get_app_version() -> Result<AppVersionInfo, String>` คืนค่าเวอร์ชันปัจจุบัน (`env!("CARGO_PKG_VERSION")`), แพลตฟอร์มปลายทาง (`windows-x86_64`), และสถานะ Release Channel
- **AC-2**: มีฟังก์ชัน IPC `check_for_updates(endpoint_override: Option<String>) -> Result<UpdateCheckResult, String>`
  - เปรียบเทียบ SemVer ผ่านฟังก์ชันบริสุทธิ์ `is_newer_version(current, candidate) -> bool`
  - หากออฟไลน์หรือไม่สามารถติดต่อเซิร์ฟเวอร์อัปเดตได้ ต้องไม่เกิด `panic!` และคืนค่า `has_update: false` อย่างนุ่มนวล (Graceful Fallback ตาม ADR-100)
- **AC-3**: มีฟังก์ชัน IPC `apply_update(download_url: String) -> Result<String, String>` สำหรับดาวน์โหลดและจัดเตรียมไฟล์อัปเดต (Staging)
- **AC-4**: UI ใน Sidebar มีป้าย Version Badge (เช่น `v0.1.0`) พร้อมสถานะไฟเขียว 🟢 เมื่อกดคลิกจะเปิด **Version & Auto-Update Modal** สำหรับตรวจสอบและสั่งอัปเดตได้ทันที

## 3. Traceability
- **Rust Backend**: [`src-tauri/src/commands/updater.rs`](../../src-tauri/src/commands/updater.rs)
- **Data Models**: [`src-tauri/src/models/types.rs::AppVersionInfo`](../../src-tauri/src/models/types.rs)
- **Tauri IPC Command**: [`src-tauri/src/lib.rs::check_for_updates`](../../src-tauri/src/lib.rs)
- **Frontend UI Module**: [`src/js/updater.js`](../../src/js/updater.js)
