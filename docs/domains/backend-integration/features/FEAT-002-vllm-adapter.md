# FEAT-002: vLLM & OpenAI-Compatible Backend Adapter

| Field | Value |
|---|---|
| **Feature ID** | `FEAT-002` |
| **Domain** | Backend Integration |
| **Status** | Implemented & Verified |
| **Requirements** | [FR-001](../../../requirements/FR-001-backend-probe.md), [FR-005](../../../requirements/FR-005-model-control.md) |
| **Rust Component** | [`src-tauri/src/commands/backends.rs`](file:///d:/local-llm-hub/src-tauri/src/commands/backends.rs) |
| **Test Suite** | [`tests/test_backend_probe.rs`](file:///d:/local-llm-hub/src-tauri/tests/test_backend_probe.rs) |

---

## 1. Overview

FEAT-002 ให้บริการเชื่อมต่อกับ vLLM หรือเซิร์ฟเวอร์ใดๆ ที่รองรับมาตรฐาน OpenAI API (`http://localhost:8000/v1`) โดยทำหน้าที่:
1. Probe ตรวจสอบสถานะการเชื่อมต่อ endpoint `/v1/models`
2. ดึงรายการ active model cards ที่กำลังรันอยู่บน vLLM instance
3. สื่อสารผ่าน standard Bearer Token หรือ No-Auth header ตาม configuration

---

## 2. Technical Contracts & IPC Interface

### 2.1 Backend Probe Protocol
- Probe ไปยัง `http://localhost:8000/v1/models`
- Response parsing รองรับ JSON schema:
```json
{
  "object": "list",
  "data": [
    {
      "id": "meta-llama/Llama-3-8B-Instruct",
      "object": "model",
      "created": 1713430000,
      "owned_by": "vllm"
    }
  ]
}
```

### 2.2 Error Handling & Resilience
- หาก vLLM เซิร์ฟเวอร์ปิดอยู่ จะคืนสถานะ `Offline` ภายในเวลาไม่เกิน 2,500ms
- รองรับ Dynamic Port Binding หากเซิร์ฟเวอร์รันอยู่บนพอร์ตที่ไม่ใช่ 8000
