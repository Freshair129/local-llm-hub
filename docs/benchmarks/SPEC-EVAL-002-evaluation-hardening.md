# Local LLM Hub — Evaluation Hardening & Six-Benchmark Test Specification

**Document ID:** `SPEC-EVAL-002`  
**Version:** `1.0.0`  
**Status:** Implementation Ready  
**Target Repository:** `Freshair129/local-llm-hub`  
**Primary Goal:** เปลี่ยนระบบประเมิน Local Coding Agent จาก benchmark ภายในที่มีโอกาส overfit / leakage ให้เป็นระบบทดสอบที่วัดได้จริง เปรียบเทียบกับ Codex ได้ และใช้ตัดสินใจ routing งาน Local vs Frontier ได้

---

# 1. Executive Summary

ปัจจุบัน `local-llm-hub` มีองค์ประกอบที่ดีอยู่แล้ว ได้แก่:

- Multi-agent roles: Explorer → Worker → Verify → Test → Review
- Model specialization
- Benchmark harness
- Model statistics
- Project-specific guard rails
- Code review benchmark
- Code generation benchmark
- Packet / traceability workflow

แต่ implementation ปัจจุบันยังมีช่องว่างระหว่าง **“LLM บอกว่าผ่าน”** กับ **“ระบบพิสูจน์ว่าผ่านจริง”**

เป้าหมายของเอกสารนี้คือเพิ่ม evaluation framework 6 ฐาน พร้อม Hard Verification Gates เพื่อให้ตอบคำถามได้อย่างมีหลักฐานว่า:

1. Local model เขียนโค้ดได้ถูกต้องแค่ไหน
2. Local agent แก้ issue ใน repo จริงได้แค่ไหน
3. Local reviewer ตรวจ defect ได้จริงหรือไม่
4. Local agent ทำงานของ FUNG / Lalin / G-Maiden / Zuri / Local LLM Hub ได้ดีแค่ไหน
5. งานประเภทใดควร Local-only
6. งานประเภทใดควรส่ง Codex มา plan / review / own task
7. Pro $200 เพียงพอหรือจำเป็นต้องขยับเป็น tier สูงกว่า

---

# 2. ช่องโหว่ / Evaluation Gaps ที่พบในระบบปัจจุบัน

## GAP-001 — Spec Gate ยัง Hard-coded

ใน `scripts/run_multi_agent_pipeline.mjs` acceptance criteria ถูกสร้างเป็นค่าคงที่ เช่น:

- prevent unhandled promise rejection
- async state unlock
- zero-panic reliability

ปัญหา:

- AC ไม่ได้ derive จาก requirement/task จริง
- Task คนละประเภทอาจถูกตัดสินด้วย AC เดิม
- เกิด false pass ได้ง่าย
- benchmark ดูดีแม้ implementation ไม่ตรง requirement

### Required Fix

สร้าง `SpecContractBuilder` ที่ derive contract จาก:

1. User task
2. Requirement documents
3. Target files
4. Existing tests
5. Repository rules / ADR / AGENTS
6. Domain constraints

Output ต้อง validate ด้วย JSON Schema ก่อน Worker เริ่มทำงาน

---

## GAP-002 — Context Retrieval เป็นการตัดข้อความแบบตายตัว

ตัวอย่างปัจจุบันมี pattern เช่น:

```js
fileContent.slice(0, 8000)
workerOut.text.slice(0, 4000)
workerOut.text.slice(0, 3000)
```

ปัญหา:

- function สำคัญอาจอยู่ท้ายไฟล์
- cross-file dependency หาย
- reviewer อาจไม่ได้เห็น bug ที่ Worker สร้าง
- large repo task ถูกประเมินเหมือน single-file task

### Required Fix

แทนที่ raw slicing ด้วย `ContextBuilder`:

```text
Task
  ↓
Repo Index
  ↓
Symbol Search
  ↓
Dependency Expansion
  ↓
Targeted Context Pack
```

