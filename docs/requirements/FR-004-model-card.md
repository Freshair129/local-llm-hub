---
id: FR-004
title: Model Card Display
domain: model-management
owner: Boss
status: draft
priority: P1
features:
  - FEAT-007
cross_domains: []
implements_test:
  - TEST-004
---

# FR-004 — Model Card Display

## Statement

ระบบต้องดึงและแสดง Model Card (README.md) ของโมเดล พร้อม metadata สำคัญเช่น license, tags, base model

## Acceptance Criteria

1. **WHEN** user คลิกโมเดลใน model list **THEN** system SHALL เปิด slide-in drawer จากขวา
2. **WHEN** drawer เปิด **THEN** system SHALL fetch model card ตาม strategy ใน §Fetch Strategy ภายใน 3 วินาที
3. **WHEN** model card โหลดสำเร็จ **THEN** system SHALL แสดง: title, license badge, language tags, pipeline_tag, base_model, README body (rendered markdown)
4. **WHEN** HuggingFace API คืน 404 **THEN** system SHALL แสดง "No model card available for this model"
5. **WHEN** model เป็น GGUF local **THEN** system SHALL หา README.md หรือ modelcard.md ใน directory เดียวกัน
6. **IF** ไม่พบ model card จากทุก strategy **THEN** system SHALL แสดง basic metadata (size, quantization, path, backend)
7. **WHEN** drawer เปิดอยู่ **THEN** กด Esc หรือคลิก overlay SHALL ปิด drawer

## Fetch Strategy (ตามลำดับ)

```
1. HF repo_id รู้ → fetch https://huggingface.co/{repo_id}/raw/main/README.md
2. Ollama model → map ชื่อ → HF repo ผ่าน OLLAMA_HF_MAP → ไปขั้น 1
3. GGUF local → ค้นหา README.md / modelcard.md ใน parent folder
4. ไม่พบ → แสดง basic metadata
```

ดู mapping table ใน [C-ai-system.md §C.4](../appendices/C-ai-system.md)

## Constraints

- Cache model card: **1 ชั่วโมง** (ใน memory, ไม่ต้องเขียน disk)
- ขนาด README ที่ render: cap ที่ **500 KB** (ตัดส่วนเกินและแสดง "truncated" notice)
- ต้อง fetch แบบ async — ไม่ block UI

## Implementation Notes

- Rust command: `read_model_card(input: ModelCardInput) → ModelCard`
- HF token จาก keychain ถ้ามี
- ดู [A-api-spec.md §A.1 read_model_card](../appendices/A-api-spec.md)

## Traceability

```
FR-004
  ├── implements ← src-tauri/src/commands/models.rs::read_model_card
  ├── implements ← src/js/components/modelCard.js::renderModelCard
  └── verified_by ← tests/model_card_test.rs::test_hf_model_card_fetch
                  ← tests/model_card_test.rs::test_gguf_local_readme
                  ← tests/model_card_test.rs::test_model_card_404_fallback
```
