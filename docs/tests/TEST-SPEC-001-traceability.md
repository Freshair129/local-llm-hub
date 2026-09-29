# TEST-SPEC-001 — Traceability Test Specification

| Field | Value |
|-------|-------|
| **ID** | TEST-SPEC-001 |
| **Version** | 1.0.0 |
| **Status** | Draft |
| **Author** | Boss |
| **Created** | 2026-09-28 |
| **References** | [ANN-001](../annotations/ANN-001-annotation-language.md), [FR-001..009](../requirements/) |

---

## 1. Purpose

กำหนด test cases ที่ verify **traceability chain** ครบวงจร:

```
Requirement (doc)
     ↕
Implementation symbol (code annotation)
     ↕
Test (verifies annotation)
```

ต้องค้นย้อนกลับได้พร้อม **source location** และ **git revision** ที่ตรงกัน

---

## 2. Test Categories

| Category | คำอธิบาย | จำนวน test |
|----------|---------|-----------|
| T-CHAIN | ตรวจ chain ครบ: FR ↔ symbol ↔ test | 9 (ตาม FR แต่ละตัว) |
| T-ANN | ตรวจ annotation parsing ถูกต้อง | 6 |
| T-ERR | ตรวจ error cases: ID ผิด, target หาย, ขัดแย้ง | 7 |
| T-MOVE | ตรวจ file rename/delete/move | 4 |

---

## 3. T-CHAIN — Full Traceability Chain Tests

### T-CHAIN-001: FR-001 Backend Probe Chain

**Scenario:** ตรวจว่า FR-001 มี implementation symbol และ test ที่ครบ

**Expected chain:**
```
FR-001 (docs/requirements/FR-001-backend-probe.md)
  │
  ├── implements ←── src-tauri/src/commands/backends.rs::probe_backends
  │                  (annotation: // trace:implements FR-001)
  │
  └── verified_by ←── tests/backend_probe_test.rs::test_probe_ollama_online
                       (annotation: // trace:verifies FR-001)
                   ←── tests/backend_probe_test.rs::test_probe_offline_timeout
                       (annotation: // trace:verifies FR-001)
```

**Pass criteria:**
- [ ] indexer พบ annotation `trace:implements FR-001` บน `probe_backends`
- [ ] indexer พบ annotation `trace:verifies FR-001` บน test functions
- [ ] graph edge สร้างได้ครบทั้งสองทิศทาง
- [ ] source location (file + line) บันทึกใน edge

---

### T-CHAIN-002: FR-002 Model Aggregation Chain

**Expected chain:**
```
FR-002 (requirements/FR-002-model-aggregation.md)
  ├── implements ←── models.rs::aggregate_models   // trace:implements FR-002
  ├── implements ←── models.rs::normalize_model_name  // trace:implements FR-002
  └── verified_by ←── tests/models_test.rs::test_aggregate_from_all_backends  // trace:verifies FR-002
                  ←── tests/models_test.rs::test_normalize_model_name  // trace:verifies FR-002
```

**Pass criteria:** เหมือน T-CHAIN-001 + ตรวจว่า `normalize_model_name` ปรากฏเป็น separate symbol

---

### T-CHAIN-003: FR-003 Deduplication Chain (Cross-Domain Test)

**นี่คือ test สำคัญ** — ตรวจ cross-domain feature ที่ CROSS-FEAT-001 orchestrate

**Expected chain:**
```
FR-003 (requirements/FR-003-deduplication.md)
  │   ← owned by: model-management
  │   ← part of: CROSS-FEAT-001
  │
  ├── implements ←── models.rs::dedup_models
  │                  // trace:implements FR-003
  │                  // trace:depends-on FR-002
  │                  // trace:part-of FEAT-006
  │
  └── verified_by ←── tests/dedup_test.rs::test_dedup_llama3_across_backends
                       // trace:verifies FR-003
                  ←── tests/dedup_test.rs::test_preferred_backend_priority
                       // trace:verifies FR-003
                  ←── tests/dedup_test.rs::test_dedup_offline_preferred_fallback
                       // trace:verifies FR-003
```

**Pass criteria:**
- [ ] FR-003 ↔ `dedup_models` edge มี `depends-on FR-002` edge ด้วย
- [ ] FR-003 ↔ `dedup_models` มี `part-of FEAT-006` edge
- [ ] FEAT-006 → CROSS-FEAT-001 linkable ผ่าน feature doc
- [ ] test_dedup_llama3 ใช้ input ที่มี duplicate จริง (Ollama + GGUF llama3.2)

