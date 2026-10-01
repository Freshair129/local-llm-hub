# Documentation Structure — Local LLM Hub

| Field | Value |
|-------|-------|
| **Version** | 2.0.0 |
| **Status** | Active |
| **Author** | Boss |
| **Supersedes** | PRD-SDD-v1.0.md (ยังคงอยู่เป็น reference) |

---

## หลักการจัดโครงสร้าง

เอกสารแบ่งตาม **Domain → Feature → Requirement** โดยมีกติกาดังนี้:

1. **Feature** คือหน่วยงานที่ผู้ใช้สัมผัสได้ — มีเจ้าของ Domain แต่อาจ _ค้นพบได้_ จากหลาย Domain
2. **Requirement** เก็บแยกในโฟลเดอร์กลาง `requirements/` ระบุ ID พร้อม Domain owner
3. **Cross-domain feature** — เนื้อหามีแหล่งเดียว ไม่คัดลอก Domain อื่นอ่านผ่าน link
4. **Traceability** — ทุก FR มี chain: `Requirement ↔ Code Symbol ↔ Test`

---

## Directory Layout

```
docs/
│
├── STRUCTURE.md                    ← ไฟล์นี้
│
├── domains/                        ← Domain-level overview docs
│   ├── backend-integration/
│   │   ├── README.md               ← Domain charter, owned features
│   │   └── features/               ← Feature-specific parts owned by this domain
│   │       ├── FEAT-001-ollama-adapter.md
│   │       ├── FEAT-002-vllm-adapter.md
│   │       ├── FEAT-003-hf-adapter.md
│   │       ├── FEAT-004-gguf-scanner.md
│   │       └── FEAT-019-hf-cache-junction-offload.md
│   │
│   ├── model-management/
│   │   ├── README.md
│   │   └── features/
│   │       ├── FEAT-005-model-aggregation.md
│   │       ├── FEAT-006-deduplication.md       ← cross-domain: also refs backend-integration
│   │       └── FEAT-007-model-card-reader.md
│   │
│   ├── inference-gateway/
│   │   ├── README.md
│   │   └── features/
│   │       ├── FEAT-008-litellm-proxy.md       ← cross-domain: refs backend-integration
│   │       └── FEAT-009-chat-interface.md
│   │
│   └── observability/
│       ├── README.md
│       ├── SPEC-002-hardware-telemetry-sensors.md
│       └── features/
│           ├── FEAT-010-gpu-monitor.md
│           ├── FEAT-011-ram-monitor.md
│           ├── FEAT-018-digital-twin.md
│           ├── FEAT-020-cpu-per-core-telemetry.md
│           ├── FEAT-021-gpu-afterburner-tuning.md
│           └── FEAT-022-hardware-surfaces-storage-motherboard.md
│   │
│   └── network-distribution/
│       ├── README.md
│       └── features/
│           └── FEAT-012-lan-share.md
│
├── features/                       ← Cross-domain feature registry (single source)
│   └── CROSS-FEAT-001-unified-model-dashboard.md
│
├── requirements/                   ← Flat requirement registry
│   ├── FR-001-backend-probe.md
│   ├── FR-002-model-aggregation.md
│   ├── FR-003-deduplication.md
│   ├── FR-004-model-card.md
│   ├── FR-005-model-control.md
│   ├── FR-006-gpu-monitor.md
│   ├── FR-007-chat-interface.md
│   ├── FR-008-litellm-proxy.md
│   ├── FR-009-gguf-scanner.md
│   ├── FR-010-lan-sharing.md
│   ├── FR-011-model-arena.md
│   ├── FR-012-model-downloader.md
│   ├── FR-013-prompt-presets.md
│   ├── FR-014-version-and-autoupdate.md
│   ├── FR-015-storage-symlink-offloader.md
│   ├── FR-016-3d-hardware-digital-twin.md
│   ├── FR-017-huggingface-cache-offload.md
│   ├── NFR-001-performance.md
│   └── NFR-002-reliability.md
│
├── benchmarks/                     ← LLM Benchmark harness & evaluations
│   └── SPEC-LLM-Benchmark-Harness.md
│
├── standards/                      ← Repo engineering standards
│   ├── STD-001-documentation-architecture.md
│   ├── STD-002-annotation-language.md
│   ├── STD-003-implementation-unit-and-packet.md
│   └── STD-004-batch-release-workflow.md
│
├── templates/                      ← Reusable documentation templates (SWE 5-Tier)
│   └── STRUCTURE-TEMPLATE.md
│
├── annotations/                    ← Annotation language spec + examples
│   └── ANN-001-annotation-language.md (STD-002 details)
│
├── GAP-ANALYSIS.md                 ← Master Engineering Gap Analysis (GAP-001)
├── ROADMAP.md                      ← Master Development Roadmap v2.0 (Phase 0 to 7)
├── ROADMAP-MVP.md                  ← Historical Roadmap to MVP Release
├── PLAN-001-implementation-plan.md ← Microtask breakdown implementation plan
├── IMPL-WORKFLOW-001-packet-system.md ← Implementation unit & packet workflow guide
├── reports/                        ← Audit and Gap Analysis Reports
│   ├── feature-verification-audit-report.md
│   └── feature-gap-analysis-refinement-report.md
├── packets/                        ← Active/completed implementation packets
│   └── PKT-FR003-SERVICE.md
├── lineage/                        ← Lineage ledger records per R6
│   └── packet-lineage.jsonl
│
├── tests/                          ← Test specification (traceability)
│   └── TEST-SPEC-001-traceability.md
│
├── appendices/                     ← Technical reference (unchanged)
│   ├── A-api-spec.md
│   ├── B-data-models.md
│   ├── C-ai-system.md
│   ├── D-traceability.md
│   ├── E-risk-matrix.md
│   └── F-glossary.md
│
├── ai-system/                      ← Multi-Agent intelligence & model routing
│   └── MULTI_AGENT_WORKFLOW_SPEC.md ← SPEC-WORKFLOW-001 (Multi-Agent Routing Pipeline)
│
├── adr/
│   ├── ARCHITECTURE.md             ← Includes ADR-001..006, ADR-100, ARCH-001 §4
│   ├── ADR-007-push-telemetry-events.md
│   ├── ADR-008-typed-ipc-contracts.md
│   └── ADR-009-feature-gap-remediation-and-p2-roadmap.md
│
└── .doc-graph.json                 ← Auto-maintained relationship graph
```

