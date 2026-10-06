# Domain: Model Management

| Field | Value |
|-------|-------|
| **Domain ID** | model-management |
| **Version** | 1.0.0 |
| **Status** | Draft |
| **Owner** | Boss |
| **Created** | 2026-09-28 |

---

## Charter

Domain นี้รับผิดชอบ **การประมวลผลและจัดการข้อมูลโมเดล** หลังจากได้ raw model list จาก backend-integration — รวม normalize ชื่อ, dedup ข้าม backend, ดึง Model Card และ expose unified model list ไปยัง UI

---

## Owned Features

| Feature ID | Name | Status | Cross-domain? |
|------------|------|--------|---------------|
| [FEAT-005](features/FEAT-005-model-aggregation.md) | Multi-Source Model Aggregator | Active | ✅ depends on backend-integration |
| [FEAT-006](features/FEAT-006-deduplication-engine.md) | Deduplication & Normalization Engine | Active | ✅ depends on backend-integration |
| [FEAT-007](features/FEAT-007-model-card-reader.md) | Model Card Reader & Metadata Parser | Active | ❌ |
| [FEAT-013](features/FEAT-013-multi-model-arena.md) | Multi-Model Side-by-Side Arena | Active | ✅ depends on inference-gateway |
| [FEAT-014](features/FEAT-014-token-roi-cost-calculator.md) | Token ROI & Cost Savings Calculator | Active | ❌ |
| [FEAT-GPU-MODEL-ADVISOR](../../features/FEAT-GPU-MODEL-ADVISOR.md) | VRAM Model Advisor & GPU Benchmark Comparison | Approved / Implemented | ✅ depends on observability |

## Discovered Cross-Domain Features

| Feature ID | Name | บทบาทของเรา |
|------------|------|-------------|
| CROSS-FEAT-001 | Unified Model Dashboard | เป็น **orchestrator** — aggregate + dedup + expose to UI |

---

## Owned Requirements

| ID | Title | Priority | Status |
|----|-------|----------|--------|
| [FR-002](../../requirements/FR-002-model-aggregation.md) | Model Aggregation | P0 | Draft |
| [FR-003](../../requirements/FR-003-deduplication.md) | Duplicate Detection | P0 | Draft |
| [FR-004](../../requirements/FR-004-model-card.md) | Model Card Display | P1 | Draft |
| [FR-024](../../requirements/FR-024-model-vram-advisor.md) | VRAM Model Advisor & GPU Benchmark Comparison | P1 | Implemented |

## Referenced Requirements (owned by others)

| ID | Title | Domain เจ้าของ |
|----|-------|----------------|
| [FR-001](../../requirements/FR-001-backend-probe.md) | Backend Probe | backend-integration |
| [FR-009](../../requirements/FR-009-gguf-scanner.md) | GGUF Scanner | backend-integration |

---

## Boundaries

```
IN SCOPE:
  - Normalize และ canonicalize model names
  - Deduplication logic + priority ranking
  - Fetch model card จาก HuggingFace API หรือ local README
  - Parse YAML frontmatter จาก model card
  - Produce UnifiedModel[] ที่ UI consume

OUT OF SCOPE:
  - HTTP communication กับ backend (นั่นคือ backend-integration)
  - Rendering UI ของ model card
  - Inference / chat
```

---

## Key Data Consumed & Produced

```
CONSUMES:  RawModel[]           (จาก backend-integration)
PRODUCES:  UnifiedModel[]       (ไปยัง UI + inference-gateway)
           ModelCard            (ไปยัง UI)
```

### Business Rule: Backend Priority

เมื่อ dedup พบโมเดลซ้ำ ให้ prefer: **Ollama → vLLM → GGUF → HF**

ดูรายละเอียดใน [FR-003](../../requirements/FR-003-deduplication.md) และ [C-ai-system.md §C.2](../../appendices/C-ai-system.md)