**Test input fixture:**
```rust
// Input สำหรับ test_dedup_llama3_across_backends
let models = vec![
    RawModel { backend: "ollama", raw_name: "llama3.2:3b", ... },
    RawModel { backend: "gguf",   raw_name: "Meta-Llama-3.2-3B-Instruct.Q4_K_M.gguf", ... },
    RawModel { backend: "ollama", raw_name: "mistral:7b", ... },
];
```

**Expected output:**
```rust
// llama3.2 3b models: is_duplicate = true
// ollama entry: is_preferred = true
// gguf entry: is_preferred = false
// mistral 7b: is_duplicate = false
```

---

### T-CHAIN-004 ถึง T-CHAIN-009

| Test ID | FR | Implementation Symbol | Test Function |
|---------|----|-----------------------|--------------|
| T-CHAIN-004 | FR-004 | `read_model_card` | `test_hf_model_card_fetch` |
| T-CHAIN-005 | FR-005 | `start_model`, `stop_model` | `test_ollama_start_stop` |
| T-CHAIN-006 | FR-006 | `get_gpu_stats` | `test_nvidia_smi_parse` |
| T-CHAIN-007 | FR-007 | `ChatPage::sendMessage` | manual |
| T-CHAIN-008 | FR-008 | `start_litellm`, `generate_litellm_config` | `test_litellm_spawn_and_health` |
| T-CHAIN-009 | FR-009 | `scan_gguf`, `read_gguf_header` | `test_gguf_scan_directory` |

---

## 4. T-ANN — Annotation Parsing Tests

### T-ANN-001: Valid single relation

**Input:**
```rust
// trace:implements FR-003
pub fn dedup_models(models: Vec<RawModel>) -> Vec<UnifiedModel> { ... }
```

**Expected:** edge created `dedup_models --implements--> FR-003` ✅

---

### T-ANN-002: Multiple relations on same symbol

**Input:**
```rust
// trace:implements FR-003
// trace:depends-on FR-002
// trace:part-of FEAT-006
pub fn dedup_models(...) { ... }
```

**Expected:** 3 edges สร้างทั้งหมด ✅

---

### T-ANN-003: Test verifies annotation

**Input:**
```rust
// trace:verifies FR-003
#[test]
fn test_dedup_llama3_across_backends() { ... }
```

**Expected:** edge `test_dedup_llama3 --verifies--> FR-003` ✅  
**Also derived:** `FR-003 --verified_by--> test_dedup_llama3` (reverse edge)

---

### T-ANN-004: Annotation ใน string literal (ต้อง ignore)

**Input:**
```rust
let msg = "// trace:implements FR-003";
```

**Expected:** ไม่สร้าง edge ✅ (annotation ใน string literal ignored)

---

### T-ANN-005: TypeScript annotation

**Input:**
```typescript
// trace:implements FR-002
// trace:part-of FEAT-005
export function aggregateModels(backends: Backend[]): UnifiedModel[] { ... }
```

**Expected:** 2 edges สร้าง ✅

---

### T-ANN-006: Annotation บน arrow function ที่ export

**Input:**
```typescript
// trace:implements FR-006
export const startMonitoring = () => { ... }
```

**Expected:** edge สร้าง, symbol = `monitor.js::startMonitoring` ✅

---

## 5. T-ERR — Error Case Tests

### T-ERR-001: Unknown requirement ID (V-P0-001)

**Input:**
```rust
// trace:implements FR-999
pub fn foo() {}
```

**Expected:** error `V-P0-001: Unknown requirement ID: FR-999` 🔴  
Indexer ต้อง reject — ไม่สร้าง edge

---

### T-ERR-002: Annotation ไม่ผูกกับ declaration (V-P0-002)

**Input:**
```rust
// trace:implements FR-003

pub fn dedup_models() {}  // มีบรรทัดว่างคั่น
```

**Expected:** error `V-P0-002: Annotation at line N has no bound symbol` 🔴

---

### T-ERR-003: Relation ไม่รู้จัก (V-P0-003)

**Input:**
```rust
// trace:owns FR-003
pub fn dedup_models() {}
```

**Expected:** error `V-P0-003: Unknown relation: owns` 🔴

---

### T-ERR-004: FR มี implements แต่ไม่มี verifies (V-P1-002)

**Scenario:** FR-003 มี annotation `implements` แต่ไม่มี test annotated `verifies FR-003`

