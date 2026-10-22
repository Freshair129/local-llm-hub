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

1. **WHEN** user กด Load บน Ollama model ที่มีสถานะยืนยันแล้ว **THEN** system SHALL ส่งคำขอ load ไปยัง Ollama
2. **WHEN** Ollama ตอบรับด้วย JSON ที่ถูกต้องและสถานะใน `/api/ps` ยืนยัน model identity เดียวกัน **THEN** system SHALL แสดง `ACTIVE`; model version และ quantization ที่ต่างกัน SHALL ไม่ถูกรวมเป็น identity เดียวกัน
3. **WHEN** user กด Unload บน Ollama model ที่ยืนยันว่า active **THEN** system SHALL ส่ง `keep_alive: 0` และยืนยันว่า identity นั้นหายจาก `/api/ps`
4. **WHEN** state endpoint ตอบผิดรูปแบบ ล้มเหลว หรือยืนยันผลไม่ได้ **THEN** system SHALL แสดง `UNKNOWN` และปิดการเปลี่ยน lifecycle จนกว่าจะ refresh สำเร็จ
5. **WHEN** load/unload กำลังทำงาน **THEN** system SHALL แสดงสถานะกำลังทำงานและ disable ปุ่มจนกว่าจะได้ผลยืนยันหรือ error
6. **WHEN** command ล้มเหลว **THEN** system SHALL แสดงรายละเอียด error และ refresh สถานะจาก backend
7. **WHEN** model มาจาก vLLM, GGUF หรือ HF โดยไม่มี lifecycle controller ที่จัดการ process จริง **THEN** system SHALL แสดงสถานะที่ทราบได้และปิดปุ่ม start/stop พร้อมข้อความบอกขอบเขตการจัดการ

## Backend-Specific Behavior

| Backend | Start Command | Stop Command |
|---------|--------------|-------------|
| Ollama | `POST /api/generate` with `stream: false`; require a valid success payload, then verify exact model identity in `/api/ps` | `POST /api/generate` with `keep_alive: 0`; require a valid success payload, then verify identity is absent from `/api/ps` |
| vLLM | Unsupported: display serving state from `/v1/models`; external server owns lifecycle | Unsupported |
| GGUF | Unsupported: display on-disk state; no managed `llama-server` process is configured | Unsupported |
| HF TGI | Unsupported: no managed TGI process is configured | Unsupported |

> สถานะ `UNKNOWN` หมายถึงอ่าน `/api/ps` ไม่สำเร็จหรือ response ไม่ถูกต้อง ไม่ได้หมายถึง model ว่าง ระบบไม่รายงาน endpoint scheduler ว่าจัดการ VRAM ร่วมกับแอปอื่น

## Traceability

```
FR-005
  ├── implements ← src-tauri/src/commands/backends.rs::start_model
  ├── implements ← src-tauri/src/commands/backends.rs::stop_model
  └── verified_by ← src-tauri/src/commands/models.rs::tests
                  ← src-tauri/src/commands/backends.rs::tests
                  ← eval/desktop/model_lifecycle.test.mjs
```
