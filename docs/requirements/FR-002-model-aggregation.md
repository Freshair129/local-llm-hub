---
id: FR-002
title: Model Aggregation
domain: model-management
owner: Boss
status: draft
priority: P0
features:
  - FEAT-005
  - CROSS-FEAT-001
cross_domains:
  - backend-integration
implements_test:
  - TEST-002
---

# FR-002 — Model Aggregation

## Statement

ระบบต้องรวมรายการโมเดลจากทุก backend ที่ online เข้าเป็น unified list เดียว

## Acceptance Criteria

1. **WHEN** backend อยู่ใน online state **THEN** system SHALL ดึง model list จาก backend นั้นและรวมใน unified list
2. **WHEN** backend offline **THEN** system SHALL ข้ามและไม่แสดง error (graceful skip)
3. **WHEN** model list ได้รับจากทุก backend **THEN** system SHALL normalize ชื่อโมเดลแต่ละตัวตาม [BR-002](../PRD-SDD-v1.0.md#br-002-model-name-normalization)
4. **WHEN** unified list พร้อม **THEN** system SHALL sort ตาม canonical name (A→Z)
5. **IF** ทุก backend offline **THEN** system SHALL แสดง empty state พร้อม message "No backends available"

## Data Contract

**Input:** `RawModel[]` จาก backend-integration  
**Output:** `UnifiedModel[]` พร้อม `canonical_name` ที่ normalize แล้ว

## Normalization Rules (BR-002)

```
1. lowercase
2. ลบ quantization suffix: q4_k_m, q8_0, f16, gguf, ggml
3. แทน [-_/.] → space, trim, collapse spaces
4. ลบ version tags: :latest, :v1.0
```

ตัวอย่าง: `Meta-Llama-3.2-3B-Instruct.Q4_K_M.gguf` → `meta llama 3.2 3b instruct`

## Implementation Notes

- Rust command: `list_all_models() → Vec<UnifiedModel>`
- ดู [A-api-spec.md §A.1 list_all_models](../appendices/A-api-spec.md)
- Normalization ใน: `src-tauri/src/commands/models.rs::normalize_model_name`

## Dependencies

- **FR-001** (Backend Probe) — ต้องรู้ว่า backend ไหน online ก่อน

## Traceability

```
FR-002
  ├── implements ← src-tauri/src/commands/models.rs::aggregate_models
  ├── implements ← src-tauri/src/commands/models.rs::normalize_model_name
  └── verified_by ← tests/models_test.rs::test_aggregate_from_all_backends
                  ← tests/models_test.rs::test_normalize_model_name
```
