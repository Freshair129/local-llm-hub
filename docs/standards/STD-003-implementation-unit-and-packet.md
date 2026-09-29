# STD-003 — Implementation Unit, Packet Specification, and Multi-Agent Workflow Standard

| Field | Value |
|---|---|
| **Standard ID** | STD-003 |
| **Title** | Implementation Unit, Packet Specification, and Local Multi-Agent Workflow |
| **Version** | 1.0.0 |
| **Status** | Active / Normative |
| **Author** | Boss |
| **Created** | 2026-09-28 |
| **Scope** | Repository-wide mandatory engineering standard |
| **Normative References** | [ANN-001 (STD-002)](../annotations/ANN-001-annotation-language.md), [ADR-100 & ARCH-001 §4](../adr/ARCHITECTURE.md), [PRD-SDD-v1.0](../PRD-SDD-v1.0.md), [TEST-SPEC-001](../tests/TEST-SPEC-001-traceability.md) |

---

## 1. Scope & Purpose (ขอบเขตและวัตถุประสงค์)

มาตรฐานฉบับนี้กำหนดกฎเกณฑ์และระเบียบปฏิบัติระดับบังคับ (Normative Standard) สำหรับการพัฒนาซอฟต์แวร์ด้วยระบบ Multi-Agent (โดยเฉพาะ Local LLM) ในคลังโค้ดนี้ เพื่อให้:

1. **Context Window Contained**: การประมวลผลของโมเดล AI แต่ละรอบจำกัดอยู่ในหน่วยงานขนาดเล็ก (**Packet**) ที่มี scope แน่นอน ป้องกันอาการบริบทล้น (context exhaustion) และการทำลายโค้ดส่วนอื่น
2. **Deterministic Interface**: สถาปัตยกรรมและลายเซ็นต์ของฟังก์ชัน (Signature) ต้องถูกล็อกล่วงหน้า ป้องกัน coder agent ดัดแปลง interface โดยพลการ
3. **Traceability by Construction**: ทุกชิ้นส่วนโค้ดและเทสต์ต้องเชื่อมโยงกลับไปยัง Functional Requirement (FR) และ Acceptance Criteria (AC) ตามมาตรฐาน [ANN-001 (STD-002)](../annotations/ANN-001-annotation-language.md)
4. **Finite Multi-Agent Execution**: มี Circuit Breaker และ Failure Path ที่ชัดเจน ป้องกัน Multi-Agent วนลูปไม่รู้จบ (infinite reasoning/fixing loop)

---

## 2. กฎหลัก 6 ข้อ (The 6 Golden Rules: R1 – R6)

ข้อกำหนดในหมวดนี้ถือเป็น **SHALL** (ต้องปฏิบัติตามโดยไม่มีข้อยกเว้น)

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

### R1. หน่วยงานและการแตกย่อย (Unit Decomposition)

1. **Skeleton per Feature**: ก่อนเริ่มการเขียนโค้ด แต่ละ Feature ต้องมีโครงสร้างไฟล์ (Skeleton) ถูกสร้างไว้ล่วงหน้า
2. **Packet = FR × Layer**: หน่วยงานในการ implement ที่เล็กที่สุดคือ **Packet** ซึ่งเกิดจาก Cartesian Product ระหว่าง Functional Requirement (FR) กับ Layer ทางสถาปัตยกรรม:
   $$\text{Packet} = \text{FR} \times \text{Layer}, \quad \text{Layer} \in \{\text{schema}, \text{service}, \text{contract/route}, \text{ui}\}$$
   - `schema`: Data models, Structs, Enums, Serialization schemas
   - `service`: Core business logic, pure algorithms, state management logic
   - `contract/route`: Tauri IPC commands, HTTP routes, IPC events, API handlers
   - `ui`: Presentation components, DOM event handlers, CSS visual states
3. **AC = 1 Test**: แต่ละ Acceptance Criterion (AC) ในข้อกำหนด FR ต้องมี Unit Test รับผิดชอบตรงกันอย่างน้อย 1 Test Case แบบ 1:1
4. **TC = Integration**: Test Case (TC) ระดับ Feature คือ Integration Test ที่รวมการทำงานของทุก packet ใน Feature เข้าด้วยกัน

### R2. การล็อกอินเทอร์เฟซ (Interface Lock & Change Control)

