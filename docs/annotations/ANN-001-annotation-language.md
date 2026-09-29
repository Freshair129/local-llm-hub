# ANN-001 — Annotation Language Specification

| Field | Value |
|-------|-------|
| **ID** | ANN-001 |
| **Version** | 1.0.0 |
| **Status** | Draft |
| **Author** | Boss |
| **Created** | 2026-09-28 |

---

## 1. Purpose

Annotation Language กำหนดวิธีผูก **source code symbol** (function, class, test) เข้ากับ **requirement ID** ใน registry โดยตรงจาก comment ใน code

เป้าหมาย:
1. ให้เครื่องมือ (validator/indexer) อ่าน annotation และสร้าง graph edge ได้โดยอัตโนมัติ
2. ให้คนเขียน code ระบุ traceability ณ จุดที่ implement — ไม่ต้องไปอัปเดตเอกสารแยก
3. ตรวจจับความขัดแย้งระหว่าง registry กับ annotation ได้ก่อน merge

> **ข้อสำคัญ**: เครื่องมือต้อง _รองรับ_ annotation แต่ **ไม่บังคับ** ให้เขียนทุก function
> เขียนเฉพาะจุดที่ traceability มีความหมาย เช่น public API, core algorithm, boundary test

---

## 2. Annotation Syntax

### 2.1 รูปแบบพื้นฐาน

```
// trace:<relation> <target-id>
```

| ส่วน | กฎ |
|------|-----|
| Prefix | ต้องขึ้นต้นด้วย `// trace:` (สองขีด, space, trace, colon) |
| `<relation>` | ดูตารางใน §3 |
| `<target-id>` | ต้องตรงกับ ID ใน `docs/requirements/` registry |
| ตำแหน่ง | **ทันทีก่อน** function/class/test declaration เท่านั้น |
| หลาย target | เขียนเป็นหลาย annotation บรรทัดแยก |

### 2.2 ตำแหน่งที่อนุญาต

```typescript
// ✅ ถูกต้อง — อยู่ทันทีก่อน function
// trace:implements FR-003
export function dedupModels(models: UnifiedModel[]): UnifiedModel[] {
  ...
}

// ✅ ถูกต้อง — หลาย relation
// trace:implements FR-003
// trace:depends-on FR-002
export function dedupModels(models: UnifiedModel[]): UnifiedModel[] {
  ...
}

// ✅ ถูกต้อง — test
// trace:verifies FR-003
test('detects duplicate llama3.2 across ollama and gguf', () => {
  ...
});

// ❌ ผิด — อยู่กลาง function body
export function dedupModels(models: UnifiedModel[]): UnifiedModel[] {
  // trace:implements FR-003   ← ไม่นับ ต้องอยู่ก่อน declaration
  return models;
}

// ❌ ผิด — ห่างจาก declaration > 0 บรรทัด
// trace:implements FR-003

export function dedupModels() { ... }
```

### 2.3 ภาษาที่รองรับ

| ภาษา | Comment Style |
|------|--------------|
| TypeScript / JavaScript | `// trace:...` |
| Rust | `// trace:...` |
| Python | `# trace:...` |

---

## 3. Relations

| Relation | ทิศทาง | ความหมาย | ใช้บน |
|----------|--------|----------|-------|
| `implements` | Symbol → Requirement | Symbol นี้ implement requirement นั้น | function, class, module |
| `depends-on` | Symbol → Requirement/Feature | Symbol นี้ต้องการ requirement/feature อื่น | function, class |
| `verifies` | Test → Requirement | Test นี้ verify requirement นั้น | test function/block |
| `part-of` | Symbol → Feature | Symbol เป็นส่วนหนึ่งของ Feature | function, class |

**`verified-by`** ไม่ใช้ใน annotation (เป็น derived/reverse ของ `verifies` — สร้างโดย indexer เอง)

### ตัวอย่างครบทุก relation

```typescript
// trace:implements FR-002
// trace:depends-on FR-001
// trace:part-of FEAT-005
export function aggregateModels(backends: Backend[]): UnifiedModel[] { ... }
```

```rust
// trace:implements FR-003
// trace:depends-on FR-002
pub fn dedup_models(models: Vec<RawModel>) -> Vec<UnifiedModel> { ... }
```

