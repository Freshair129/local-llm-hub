# FEAT-008: LiteLLM Proxy Manager & Unified Endpoint Generator

| Field | Value |
|---|---|
| **Feature ID** | `FEAT-008` |
| **Domain** | Inference Gateway |
| **Status** | Implemented & Verified |
| **Requirements** | [FR-008](../../../requirements/FR-008-litellm-proxy.md) |
| **Rust Component** | [`src-tauri/src/commands/proxy.rs`](file:///d:/local-llm-hub/src-tauri/src/commands/proxy.rs) |
| **Sidecar Script** | [`sidecar/litellm_proxy.py`](file:///d:/local-llm-hub/sidecar/litellm_proxy.py) |
| **Test Suite** | [`tests/test_proxy.rs`](file:///d:/local-llm-hub/src-tauri/tests/test_proxy.rs) |

---

## 1. Overview

FEAT-008 ทำหน้าที่สร้างและควบคุม LiteLLM Proxy ซึ่งเป็นเซิร์ฟเวอร์กลางที่แปลงโมเดล Local ทั้งหมดให้กลายเป็น OpenAI-compatible API endpoint บน `http://localhost:4000`:
1. **Dynamic Config Generation**: สร้างไฟล์ `config.yaml` อัตโนมัติ โดย map โมเดลจาก Ollama (`ollama/*`) และ vLLM (`vllm/*`)
2. **Process Management**: สั่ง Start / Stop และ Monitor สถานะของ Python sidecar process
3. **API Key Management**: บริหารจัดการ Virtual API Keys เพื่อควบคุมและบันทึกปริมาณการเรียกใช้งานของแต่ละแอปพลิเคชันภายนอก

---

## 2. Technical Contracts & IPC Interface

```rust
#[tauri::command]
pub async fn generate_litellm_config(state: State<'_, AppState>) -> Result<String, String>;

#[tauri::command]
pub async fn start_proxy(state: State<'_, AppState>) -> Result<String, String>;

#[tauri::command]
pub async fn stop_proxy(state: State<'_, AppState>) -> Result<String, String>;

#[tauri::command]
pub async fn get_proxy_status(state: State<'_, AppState>) -> Result<ProxyStatus, String>;
```
