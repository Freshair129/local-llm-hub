# Documentation Structure — {{PROJECT_NAME}}

| Field | Value |
|---|---|
| **Project** | {{PROJECT_NAME}} |
| **Version** | {{VERSION}} |
| **Status** | {{STATUS}} <!-- Draft | Active | Review | Released --> |
| **Author / Lead** | {{AUTHOR}} |
| **Target Architecture** | {{TECH_STACK}} <!-- e.g. Tauri v2 (Rust Backend) + Vanilla Modern ES Modules --> |
| **Traceability Standard** | ANN-001 (`// trace:implements`, `// trace:verifies`) |
| **Reliability Standard** | ADR-100 (Safe Error Handling, Zero Panics, `Result<T, E>`) |
| **Supersedes / Baseline**| {{BASELINE_DOCUMENT}} <!-- e.g. PRD-SDD-v1.0.md --> |

---

## 1. หลักการจัดโครงสร้าง (Architecture Principles)

เอกสารในโปรเจกต์นี้ยึดหลัก **SWE / RWANG Standard Architecture** แบ่งลำดับชั้นตาม:
**Domain → Feature → Requirement → Code Symbol → Test**

### กติกาหลัก 5 ข้อ:
1. **Domain (ขอบเขตงาน):** จัดกลุ่มตามความรับผิดชอบทางเทคนิคหรือธุรกิจ แต่ละ Domain มี `README.md` กำหนด Charter และ Boundaries ชัดเจน
2. **Feature (หน่วยงานที่ผู้ใช้สัมผัสได้):** เป็นชิ้นส่วนฟังก์ชันที่จับต้องได้ มีเจ้าของ Domain หลัก แต่อาจถูก _ค้นพบ (Discovered)_ จากหลาย Domain
3. **Requirement (Single Source of Truth):** เก็บรวมที่โฟลเดอร์กลาง `requirements/` (ระบุ ID เช่น `FR-001`, `NFR-001`) พร้อม Domain Owner ห้ามคัดลอกเนื้อหาซ้ำซ้อน
4. **Cross-domain Feature:** ถ้าฟีเจอร์คาบเกี่ยวหลายโดเมน ให้บันทึกไว้ใน `docs/features/CROSS-FEAT-XXX.md` เพียงที่เดียว แล้วให้ Domain ต่างๆ ทำลิงก์อ้างอิง
5. **Bidirectional Traceability:** ทุก Requirement ต้องมีสายสัมพันธ์ครบวงจร:
   `Requirement Document ↔ Code Symbol (Annotation) ↔ Integration/Unit Test`

---

## 2. Directory Layout (โครงสร้างไดเรกทอรีเอกสาร)

```
docs/
│
├── STRUCTURE.md                        ← ไฟล์แผนที่โครงสร้างเอกสารของโปรเจกต์
├── ROADMAP-MVP.md                      ← แผนการส่งมอบ Sprint และสถานะ DoD
├── TASKS.md                            ← เช็กลิสต์งานระดับ Microtask
│
├── domains/                            ← Domain-level overview docs
│   ├── {{DOMAIN_1_SLUG}}/
│   │   ├── README.md                   ← Domain Charter, Boundaries, Data Contract
│   │   └── features/                   ← Feature-specific specs ของโดเมนนี้
│   │       ├── FEAT-001-{{FEATURE_NAME}}.md
│   │       └── FEAT-002-{{FEATURE_NAME}}.md
│   │
│   ├── {{DOMAIN_2_SLUG}}/
│   │   ├── README.md
│   │   └── features/
│   │       └── FEAT-003-{{FEATURE_NAME}}.md
│   │
│   └── {{DOMAIN_3_SLUG}}/
│       ├── README.md
│       └── features/
│           └── FEAT-004-{{FEATURE_NAME}}.md
│
├── features/                           ← Cross-domain feature registry (single source)
│   └── CROSS-FEAT-001-{{FEATURE_NAME}}.md
│
├── requirements/                       ← Flat requirement registry (Single Source of Truth)
│   ├── FR-001-{{REQ_NAME}}.md
│   ├── FR-002-{{REQ_NAME}}.md
│   ├── FR-003-{{REQ_NAME}}.md
│   ├── NFR-001-performance.md
│   └── NFR-002-reliability.md
│
├── standards/                          ← Repo engineering standards & guidelines
│   └── STD-001-{{STANDARD_NAME}}.md
│
├── annotations/                        ← Traceability annotation language specs
│   └── ANN-001-annotation-language.md
│
├── tests/                              ← Traceability test specifications & coverage matrix
│   └── TEST-SPEC-001-traceability.md
│
├── appendices/                         ← Technical reference & Deep dives
│   ├── A-api-spec.md
│   ├── B-database-schema.md
│   ├── C-ai-system.md
│   ├── D-traceability-matrix.md
│   ├── E-risk-register.md
│   └── F-glossary.md
│
├── adr/                                ← Architecture Decision Records
│   ├── ADR-001-{{DECISION_TITLE}}.md
│   └── ARCHITECTURE.md
│
└── .doc-graph.json                     ← Auto-maintained relationship graph (Machine-readable)
```