```typescript
// trace:verifies FR-003
test('detects duplicate llama3.2 across ollama and gguf backends', () => {
  const models = [ollamaLlama32, ggufLlama32];
  const result = dedupModels(models);
  expect(result.find(m => m.canonical_name === 'llama3.2 3b')?.is_duplicate).toBe(true);
});
```

---

## 4. Symbol Identity

Symbol identity คือสิ่งที่ indexer ใช้ระบุว่า annotation ผูกกับ code อะไร

### 4.1 กฎการ binding

Annotation ผูกกับ **declaration แรกที่ตาม** (ข้ามบรรทัดว่างไม่ได้)

```
line N:   // trace:implements FR-003        ← annotation
line N+1: export function dedupModels() {   ← bound symbol = "dedupModels"
```

### 4.2 Symbol canonical form

| ภาษา | Canonical Form | ตัวอย่าง |
|------|---------------|---------|
| TypeScript | `{file}::{name}` | `src/js/pages/models.js::dedupModels` |
| Rust | `{crate}::{module}::{name}` | `local_llm_hub::commands::models::dedup_models` |
| Python | `{module}::{name}` | `sidecar.litellm_proxy::generate_config` |

### 4.3 สิ่งที่ถือว่าเป็น declaration ที่ bind ได้

```typescript
// ✅ function declaration
export function foo() {}

// ✅ arrow function ที่ export (ต้องตามหลัง const/let/export)
export const bar = () => {}

// ✅ class
export class BackendProber { ... }

// ✅ test (jest/vitest)
test('...', () => {})
it('...', () => {})
describe('...', () => {})
```

```rust
// ✅ fn
pub fn dedup_models() {}

// ✅ struct / impl
pub struct AppState {}
impl AppState {}

// ✅ #[test]
#[test]
fn test_dedup_llama3() {}
```

---

## 5. Validation Rules

### 5.1 P0 — Error (ต้องแก้ ห้าม merge)

| Rule ID | กฎ | ข้อความ error |
|---------|----|--------------|
| V-P0-001 | Target ID ไม่มีใน registry | `Unknown requirement ID: FR-999` |
| V-P0-002 | Annotation ไม่ผูกกับ declaration ใด (บรรทัดถัดไปว่าง หรือไม่ใช่ declaration) | `Annotation at line N has no bound symbol` |
| V-P0-003 | Relation ไม่รู้จัก | `Unknown relation: trace:owns` |
| V-P0-004 | Syntax ผิด | `Invalid annotation format at line N` |

### 5.2 P1 — Warning (ควรแก้ แต่ไม่ block)

| Rule ID | กฎ | ข้อความ |
|---------|----|---------|
| V-P1-001 | Symbol เดิมมี `implements` ซ้ำกับที่ registry ประกาศไว้ | `Duplicate implements: FR-003 declared in both annotation and registry` |
| V-P1-002 | FR มี `implements` annotation แต่ไม่มี `verifies` test | `FR-003 has no test coverage annotation` |
| V-P1-003 | `depends-on` target เป็น FR ที่ status=deprecated | `Dependency on deprecated FR-002` |

### 5.3 สิ่งที่ไม่ใช่ error

- ไม่มี annotation บน function ธรรมดา (ไม่บังคับ)
- Function มี annotation แต่ไม่ได้ export (private helper อนุญาต)
- Comment `// trace:` อยู่ใน string literal หรือ multiline comment `/* */` — indexer ข้าม

---

## 6. Registry vs Annotation Conflict

เมื่อ registry (เช่น `FR-003.md` frontmatter) และ annotation ใน code ประกาศ relation เดียวกัน:

```yaml
# FR-003.md frontmatter
implements_symbol:
  - "local_llm_hub::commands::models::dedup_models"  ← declared in registry
```

```rust
// trace:implements FR-003   ← declared in annotation
pub fn dedup_models() {}
```

**กฎ: annotation ชนะเมื่อขัดกัน** — registry คือ human-maintained index ที่อาจล้าสมัย, annotation คือ truth ณ จุด code

Indexer ต้อง:
1. เก็บทั้งสองแหล่ง
2. แสดง `V-P1-001` warning
3. ใช้ annotation เป็น canonical edge

---

## 7. Source Precedence (ลำดับความน่าเชื่อถือ)

