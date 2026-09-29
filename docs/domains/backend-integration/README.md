# Domain: Backend Integration

| Field | Value |
|-------|-------|
| **Domain ID** | backend-integration |
| **Version** | 1.0.0 |
| **Status** | Draft |
| **Owner** | Boss |
| **Created** | 2026-09-28 |

---

## Charter

Domain นี้รับผิดชอบ **การสื่อสารกับ LLM backend ทุกตัว** — ตรวจสอบ online/offline, ดึงรายการโมเดล, สั่ง start/stop และส่ง inference request

Domain นี้ **ไม่รับผิดชอบ** logic หลังจากได้ข้อมูลโมเดลมาแล้ว (เช่น dedup, model card) — นั่นเป็นของ `model-management`

---

## Owned Features

| Feature ID | Name | Status | Cross-domain? |
|------------|------|--------|---------------|
| FEAT-001 | Ollama Adapter | Draft | ❌ |
| FEAT-002 | vLLM Adapter | Draft | ❌ |
| FEAT-003 | HuggingFace TGI Adapter | Draft | ❌ |
| FEAT-004 | GGUF File Scanner | Draft | ❌ |
| [FEAT-019](features/FEAT-019-hf-cache-junction-offload.md) | HuggingFace Cache Junction Offloader | Active | ❌ |

## Discovered Cross-Domain Features

Features ที่ domain นี้เกี่ยวข้องแต่ไม่ได้เป็นเจ้าของ:

| Feature ID | Name | Domain เจ้าของ | บทบาทของเรา |
|------------|------|----------------|-------------|
| CROSS-FEAT-001 | Unified Model Dashboard | model-management | ให้ข้อมูล raw model list จากแต่ละ backend |

---

## Owned Requirements

| ID | Title | Priority | Status |
|----|-------|----------|--------|
| [FR-001](../../requirements/FR-001-backend-probe.md) | Backend Probe | P0 | Draft |
| [FR-005](../../requirements/FR-005-model-control.md) | Model Start/Stop Control | P1 | Draft |
| [FR-009](../../requirements/FR-009-gguf-scanner.md) | GGUF File Scanner | P1 | Draft |
| [FR-017](../../requirements/FR-017-huggingface-cache-offload.md) | HuggingFace Cache Offload | P1 | Approved |

## Referenced Requirements (owned by others)

| ID | Title | Domain เจ้าของ |
|----|-------|----------------|
| [FR-002](../../requirements/FR-002-model-aggregation.md) | Model Aggregation | model-management |

---

## Boundaries

```
IN SCOPE:
  - HTTP probe ไปยัง backend URL
  - Parse response format ของแต่ละ backend (Ollama, vLLM, HF, llama.cpp)
  - Filesystem scan หา .gguf files
  - Send start/stop/unload commands ไปยัง backend

OUT OF SCOPE:
  - Deduplication logic
  - Model card fetch/render
  - GPU monitoring
  - Chat interface
  - LiteLLM proxy management
```

---

## Key Data Produced

```typescript
// Output ที่ domain นี้ produce และส่งต่อให้ model-management
interface RawModel {
  backend: 'ollama' | 'vllm' | 'hf' | 'gguf';
  raw_name: string;       // ชื่อดิบจาก backend
  size_bytes: number | null;
  local_path: string | null;  // สำหรับ gguf
  hf_repo_id: string | null;  // ถ้า backend รู้
  status: 'loaded' | 'available';
}
```
