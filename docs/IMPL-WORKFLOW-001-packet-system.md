# Implementation Unit & Packet System — Local Multi-Agent Workflow

| Field | Value |
|-------|-------|
| **Document ID** | IMPL-WORKFLOW-001 |
| **Title** | Implementation Unit & Packet Protocol with Local Multi-Agent Workflow |
| **Version** | 1.0.0 |
| **Status** | Approved |
| **Author** | Boss |
| **Created** | 2026-09-28 |
| **Normative References** | [ANN-001](annotations/ANN-001-annotation-language.md), [ARCHITECTURE.md](adr/ARCHITECTURE.md) (ADR-100, ARCH-001 §4), [PRD-SDD-v1.0.md](PRD-SDD-v1.0.md), [TEST-SPEC-001](tests/TEST-SPEC-001-traceability.md) |

---

## 1. วัตถุประสงค์และปรัชญา (Core Philosophy)

ระบบ **Implementation Unit & Packet** ถูกออกแบบมาเพื่อแก้ปัญหาคอขวดของการให้ AI (โดยเฉพาะ Local LLM) เขียนโค้ดในโปรเจกต์ขนาดใหญ่:

1. **Context Window Protection**: Local LLM มีขีดจำกัดด้าน context window และ reasoning depth การส่งโค้ดทั้ง repo เข้า prompt ทำให้เกิดภาพหลอน (hallucination) หรือละเลย boundary
2. **Deterministic Scope**: ย่อยงานให้อยู่ในหน่วย **Packet** ที่เป็นอิสระ มี scope ชัดเจนระดับ Function / Struct เดี่ยว
3. **Traceability by Construction**: เชื่อมโยง Requirement (FR) → Code Symbol (CMP) → Unit Test (AC) → Integration Test (TC) แบบ 100% ตรวจสอบย้อนกลับได้เสมอ
4. **Strict Interface Lock**: สถาปัตยกรรมต้องนิ่งก่อนลงมือโค้ด หาก coder ต้องการเปลี่ยน signature ต้องถือเป็น Design Change และหยุดทันที

---

## 2. กฎหลัก 6 ข้อ (The 6 Golden Rules: R1 – R6)

```
        ┌─────────────────────────────────────────────────────────┐
        │ R1: Skeleton / Feature → Packet = FR × Layer           │
        └────────────────────────────┬────────────────────────────┘
                                     ▼
        ┌─────────────────────────────────────────────────────────┐
        │ R2: Interface Lock (CMP, Signature, Port Locked)        │
        └────────────────────────────┬────────────────────────────┘
                                     ▼
        ┌─────────────────────────────────────────────────────────┐
        │ R3: Mandatory Packet Anatomy + Token Ceiling            │
        └────────────────────────────┬────────────────────────────┘
                                     ▼
        ┌─────────────────────────────────────────────────────────┐
        │ R5: Ordering (Foundation first → Topological depends_on)│
        │     & Single-Writer Mutex                               │
        └────────────────────────────┬────────────────────────────┘
                                     ▼
        ┌─────────────────────────────────────────────────────────┐
        │ R4: Definition of Done (AC passes, @trace, zero leak)   │
        └────────────────────────────┬────────────────────────────┘
                                     ▼
        ┌─────────────────────────────────────────────────────────┐
        │ R6: Evidence & Lineage Ledger (FR, Layer, Model, Hash)  │
        └─────────────────────────────────────────────────────────┘
```

### R1. หน่วยงาน (Atomic Unit & Decomposition)

- **Skeleton ต่อ Feature**: แต่ละ Feature ต้องมี skeleton โครงร่างไฟล์/โมดูลที่ประกาศไว้ก่อน
- **Packet = FR × Layer**: หน่วยการ implement ย่อยที่สุดคือ 1 Packet ซึ่งเกิดจากผลคูณของ Requirement (FR) กับ Layer ในสถาปัตยกรรม:
  $$\text{Packet} = \text{FR} \times \text{Layer}$$
  โดย Layer มี 4 ชั้น:
  1. `schema`: Data models, DTOs, Enums, Structs, Database schemas
  2. `service`: Core business logic, normalization, deduplication algorithms
  3. `contract/route`: Tauri IPC commands, HTTP routes, event listeners
  4. `ui`: Presentation components, DOM rendering, user event handlers
