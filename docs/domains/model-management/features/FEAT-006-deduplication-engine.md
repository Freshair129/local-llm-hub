# FEAT-006: Model Deduplication & Normalization Engine

| Field | Value |
|---|---|
| **Feature ID** | `FEAT-006` |
| **Domain** | Model Management |
| **Status** | Implemented & Verified |
| **Requirements** | [FR-003](../../../requirements/FR-003-deduplication.md) |
| **Rust Component** | [`src-tauri/src/commands/models.rs`](file:///d:/local-llm-hub/src-tauri/src/commands/models.rs) |
| **Frontend Component** | [`src/js/model.js`](file:///d:/local-llm-hub/src/js/model.js) |
| **Test Suite** | [`tests/test_dedup.rs`](file:///d:/local-llm-hub/src-tauri/tests/test_dedup.rs) |

---

## 1. Overview

FEAT-006 จัดการปัญหาการมีโมเดลซ้ำซ้อนกันในหลาย backend (เช่น ติดตั้ง Llama-3-8B ทั้งใน Ollama และมีไฟล์ GGUF ในโฟลเดอร์) โดยบังคับใช้กฎทางธุรกิจ:
1. **BR-001 (Priority Ranking)**: กำหนดลำดับความสำคัญของ Backend: `Ollama > GGUF > vLLM > HuggingFace`
2. **BR-002 (Name Normalization)**: ปรับชื่อโมเดลให้อยู่ในรูป Canonical Base Name โดยตัด tags เช่น `:latest`, `:q4_k_m`, `-instruct`, `-gguf` ออกเพื่อนำมาจับคู่
3. **Duplicate Badge**: ทำเครื่องหมาย `is_duplicate = true` ให้กับรายการที่เป็นตัวซ้ำ เพื่อให้ UI ซ่อนหรือแสดง badge เตือนผู้ใช้ได้ถูกต้อง

---

## 2. Technical Contracts & Implementation

```rust
pub fn normalize_model_name(raw_name: &str) -> String;
pub fn dedup_models(models: Vec<UnifiedModel>) -> Vec<UnifiedModel>;
```

### 2.1 Normalization Logic
- ตัวพิมพ์เล็กทั้งหมด (`to_lowercase()`)
- ตัด prefix ของผู้พัฒนา เช่น `meta-llama/`
- ตัด quantization suffix เช่น `-q4_0`, `-q4_k_m`, `:8b-instruct`
- จับกลุ่มเข้าสู่ `duplicate_group` เดียวกัน