---

## 3. Naming Convention (มาตรฐานการตั้งชื่อไฟล์)

| Pattern | Format | Example |
|---|---|---|
| **Engineering Standard** | `STD-{NNN}-{slug}.md` | `STD-003-implementation-unit-and-packet.md` |
| **Functional Requirement** | `FR-{NNN}-{slug}.md` | `FR-001-backend-probe.md` |
| **Non-Functional Requirement** | `NFR-{NNN}-{slug}.md` | `NFR-001-performance.md` |
| **Feature (Domain Owned)** | `FEAT-{NNN}-{slug}.md` | `FEAT-001-ollama-adapter.md` |
| **Cross-domain Feature** | `CROSS-FEAT-{NNN}-{slug}.md` | `CROSS-FEAT-001-unified-dashboard.md` |
| **Annotation Spec** | `ANN-{NNN}-{slug}.md` | `ANN-001-annotation-language.md` |
| **Test Spec** | `TEST-SPEC-{NNN}-{slug}.md` | `TEST-SPEC-001-traceability.md` |
| **Architecture Decision** | `ADR-{NNN}-{slug}.md` | `ADR-001-tauri-choice.md` |

---

## 4. Requirement Metadata (YAML Frontmatter Schema)

ทุกไฟล์ใน `docs/requirements/` ต้องมี Header Frontmatter ตามรูปแบบนี้:

```yaml
---
id: FR-001
title: {{REQUIREMENT_TITLE}}
domain: {{DOMAIN_SLUG}}
owner: {{OWNER_NAME}}
status: draft          # draft | approved | implemented | deprecated
priority: P0           # P0=Must have | P1=Should have | P2=Nice to have
features:
  - FEAT-001           # feature IDs ที่เกี่ยวข้อง
cross_domains:
  - {{CROSS_DOMAIN_SLUG}} # domain อื่นที่เกี่ยวข้อง (ถ้ามี)
implements_test:
  - TEST-001           # test spec ID หรือ test file ที่ตรวจสอบ
---
```

---

## 5. Traceability Chain (สายสัมพันธ์ความถูกต้อง)

```
FR-NNN (docs/requirements/FR-NNN.md)
   │
   ├── implements ──► Code Symbol (src/.../service.rs::function_name)
   │                   annotated: // trace:implements FR-NNN
   │
   └── verified_by ──► Test Case (tests/.../test_suite.rs::test_case_name)
                        annotated: // trace:verifies FR-NNN
```

### การสืบค้นย้อนกลับ (Traceability Query):
- *"Requirement นี้ถูก Implement ไว้ที่ไฟล์/ฟังก์ชันไหน?"* → ค้นหา `// trace:implements FR-NNN`
- *"Requirement นี้มี Test ครอบคลุมแล้วหรือยัง?"* → ค้นหา `// trace:verifies FR-NNN`

---

## 6. Cross-Domain Feature Pattern (สถาปัตยกรรมไร้รอยต่อ)

เมื่อ Feature เดียวต้องทำงานข้ามหลาย Domain:

```
Domain: A (Data Producer) ──────ค้นพบ──┐
                                       ├── CROSS-FEAT-001: Unified Interface
Domain: B (Data Consumer) ──────ค้นพบ──┘
                                             │
                                     features/CROSS-FEAT-001.md  (Single Source of Truth)
                                             │
                                ┌────────────┴────────────┐
                                │                         │
                          FR ที่ owned by           FR ที่ owned by
                          Domain A                  Domain B
```

**กฎเหล็ก:** แต่ละ Domain ให้ระบุ "บทบาทของเราใน Cross-Feature นี้" ไว้ใน Domain `README.md` แล้วทำลิงก์อ้างอิง ห้ามเขียนข้อกำหนดซ้ำในหลายที่

---

## 7. Annotation Language Rules (ไวยากรณ์ Comment ใน Code)

### ตัวอย่างในภาษาต่างๆ:

#### Rust:
```rust
// trace:implements FR-001
// trace:depends-on FR-002
pub fn execute_core_service() -> Result<Data, Error> {
    // ...
}

// trace:verifies FR-001
#[tokio::test]
async fn test_core_service_success() {
    // ...
}
```

#### TypeScript / JavaScript:
```typescript
// trace:implements FR-001
export async function fetchRemoteData(): Promise<Data> {
    // ...
}

// trace:verifies FR-001
test('fetches remote data successfully', async () => {
    // ...
});
```

#### Python:
```python
# trace:implements FR-001
def process_pipeline():
    pass

# trace:verifies FR-001
def test_pipeline_execution():
    assert True
```

### กติกาบังคับ:
1. แท็ก `// trace:` ต้องอยู่ **ทันทีก่อนบรรทัดประกาศ** Function, Struct, Class หรือ Test Case
2. รหัส ID หลังแท็กต้องมีอยู่จริงใน `docs/requirements/`
3. ห้ามใช้ ID ที่ไม่ได้ลงทะเบียน หากตรวจพบจะถือเป็น Error ในขั้น Audit CI/CD ทันที