1. **SDD Pre-requisites**: ก่อนที่ Packet ใดๆ จะถูกปล่อย (Issue) ออกมาให้ Coder สเปกใน SDD ต้องประกาศข้อมูล 4 ประการครบถ้วนและล็อกสถานะ (`LOCKED`):
   - **Component (`CMP`)**: ตำแหน่งไฟล์และ Symbol path ที่แน่นอน (เช่น `src-tauri/src/commands/models.rs::dedup_models`)
   - **Signature**: ชื่อฟังก์ชัน, ชนิดข้อมูลของ Input parameters, และ Return type
   - **Data Schema**: โครงสร้าง Struct / DTO พร้อมชนิดตัวแปรและ serde constraints
   - **Port / Channel**: ชื่อ Tauri IPC command, HTTP route หรือ Event name
2. **Design Change Protocol**: หาก Coder พบว่าไม่สามารถทำให้ AC ผ่านได้หากไม่แก้ Signature หรือเปลี่ยน Return type:
   - **SHALL HALT IMMEDIATELY**: Coder ต้อง **หยุดทำงานทันที** ห้ามแก้ Signature เองโดยเด็ดขาด
   - **Escalation**: ตีกลับงานให้ **Architect** เพื่อพิจารณาปรับแก้ SDD และออก Interface Lock รอบใหม่

### R3. เนื้อหาบังคับใน Packet (Mandatory Packet Anatomy)

ทุก Packet ต้องถูกจัดทำเป็นเอกสาร Markdown ที่มีสาระสำคัญครบทั้ง 9 หัวข้อดังนี้:

| ลำดับ | ส่วนประกอบ | รายละเอียดข้อบังคับ |
|:---:|---|---|
| 1 | **Statement** | คำสั่งชัดเจน 1 ประโยค ระบุผลลัพธ์ที่ต้องการของ packet นี้ |
| 2 | **Acceptance Criteria (AC)** | เกณฑ์ยอมรับที่ตัดมาเฉพาะส่วนของ Layer นั้น พร้อมเงื่อนไข Expected output |
| 3 | **Relevant SDD Section** | ตัดเนื้อหาจาก SDD เฉพาะส่วนที่เกี่ยวข้องโดยตรง (ห้ามแปะทั้งเล่ม) |
| 4 | **API / EVT Specification** | Function signature, IPC command payload, หรือ Event schema |
| 5 | **BR / SEC** | Business Rules (เช่น ตาราง Priority) และข้อกำหนดความปลอดภัย (Security constraints) |
| 6 | **Guard Rails** | ข้อห้ามทางสถาปัตยกรรม บังคับอิง [ADR-100](../adr/ARCHITECTURE.md#adr-100-code--component-boundary-guard-rails) และ [ARCH-001 §4](../adr/ARCHITECTURE.md#arch-001-architectural-invariants--layering-constraints) |
| 7 | **Current CMP Code** | ซอร์สโค้ดปัจจุบันของ Component นั้น เพื่อให้ Coder มีบริบทในการต่อยอด |
| 8 | **Target TC** | รหัส Integration Test (TC-xxx) ที่ Packet นี้สังกัดอยู่ |
| 9 | **Token Ceiling** | เพดาน Token สูงสุดที่อนุญาตให้ Coder Prompt ใช้ (ค่ามาตรฐาน: 4,000 – 8,000 tokens) |

### R4. นิยามความเสร็จสมบูรณ์ (Definition of Done: DoD)

Packet จะได้รับการอนุมัติให้ปิดและควบรวม (Merged/Closed) ได้ต่อเมื่อผ่านเกณฑ์ครบทั้ง 4 ข้อ:

1. **AC Unit Tests Pass (Green)**: Unit test ประจำ packet ผ่าน 100%
2. **Complete @trace Annotations**: มีการใส่แท็กความสัมพันธ์ตาม [ANN-001 (STD-002)](../annotations/ANN-001-annotation-language.md):
   - โค้ดใน CMP มี `// trace:implements FR-xxx`
   - เทสต์มี `// trace:verifies FR-xxx`
3. **`validate-docs` Status 0/0**: เครื่องมือตรวจ doc-graph และ trace annotation รายงาน **0 Errors, 0 Warnings**
4. **Boundary Isolation (Zero Leaks)**: แก้ไขเฉพาะไฟล์ที่ประกาศใน `CMP` ของ packet เท่านั้น หากพบการแตะไฟล์นอกประกาศ ให้ถือว่าตกการตรวจทันที

### R5. ลำดับงานและการป้องกันการชน (Sequencing & Mutex)

1. **Foundation First**: ต้อง implement โครงสร้างพื้นฐานก่อนเสมอ (`PRJ` project setup, `IAM` permission, `AppState`, Core types)
2. **Topological Ordering**: การรัน packet ต้องเรียงตามลำดับ Topological Sort ของ `depends_on` ใน FR
3. **Layer Progression**: ภายใน FR เดียวกัน ต้องทำตามลำดับชั้น:
   $$\text{schema} \longrightarrow \text{service} \longrightarrow \text{contract/route} \longrightarrow \text{ui}$$
4. **Single-Writer Invariant (Mutual Exclusion)**:
   - **ห้ามเด็ดขาด** ไม่ให้มี Packet มากกว่า 1 ตัวเขียนลงใน Component (`CMP`) เดียวกันในเวลาเดียวกัน
   - หากมีหลาย Packet ต้องการแก้ไขไฟล์เดียวกัน ต้องจัดคิวทำแบบ Sequential เท่านั้น

### R6. หลักฐานและสมุดประวัติ (Evidence & Lineage Ledger)

1. ทุก Packet ที่ผ่าน DoD ต้องบันทึกประวัติแบบ Append-only ลงใน `docs/lineage/packet-lineage.jsonl`
2. ข้อมูลต้องเป็น **Lineage Record** ไม่ใช่ log ชั่วคราว โดยมี schema บังคับ:
   - `packet_id`: รหัสประจำตัวของ Packet
   - `fr_id`: รหัส Requirement
   - `layer`: ชั้นงาน (`schema` | `service` | `route` | `ui`)
   - `cmp`: File path และ Symbol เป้าหมาย
   - `model`: ชื่อ/รุ่นของ AI โมเดลที่ทำหน้าที่ Coder (หรือ `human`)
   - `timestamp`: เวลาที่ผ่านการตรวจ (ISO-8601)
   - `test_result`: สถานะผลเทสต์, จำนวนเทสต์, ระยะเวลา (ms)
   - `target_tc`: Integration Test ที่ผูกอยู่
   - `git_commit`: Commit hash หลังผ่านการตรวจ
   - `reviewed_by`: ชื่อ Reviewer agent หรือผู้ตรวจ

---

## 3. Local Multi-Agent Workflow (กระบวนการทำงานแบบ Multi-Agent)

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
                             │ ลำดับคิว Packet
                             ▼
 ┌─────────────►  ┌──────────────────────┐
 │                │        Tester        │
 │                │  (เขียน Unit Test    │
 │                │   จาก AC: Test-First)│
 │                └──────────┬───────────┘
 │                           │ Test พร้อม (Red Phase)
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

### 3.1 บทบาทและความรับผิดชอบ (Roles & Responsibilities)

| บทบาท | หน้าที่รับผิดชอบ | สิ่งที่ห้ามทำ |
|---|---|---|
| **Architect** | - ออกแบบและยืนยัน SDD<br>- สร้าง Skeleton โครงไฟล์<br>- ประกาศและล็อก Interface (CMP, Signature, Port) | ห้ามลงไปเขียนโค้ดเนื้อในของฟังก์ชันใน packet |
| **Tester** | - นำ AC จาก packet มาเขียนเป็น Unit Test ล่วงหน้า (Test-First / TDD)<br>- ติดแท็ก `// trace:verifies FR-xxx`<br>- ยืนยันว่าเทสต์ Fail ก่อนเริ่มส่งโค้ด (Red Phase) | ห้ามแก้ไขโค้ด Business logic ใน CMP |
| **Coder** | - รับงานครั้งละ **1 Packet เท่านั้น** (Local LLM)<br>- เขียนโค้ดภายใน CMP ที่กำหนดเพื่อให้ Unit Test ผ่าน (Green Phase)<br>- ติดแท็ก `// trace:implements FR-xxx`<br>- ควบคุมบริบทให้อยู่ใต้ Token Ceiling | ห้ามเปลี่ยน Signature โดยพลการ<br>ห้ามแก้ไขไฟล์นอก CMP<br>ห้ามทำเกินขอบเขตของ AC |
| **Reviewer** | - ตรวจสอบเฉพาะความสอดคล้องตาม **R4 Definition of Done**<br>- รัน unit tests, ตรวจ `@trace`, รัน `validate-docs`, ตรวจ git diff | **ห้ามตรวจ Style หรือความชอบส่วนตัว** (เช่น spaces, indentation ให้ linter จัดการ) |

### 3.2 ขั้นตอนการทำงาน (Lifecycle Stages)

1. **Feature Selection**: เลือก Feature จาก backlog ใน `docs/TASKS.md`
2. **SDD Readiness Gate**: ตรวจสอบว่า SDD มี AC, Data Models และ Component mappings ครบถ้วน
3. **Interface Locking**: Architect ประกาศสถานะ `INTERFACE_LOCKED` สำหรับ Feature นั้น
4. **Queue Generation**: รัน `node scripts/packet.mjs --queue` เพื่อสร้างลำดับการทำงานตาม R5
5. **Execution Cycle ต่อ Packet**:
   - **Tester**: สร้าง Unit Test file จาก AC
   - **Coder**: Local LLM implement โค้ดใน CMP
   - **Reviewer**: ตรวจสอบเกณฑ์ R4
6. **Feature Integration Gate**: รัน Integration Test (`TC`) รวมทุก packet ใน Feature
7. **Closure & Ledger**: บันทึก Lineage Record ลง `docs/lineage/packet-lineage.jsonl` และ commit

### 3.3 เส้นทางจัดการความล้มเหลว (Failure Paths & Circuit Breakers)

เพื่อตัดวงจร infinite loop ในกรณี AI แก้ไขงานไม่สำเร็จ บังคับใช้เกณฑ์การหยุดงาน (Circuit Breakers):

| รหัสข้อผิดพลาด | อาการที่พบ | ปฏิกิริยาของระบบ (System Action) |
|---|---|---|
| **FP-01** | Coder ต้องการแก้ Function Signature หรือ Return type | **HALT**: ห้ามแก้เอง ตีกลับเป็น Issue ระดับ Design Change ให้ Architect |
| **FP-02** | Acceptance Criteria (AC) กำกวม ขัดแย้ง หรือไม่เพียงพอ | **HALT**: ยุติการเขียนโค้ด ส่งกลับให้ Requirement Author ชี้แจง |
| **FP-03** | Coder แก้โค้ดแล้ว Unit Test ไม่ผ่านติดต่อกัน **2 รอบ** (Two-Strike Rule) | **HALT**: ห้ามวนซ้ำรอบที่ 3 บันทึกเป็น Implementation Defect Escalate ให้คนหรือ Architect ช่วยวิเคราะห์ |

---

## 4. โครงสร้างไฟล์มาตรฐานใน Repo

เพื่อให้สอดคล้องกับมาตรฐานนี้ โครงสร้างไฟล์ใน Repository มีการจัดวางดังนี้:

```
docs/
├── standards/
│   └── STD-003-implementation-unit-and-packet.md  ← มาตรฐานฉบับนี้
├── annotations/
│   └── ANN-001-annotation-language.md             ← มาตรฐาน STD-002 (Annotation)
├── packets/                                       ← แหล่งเก็บไฟล์ Packet แต่ละตัว
│   └── PKT-FR003-SERVICE.md
├── lineage/                                       ← สมุดประวัติ Lineage Ledger
│   └── packet-lineage.jsonl
└── requirements/                                  ← ข้อกำหนดต้นทาง (FR/NFR)
scripts/
└── packet.mjs                                     ← เครื่องมือ CLI จัดคิวและตรวจสอบ R1-R6
```

---

## 5. การบังคับใช้ผ่านคำสั่งอัตโนมัติ (CLI Automation)

สามารถเรียกใช้งานคำสั่งสนับสนุนมาตรฐานได้จาก `package.json`:

```bash
# ตรวจสอบคิว Packet ทั้งระบบตาม R5
npm run packet -- --queue

# ตรวจสอบคิวเฉพาะ Feature
npm run packet -- --feature FEAT-006

# ตรวจสอบเกณฑ์ R4 Definition of Done
npm run packet -- --verify <PACKET-ID>
```