- **AC = 1 Test**: แต่ละ Acceptance Criterion (AC) ใน FR ต้องมี Unit Test รับผิดชอบอย่างน้อย 1 test ตรงไปตรงมา
- **TC = Integration**: Test Case (TC) ระดับ Feature คือ Integration Test ที่รวมผลลัพธ์ของทุก packet ใน feature นั้นเข้าด้วยกัน

### R2. Interface Lock (Interface Stability & Change Control)

- **ก่อนออก Packet**: Software Design Document (SDD) ต้องประกาศ:
  1. Component (`CMP`): ไฟล์และ module path ที่แน่นอน (เช่น `src-tauri/src/commands/models.rs`)
  2. Signature: ชื่อฟังก์ชัน, parameter types, และ return type
  3. Data: Struct definitions, serialization format (JSON/serde)
  4. Port / IPC: Command name, event name ที่ใช้สื่อสารข้าม boundary
- **กติกา Design Change**: Packet ใดที่ coder พบว่า "จำเป็นต้องเปลี่ยน signature" หรือ "เปลี่ยน return type" จะถือเป็น **Design Change** ทันที
  - **Action**: **หยุดทำทันที (HALT)** ห้าม coder แก้ตามใจชอบ
  - **Escalation**: ส่งงานกลับไปยัง Architect เพื่อพิจารณาปรับแก้ SDD และประกาศ lock interface รอบใหม่

### R3. เนื้อหาบังคับของ Packet (Mandatory Packet Anatomy)

ทุก packet ต้องมีข้อมูลครบทั้ง 9 หัวข้อต่อไปนี้ ห้ามขาดข้อใดข้อหนึ่ง:

