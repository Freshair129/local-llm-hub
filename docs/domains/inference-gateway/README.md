# Domain: Inference Gateway

| Field | Value |
|-------|-------|
| **Domain ID** | inference-gateway |
| **Version** | 1.0.0 |
| **Status** | Draft |
| **Owner** | Boss |
| **Created** | 2026-09-28 |

---

## Charter

Domain นี้รับผิดชอบ **การ route inference request ไปยัง backend ที่ถูกต้อง** ผ่าน LiteLLM proxy และให้ Chat interface สำหรับทดสอบโมเดลโดยตรง

LiteLLM proxy ทำหน้าที่เป็น **unified OpenAI-compatible endpoint** ที่ app ภายนอกก็ใช้ได้

---

## Owned Features

| Feature ID | Name | Status | Cross-domain? |
|------------|------|--------|---------------|
| [FEAT-008](features/FEAT-008-litellm-proxy-manager.md) | LiteLLM Proxy Manager & Unified Endpoint | Active | ✅ depends on backend-integration, model-management |
| [FEAT-009](features/FEAT-009-streaming-chat-playground.md) | Interactive Streaming Chat Playground | Active | ✅ depends on FEAT-008 |
| [FEAT-016](features/FEAT-016-prompt-presets-manager.md) | System Prompt & Inference Preset Manager | Active | ❌ |

## Discovered Cross-Domain Features

| Feature ID | Name | บทบาทของเรา |
|------------|------|-------------|
| CROSS-FEAT-001 | Unified Model Dashboard | ให้ผู้ใช้เลือกโมเดลแล้ว route ผ่าน proxy |

---

## Owned Requirements

| ID | Title | Priority | Status |
|----|-------|----------|--------|
| [FR-007](../../requirements/FR-007-chat-interface.md) | Chat / Test Interface | P1 | Draft |
| [FR-008](../../requirements/FR-008-litellm-proxy.md) | LiteLLM Proxy Management | P0 | Draft |

## Referenced Requirements (owned by others)

| ID | Title | Domain เจ้าของ |
|----|-------|----------------|
| [FR-002](../../requirements/FR-002-model-aggregation.md) | Model Aggregation | model-management |

---

## Boundaries

```
IN SCOPE:
  - Spawn / stop LiteLLM Python sidecar
  - Generate LiteLLM config.yaml จาก detected backends
  - Auto-restart sidecar เมื่อ crash
  - Chat UI + SSE streaming consumer
  - Copy endpoint URL ไปยัง clipboard

OUT OF SCOPE:
  - GPU monitoring
  - Model card display
  - Backend probe (นั่นคือ backend-integration)
```

---

## LiteLLM Config Generation

ดูรายละเอียดใน [C-ai-system.md §C.3](../../appendices/C-ai-system.md)

Config ถูก generate อัตโนมัติจาก `UnifiedModel[]` ที่ model-management produce

```yaml
# ตัวอย่าง generated config
model_list:
  - model_name: llama3.2:3b
    litellm_params:
      model: ollama/llama3.2:3b
      api_base: http://localhost:11434
```