---

## Naming Convention

| Pattern | Format | Example |
|---------|--------|---------|
| Engineering Standard | `STD-{NNN}-{slug}.md` | `STD-003-implementation-unit-and-packet.md` |
| Functional Requirement | `FR-{NNN}-{slug}.md` | `FR-003-deduplication.md` |
| Non-Functional Requirement | `NFR-{NNN}-{slug}.md` | `NFR-001-performance.md` |
| Feature (owned by domain) | `FEAT-{NNN}-{slug}.md` | `FEAT-006-deduplication.md` |
| Cross-domain Feature | `CROSS-FEAT-{NNN}-{slug}.md` | `CROSS-FEAT-001-unified-model-dashboard.md` |
| Annotation Spec | `ANN-{NNN}-{slug}.md` | `ANN-001-annotation-language.md` |
| Test Spec | `TEST-SPEC-{NNN}-{slug}.md` | `TEST-SPEC-001-traceability.md` |
| Architecture Decision | `ADR-{NNN}-{slug}.md` | `ADR-001-tauri-choice.md` |

---

## Requirement Metadata (YAML Frontmatter)

ทุกไฟล์ requirement ต้องมี frontmatter:

```yaml
---
id: FR-003
title: Duplicate Detection
domain: model-management
owner: Boss
status: draft          # draft | approved | implemented | deprecated
priority: P0           # P0=must | P1=should | P2=nice-to-have
features:
  - FEAT-006           # features ที่ implement requirement นี้
cross_domains:
  - backend-integration  # domains อื่นที่เกี่ยวข้อง
implements_test:
  - TEST-003           # test ที่ verify requirement นี้
---
```

---

## Traceability Chain

```
FR-NNN (requirement doc)
   │
   ├── implements ──► Code Symbol (src-tauri/src/commands/models.rs::dedup_models)
   │                   annotated: // trace:implements FR-003
   │
   └── verified_by ──► Test (tests/dedup_test.rs::test_dedup_llama3)
                        annotated: // trace:verifies FR-003
```

Query ได้ว่า: **"FR-003 implement ที่ไหน? test อะไรครอบคลุม?"**

---

## Cross-Domain Feature Pattern

Feature เดียว ค้นพบได้จากหลาย Domain — **เนื้อหามีแหล่งเดียว**:

