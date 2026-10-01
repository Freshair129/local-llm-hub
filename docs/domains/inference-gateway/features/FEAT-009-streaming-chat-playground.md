# FEAT-009: Interactive Streaming Chat Playground

| Field | Value |
|---|---|
| **Feature ID** | `FEAT-009` |
| **Domain** | Inference Gateway |
| **Status** | Implemented & Verified |
| **Requirements** | [FR-007](../../../requirements/FR-007-chat-interface.md) |
| **Rust Component** | [`src-tauri/src/commands/chat.rs`](file:///d:/local-llm-hub/src-tauri/src/commands/chat.rs) |
| **Frontend Component** | [`src/js/chat.js`](file:///d:/local-llm-hub/src/js/chat.js), [`src/index.html`](file:///d:/local-llm-hub/src/index.html) (`view-chat`) |
| **Test Suite** | [`tests/test_chat.rs`](file:///d:/local-llm-hub/src-tauri/tests/test_chat.rs) |

---

## 1. Overview

FEAT-009 ให้บริการหน้าต่างสนทนาโต้ตอบ (Chat Playground) สำหรับทดสอบโมเดลโดยตรง:
1. **Multi-Backend Routing**: สื่อสารตรงไปยัง Ollama `/api/chat` หรือ vLLM `/v1/chat/completions` ตามประเภทของโมเดลที่เลือก
2. **Streaming Tokens**: รับส่งข้อความแบบ SSE (Server-Sent Events) streaming tokens แสดงผลคำตอบตัวอักษรต่อตัวอักษรบนหน้าจอแบบ real-time
3. **Execution Telemetry**: บันทึกสถิติ Latency, Time-to-First-Token (TTFT), และ Token Throughput อัตโนมัติหลังตอบเสร็จสิ้น
4. **Markdown & Code Highlighting**: เรนเดอร์ code syntax และ markdown tables ได้อย่างสวยงาม

---

## 2. Technical Contracts & IPC Interface

```rust
#[tauri::command]
pub async fn execute_chat(request: ChatRequest, state: State<'_, AppState>) -> Result<ChatResponse, String>
```
