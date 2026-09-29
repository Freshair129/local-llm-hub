---
id: FR-008
title: LiteLLM Proxy Management
domain: inference-gateway
owner: Boss
status: draft
priority: P0
features:
  - FEAT-008
cross_domains:
  - backend-integration
  - model-management
implements_test:
  - TEST-008
---

# FR-008 — LiteLLM Proxy Management

## Statement

ระบบต้องสามารถ spawn และ manage LiteLLM Python sidecar เป็น unified OpenAI-compatible proxy โดยอัตโนมัติ generate config จาก detected backends

## Acceptance Criteria

1. **WHEN** user toggle LiteLLM ON **THEN** system SHALL ตรวจสอบว่า Python และ litellm installed ก่อน spawn
2. **IF** Python ไม่พบ **THEN** system SHALL แสดง setup dialog พร้อม installation instructions — ไม่ spawn
3. **WHEN** spawn สำเร็จ **THEN** system SHALL poll `GET /health` ทุก 500ms และ mark "Running" เมื่อ health check pass
4. **WHEN** LiteLLM running **THEN** system SHALL แสดง endpoint URL (`http://localhost:{port}`) พร้อม copy button ใน sidebar
5. **WHEN** backend config เปลี่ยน (เช่น Ollama URL เปลี่ยน) **THEN** system SHALL regenerate config.yaml และ restart sidecar
6. **WHEN** sidecar crash **THEN** system SHALL auto-restart ไม่เกิน 3 ครั้ง แล้วแสดง error ถ้าล้มเหลวทุกครั้ง
7. **WHEN** app ปิด **THEN** system SHALL terminate sidecar process (ไม่ให้เป็น orphan)
8. **WHEN** user toggle LiteLLM OFF **THEN** system SHALL graceful shutdown สาย

## Config Generation Rules (BR-003)

| Backend | LiteLLM model prefix | Example |
|---------|---------------------|---------|
| Ollama | `ollama/{model}` | `ollama/llama3.2:3b` |
| vLLM | `openai/{model}` + custom base_url | `openai/llama-3.1-8b` |
| HF TGI | `openai/{model}` + custom base_url | `openai/mistral-7b` |
| GGUF (via llama-server) | `openai/{model}` + localhost base_url | `openai/llama3.2-3b-gguf` |

## Port Conflict

**WHEN** port 4000 occupied **THEN** system SHALL:
1. แสดง error "Port 4000 is in use"
2. แนะนำให้เปลี่ยนใน Settings
3. ไม่ force kill process อื่น

## Traceability

```
FR-008
  ├── implements ← src-tauri/src/commands/litellm.rs::start_litellm
  ├── implements ← src-tauri/src/commands/litellm.rs::stop_litellm
  ├── implements ← src-tauri/src/commands/litellm.rs::generate_litellm_config
  └── verified_by ← tests/litellm_test.rs::test_litellm_spawn_and_health
                  ← tests/litellm_test.rs::test_litellm_config_generation
                  ← tests/litellm_test.rs::test_litellm_auto_restart
                  ← tests/litellm_test.rs::test_litellm_shutdown_on_app_close
```
