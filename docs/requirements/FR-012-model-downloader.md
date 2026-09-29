---
id: FR-012
title: In-App Model Downloader
domain: backend-integration
owner: Boss
status: implemented
priority: P1
features:
  - FEAT-014
cross_domains:
  - model-management
implements_test:
  - TC-FEAT-014-INTEG
---

# FR-012: In-App Model Downloader

## 1. Description
ระบบค้นหาและดาวน์โหลดโมเดล GGUF หรือเรียกคำสั่ง Pull โมเดลจาก Ollama Library ผ่านหน้าต่างแอปพลิเคชันโดยตรง พร้อมแสดงแถบความคืบหน้า (Progress Bar) และเชื่อมต่อกับพื้นที่เก็บโมเดลในไดรฟ์ `O:\.ollama\models`

## 2. Acceptance Criteria (AC)
- **AC-1**: มีฟังก์ชัน IPC `pull_model(model_name: String) -> Result<String, String>` ใน Backend
- **AC-2**: ปฏิบัติตาม ADR-100: คืนค่า `Result<String, String>` หากชื่อโมเดลว่าง หรือ Backend ออฟไลน์ ปราศจาก `panic!` หรือ crash
- **AC-3**: หน้าจอ UI มีช่องค้นหา/ระบุชื่อโมเดล พร้อม Quick Recommendation Tags สำหรับโมเดลที่แนะนำบน RTX 3060 (12GB CUDA)
- **AC-4**: เมื่อดาวน์โหลดเสร็จสิ้น ให้สั่ง Sync รายการโมเดลใหม่ทั้งหมดเข้าสู่ State อัตโนมัติ

## 3. Traceability
- **Rust Backend**: [`src-tauri/src/commands/backends.rs::pull_model`](../../src-tauri/src/commands/backends.rs)
- **Tauri IPC Command**: [`src-tauri/src/lib.rs::pull_model`](../../src-tauri/src/lib.rs)
- **Frontend UI**: [`src/js/downloader.js`](../../src/js/downloader.js)
