# FEAT-013: Multi-Model Side-by-Side Arena

| Field | Value |
|---|---|
| **Feature ID** | `FEAT-013` |
| **Domain** | Model Management & Evaluation |
| **Status** | Implemented & Verified |
| **Requirements** | [FR-011](../../../requirements/FR-011-model-arena.md) |
| **Frontend Component** | [`src/js/arena.js`](file:///d:/local-llm-hub/src/js/arena.js), [`src/index.html`](file:///d:/local-llm-hub/src/index.html) (`view-arena`) |
| **Rust Backend Component** | [`src-tauri/src/commands/chat.rs`](file:///d:/local-llm-hub/src-tauri/src/commands/chat.rs) |

---

## 1. Overview

FEAT-013 ให้บริการหน้าจอทดสอบเปรียบเทียบคำตอบของโมเดล 2 ตัวพร้อมกัน (Side-by-Side Comparison):
1. ผู้ใช้เลือกโมเดลฝั่งซ้าย (Model A) และฝั่งขวา (Model B)
2. ป้อน Prompt เดียวกัน แล้วกด Send
3. ระบบจะยิงคำขอไปยังโมเดลทั้งสองพร้อมกัน (Concurrent Execution)
4. แสดงผลลัพธ์คำตอบแบบ Real-time พร้อมจับเวลา Time-to-First-Token (TTFT), Throughput (tokens/second), และระยะเวลาการประมวลผลทั้งหมด (Total Latency)
5. ผู้ใช้สามารถให้คะแนน (Vote A, Vote B, Tie) เพื่อบันทึกสถิติลง local analytics
