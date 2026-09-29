---
id: FR-003
title: Duplicate Detection
domain: model-management
owner: Boss
status: draft
priority: P0
features:
  - FEAT-006
  - CROSS-FEAT-001
cross_domains:
  - backend-integration
implements_test:
  - TEST-003
---

# FR-003 — Duplicate Detection

## Statement

ระบบต้องตรวจจับโมเดลที่เหมือนกัน (ตาม canonical name) ข้ามหลาย backend และ mark ทั้งสองฝั่งพร้อมแนะนำ preferred backend

## Acceptance Criteria

1. **WHEN** model ชื่อเดียวกัน (หลัง normalize) พบในมากกว่า 1 backend **THEN** system SHALL mark ทุก entry ใน group ด้วย `is_duplicate = true`
2. **WHEN** duplicate group ถูกสร้าง **THEN** system SHALL เลือก preferred entry ตาม priority: Ollama > vLLM > GGUF > HF
3. **WHEN** preferred เลือกแล้ว **THEN** system SHALL mark entry นั้นด้วย `is_preferred = true` และ entry อื่นใน group เป็น `false`
4. **WHEN** UI แสดง model list **THEN** system SHALL แสดง duplicate badge สีเหลืองบน entry ที่ `is_duplicate = true`
5. **WHEN** user hover บน duplicate badge **THEN** system SHALL แสดง tooltip ระบุว่า backend ไหนบ้างที่มีโมเดลนี้

## Edge Cases

- **Backend เดียวกัน** มีโมเดลชื่อเหมือนกันสองครั้ง → ไม่ถือว่า duplicate (เป็น bug ของ backend)
- **Canonical name เหมือนกันแต่ parameter count ต่างกัน** → ไม่ถือว่า duplicate (เช่น llama3.2:3b vs llama3.2:8b normalize ต่างกัน)
- **Backend ที่ preferred offline** → เลือก preferred อันดับถัดไปที่ online

## Priority Matrix (BR-001)

| Scenario | Winner | Reason |
|----------|--------|--------|
| Ollama vs GGUF | Ollama | Auto memory management ดีกว่า |
| Ollama vs vLLM | Ollama (consumer) | ขึ้นกับ use case — configurable ใน v1.1 |
| vLLM vs GGUF | vLLM | Higher throughput |
| HF vs anything | HF loses | Slowest inference |

## Implementation Notes

- Rust: `src-tauri/src/commands/models.rs::dedup_models`
- Input: `Vec<UnifiedModel>` ที่ผ่าน normalize แล้ว (จาก FR-002)
- Output: `Vec<UnifiedModel>` พร้อม `is_duplicate`, `is_preferred`, `duplicate_group`

## Dependencies

- **FR-002** (Model Aggregation + Normalization) — ต้องมี canonical name ก่อน

## Traceability

```
FR-003
  ├── implements ← src-tauri/src/commands/models.rs::dedup_models
  └── verified_by ← tests/dedup_test.rs::test_dedup_llama3_across_backends
                  ← tests/dedup_test.rs::test_preferred_backend_priority
                  ← tests/dedup_test.rs::test_dedup_offline_preferred_fallback
```
