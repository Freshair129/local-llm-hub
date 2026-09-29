---
id: FR-009
title: GGUF File Scanner
domain: backend-integration
owner: Boss
status: draft
priority: P1
features:
  - FEAT-004
cross_domains:
  - model-management
implements_test:
  - TEST-009
---

# FR-009 — GGUF File Scanner

## Statement

ระบบต้อง scan directories ที่ผู้ใช้กำหนดเพื่อหาไฟล์ `.gguf` และ extract metadata จาก GGUF header โดยไม่ต้อง load weights ทั้งไฟล์

## Acceptance Criteria

1. **WHEN** user กำหนด scan path ใน Settings **THEN** system SHALL scan recursively ลึกสูงสุด 5 levels
2. **WHEN** ไฟล์ `.gguf` พบ **THEN** system SHALL extract metadata จาก GGUF header (ไม่ load weights)
3. **WHEN** scan เสร็จ **THEN** system SHALL add ผลลัพธ์เข้า model list เป็น backend `gguf`
4. **WHEN** path ไม่มีอยู่จริง **THEN** system SHALL แสดง warning และข้าม path นั้น (ไม่ error ทั้งหมด)
5. **WHEN** scan path เป็น system directory (C:\Windows, C:\Program Files) **THEN** system SHALL ปฏิเสธและแสดง error
6. **IF** ไฟล์ขนาดเล็กกว่า 1 MB **THEN** system SHALL ข้าม (ไม่น่าใช่ model file)
7. **WHEN** scan กำลังทำงาน **THEN** system SHALL แสดง progress indicator และ ไม่ block UI

## GGUF Header Fields ที่ Extract

| Field | GGUF Key | คำอธิบาย |
|-------|---------|---------|
| Model name | `general.name` | ชื่อโมเดล |
| Architecture | `general.architecture` | llama, mistral, etc. |
| Parameter count | `general.parameter_count` | จำนวน parameters |
| Context length | `llama.context_length` หรือ `{arch}.context_length` | max context |
| Quantization | Extract จาก filename pattern | Q4_K_M, Q8_0, F16 |

ดูรายละเอียดใน [C-ai-system.md §C.6](../appendices/C-ai-system.md)

## Forbidden Paths

```rust
const FORBIDDEN_PREFIXES: &[&str] = &[
    "C:\\Windows",
    "C:\\Program Files",
    "C:\\Program Files (x86)",
    "C:\\System32",
];
```

## Traceability

```
FR-009
  ├── implements ← src-tauri/src/commands/models.rs::scan_gguf
  ├── implements ← src-tauri/src/commands/models.rs::read_gguf_header
  └── verified_by ← tests/gguf_test.rs::test_gguf_scan_directory
                  ← tests/gguf_test.rs::test_gguf_header_parse
                  ← tests/gguf_test.rs::test_gguf_forbidden_path_rejected
```
