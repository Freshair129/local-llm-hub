# STD-001 — Documentation Architecture & Repository Organization Standard

| Field | Value |
|---|---|
| **Standard ID** | STD-001 |
| **Title** | Documentation Architecture, Hierarchy, and Repository Organization Standard |
| **Version** | 1.0.0 |
| **Status** | Active / Normative |
| **Author** | Boss |
| **Created** | 2026-09-28 |
| **Scope** | Repository-wide mandatory documentation standard |
| **Implementation Reference** | [STRUCTURE.md](../STRUCTURE.md), [STRUCTURE-TEMPLATE.md](../templates/STRUCTURE-TEMPLATE.md) |

---

## 1. Scope & Purpose (ขอบเขตและวัตถุประสงค์)

มาตรฐานฉบับนี้กำหนดกฎเกณฑ์และโครงสร้างการจัดเก็บเอกสารทางเทคนิค (Technical Documentation Architecture) ของคลังโค้ด เพื่อรองรับการทำงานร่วมกันระหว่างมนุษย์และ AI Agents (Multi-Agent System) โดยแบ่งโครงสร้างตามลำดับชั้น:

```
Domain → Feature → Requirement → Implementation (Code) → Verification (Test)
```

---

## 2. ลำดับชั้นเอกสาร 5 ระดับ (The 5 Structural Tiers)

### 2.1 Tier 1: Domain Overview (`docs/domains/<domain-id>/README.md`)
- กำหนด Charter (พันธกิจและความรับผิดชอบ) ของแต่ละโดเมน
- กำหนด In-Scope / Out-of-Scope (Boundaries)
- กำหนด Data Contracts และ Interface ที่ส่งมอบให้โดเมนอื่น

### 2.2 Tier 2: Features (`docs/domains/<domain-id>/features/` และ `docs/features/`)
- ฟังก์ชันระดับผู้ใช้สัมผัสได้ (User-facing capabilities)
- หากเป็นฟังก์ชันที่คาบเกี่ยวหลายโดเมน ให้บันทึกที่ `docs/features/CROSS-FEAT-XXX.md` (Single Source of Truth)

### 2.3 Tier 3: Requirements (`docs/requirements/`)
- บันทึกข้อกำหนดเดี่ยวแบบ Flat Registry (เช่น `FR-001`, `NFR-001`)
- ทุกไฟล์ต้องมี YAML Frontmatter ระบุ `id`, `domain`, `owner`, `status`, `priority`, และ `features`

### 2.4 Tier 4: Code Symbols (Implementation)
- สัญลักษณ์ในซอร์สโค้ด (ฟังก์ชัน, Struct, Class)
- ต้องกำกับด้วย Annotation ตามมาตรฐาน [STD-002 / ANN-001](../annotations/ANN-001-annotation-language.md)

### 2.5 Tier 5: Tests (Verification)
- Integration และ Unit Tests
- ต้องมีแอนโนเทชัน `// trace:verifies <REQ-ID>` เพื่อยืนยันความถูกต้อง

---

## 3. กฎเหล็กการจัดเก็บเอกสาร (Documentation Rules)

1. **Single Source of Truth:** ห้ามคัดลอกข้อกำหนดเดียวกันไปไว้ในหลายไฟล์ หากต้องการอ้างอิงให้ใช้ Relative Markdown Link
2. **Deterministic Naming:** ต้องตั้งชื่อไฟล์ตาม Naming Convention ที่กำหนดใน [STRUCTURE.md](../STRUCTURE.md)
3. **Graph Machine-Readability:** ความสัมพันธ์ทั้งหมดต้องสามารถแปลงเป็น Graph ใน `docs/.doc-graph.json` ได้