Context pack ควรประกอบด้วย:

- target symbols
- callers/callees
- interfaces/types
- neighboring tests
- requirement/ADR snippets
- relevant git diff
- token budget metadata

---

## GAP-003 — Worker Output ยังไม่เป็น Patch Contract ที่บังคับใช้จริง

ปัจจุบัน Worker สามารถตอบเป็น code/prose ได้ แต่ pipeline ยังไม่ได้ enforce ว่า:

- ต้องเป็น unified diff
- patch apply ได้จริง
- ห้ามแก้นอก target scope
- changed file list ตรง contract

### Required Fix

สร้าง `PatchArtifact` schema:

```json
{
  "task_id": "TASK-...",
  "base_commit": "...",
  "files": [
    {
      "path": "src/foo.rs",
      "patch": "...",
      "reason": "..."
    }
  ]
}
```

จากนั้น:

1. parse
2. schema validate
3. apply ใน isolated worktree
4. reject ถ้าแตะ path นอก scope
5. generate canonical `git diff`

---

## GAP-004 — Verify Gate ใช้ String Matching เป็น Verdict

logic ปัจจุบันมีลักษณะ:

```js
!output.includes('"FAILED"')
```

ปัญหา:

- malformed JSON อาจถูกนับผ่าน
- model อาจเขียน `"not FAILED"` แล้ว logic ผิด
- ไม่มี schema validation
- ไม่สามารถแยก fatal / warning / confidence ได้

### Required Fix

ใช้ strict structured output:

```json
{
  "schema_version": 1,
  "verdict": "PASS|FAIL|ESCALATE",
  "blocking_findings": [],
  "warnings": [],
  "ac_results": {},
  "confidence": 0.0
}
```

เงื่อนไข:

- JSON parse fail = FAIL
- schema fail = FAIL
- missing AC = FAIL
- confidence ต่ำกว่า threshold = ESCALATE

---

## GAP-005 — Test Gate ยังเป็น LLM Critique มากกว่า Test Execution

ใน specification ระบุว่า Test Gate ต้องรัน:

- `cargo test`
- `npm test`
- integration tests

แต่ implementation ปัจจุบันยังส่ง code ให้ model “ประเมิน” เป็นหลัก

นี่เป็น gap ที่สำคัญที่สุด

### Required Fix

Test Gate ต้องเรียก deterministic tools จริง:

```text
Patch Applied
   ↓
Formatter
   ↓
Type Check
   ↓
Compiler
   ↓
Unit Tests
   ↓
Integration Tests
   ↓
Static Analysis
   ↓
Security Checks
```

LLM Test Reviewer ใช้เฉพาะ:

- สร้าง test เพิ่ม
- วิเคราะห์ failure
- หา missing edge cases

แต่ **LLM ห้ามเป็น source-of-truth ว่า test ผ่าน**

---

## GAP-006 — Circuit Breaker ใน Spec ยังไม่ครบใน Runtime

เอกสารกำหนด max retry และ escalation แต่ runtime pipeline ปัจจุบันยังไม่ได้ implement loop แบบ state machine เต็มรูปแบบ

### Required Fix

State machine:

```text
IMPLEMENT
  ↓
VERIFY
  ├─ PASS → TEST
  └─ FAIL → retry_count + 1
                │
                ├─ <= 2 → REPAIR
                └─ > 2  → ESCALATE
```

ทุก retry ต้องบันทึก:

- failure signature
- previous patch hash
- reviewer feedback
- changed lines
- token use
- wall time

---

## GAP-007 — ไม่มี Isolated Sandbox / Worktree ต่อ Task

ถ้า agent แก้ working tree จริงโดยตรง:

- task สองตัวชนกันได้
- rollback ไม่ deterministic
- benchmark contamination
- state จาก task ก่อนส่งผล task หลัง

### Required Fix

