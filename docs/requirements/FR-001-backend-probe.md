---
id: FR-001
title: Backend Probe
domain: backend-integration
owner: Boss
status: draft
priority: P0
features:
  - FEAT-001
  - FEAT-002
  - FEAT-003
cross_domains: []
implements_test:
  - TEST-001
---

# FR-001 — Backend Probe

## Statement

ระบบต้องตรวจสอบ online/offline status ของทุก backend ที่ configured และแสดงผลใน UI

## Acceptance Criteria

1. **WHEN** application เริ่มต้น **THEN** system SHALL probe ทุก backend URL ที่ enabled และแสดงสถานะ online/offline ภายใน 5 วินาที
2. **WHEN** user กด Refresh **THEN** system SHALL re-probe ทุก backend ภายใน 5 วินาที
3. **WHEN** backend offline **THEN** system SHALL แสดง error message ที่อ่านได้ (ไม่ใช่ raw error code)
4. **WHEN** probe timeout **THEN** system SHALL retry 1 ครั้ง ก่อน mark offline
5. **IF** backend กลับมา online หลัง probe **THEN** system SHALL อัปเดตสถานะในรอบถัดไปโดยไม่ต้อง restart app

## Constraints

- Timeout per backend: **5 วินาที**
- Retry: **1 ครั้ง** ก่อน mark offline
- ต้องไม่ block UI ระหว่าง probe (async)

## Implementation Notes

- Rust command: `probe_backends(config: BackendConfig) → Vec<ProbeResult>`
- ดู API spec: [A-api-spec.md §A.1 probe_backends](../appendices/A-api-spec.md)

## Traceability

```
FR-001
  ├── implements ← src-tauri/src/commands/backends.rs::probe_backends
  └── verified_by ← tests/backend_probe_test.rs::test_probe_ollama_online
                  ← tests/backend_probe_test.rs::test_probe_offline_timeout
```