| Priority | แหล่ง | อธิบาย |
|----------|-------|--------|
| 1 (สูงสุด) | Code annotation | Truth ณ เวลา commit |
| 2 | Registry frontmatter | Human-declared, อาจ lag |
| 3 | Doc graph edges | Derived, auto-generated |

---

## 8. File Movement / Rename / Delete

| เหตุการณ์ | พฤติกรรม |
|----------|---------|
| ไฟล์ถูก rename | Indexer scan ใหม่ — symbol canonical form เปลี่ยนตาม path ใหม่ |
| ไฟล์ถูกลบ | Graph edge ที่อ้างถึง symbol นั้นถูก mark `dangling` |
| Function ถูก move ข้าม file | Edge เก่าเป็น `dangling`, edge ใหม่สร้างจาก annotation ในไฟล์ปลายทาง |
| Requirement ถูก deprecate | `V-P1-003` warning บน annotation ที่ยัง point มา |

Indexer ต้อง **อ่าน git diff** เพื่อตรวจ rename vs delete:
```
git diff --diff-filter=R HEAD~1..HEAD  ← detect rename
git diff --diff-filter=D HEAD~1..HEAD  ← detect delete
```

---

## 9. Physical Schema ของ Graph Edge

เมื่อ indexer สร้าง edge จาก annotation:

```json
{
  "id": "edge:ann-FR-003-dedup_models",
  "source": "annotation",
  "from": {
    "type": "symbol",
    "canonical": "local_llm_hub::commands::models::dedup_models",
    "file": "src-tauri/src/commands/models.rs",
    "line": 42,
    "git_rev": "abc1234"
  },
  "relation": "implements",
  "to": {
    "type": "requirement",
    "id": "FR-003",
    "path": "docs/requirements/FR-003-deduplication.md"
  },
  "created_at": "2026-09-28T03:00:00Z",
  "validated": true
}
```

---

## 10. ตัวอย่างครบวงจร (Cross-Domain)

### Scenario: Deduplication Feature

```
FEAT-006 (model-management) ──part-of──► CROSS-FEAT-001 (unified dashboard)
         │
         ├── FR-002 (aggregation)   ← owned by backend-integration
         └── FR-003 (deduplication) ← owned by model-management
```

**Code (Rust):**
```rust
// trace:implements FR-002
// trace:part-of FEAT-005
pub fn aggregate_models(backends: &[Backend]) -> Vec<RawModel> { ... }

// trace:implements FR-003
// trace:depends-on FR-002
// trace:part-of FEAT-006
pub fn dedup_models(models: Vec<RawModel>) -> Vec<UnifiedModel> { ... }
```

**Test (Rust):**
```rust
// trace:verifies FR-002
#[test]
fn test_aggregate_from_ollama_and_gguf() { ... }

// trace:verifies FR-003
#[test]
fn test_dedup_llama3_across_backends() { ... }
```

**Query ที่เป็นไปได้:**
```
"FR-003 implement ที่ไหน?"
→ src-tauri/src/commands/models.rs::dedup_models (line 42, rev abc1234)

"FR-003 มี test ไหม?"
→ tests/dedup_test.rs::test_dedup_llama3_across_backends (line 18, rev abc1234)

"CROSS-FEAT-001 ประกอบด้วย symbols อะไรบ้าง?"
→ aggregate_models (via FR-002 → FEAT-005 → CROSS-FEAT-001)
→ dedup_models (via FEAT-006 → CROSS-FEAT-001)

"Domain backend-integration ค้นพบ feature ไหนบ้าง?"
→ CROSS-FEAT-001 (via FR-002 ownership)
→ FEAT-001, FEAT-002, FEAT-003, FEAT-004
```

---

## 11. Error Cases ที่ต้องทดสอบ

| Case | Input | Expected |
|------|-------|---------|
| Unknown ID | `// trace:implements FR-999` | V-P0-001 error |
| No bound symbol | `// trace:implements FR-003\n\n\nfunction foo()` | V-P0-002 error |
| Unknown relation | `// trace:owns FR-003` | V-P0-003 error |
| Deprecated target | `// trace:depends-on FR-DEPRECATED` | V-P1-003 warning |
| Duplicate with registry | annotation + registry both declare same edge | V-P1-001 warning, annotation wins |
| Dangling after delete | function deleted but graph edge remains | edge marked `dangling` |
| Annotation inside string | `const s = "// trace:implements FR-003"` | no-op, ignored |