ทุก eval/task ต้องมี:

```text
git worktree
+ clean base commit
+ isolated temp directory
+ isolated test artifacts
```

ห้าม benchmark บน dirty working tree

---

## GAP-008 — Reviewer Correlated Error

หลาย role ใช้ Mellum2 family เดียวกัน:

- Explorer
- Worker
- Escalator
- Reviewer

ข้อดีคือ cache/runtime efficiency  
ข้อเสียคือ blind spot อาจซ้ำกัน

### Required Fix

Final verification ควรใช้ heterogeneous reviewers:

- Worker family A
- Reviewer family B
- deterministic compiler/test
- optional Frontier judge เฉพาะ high-risk

ห้ามใช้ LLM agreement เป็นหลักฐานเพียงอย่างเดียว

---

## GAP-009 — Benchmark ปัจจุบันมี Sample Size เล็กเกินไป

ตัวอย่าง code-generation guardrail benchmark หลักมีเพียงไม่กี่ task

`100/100` จึงหมายถึง:

> ผ่าน rubric ใน task ชุดนี้

ไม่ใช่:

> reliability 100%

### Required Fix

อย่างน้อย:

- development set: 50+
- hidden validation set: 100+
- release qualification set: 200+ task-equivalents

และ report ต้องแสดง denominator ทุกครั้ง เช่น:

```text
87 / 100 tasks passed
```

ห้ามแสดงเพียง `87%`

---

## GAP-010 — Benchmark Leakage / Overfitting Risk

ปัจจุบัน:

- prompt
- benchmark
- expected rules
- project docs
- model selection logic

อยู่ใน repo เดียวกันจำนวนมาก

Agent ที่มี repo access อาจเห็นข้อมูลที่ใช้เป็น ground truth ได้

### Required Fix

แยก:

```text
eval/
  public/

private-eval-store/
  hidden/
  answer-keys/
```

Hidden tests / expected patches / injected defects ต้องอยู่นอก context ของ agent

---

## GAP-011 — “temperature = 0” ไม่ควรถูกเรียกว่า Deterministic 100%

แม้ temperature 0 จะลด sampling variance แต่ผลยังอาจเปลี่ยนจาก:

- runtime
- CUDA kernels
- prompt formatting
- model/runtime version
- batching
- backend implementation

### Required Fix

ใช้คำว่า:

`low-variance deterministic decoding configuration`

และวัดซ้ำอย่างน้อย 3–5 runs สำหรับ benchmark สำคัญ

---

## GAP-012 — ไม่มี Statistical Reliability

benchmark ปัจจุบันเน้น single run

### Required Fix

รายงาน:

- mean
- median
- stddev
- min/max
- 95% CI เมื่อ sample size เพียงพอ
- pass@1
- pass@k (ถ้าอนุญาต retry)
- retry-adjusted success

---

## GAP-013 — Benchmark Metadata Drift

Machine/runtime metadata ต้องเป็น source-of-truth เดียวกัน

พบความเสี่ยงจากเอกสารที่ระบุ RAM/hardware profile ต่างกันในคนละส่วน

### Required Fix

สร้าง machine manifest:

```json
{
  "machine_id": "...",
  "cpu": "...",
  "ram_gb": 32,
  "gpu": [...],
  "driver": "...",
  "runtime": "...",
  "git_commit": "..."
}
```

Generate report จาก manifest เท่านั้น ห้าม hard-code hardware ใน Markdown

---

## GAP-014 — ยังไม่มี Codex Control Group

ถ้าจะตัดสินว่า Local แทน Codex ได้หรือไม่ ต้องให้ทั้งสองระบบทำ task ชุดเดียวกัน

### Required Fix

ทุก benchmark สำคัญต้องรองรับ:

```text
candidate = local
control   = codex
```

และ compare:

- success
- retries
- latency
- tokens
- cost
- regression
- review recall
- human intervention

