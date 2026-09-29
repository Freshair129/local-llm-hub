---
id: FR-005
title: Model Start/Stop Control
domain: backend-integration
owner: Boss
status: draft
priority: P1
features:
  - FEAT-001
  - FEAT-002
  - FEAT-004
cross_domains: []
implements_test:
  - TEST-005
---

# FR-005 — Model Start/Stop Control

## Statement

ระบบต้องให้ผู้ใช้ start (load) และ stop (unload) โมเดลจาก UI โดยตรง โดยส่ง command ไปยัง backend ที่เหมาะสม

## Acceptance Criteria

1. **WHEN** user กด Start บน available model **THEN** system SHALL ส่ง load command ไปยัง backend ที่รับผิดชอบ
2. **WHEN** load command สำเร็จ **THEN** system SHALL update สถานะโมเดลเป็น `loaded` ใน UI ภายใน 2 วินาที
3. **WHEN** user กด Stop บน loaded model **THEN** system SHALL ส่ง unload command ไปยัง backend
4. **WHEN** unload สำเร็จ **THEN** system SHALL update สถานะเป็น `available`
5. **WHEN** load/unload กำลังทำงาน **THEN** system SHALL แสดง loading indicator บน button และ disable ปุ่มจนกว่าจะเสร็จ
6. **WHEN** command ล้มเหลว **THEN** system SHALL แสดง error message พร้อม detail

## Backend-Specific Behavior

| Backend | Start Command | Stop Command |
|---------|--------------|-------------|
| Ollama | `POST /api/generate` (first call loads) | `POST /api/generate` with `keep_alive: 0` |
| vLLM | แสดง info dialog "vLLM requires server restart to change models" | แสดง info dialog เดียวกัน |
| GGUF | แสดง info dialog "Start llama-server manually: `llama-server -m {path}`" | แสดง info dialog |
| HF TGI | แสดง info dialog "TGI requires restart" | แสดง info dialog |

> **หมายเหตุ**: vLLM และ TGI ไม่ support hot-swap model ใน v1.0 ระบบจะแสดง instruction แทน

## Traceability

```
FR-005
  ├── implements ← src-tauri/src/commands/backends.rs::start_model
  ├── implements ← src-tauri/src/commands/backends.rs::stop_model
  └── verified_by ← tests/backends_test.rs::test_ollama_start_model
                  ← tests/backends_test.rs::test_ollama_stop_model
                  ← tests/backends_test.rs::test_start_model_error_handling
```
