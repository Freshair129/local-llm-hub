---
id: NFR-002
title: Reliability
domain: inference-gateway
owner: Boss
status: draft
priority: P0
cross_domains:
  - backend-integration
---

# NFR-002 — Reliability

## Requirements

| ID | Requirement | EARS Format |
|----|------------|-------------|
| NFR-002-01 | Graceful backend offline | **IF** backend offline **THEN** app SHALL ยังทำงานได้ — ไม่ crash |
| NFR-002-02 | LiteLLM auto-restart | **WHEN** sidecar crash **THEN** system SHALL auto-restart ≤ 3 ครั้ง |
| NFR-002-03 | Settings persistence | **WHEN** app restart **THEN** backend config SHALL ยังคงอยู่ครบถ้วน |
| NFR-002-04 | Clean shutdown | **WHEN** app ปิด **THEN** system SHALL terminate LiteLLM sidecar — ไม่ orphan |
| NFR-002-05 | Partial failure isolation | **IF** 1 backend error **THEN** backends อื่น SHALL ทำงานได้ตามปกติ |

## Verification

- NFR-002-01: test โดย kill Ollama ขณะ app running
- NFR-002-02: unit test mock process ที่ crash → verify restart count
- NFR-002-03: integration test save + kill + relaunch → compare settings
- NFR-002-04: process monitor ตรวจหลัง app close