---

# 3. Hard Verification Gates — ใช้ร่วมกับทุก Benchmark

ก่อนคะแนน LLM จะถูกนับ ต้องผ่าน gate ที่ deterministic ก่อน

## HG-01 Patch Validity

- patch parse ได้
- apply clean
- ไม่มี binary corruption
- ไม่มี path traversal
- ไม่แตะ file นอก contract

## HG-02 Build / Compile

ตาม project:

```text
Rust       cargo check / cargo test
TS/JS      tsc --noEmit / npm test
Python     pytest / compileall / mypy ตามที่ repo กำหนด
Go         go test ./...
Java       mvn test / gradle test
```

Compile fail = task fail

## HG-03 Existing Regression Tests

tests เดิมทั้งหมดที่เกี่ยวข้องต้องผ่าน

## HG-04 Hidden Tests

agent ต้องไม่เห็น hidden test source

## HG-05 Security / Static Checks

อย่างน้อย:

- secret scan
- dependency risk ตาม project
- path traversal / auth / injection rules
- Rust forbidden panic rules หาก project กำหนด

## HG-06 Scope Check

เปรียบเทียบ changed files กับ `target_files` และ `allowed_paths`

---

# 4. Six-Benchmark Evaluation Standard

ระบบใหม่ต้องมี 6 ฐานการทดสอบ

---

# BASE-1 — Function Correctness Benchmark

## Purpose

วัดความสามารถพื้นฐานในการเขียน function ให้ถูกต้อง

## Dataset

- HumanEval+
- MBPP+
- EvalPlus extended tests

## Metrics

- pass@1
- compile rate
- hidden-test pass rate
- runtime error rate
- average retries
- tokens/success
- wall-time/success

## Rule

ห้ามใช้ public visible tests เพียงอย่างเดียว  
ต้องรัน extended/hidden tests

## Suggested Qualification

Local model ผ่านฐานนี้เมื่อ:

```text
compile_rate >= 95%
hidden_test_pass_rate >= 80%
```

Threshold ต้อง config ได้ ห้าม hard-codeเป็น universal truth

---

# BASE-2 — Practical Code Composition Benchmark

## Purpose

วัดการเขียนโค้ดที่ต้องใช้ library/API หลายตัวและ requirement ซับซ้อนกว่า function toy problem

## Dataset

- BigCodeBench
- BigCodeBench-Hard

## Metrics

- pass@1
- library/API correctness
- import correctness
- runtime correctness
- dependency hallucination rate
- forbidden API use rate

## Additional Failure Labels

```text
IMPORT_ERROR
API_HALLUCINATION
WRONG_SIGNATURE
RUNTIME_ERROR
PARTIAL_IMPLEMENTATION
```

---

# BASE-3 — Fresh / Contamination-Resistant Coding Benchmark

## Purpose

ลดความเสี่ยงที่ model จำ benchmark จาก training data

## Dataset

- LiveCodeBench
- ใช้โจทย์ใหม่ตาม cutoff window

## Run Policy

บันทึก:

- problem release date
- model release/train cutoff ถ้าทราบ
- benchmark snapshot version

## Metrics

- pass@1
- execution accuracy
- test-output prediction accuracy
- difficulty-stratified accuracy

## Qualification

ต้อง report แยก Easy / Medium / Hard  
ห้ามใช้ aggregate อย่างเดียว

---

# BASE-4 — Repository-Level Issue Resolution

## Purpose

วัดความสามารถแบบ Codex/SWE Agent จริง:

> อ่าน repo → เข้าใจ issue → แก้หลายไฟล์ → test → ส่ง patch

## Dataset

- SWE-bench Verified

## Initial Scope

เริ่มด้วย stratified sample 30–50 tasks ก่อน full 500

ตัวอย่าง:

```text
Easy     15
Medium   20
Hard     15
```

## Metrics