| # | ส่วนประกอบ | คำอธิบาย |
|---|---|---|
| 1 | **Statement** | คำสั่งชัดเจน 1 ประโยคว่า packet นี้ต้องทำอะไร |
| 2 | **AC (Acceptance Criteria)** | เกณฑ์การยอมรับที่เจาะจงเฉพาะ layer นั้น พร้อม test expectation |
| 3 | **Relevant SDD Section** | ส่วนของ SDD / PRD ที่เกี่ยวข้องโดยตรง (ตัดมาเฉพาะส่วน ไม่ส่งทั้งเล่ม) |
| 4 | **API / EVT** | Signature ของฟังก์ชัน, IPC command, หรือ Event payload |
| 5 | **BR / SEC** | Business Rules (เช่น ตารางลำดับ priority) และข้อกำหนด Security |
| 6 | **Guard Rails** | ข้อห้ามทางสถาปัตยกรรม ([ADR-100](adr/ARCHITECTURE.md#adr-100-code--component-boundary-guard-rails) และ [ARCH-001 §4](adr/ARCHITECTURE.md#arch-001-architectural-invariants--layering-constraints)) |
| 7 | **Current CMP Code** | ซอร์สโค้ดปัจจุบันของ component นั้น (ถ้ามี) เพื่อให้ coder เห็น context |
| 8 | **TC ที่ต้องผ่าน** | รหัส Integration Test (TC-xxx) ที่ packet นี้ต้องส่งต่อให้ผ่าน |
| 9 | **เพดาน Token (Budget)** | Token ceiling สูงสุดที่อนุญาตให้ prompt + output ใช้ (ปกติ 4,000 – 8,000 tokens) |

### R4. Definition of Done ของ Packet (DoD)

Packet จะถือว่าเสร็จสมบูรณ์ (Done) และปิดได้ ก็ต่อเมื่อผ่านเกณฑ์ครบทั้ง 4 ข้อ:

1. **Unit Test จาก AC ผ่านทั้งหมด (Green Tests)**: รันเทสต์ประจำ packet แล้วผ่าน 100%
2. **@trace ครบถ้วนตาม [ANN-001](annotations/ANN-001-annotation-language.md)**:
   - โค้ดฟังก์ชัน/struct มี `// trace:implements FR-xxx`
   - เทสต์มี `// trace:verifies FR-xxx`
3. **`validate-docs` ผ่าน 0/0**: ผลการตรวจ doc-graph และ annotation validator ต้องได้ **0 Errors, 0 Warnings**
4. **Boundary Isolation (ไม่แตะไฟล์นอก CMP)**: ตรวจสอบ git status แล้วพบว่ามีการแก้ไขเฉพาะไฟล์ที่ประกาศไว้ใน CMP ของ packet เท่านั้น ห้าม touch ไฟล์อื่น

### R5. ลำดับและการทำงานคู่ขนาน (Sequencing & Concurrency)

- **ลำดับการทำ**:
  1. **Foundation First**: ต้องทำโครงสร้างพื้นฐานก่อนเสมอ (`PRJ` project setup, `IAM` permissions, `AppState`, core utility crates)
  2. **Topological Order by `depends_on`**: เรียงตามลำดับ dependency graph ของ FR
  3. **Layer Order**: ภายใน FR เดียวกัน ต้องเรียง `schema` → `service` → `contract/route` → `ui`
- **Single-Writer Invariant (Mutual Exclusion)**:
  - **ห้ามเด็ดขาด** ไม่ให้มี 2 packet เขียนลงใน Component (`CMP`) เดียวกันในเวลาเดียวกัน
  - หาก 2 packet ต้องแตะไฟล์เดียวกัน ต้องเข้าคิวทำตามลำดับ (Sequential)

### R6. หลักฐานและประวัติ (Evidence & Lineage Ledger)

- ทุก packet ที่ทำสำเร็จ ต้องบันทึก record ลงในไฟล์ประวัติ `docs/lineage/packet-lineage.jsonl`
- ข้อมูลที่บันทึกต้องเป็น **Lineage (สายวิวัฒนาการ)** ไม่ใช่แค่ log ทั่วไป ประกอบด้วย:
  - `packet_id`: รหัสประจำ packet
  - `fr_id`: รหัส Requirement
  - `layer`: ชั้นงาน (`schema` | `service` | `contract/route` | `ui`)
  - `model`: ชื่อโมเดล AI ที่ทำหน้าที่ Coder (เช่น `local/qwen2.5-coder-7b`, `local/deepseek-coder-6.7b`, `human`)
  - `test_result`: สถานะผลเทสต์ (`PASSED`, execution duration, assertion count)
  - `target_tc`: Integration Test ที่ผูกอยู่
  - `git_commit`: Hash ของ git commit หลัง packet ผ่าน Reviewer

---

## 3. Local Multi-Agent Implementation Workflow

การทำงานร่วมกันระหว่าง Agent ถูกแบ่งออกเป็น 4 บทบาทที่มีความรับผิดชอบตัดขาดกันชัดเจน:

```
                  ┌──────────────────────┐
                  │      Architect       │
                  │ (Big LLM หรือ คน)    │
                  └──────────┬───────────┘
                             │ 1. สร้าง Skeleton & ล็อก Interface
                             ▼
                  ┌──────────────────────┐
                  │    packet.mjs        │
                  │  --queue (จัดคิว R5)  │
                  └──────────┬───────────┘
                             │ คิว Packet
                             ▼
 ┌─────────────►  ┌──────────────────────┐
 │                │        Tester        │
 │                │  (เขียน Unit Test    │
 │                │   จาก AC: Test-First)│
 │                └──────────┬───────────┘
 │                           │ Test พร้อม (Red)
 │                           ▼
 │                ┌──────────────────────┐
 │                │        Coder         │
 │                │  (Local LLM:         │
 │                │   1 packet / ครั้ง)  │
 │                └──────────┬───────────┘
 │                           │ โค้ดส่งมอบ
 │                           ▼
 │  แก้เทสต์รอบ 2 ┌──────────────────────┐
 └──(Fail 1 รอบ)──┤       Reviewer       │
                  │ (ตรวจ R4 DoD อย่างเดียว│
                  │   ไม่ตรวจสไตล์)      │
                  └──────────┬───────────┘
                             │ ผ่าน R4 DoD (0 errors, 0 leak)
                             ▼
                  ┌──────────────────────┐
                  │   Feature Level TC   │
                  │  (Integration Test)  │
                  └──────────┬───────────┘
                             │ ผ่าน
                             ▼
                  ┌──────────────────────┐
                  │   ปิด Feature &      │
                  │   บันทึก Lineage     │
                  └──────────────────────┘
```

### 3.1 บทบาททั้งสี่ (The Four Roles)

| บทบาท | ผู้รับผิดชอบที่เหมาะสม | หน้าที่หลัก | สิ่งที่**ห้าม**ทำ |
|---|---|---|---|
| **Architect** | โมเดลใหญ่ (Claude 3.5 Sonnet / GPT-4o) หรือ มนุษย์ | - สกัด SDD ออกมาเป็น Skeleton<br>- ประกาศ Component (CMP), signature, data models, ports<br>- ล็อก Interface ก่อนเริ่มงาน | ห้ามลงไปเขียน implementation รายละเอียดของแต่ละ packet |
| **Tester** | Agent หรือ Local LLM (Test Specialist) | - เขียน Unit Test จาก AC ใน packet ล่วงหน้า (Test-First / TDD)<br>- ติดแท็ก `// trace:verifies FR-xxx`<br>- ยืนยันว่าเทสต์ fail ก่อนส่งต่อ coder (Red phase) | ห้ามแก้ implementation code ใน CMP |
| **Coder** | Local LLM (Qwen2.5-Coder, DeepSeek-Coder, Llama-3-Coder) | - อ่าน packet ทีละ 1 packet เท่านั้น<br>- เขียนโค้ดเฉพาะใน CMP ที่ได้รับอนุญาตให้ผ่าน AC test<br>- ใส่แท็ก `// trace:implements FR-xxx` | ห้ามเปลี่ยน signature หรือแก้ไฟล์นอก CMP<br>ห้ามทำเกิน scope ของ packet |
| **Reviewer** | Fast Agent / Script Validator | - ตรวจสอบเฉพาะ **R4 Definition of Done**:<br>  1. AC unit test ผ่านครบไหม?<br>  2. @trace ถูกต้องตาม ANN-001 ไหม?<br>  3. validate-docs ได้ 0/0 ไหม?<br>  4. มีการแตะไฟล์นอก CMP ไหม? | **ห้ามตรวจสไตล์** เช่น เรื่องเว้นวรรค, การตั้งชื่อตัวแปรย่อย, indentation (ให้เป็นหน้าที่ของ formatter / linter อัตโนมัติ) |

### 3.2 ขั้นตอนการทำงาน (Step-by-Step Execution Lifecycle)

1. **เลือก Feature**: นำ Feature จาก `docs/TASKS.md` หรือ `docs/features/` ขึ้นมา 1 รายการ
2. **ตรวจ SDD ผ่าน Minimum Gate**: ตรวจสอบว่า FR และ SDD ใน feature นั้นมี:
   - Statement ชัดเจน
   - AC ครบทุกข้อ
   - Data types และ API specifications ระบุครบ
3. **Architect ล็อก Interface**:
   - ประกาศไฟล์ skeleton และ function signature ใน SDD
   - มาร์กสถานะเป็น `INTERFACE_LOCKED`
4. **สร้างคิวงานด้วย Tooling**:
   - รันคำสั่ง `node scripts/packet.mjs --queue --feature <FEAT-ID>` เพื่อคำนวณ dependency ตาม R5
5. **วนลูป Packet Cycle (Tester → Coder → Reviewer)**:
   - **Tester**: สร้าง unit test ไฟล์ตาม AC
   - **Coder**: เขียนโค้ดให้ test ผ่าน ภายใต้ token ceiling
   - **Reviewer**: รัน check DoD ตาม R4
6. **TC ระดับ Feature (Integration Gate)**:
   - เมื่อทุก packet ใน feature ผ่าน R4 ครบ ให้รัน Integration Test (TC)
7. **ปิดงาน (Feature Closure)**:
   - บันทึก record ลง `docs/lineage/packet-lineage.jsonl` ตาม R6
   - อัปเดต Task checklist ใน `docs/TASKS.md`

### 3.3 เส้นทางจัดการความล้มเหลว (Failure Paths & Escalation Protocols)

เพื่อป้องกันไม่ให้ Multi-Agent วนลูปไม่รู้จบ (infinite reasoning loop) ให้บังคับใช้เส้นทางหยุดงานดังนี้:

```
[ปัญหาเกิดขึ้น]
   ├── Coder ต้องการเปลี่ยน Signature / Return Type
   │      └──► [ACTION: HALT] ห้ามเปลี่ยนเอง → Escalate เป็น Design Change Issue คืนให้ Architect
   │
   ├── AC กำกวม ตีความได้หลายแบบ หรือขัดแย้งกันเอง
   │      └──► [ACTION: HALT] ห้ามเดาใจ → Escalate เป็น Spec Clarification Issue ให้ผู้เขียน FR
   │
   └── เทสต์ไม่ผ่านติดต่อกัน 2 รอบ (Strike Two Rule)
          └──► [ACTION: HALT] หยุด coder ทันที → Escalate เป็น Implementation Defect Issue ให้คน/Architect ดู
```

---

## 4. โครงสร้างแม่แบบ Packet (Packet Template Format)

ไฟล์ packet จะถูกสร้างไว้ใน `docs/packets/<PACKET-ID>.md` ตามโครงสร้างมาตรฐาน:

````markdown
# PACKET: {PACKET_ID}

- **Requirement**: {FR_ID} ({FR_TITLE})
- **Layer**: {schema | service | contract/route | ui}
- **Target Component (CMP)**: `{FILE_PATH}::{SYMBOL}`
- **Assigned Target TC**: {TC_ID}
- **Token Ceiling**: {TOKEN_LIMIT} tokens

---

### 1. Statement
{คำสั่งชัดเจน 1 ประโยคว่า packet นี้ต้องทำอะไร}

### 2. Acceptance Criteria (AC)
- **AC-1**: WHEN {event} THEN {action} SHALL {result}

### 3. Relevant SDD Section
{คัดลอกเฉพาะข้อความ SDD ที่ตรงกับงานนี้โดยตรง ไม่เกิน 20 บรรทัด}

### 4. API / EVT Specification
```rust
// หรือ TypeScript / JavaScript ตาม layer
pub fn function_name(param: Type) -> Result<ReturnType, String>;
```

### 5. Business Rules (BR) & Security (SEC)
- **BR-xxx**: {เงื่อนไขทางธุรกิจ}
- **SEC-xxx**: {ข้อกำหนดความปลอดภัย}

### 6. Guard Rails
- **ADR-100**: ห้าม unwrap(), return Result<T, String>, ห้ามแตะไฟล์นอก CMP
- **ARCH-001 §4**: ห้าม UI เรียก external process ตรง, ห้าม layer ล่างอิง layer บน

### 7. Current CMP Code
```rust
// โค้ดปัจจุบันของไฟล์เป้าหมาย (หากเพิ่งเริ่ม ให้ใส่โครงร่างว่าง)
```

### 8. Target Test Case (TC)
- **Integration Test**: `{TC_ID}` (จะรันหลังทุก packet ใน feature จบ)
- **Unit Test File**: `{TEST_FILE_PATH}`
````

---

## 5. ตัวอย่างการใช้งานจริง: FR-003 Duplicate Detection

ตัวอย่างการแตก Feature `FEAT-006` (FR-003: Duplicate Detection) ออกเป็น 4 Packets ตาม R1:

```
FR-003 Duplicate Detection
  │
  ├── Packet 1: PKT-FR003-SCHEMA   ──► src-tauri/src/models/types.rs
  ├── Packet 2: PKT-FR003-SERVICE  ──► src-tauri/src/commands/models.rs::dedup_models
  ├── Packet 3: PKT-FR003-ROUTE    ──► src-tauri/src/lib.rs (IPC Registration)
  └── Packet 4: PKT-FR003-UI       ──► src/js/models.js (Badge & Tooltip Rendering)
```

### 5.1 Packet 1: PKT-FR003-SCHEMA
- **CMP**: `src-tauri/src/models/types.rs`
- **Statement**: เพิ่มฟิลด์ `is_duplicate: bool`, `is_preferred: bool`, และ `duplicate_group: Option<String>` ใน struct `UnifiedModel`
- **AC**: Struct deserialize/serialize JSON ถูกต้องตาม schema
- **DoD**: Unit test test_model_serialization ผ่าน, `@trace:implements FR-003`

### 5.2 Packet 2: PKT-FR003-SERVICE
- **CMP**: `src-tauri/src/commands/models.rs::dedup_models`
- **Statement**: เขียนอัลกอริทึม group โมเดลตาม canonical name และ mark preferred entry ตามลำดับ Ollama > vLLM > GGUF > HF (BR-001)
- **AC**: เมื่อมี canonical name ซ้ำข้าม backend ตัวที่ priority สูงสุดได้ `is_preferred = true` และทุกตัวได้ `is_duplicate = true`
- **DoD**: Unit test `test_dedup_models_priority` ผ่าน, `@trace:implements FR-003`, ไม่แตะไฟล์อื่น

### 5.3 Packet 3: PKT-FR003-ROUTE
- **CMP**: `src-tauri/src/lib.rs`
- **Statement**: ลงทะเบียน Tauri command `list_all_models` ซึ่งเรียกใช้ `dedup_models` ใน IPC invoke handler
- **AC**: Frontend invoke `list_all_models` แล้วได้รับ list ของ `UnifiedModel` ที่ผ่านการ dedup แล้ว
- **DoD**: IPC handler test ผ่าน, `@trace:implements FR-003`

### 5.4 Packet 4: PKT-FR003-UI
- **CMP**: `src/js/models.js::renderModelCard`
- **Statement**: แสดง Badge สีเหลือง "Duplicate" พร้อม tooltip ระบุ backend อื่นที่มีโมเดลนี้ หาก `is_duplicate === true`
- **AC**: เมื่อ `is_duplicate === true` DOM element มี class `.badge-duplicate`
- **DoD**: DOM unit test ผ่าน, `@trace:implements FR-003`

---

## 6. โครงสร้างบันทึก Lineage (R6 Specification)

ไฟล์ `docs/lineage/packet-lineage.jsonl` เก็บประวัติแบบ append-only ในรูปแบบ JSON Lines:

```json
{"packet_id":"PKT-FR003-SERVICE","fr_id":"FR-003","layer":"service","cmp":"src-tauri/src/commands/models.rs::dedup_models","model":"local/qwen2.5-coder-7b","timestamp":"2026-09-28T05:30:00Z","test_result":{"status":"PASSED","tests_run":3,"duration_ms":124},"target_tc":"TC-FEAT-006","git_commit":"a3f9c2d1","reviewed_by":"reviewer-agent"}
```

---

## 7. คำสั่ง Tooling ประจำระบบ

ระบบมีสคริปต์อัตโนมัติ `scripts/packet.mjs` รองรับการรัน:

```bash
# 1. ดูคิวการทำ packet เรียงตาม R5 (Foundation ก่อน, ตาม depends_on และ layer)
node scripts/packet.mjs --queue

# 2. ดูเฉพาะคิวของ Feature ใด Feature หนึ่ง
node scripts/packet.mjs --feature FEAT-006

# 3. ตรวจสอบสถานะ Definition of Done (DoD) ตาม R4
node scripts/packet.mjs --verify PKT-FR003-SERVICE

# 4. บันทึกผล Lineage ตาม R6
node scripts/packet.mjs --record-lineage docs/packets/PKT-FR003-SERVICE.json
```
