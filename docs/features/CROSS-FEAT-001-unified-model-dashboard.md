# CROSS-FEAT-001 — Unified Model Dashboard

| Field | Value |
|-------|-------|
| **ID** | CROSS-FEAT-001 |
| **Type** | Cross-Domain Feature |
| **Status** | Draft |
| **Owner** | model-management (orchestrator) |
| **Created** | 2026-09-28 |

---

## Feature Overview

Unified Model Dashboard คือ feature หลักที่ผู้ใช้เห็นเป็นอย่างแรก — **รายการโมเดลทั้งหมดจากทุก backend ในที่เดียว** พร้อม dedup status, backend badge, start/stop control

Feature นี้ **ค้นพบได้จากสอง domain** แต่เนื้อหามีแหล่งเดียว (ไฟล์นี้):

```
Domain: backend-integration ──ค้นพบ──┐
                                     ├── CROSS-FEAT-001: Unified Model Dashboard
Domain: model-management ────ค้นพบ──┘
                                           │
                                    ┌──────┴──────┐
                                    │             │
                             FR-001, FR-005    FR-002, FR-003
                             FR-009            FR-004
                          (owned by           (owned by
                          backend-integ.)     model-mgmt.)
```

---

## Parts & Domain Ownership

### Part A — Data Collection (backend-integration)

**บทบาท:** ดึงข้อมูลดิบจากทุก backend

| Requirement | Description |
|-------------|-------------|
| [FR-001](../requirements/FR-001-backend-probe.md) | Probe backends → รู้ว่า online/offline |
| [FR-009](../requirements/FR-009-gguf-scanner.md) | Scan GGUF files → รายการ .gguf |
| [FR-005](../requirements/FR-005-model-control.md) | Start/Stop commands → ส่งไปยัง backend |

**Output:** `RawModel[]` — raw model data จากแต่ละ backend

---

### Part B — Data Processing (model-management)

**บทบาท:** แปลงข้อมูลดิบเป็น unified view พร้อม dedup

| Requirement | Description |
|-------------|-------------|
| [FR-002](../requirements/FR-002-model-aggregation.md) | Aggregate + normalize → canonical names |
| [FR-003](../requirements/FR-003-deduplication.md) | Detect duplicates → mark preferred |
| [FR-004](../requirements/FR-004-model-card.md) | Fetch model card → ข้อมูลเพิ่มเติม |

**Output:** `UnifiedModel[]` — unified list พร้อม dedup metadata

---

## Data Flow (End-to-End)

```
User opens app
     │
     ▼
[FR-001] probe_backends()
     │  online: ollama, gguf
     │  offline: vllm
     │
     ▼
[FR-009] scan_gguf(paths)     ← parallel กับ probe
     │  found: llama3.2-3b.gguf
     │
     ▼
Backend adapters fetch model lists:
     │  ollama → [llama3.2:3b, mistral:7b]
     │  gguf   → [Meta-Llama-3.2-3B-Instruct.Q4_K_M.gguf]
     │
     ▼
[FR-002] normalize_model_name() × each model
     │  "llama3.2:3b"                      → "llama3.2 3b"  (ollama)
     │  "Meta-Llama-3.2-3B-Instruct.Q4_K_M.gguf" → "meta llama 3.2 3b instruct" (gguf)
     │  "mistral:7b"                        → "mistral 7b"  (ollama)
     │
     ▼
[FR-003] dedup_models()
     │  "llama3.2 3b" found in 2 backends → DUPLICATE
     │  preferred: ollama (priority > gguf)
     │
     ▼
UnifiedModel[] sent to UI:
     ├── llama3.2 3b  [ollama] ⭐ preferred    ⚠️ duplicate
     ├── llama3.2 3b  [gguf]                  ⚠️ duplicate
     └── mistral 7b   [ollama]
```

---

## Query Examples (ย้อนกลับได้)

```
Q: "CROSS-FEAT-001 ประกอบด้วย symbols อะไรบ้าง?"
A: via FR-001 → probe_backends
   via FR-002 → aggregate_models, normalize_model_name
   via FR-003 → dedup_models
   via FR-005 → start_model, stop_model
   via FR-009 → scan_gguf, read_gguf_header

Q: "Domain backend-integration ค้นพบ cross-domain features อะไร?"
A: CROSS-FEAT-001 (owns Part A: FR-001, FR-005, FR-009)

Q: "Domain model-management รับผิดชอบ Part อะไรใน CROSS-FEAT-001?"
A: Part B: FR-002, FR-003, FR-004
```

---

## Acceptance Criteria (Cross-Domain)

| Criterion | Domain | Requirement |
|-----------|--------|------------|
| Backend status แสดงถูกต้อง | backend-integration | AC-001 (FR-001) |
| Model list รวมจากทุก online backend | model-management | FR-002 AC-1 |
| Duplicate badge แสดงบนโมเดลที่ซ้ำ | model-management | AC-002 (FR-003) |
| Start/Stop ทำงานได้ | backend-integration | FR-005 AC-1,2,3 |
| Model card เปิดได้เมื่อคลิก | model-management | AC-003 (FR-004) |