- issue resolved rate
- patch apply rate
- test pass rate
- regression rate
- average files changed
- average retries
- time-to-resolution
- tokens/resolved-task
- cost/resolved-task

## Hard Rule

`Resolved` ต้องมาจาก test harness ไม่ใช่ LLM judge

---

# BASE-5 — Private Project Hidden Regression Benchmark

## Purpose

วัดว่า Local Agent เหมาะกับงานจริงของผู้ใช้หรือไม่

## Target Projects

อย่างน้อย:

- local-llm-hub
- FUNG
- Lalin-AI
- G-Maiden
- Zuri-Go
- Zuri.ai

## Dataset Design

ขั้นต่ำ 100 hidden tasks

Suggested distribution:

| Category | Count |
|---|---:|
| Rust implementation | 20 |
| TypeScript / JavaScript | 15 |
| Python / API | 10 |
| Bug fixing | 15 |
| Concurrency / async | 10 |
| Security / validation | 10 |
| Refactor / architecture | 10 |
| Tests | 5 |
| Docs / traceability | 5 |

## Task Types

แต่ละ task ต้องมี:

```json
{
  "task_id": "...",
  "repo": "...",
  "base_commit": "...",
  "request": "...",
  "visible_context_policy": "...",
  "hidden_tests": "...",
  "allowed_paths": [],
  "risk_level": "LOW|MEDIUM|HIGH"
}
```

## Anti-Leak Rule

Answer key / hidden tests ห้ามอยู่ใน repository ที่ agent อ่านได้

## Metrics

- exact task success
- regression-free success
- first-pass success
- retry-adjusted success
- scope violation rate
- human intervention rate

---

# BASE-6 — Reviewer / Defect Detection Benchmark

## Purpose

พิสูจน์ว่า Local Review Gate ตรวจ bug จริงได้หรือเพียงให้ critique ดูดี

## Method

ใช้ code ที่ถูกต้อง แล้ว inject defect ที่รู้ ground truth

### Defect Taxonomy

อย่างน้อย:

1. null dereference
2. unhandled promise
3. missing await
4. race condition
5. deadlock risk
6. off-by-one
7. incorrect bounds check
8. path traversal
9. SQL injection
10. command injection
11. auth bypass
12. missing authorization check
13. unsafe deserialization
14. resource leak
15. panic / unwrap policy violation
16. wrong transaction boundary
17. stale cache
18. state desync
19. TOCTOU
20. test coverage gap

## Dataset

ขั้นต่ำ:

- 100 injected defects
- 20 clean controls ที่ไม่มี defect

## Metrics

### Recall

```text
true defects found / total injected defects
```

### Precision

```text
true defects found / all reported defects
```

### False Positive Rate

```text
false alarms / clean opportunities
```

### Severity-weighted Miss Rate

Critical/Security defect ที่พลาดต้องลงโทษมากกว่าปัญหา style

## Qualification Example

```text
overall_recall >= 85%
critical_recall >= 95%
precision >= 75%
```

Threshold ต้อง config ได้

---

# 5. Codex vs Local Comparative Evaluation

ทุกฐานที่ทำได้ควรมี Control Group

```text
LOCAL
vs
CODEX
```

## Required Metrics

| Metric | Local | Codex |
|---|---:|---:|
| pass@1 | | |
| resolved task rate | | |
| retries | | |
| wall time | | |
| input tokens | | |
| output tokens | | |
| estimated cost | | |
| human intervention | | |
| regression rate | | |
| review recall | | |

ห้ามสรุปจาก model score เพียงอย่างเดียว

Metric หลักสำหรับ business decision:

```text
Cost per Successful Task
```

และ:

```text
Successful Tasks per 100 Requests
```

---

# 6. Routing Qualification Matrix

หลังมีผล benchmark ให้สร้าง policy อัตโนมัติ

## Tier L0 — Local Only

อนุญาตเมื่อ:

