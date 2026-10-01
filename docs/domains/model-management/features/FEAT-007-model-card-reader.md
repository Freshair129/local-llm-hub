# FEAT-007: Model Card Reader & Metadata Parser

| Field | Value |
|---|---|
| **Feature ID** | `FEAT-007` |
| **Domain** | Model Management |
| **Status** | Implemented & Verified |
| **Requirements** | [FR-004](../../../requirements/FR-004-model-card.md) |
| **Rust Component** | [`src-tauri/src/commands/modelcard.rs`](file:///d:/local-llm-hub/src-tauri/src/commands/modelcard.rs) |
| **Frontend Component** | [`src/js/model.js`](file:///d:/local-llm-hub/src/js/model.js) |
| **Test Suite** | [`tests/test_modelcard.rs`](file:///d:/local-llm-hub/src-tauri/tests/test_modelcard.rs) |

---

## 1. Overview

FEAT-007 ให้บริการดึงและแสดงผล Model Card สำหรับแต่ละโมเดล:
1. ตรวจสอบไฟล์ README / Model Card ในเครื่อง (Local `.md` file) ก่อน
2. หากไม่มี ให้ดึงข้อมูล Model Card จาก HuggingFace Hub API โดยอัตโนมัติ
3. แปลง YAML frontmatter (license, language, tags, context length) เพื่อนำมาแสดงใน UI Modal
4. หากเกิดข้อผิดพลาดในการดึงข้อมูล ให้ Fallback เป็น Synthetic Minimal Card ที่ประกอบด้วยสถิติขนาดไฟล์และ quantization แทนที่จะแจ้ง error

---

## 2. Technical Contracts & IPC Interface

```rust
#[tauri::command]
pub async fn read_model_card(model_id: String, local_path: Option<String>) -> Result<ModelCardData, String>
```
