# FEAT-005: Multi-Source Model Aggregator

| Field | Value |
|---|---|
| **Feature ID** | `FEAT-005` |
| **Domain** | Model Management |
| **Status** | Implemented & Verified |
| **Requirements** | [FR-002](../../../requirements/FR-002-model-aggregation.md) |
| **Rust Component** | [`src-tauri/src/commands/models.rs`](file:///d:/local-llm-hub/src-tauri/src/commands/models.rs) |
| **Frontend Component** | [`src/js/model.js`](file:///d:/local-llm-hub/src/js/model.js) |
| **Test Suite** | [`tests/test_model_aggregation.rs`](file:///d:/local-llm-hub/src-tauri/tests/test_model_aggregation.rs) |

---

## 1. Overview

FEAT-005 ทำหน้าที่รวบรวมรายการโมเดลจากหลายแหล่งพร้อมกัน (Multi-Source Aggregation) ทั้งจาก:
- **Ollama**: ผ่าน `/api/tags`
- **vLLM**: ผ่าน `/v1/models`
- **Local GGUF Directories**: ผ่านการสแกน filesystem
- **HuggingFace Local Snapshot Caches**

และแปลงเป็นโครงสร้างข้อมูลมาตรฐานเดียวกันคือ `UnifiedModel` เพื่อส่งต่อให้ UI แสดงผลใน Bento Dashboard

---

## 2. Data Structure (`UnifiedModel`)

```rust
pub struct UnifiedModel {
    pub id: String,
    pub name: String,
    pub backend: String,
    pub size_bytes: u64,
    pub quantization: Option<String>,
    pub parameter_size: Option<String>,
    pub is_duplicate: bool,
    pub duplicate_group: Option<String>,
    pub status: String,
}
```

---

## 3. Parallel Execution & Resilience
- ใช้ `tokio::join!` ในการยิง request ไปยังทุก backend พร้อมกัน เพื่อให้ latency ต่ำที่สุด
- หาก backend ใด backend หนึ่ง offline จะไม่ทำให้การรวบรวมของ backend อื่นล้มเหลว