- risk LOW
- task category มี historical local success >= threshold
- tests ครบ
- diff size ต่ำ
- ไม่มี sensitive domain

ตัวอย่าง:

- formatting
- small CRUD
- isolated function
- docs
- unit tests
- boilerplate
- simple UI

## Tier L1 — Codex Plan → Local Implement

ใช้เมื่อ:

- medium complexity
- 2–5 files
- requirement ต้อง decomposition
- local implementation success สูง

Codex ทำ:

- plan
- AC
- boundaries
- invariants

Local ทำ:

- implementation
- tests
- review

## Tier L2 — Codex Plan + Local + Codex Review

ใช้เมื่อ:

- auth
- database migration
- concurrency
- security
- distributed state
- high blast radius
- local reviewer disagreement
- retry >= 2

## Tier L3 — Codex Owns Task

ใช้เมื่อ:

- novel architecture
- repo-wide extraction
- ambiguous requirements
- repeated local failure
- high-risk production incident

---

# 7. Risk Score Specification

สร้าง `risk_score` 0–100

ตัวอย่าง weight:

```text
+25 touches auth/security
+20 database migration
+15 concurrency/async
+15 > 5 files
+10 diff > 500 LOC
+10 cross-domain
+10 tests missing
+10 local retry >= 2
+10 reviewer disagreement
```

Routing ตัวอย่าง:

```text
0–24   Local Only
25–49  Codex Plan → Local
50–74  Codex Plan + Final Review
75+    Codex Owns
```

Weight/threshold ต้อง config ได้

---

# 8. Reproducibility Specification

ทุก run ต้อง bind กับ:

```text
Benchmark ID
Task ID
Run ID
Model ID
Model Hash
Quantization
Sampling Settings
Machine ID
Runtime ID
Runtime Version
Driver Version
Git Commit
Date
```

Output example:

```json
{
  "run_id": "RUN-...",
  "benchmark_id": "BASE-5",
  "task_id": "FUNG-BUG-017",
  "model": {
    "id": "...",
    "sha256": "...",
    "quant": "Q4_K_M"
  },
  "machine": "MACH-LOCAL-RTX3060-I7",
  "runtime": "OLLAMA-...",
  "repo_commit": "...",
  "result": {
    "compile": true,
    "tests": 42,
    "failed_tests": 0,
    "success": true
  }
}
```

---

# 9. Multi-Run Policy

สำหรับ model benchmark:

- Quick dev run: 1 run
- Validation: 3 runs
- Release qualification: 5 runs

Report:

```text
pass@1
mean latency
median latency
stddev
min/max
```

ถ้า result ไม่เสถียร ให้ flag:

`NON_DETERMINISTIC`

---

# 10. Directory Structure

Recommended:

```text
eval/
├── config/
│   ├── thresholds.yaml
│   ├── risk-policy.yaml
│   └── model-registry.yaml
│
├── public/
│   ├── evalplus/
│   ├── bigcodebench/
│   ├── livecodebench/
│   └── swebench/
│
├── project/
│   ├── local-llm-hub/
│   ├── fung/
│   ├── lalin/
│   ├── g-maiden/
│   ├── zuri-go/
│   └── zuri-ai/
│
├── reviewer/
│   ├── injectors/
│   ├── taxonomy.yaml
│   └── clean-controls/
│
├── harness/
│   ├── runner/
│   ├── sandbox/
│   ├── patch/
│   ├── tests/
│   └── scoring/
│
└── reports/
    ├── runs/
    ├── scorecards/
    └── comparisons/
```

Hidden answer keys ควรเก็บนอก repo หรือ encrypted/private store

---

# 11. Scoring Model

ห้ามใช้คะแนนเดียวโดยไม่มี raw metrics

Suggested composite score:

| Dimension | Weight |
|---|---:|
| Correctness | 30% |
| Repo Task Success | 25% |
| Regression Safety | 15% |
| Review Accuracy | 15% |
| Efficiency / Cost | 10% |
| Latency | 5% |

