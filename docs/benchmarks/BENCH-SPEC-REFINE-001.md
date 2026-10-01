# Benchmark Specification: Spec Refinement & Defect Detection (BENCH-SPEC-REFINE-001)

| Field | Value |
|---|---|
| **Benchmark ID** | `BENCH-SPEC-REFINE-001` |
| **Benchmark Name** | Local LLM Technical Spec Review & Gap Refinement Benchmark |
| **Domain** | SWE Documentation & Local Model Quality Assurance |
| **Status** | Active |
| **Hardware Target** | NVIDIA GeForce RTX 3060 12GB (CUDA 0), Intel Core i7-8700K |
| **Target Baseline** | [`feat-01-mellum12b-instruct.md`](file:///d:/local-llm-hub/feat-01-mellum12b-instruct.md) (Raw Unedited Draft) |
| **Reference Ground Truth** | [`docs/domains/network-distribution/features/FEAT-012-lan-share.md`](file:///d:/local-llm-hub/docs/domains/network-distribution/features/FEAT-012-lan-share.md) |

---

## 1. Benchmark Objective & Scope

ประเมินและวัดผลความสามารถของ Local LLMs ในการ:
1. **ตรวจจับข้อผิดพลาด (Defect & Hallucination Detection):** ชี้จุดบั๊กและข้อมูลเท็จในเอกสารทางเทคนิค (เช่น การอ้างอิงไฟล์ผิดโมดูล, Logging สับสนกับระบบอื่น)
2. **ปรับปรุงโครงสร้างเอกสาร (Markdown & Diagram Formatting):** แยกบรรทัดที่ติดกัน, แก้ไข Mermaid sequenceDiagram ให้อยู่ในบล็อกที่เรนเดอร์ได้
3. **ความถูกต้องของ Data Contract & Code Traceability:** ตรวจสอบความสอดคล้องกับ Rust Backend IPC และ Data Types
4. **การเสนอแนะทางวิศวกรรม (Engineering Extensions):** แนะนำฟีเจอร์ความปลอดภัยและประสบการณ์ผู้ใช้เพิ่มเติม (เช่น PIN Protection, QR Code, Bandwidth Throttling)
5. **ประสิทธิภาพความเร็วและการใช้ทรัพยากร (Speed & VRAM):** บันทึก Token Generation Speed (t/s), Prompt Processing Speed, และ VRAM Consumption

---

## 2. 4-Tuple Identifier Binding Schema

ทุกการวิเคราะห์จะถูกระบุและติดตามด้วย 4 องค์ประกอบหลักแบบผูกโยง (Binding):

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. Benchmark ID: BENCH-SPEC-REFINE-001                                 │
│ (ชุดโจทย์มาตรฐาน: ตรวจสอบและแก้ไข feat-01-mellum12b-instruct.md)         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ binds to
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 2. Run ID: RUN-SPEC-<TIMESTAMP> (เช่น RUN-SPEC-1790886044894)           │
│ (รอบการรันประเมินผล มี Timestamp, Execution Duration & System Metrics) │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │ binds to                       │ binds to
                    ▼                                ▼
┌──────────────────────────────────────┐ ┌───────────────────────────────┐
│ 3. Model ID: MODEL-MELLUM2-THINK     │ │ 4. Setting ID:                │
│ Name: JetBrains Mellum2 12B Thinking │ │ SET-MELLUM-THINK-OFFICIAL     │
│ VRAM Footprint: 8.11 GB              │ │ Temp=0.6, TopP=0.95, MinP=0.05│
└──────────────────────────────────────┘ └───────────────────────────────┘
```

---

## 3. Registered Identifiers Registry

### 3.1 Model Registry (Model IDs)

| Model Registry ID | Model Full Name | Parameters & Quant | Target VRAM |
|---|---|---|:---:|
| `MODEL-MELLUM2-THINK` | `hf.co/JetBrains/Mellum2-12B-A2.5B-Thinking-GGUF-Q4_K_M:Q4_K_M` | 12B MoE (2.5B Active) Q4_K_M | 8.11 GB |
| `MODEL-MELLUM2-INST` | `hf.co/JetBrains/Mellum2-12B-A2.5B-Instruct-GGUF-Q4_K_M:Q4_K_M` | 12B MoE (2.5B Active) Q4_K_M | 8.11 GB |
| `MODEL-QWEN35-CODER` | `hf.co/mradermacher/Qwen3.5-9B-Coder-GGUF:Q4_K_M` | 9B Dense Q4_K_M | 6.40 GB |
| `MODEL-GEMMA4-12B` | `hf.co/unsloth/gemma-4-12b-it-GGUF:UD-Q4_K_XL` | 12B Dense UD-Q4_K_XL | 8.05 GB |
| `MODEL-AROOW-RUST` | `hf.co/sillykiwi/Aroow-Rust-Coder-9B-Q4_K_S-GGUF:Q4_K_S` | 9B Dense Q4_K_S | 5.05 GB |
| `MODEL-SUSHI-CODER` | `hf.co/bigatuna/Qwen3.5-9b-Sushi-Coder-RL-GGUF:Q4_K_M` | 9B Dense Q4_K_M | 5.59 GB |

### 3.2 Setting Registry (Setting IDs)

| Setting ID | Description / Use-Case | Temperature | Top-P | Min-P | Repeat Penalty | Context Window |
|---|---|:---:|:---:|:---:|:---:|:---:|
| `SET-MELLUM-THINK-OFFICIAL` | Official HF Thinking Preset | `0.60` | `0.95` | `0.05` | `1.10` | 131,072 |
| `SET-MELLUM-INST-OFFICIAL` | Official HF Instruct Preset | `0.60` | `0.95` | `0.05` | `1.10` | 131,072 |
| `SET-DETERMINISTIC-ZERO` | Strict Zero-Variance Code Audit | `0.00` | `1.00` | `0.00` | `1.00` | 32,768 |
| `SET-CODER-PRECISE-02` | Precise Technical Spec Synthesis | `0.20` | `0.95` | `0.05` | `1.10` | 32,768 |
| `SET-GEMMA-SENIOR-03` | Senior Engineering Critique | `0.30` | `0.90` | `0.05` | `1.05` | 32,768 |
| `SET-CREATIVE-BALANCED-07`| Exploratory & Brainstorming Mode | `0.70` | `0.90` | `0.05` | `1.15` | 32,768 |

---

## 4. Evaluation Rubric (100 Points Total)

| Rubric Metric | Max Points | Verification Criteria & Ground Truth |
|---|:---:|---|
| **1. Known Defect Detection** | 35 pts | ชี้จุดบกพร่อง 5 จุด: (1) Markdown squashed (2) `queries_nvidia_smi.rs:58` ผิด (3) `scanner.rs:13` ผิด (4) Mermaid syntax block หลุด (5) Logging prefix `[WARN:telemetry]` ปนเปื้อน |
| **2. Markdown & Mermaid Quality** | 25 pts | แยกย่อหน้าถูกต้อง, ตารางสมบูรณ์, Sequence diagram เรนเดอร์ได้ 100% |
| **3. Traceability & Contracts** | 20 pts | อ้างอิงพาธ [`commands/share.rs`](file:///d:/local-llm-hub/src-tauri/src/commands/share.rs), [`models/types.rs`](file:///d:/local-llm-hub/src-tauri/src/models/types.rs), [`tests/test_lan_share.rs`](file:///d:/local-llm-hub/src-tauri/tests/test_lan_share.rs) ได้ถูกต้อง |
| **4. Architectural Suggestions** | 20 pts | เสนอแนะฟีเจอร์ความปลอดภัยและ UX (Web Portal, PIN Auth, QR Code, Bandwidth Throttling) |

---

## 5. Automated Execution

สั่งรันการทดสอบและบันทึกผลพร้อม 4-tuple binding ได้ทันทีผ่าน:
```bash
node scripts/benchmark_spec_refinement.mjs <MODEL_ID> [SETTING_ID]
```
