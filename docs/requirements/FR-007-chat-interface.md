---
id: FR-007
title: Chat / Test Interface
domain: inference-gateway
owner: Boss
status: draft
priority: P1
features:
  - FEAT-009
cross_domains:
  - model-management
implements_test:
  - TEST-007
---

# FR-007 — Chat / Test Interface

## Statement

ระบบต้องให้ผู้ใช้สนทนากับโมเดลที่เลือกได้โดยตรงจาก UI ผ่าน LiteLLM proxy พร้อม streaming response

## Acceptance Criteria

1. **WHEN** user เลือกโมเดลจาก dropdown **THEN** system SHALL แสดงชื่อโมเดลพร้อม backend badge
2. **WHEN** user ส่ง message **THEN** system SHALL ส่ง POST request ไปยัง LiteLLM proxy (`/v1/chat/completions`) พร้อม `stream: true`
3. **WHEN** streaming response เริ่มมา **THEN** system SHALL แสดง typing indicator จนกว่า token แรกมาถึง
4. **WHEN** token stream มาถึง **THEN** system SHALL render ใน assistant bubble แบบ real-time (character by character)
5. **WHEN** stream เสร็จสิ้น **THEN** system SHALL render markdown ทั้งหมดใน assistant bubble (code blocks, bold, lists)
6. **WHEN** LiteLLM proxy ไม่ได้ run **THEN** system SHALL แสดง error "LiteLLM proxy not running — toggle it in the sidebar"
7. **WHEN** stream ขาด (network error) **THEN** system SHALL แสดง partial response + error notice + retry button
8. **WHEN** user กด Stop **THEN** system SHALL abort request และแสดง partial response ที่ได้

## Chat Parameters (Configurable)

| Parameter | Default | Range |
|-----------|---------|-------|
| Temperature | 0.7 | 0.0–2.0 |
| Max tokens | 2048 | 64–8192 |
| System prompt | "" (empty) | multiline text |

## Dependencies

- **FR-008** (LiteLLM Proxy) — ต้อง running ก่อน chat ได้

## Traceability

```
FR-007
  ├── implements ← src/js/pages/chat.js::ChatPage
  ├── implements ← src/js/pages/chat.js::sendMessage
  ├── implements ← src/js/pages/chat.js::streamResponse
  └── verified_by ← manual: test_chat_streaming
                  ← manual: test_chat_stream_abort
```