แต่ UI/report ต้องแสดง raw metrics เสมอ

ตัวอย่าง:

```text
Overall Score: 84.2

Correctness        91%
Repo Success       78%
Regression Safety  96%
Review Recall      87%
Cost/Success       $0.04
Median Time        92s
```

---

# 12. Release Qualification Gate

Local agent จะได้รับสถานะ `PRODUCTION_CODING_WORKER` เมื่อ:

1. BASE-1 ผ่าน threshold
2. BASE-2 ผ่าน threshold
3. BASE-3 ไม่มี contamination anomaly ร้ายแรง
4. BASE-4 repo resolution ผ่าน threshold ที่กำหนด
5. BASE-5 private tasks >= target
6. BASE-6 reviewer critical recall >= target
7. scope violation = 0 สำหรับ release qualification
8. security critical miss = 0
9. reproducibility metadata ครบ
10. benchmark run บน clean commit

---

# 13. Stop Conditions / Invalid Benchmark Conditions

ผล benchmark ต้องถูก mark `INVALID` ถ้า:

- dirty worktree
- hidden test leaked
- answer key accessible
- model changed mid-run
- runtime changed mid-run
- GPU OOM แล้ว fallback CPU โดยไม่บันทึก
- test timeout โดยไม่มี label
- network dependency unavailable
- external API rate limit
- benchmark task corrupt
- evaluator crash

ห้ามนับ INVALID เป็น PASS หรือ FAIL

---

# 14. Implementation Order สำหรับ Codex

## Phase 1 — Harden Existing Pipeline

1. สร้าง JSON Schemas
2. เปลี่ยน Verify Gate จาก string matching เป็น schema parser
3. implement PatchArtifact
4. isolated git worktree
5. actual compiler/test execution
6. retry state machine
7. structured run artifact

## Phase 2 — Build Evaluation Harness

1. `eval/harness`
2. common task schema
3. sandbox runner
4. result schema
5. scoring engine
6. report generator

## Phase 3 — Add Public Benchmarks

1. EvalPlus
2. BigCodeBench
3. LiveCodeBench
4. SWE-bench Verified sample

## Phase 4 — Build Private Benchmark

1. task extractor
2. hidden tests
3. project fixtures
4. 100-task validation set

## Phase 5 — Reviewer Benchmark

1. bug injectors
2. taxonomy
3. clean controls
4. precision/recall scorer

## Phase 6 — Codex Control Group

1. same task schema
2. Codex runner adapter
3. normalize outputs
4. cost tracking
5. side-by-side report

## Phase 7 — Router Policy

1. historical task success store
2. risk score
3. local/codex routing
4. automatic escalation
5. dashboard metrics

---

# 15. Minimum Acceptance Criteria สำหรับงานนี้

## AC-EVAL-001

`run_multi_agent_pipeline` ห้ามตัดสิน PASS จาก string matching

## AC-EVAL-002

Test Gate ต้องรัน deterministic test command จริงอย่างน้อยหนึ่ง command

## AC-EVAL-003

ทุก task รันใน isolated git worktree

## AC-EVAL-004

ทุก model output ที่เป็น contract ต้องผ่าน JSON Schema validation

## AC-EVAL-005

benchmark result ต้อง bind กับ machine/runtime/model/git metadata

## AC-EVAL-006

รองรับ 6 benchmark bases ตามเอกสารนี้

## AC-EVAL-007

รองรับ Local vs Codex control comparison

## AC-EVAL-008

Private hidden tests ต้องไม่ถูกส่งใน model context

## AC-EVAL-009

Reviewer benchmark ต้องรายงาน precision + recall ไม่ใช่ score เชิงความรู้สึก

## AC-EVAL-010

Dashboard/report ต้องแสดง `Cost per Successful Task`

## AC-EVAL-011

