# PACKET: PKT-FR003-SERVICE

| Metadata | Value |
|---|---|
| **Packet ID** | PKT-FR003-SERVICE |
| **Requirement** | [FR-003: Duplicate Detection](../requirements/FR-003-deduplication.md) |
| **Domain** | model-management |
| **Layer** | service |
| **Target Component (CMP)** | `src-tauri/src/commands/models.rs::dedup_models` |
| **Assigned Target TC** | `TC-FEAT-006-INTEG` |
| **Token Ceiling** | 6,000 tokens |
| **Status** | COMPLETED (PASSED) |

---

### 1. Statement

พัฒนาฟังก์ชันบริสุทธิ์ (Pure function) `dedup_models(models: Vec<UnifiedModel>) -> Vec<UnifiedModel>` ใน Rust เพื่อจัดกลุ่มโมเดลที่มี canonical name เหมือนกัน และกำหนด preferred backend ตามลำดับความสำคัญทางธุรกิจ

---

### 2. Acceptance Criteria (AC)

- **AC-1**: หากพบโมเดลมากกว่า 1 ตัวที่มี `canonical_name` เดียวกัน (ข้ามต่าง backend) ให้ตั้งค่า `is_duplicate = true` ให้กับทุกตัวในกลุ่มนั้น
- **AC-2**: สำหรับแต่ละกลุ่ม duplicate ให้เลือก preferred backend 1 ตัวตาม Priority Matrix (BR-001):
  `Ollama` (อันดับ 1) > `vLLM` (อันดับ 2) > `GGUF` (อันดับ 3) > `HuggingFace` (อันดับ 4)
- **AC-3**: ตัวที่ได้รับเลือกเป็น preferred ให้ตั้งค่า `is_preferred = true` ส่วนตัวอื่นในกลุ่มเดียวกันให้เป็น `false`
- **AC-4**: โมเดลที่ไม่ซ้ำกับใครเลย (`canonical_name` ปรากฏเพียงครั้งเดียว) ต้องคงค่า `is_duplicate = false` และ `is_preferred = false`
- **AC-5**: ทุกตัวในกลุ่มเดียวกันต้องได้รับ `duplicate_group = Some("group_<canonical_name>")` เหมือนกัน

---

### 3. Relevant SDD Section

> **From SDD §10 Data Models & §6 Business Rules**:
> โมเดลจากแต่ละ backend จะผ่านการแปลงเป็น `UnifiedModel` และทำ name normalization แล้ว หน้าที่ของ Deduplication Engine คือการจับคู่ entry ที่มี `canonical_name` เหมือนกันแต่ `backend` ต่างกัน เพื่อไม่ให้ผู้ใช้งานเห็นรายการซ้ำซ้อนโดยไม่จำเป็น

---

### 4. API / EVT Specification

```rust
// In src-tauri/src/commands/models.rs
use crate::models::types::UnifiedModel;

// trace:implements FR-003
pub fn dedup_models(models: Vec<UnifiedModel>) -> Vec<UnifiedModel> {
    // Implementation
}
```

---

### 5. Business Rules (BR) & Security (SEC)

- **BR-001 (Priority Matrix)**:
  - Ollama ได้ priority สูงสุดเนื่องจากจัดการ VRAM unloading อัตโนมัติได้ดีที่สุดสำหรับ desktop local
  - vLLM เป็นอันดับ 2 สำหรับ high throughput
  - GGUF/llama.cpp เป็นอันดับ 3
  - HuggingFace เป็นอันดับสุดท้าย (latency สูงสุด)
- **SEC-001**: ฟังก์ชันนี้ต้องทำงาน in-memory 100% ห้ามยิง network หรือแตะ filesystem

---

### 6. Guard Rails

- **ADR-100**:
  - ฟังก์ชันต้องเป็น deterministic ไม่มี side-effects
  - ห้ามใช้ `panic!` หรือ `unwrap()` ที่เสี่ยง crash
  - อนุญาตให้แก้เฉพาะไฟล์ `src-tauri/src/commands/models.rs` เท่านั้น ห้ามแตะไฟล์อื่น
- **ARCH-001 §4**:
  - Service layer (Layer 2) เรียกใช้งานได้เฉพาะ Layer 1 (Data Types) ห้ามเรียก Layer 3 (Tauri IPC) หรือ Layer 4 (UI)

---

### 7. Current CMP Code

```rust
// File: src-tauri/src/commands/models.rs (Initial Skeleton)
use crate::models::types::UnifiedModel;

// trace:implements FR-003
pub fn dedup_models(models: Vec<UnifiedModel>) -> Vec<UnifiedModel> {
    // TODO: Coder implement here based on AC-1 to AC-5
    models
}

#[cfg(test)]
mod tests {
    use super::*;
    // Unit tests will be provided by Tester agent
}
```

---

### 8. Target Test Case (TC)

- **Feature Integration Test**: `TC-FEAT-006-INTEG`
- **Unit Test File**: `src-tauri/src/commands/models.rs::tests::test_dedup_priority_matrix`
- **Verification Command**: `cargo test test_dedup`