**Expected:** warning `V-P1-002: FR-003 has no test coverage annotation` 🟡  
ไม่ block — แต่แสดงใน report

---

### T-ERR-005: Duplicate declaration (registry + annotation) (V-P1-001)

**Scenario:**
- `FR-003.md` frontmatter มี `implements_symbol: [models.rs::dedup_models]`
- code มี `// trace:implements FR-003` บน `dedup_models`

**Expected:** warning `V-P1-001: Duplicate implements: FR-003 declared in both annotation and registry` 🟡  
Annotation ชนะ (ใช้เป็น canonical edge)

---

### T-ERR-006: Annotation ชี้ไปยัง deprecated FR

**Scenario:** FR-002 ถูก mark `status: deprecated`

**Input:**
```rust
// trace:depends-on FR-002
pub fn dedup_models() {}
```

**Expected:** warning `V-P1-003: Dependency on deprecated FR-002` 🟡

---

### T-ERR-007: ไม่มี annotation บน function (ไม่ใช่ error)

**Scenario:** function ที่ไม่มี annotation ใดๆ

**Expected:** ไม่มี warning ✅ — annotation เป็น optional

---

## 6. T-MOVE — File Movement Tests

### T-MOVE-001: Symbol ถูก rename

**Before:**
```
src-tauri/src/commands/models.rs::dedup_models
  edge: --implements--> FR-003
```

**Action:** ย้าย function ไปไฟล์ใหม่ `src-tauri/src/dedup/engine.rs::dedup_models`

**Expected after re-index:**
- edge เก่า: marked `dangling`
- edge ใหม่: สร้างจาก annotation ในไฟล์ใหม่
- report: "Symbol moved: models.rs::dedup_models → dedup/engine.rs::dedup_models"

---

### T-MOVE-002: Requirement ถูกลบ

**Action:** ลบ `FR-003-deduplication.md`

**Expected:**
- ทุก annotation `trace:implements FR-003` และ `trace:verifies FR-003` → error V-P0-001
- graph edges ที่ชี้ไป FR-003 → marked `dangling`

---

### T-MOVE-003: Source file ถูก rename

**Action:** `models.rs` → `model_engine.rs`

**Expected:**
- indexer ตรวจ git diff `--diff-filter=R`
- อัปเดต symbol canonical form ใน all edges
- ไม่สร้าง dangling edge

---

### T-MOVE-004: Source file ถูกลบ

**Action:** `dedup_test.rs` ถูกลบออก

**Expected:**
- FR-003 `verified_by` edges → marked `dangling`
- report: "Test coverage lost: FR-003 no longer has verified_by edges"
- แสดงใน coverage report เป็น untested

---

## 7. Coverage Report Format

หลัง indexer run ต้องสร้าง coverage report:

```markdown
# Traceability Coverage Report
Generated: 2026-09-28T04:00:00Z

## Summary
| Category | Count |
|----------|-------|
| Total Requirements | 12 (10 FR + 2 NFR) |
| Requirements with implements | 10/10 FR (100%) |
| Requirements with test coverage | 10/10 FR (100%) |
| Dangling edges | 0 |
| Warnings (P1) | 0 |
| Errors (P0) | 0 |

## FR Coverage
| ID | Title | Implemented | Tested | Status |
|----|-------|-------------|--------|--------|
| FR-001 | Backend Probe | ✅ probe_backends | ✅ 2 tests | OK |
| FR-002 | Model Aggregation | ✅ aggregate_models, normalize_model_name | ✅ 2 tests | OK |
| FR-003 | Deduplication | ✅ dedup_models | ✅ 3 tests | OK |
| FR-004 | Model Card | ✅ read_model_card, renderModelCard | ✅ 3 tests | OK |
| FR-005 | Model Control | ✅ start_model, stop_model | ✅ 3 tests | OK |
| FR-006 | GPU Monitor | ✅ get_gpu_stats, GPUGauge | ✅ 2 tests | OK |
| FR-007 | Chat Interface | ✅ ChatPage, sendMessage, streamResponse | ✅ test_chat.rs | OK |
| FR-008 | LiteLLM Proxy | ✅ start_litellm, generate_litellm_config | ✅ 4 tests | OK |
| FR-009 | GGUF Scanner | ✅ scan_gguf, read_gguf_header | ✅ 3 tests | OK |
| FR-010 | LAN Sharing | ✅ start_lan_share, stop_lan_share | ✅ 3 tests (test_lan_share.rs) | OK |

## Dangling Edges
(none)

## Warnings
(none)
```