ถ้า test/compile fail task ต้อง fail แม้ LLM reviewer บอก PASS

## AC-EVAL-012

ห้ามใช้คำว่า deterministic 100% เพียงเพราะ temperature = 0

---

# 16. Deliverables ที่ Codex ต้องสร้าง

1. `eval/README.md`
2. `eval/schemas/task.schema.json`
3. `eval/schemas/result.schema.json`
4. `eval/schemas/review.schema.json`
5. `eval/config/thresholds.yaml`
6. `eval/config/risk-policy.yaml`
7. `eval/harness/run-eval.*`
8. `eval/harness/worktree-manager.*`
9. `eval/harness/patch-validator.*`
10. `eval/harness/test-runner.*`
11. `eval/harness/scorer.*`
12. `eval/harness/report-generator.*`
13. EvalPlus adapter
14. BigCodeBench adapter
15. LiveCodeBench adapter
16. SWE-bench adapter
17. Private project benchmark adapter
18. Reviewer injection benchmark
19. Local vs Codex comparison runner
20. migration/update ของ `scripts/run_multi_agent_pipeline.mjs`
21. tests ของ evaluation framework
22. sample benchmark report

---

# 17. Definition of Done

งานนี้ถือว่าเสร็จเมื่อ:

- six-base evaluation ใช้งานได้จริง
- public benchmark อย่างน้อย 2 ชุดรันได้ end-to-end
- SWE-bench sample รันได้อย่างน้อย 5 tasks
- private hidden benchmark อย่างน้อย 20 tasks
- reviewer benchmark อย่างน้อย 20 injected bugs + 5 clean controls
- Local vs Codex comparison report ถูก generate ได้
- compile/test gate เป็น deterministic source-of-truth
- pipeline ไม่มี string-based verdict
- benchmark artifacts reproducible
- documentation อธิบายวิธีเพิ่ม benchmark ใหม่
- CI มี smoke test ของ eval harness

---

# 18. Prompt สำหรับส่งต่อให้ Codex

ใช้ข้อความนี้เป็น implementation instruction:

> Implement `SPEC-EVAL-002` in `Freshair129/local-llm-hub`. Treat this document as the source of truth. First audit the existing multi-agent pipeline and benchmark harness against every GAP and AC. Do not rewrite working components unnecessarily. Create an implementation plan with dependency order, then execute in small reviewable commits. The highest priority is replacing LLM-simulated verification with deterministic patch application, compile/test execution, isolated git worktrees, schema-validated contracts, and reproducible run metadata. After hardening the pipeline, implement the six benchmark bases and Local-vs-Codex comparison. Do not claim a benchmark is production-valid until hidden-test isolation and reproducibility requirements are met. Preserve existing project traceability conventions and add explicit links from implementation files to `SPEC-EVAL-002`.

---

# 19. Intended Decision Output

เมื่อระบบนี้เสร็จ ต้องสามารถตอบได้จากข้อมูลจริงว่า:

```text
Task Category          Local Success   Codex Success   Recommended Route
-----------------------------------------------------------------------
Small Rust function       94%              98%        LOCAL
UI bug fix                91%              97%        LOCAL
Cross-file feature        82%              96%        CODEX PLAN + LOCAL
Concurrency bug           67%              93%        CODEX REVIEW
DB migration              58%              95%        CODEX OWN
```

เป้าหมายสุดท้ายไม่ใช่พิสูจน์ว่า Local “เก่งกว่า Codex”

แต่คือหา **boundary ที่วัดได้จริง** ว่า:

> งานไหน Local ทำได้คุ้มและปลอดภัย  
> งานไหนควรซื้อ intelligence จาก Codex

เมื่อมีข้อมูลนี้แล้วจึงค่อยตัดสินใจเรื่อง Codex $200 vs $500 จาก `Cost per Successful Task` และ `Escalation Rate` แทนการเดาจากจำนวน token