```
Domain: backend-integration ──ค้นพบ──┐
                                     ├── CROSS-FEAT-001: Unified Model Dashboard
Domain: model-management ────ค้นพบ──┘
                                           │
                                    features/CROSS-FEAT-001.md  ← เนื้อหาจริงอยู่ที่นี่
                                           │
                              ┌────────────┴────────────┐
                              │                         │
                        FR ที่ owned by            FR ที่ owned by
                        backend-integration        model-management
```

Domain แต่ละตัวมี `features/FEAT-XXX.md` ที่บอก "Part ของเราใน cross-domain feature นี้คืออะไร"
แต่ไม่คัดลอก requirement ไปไว้ใน domain ตัวเอง — link ไปหา `requirements/FR-NNN.md` แทน

---

## Annotation Language (สรุป — ดูฉบับเต็มใน annotations/ANN-001)

```typescript
// trace:implements FR-003
// trace:depends-on FR-002
export function dedupModels(models: UnifiedModel[]): UnifiedModel[] { ... }
```

```rust
// trace:implements FR-003
pub fn dedup_models(models: Vec<RawModel>) -> Vec<UnifiedModel> { ... }
```

```typescript
// trace:verifies FR-003
test('detects duplicate llama3.2 across ollama and gguf', () => { ... });
```

กติกา:
- `trace:` comment ต้องอยู่ **ทันทีก่อน** function/test declaration
- ต้อง resolve ได้เป็น ID ใน `requirements/`
- ถ้า ID ไม่มีใน registry → P1 error (reject, ไม่ใช่ silent ignore)

---

## Verification & Quality Tooling (เครื่องมือตรวจสอบคุณภาพ)

| คำสั่ง | วัตถุประสงค์ | มาตรฐานที่กำกับ |
|---|---|---|
| `npm run packet -- status` | ตรวจสอบคิว Implementation Packet ทั้ง 40 หน่วย | STD-003 (R1-R6) |
| `npm run packet -- --verify <ID>` | ตรวจสอบ Definition of Done (DoD) ของแต่ละ Packet | STD-003 (R4) |
| `cargo test` | รันชุดทดสอบ Backend ทั้งหมด 44 Tests (Unit & Integration) | ADR-100 (Zero Panic) |
| `node scripts/run_multi_agent_pipeline.mjs` | สั่งการ Multi-Agent Pipeline 5 ระดับบนโมเดลท้องถิ่น | SPEC-WORKFLOW-001 |
| `npm run tauri dev` | รันแอปพลิเคชัน GUI Desktop ในโหมด Development | PRJ-003 |
| `npm run tauri build -- --no-bundle` | คอมไพล์ Standalone Release Executable (`tauri-app.exe`) | Release Candidate |

---

## Lineage Ledger & Audit Trail (ประวัติการส่งมอบงาน)

ทุกความเปลี่ยนแปลงระดับ Service, Contract, และ Route ต้องผ่าน Gate และบันทึกประวัติ immutable ลงใน:
- **Ledger Path:** [`docs/lineage/packet-lineage.jsonl`](lineage/packet-lineage.jsonl)
- **ฟิลด์บังคับตามกฎ R6:** `packet_id`, `fr_id`, `layer`, `cmp`, `model`, `timestamp`, `test_result`, `git_commit`, `reviewed_by`

---

## Implementation Summary (สถานะภาพรวม Waves 0–5)

| Wave | Scope | Functional Requirements | สถานะ | Test Coverage |
|:---:|---|---|:---:|:---:|
| **Wave 0** | Core Foundation & System State | `PRJ-001`, `PRJ-002`, `PRJ-003` | ✅ COMPLETED | 100% |
| **Wave 1** | Discovery & Aggregation | `FR-001` (Backend Probe), `FR-002` (Model Normalizer) | ✅ COMPLETED | 100% |
| **Wave 2** | Intelligence & Scanning | `FR-003` (Dedup), `FR-009` (GGUF Scan), `FR-004` (ModelCard) | ✅ COMPLETED | 100% |
| **Wave 3** | Observability & Control | `FR-006` (GPU/RAM Monitor), `FR-005` (Model Start/Stop) | ✅ COMPLETED | 100% |
| **Wave 4** | Gateway, Chat & LAN Sharing | `FR-008` (LiteLLM Proxy), `FR-007` (Chat), `FR-010` (LAN Share) | ✅ COMPLETED | 100% |
| **Wave 5** | MVP Integration & Hardening | `TC-MVP-E2E` (Full Suite Integration Gate) | ✅ COMPLETED | 44/44 Green |

