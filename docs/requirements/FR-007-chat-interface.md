---
id: FR-007
title: Chat / Test Interface
domain: inference-gateway
owner: Boss
status: active
superseded_by: null
version: 0.2.0
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

### Approved buffered mode (2026-10-05)

The [approved repair](../plans/HUB-ACCEPTANCE-REPAIR.md) defines the current implementation: `get_chat_catalog` supplies Hub logical IDs when configured, or the legacy cached inventory otherwise. Failed Hub discovery disables inference without fallback. Selection and `send_chat_message({request:{model,messages,backend,temperature,max_tokens}})` use the same namespace. Render canonical `content`, preserve a valid selection across refresh, clear invalid selections and reset conversation history when the selection changes. Prevent duplicate sends and model/persona changes during an active request. Escape model names and response/error text.

The buffered response reports only provider-supplied token counts; zero-for-unknown means unavailable. Label output tokens divided by total duration as an end-to-end rate. GPU activity and TTFT are not inferred. Actual native acceptance must cover response rendering and visible failure/busy-state recovery. The streaming, markdown, Stop and retry criteria below remain deferred targets, not completed acceptance claims. The Hub path does not require LiteLLM.

ระบบต้องให้ผู้ใช้สนทนากับโมเดลที่เลือกได้โดยตรงจาก UI ผ่าน LiteLLM proxy พร้อม streaming response

## Deferred streaming acceptance criteria

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

Version diff 0.1.0 -> 0.2.0: Approved buffered behavior with canonical request/response and actual native acceptance; streaming remains deferred. Current implementation is src/js/chat.js, with focused and native tests in eval/desktop/.
