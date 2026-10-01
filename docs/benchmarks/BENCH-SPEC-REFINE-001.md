# Benchmark Specification: Spec Refinement & Defect Detection (BENCH-SPEC-REFINE-001)

| Field | Value |
|---|---|
| **Benchmark ID** | `BENCH-SPEC-REFINE-001` |
| **Benchmark Name** | Local LLM Technical Spec Review & Gap Refinement Benchmark |
| **Domain** | SWE Documentation & Local Model Quality Assurance |
| **Standard** | SWE-AI-BENCH-STD v2.0 (6-Tuple Environment Binding) |
| **Status** | Active |
| **Target Baseline** | [`feat-01-mellum12b-instruct.md`](file:///d:/local-llm-hub/feat-01-mellum12b-instruct.md) (Raw Unedited Draft) |
| **Reference Ground Truth** | [`docs/domains/network-distribution/features/FEAT-012-lan-share.md`](file:///d:/local-llm-hub/docs/domains/network-distribution/features/FEAT-012-lan-share.md) |

---

## 1. 6-Tuple AI Benchmark Environment Schema

เพื่อให้การทดสอบสามารถทำซ้ำได้ (Reproducible), เปรียบเทียบผลข้ามเครื่องได้ (Cross-Machine Comparative), และตรวจสอบย้อนกลับได้ตามมาตรฐานสากล (Traceable Audit), ระบบจะผูกโยงข้อมูลการทดสอบด้วย **6-Tuple Identifier Binding**:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 1. Benchmark ID: BENCH-SPEC-REFINE-001                                                 │
│    (ชุดโจทย์มาตรฐาน: ตรวจสอบและแก้ไข feat-01-mellum12b-instruct.md)                      │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ binds to
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 2. Run ID: RUN-SPEC-<TIMESTAMP> (เช่น RUN-SPEC-1790886114806)                            │
│    (รอบการรันประเมินผล มี Timestamp, Wall Duration & System Telemetry)                  │
└───────────────┬───────────────────────────┼────────────────────────────┬───────────────┘
                │                           │                            │
                ▼ binds to                  ▼ binds to                   ▼ binds to
┌───────────────────────────────┐ ┌─────────────────────────┐ ┌───────────────────────────┐
│ 3. Model ID:                  │ │ 5. Machine ID:          │ │ 6. Runtime ID /           │
│    MODEL-MELLUM2-THINK        │ │    MACH-DESKTOP-RTX3060 │ │    Software ID:           │
│    Mellum2 12B MoE (A2.5B)    │ │    i7-8700K / 12GB CUDA │ │    ENV-OLLAMA-V0.35-NODE24│
└───────────────┬───────────────┘ └─────────────────────────┘ └───────────────────────────┘
                │ binds to
                ▼
┌───────────────────────────────┐
│ 4. Setting ID:                │
│    SET-MELLUM-THINK-OFFICIAL  │
│    Temp=0.6, TopP=0.95, MinP  │
└───────────────────────────────┘
```

---

## 2. Identifier Registries & Specifications

### 2.1 🎯 Benchmark ID (`BENCH-*`)
* **`BENCH-SPEC-REFINE-001`**: ชุดทดสอบการอ่านจับใจความ, ตรวจจับ Defect/Hallucination, และจัดระเบียบโครงสร้างเอกสารทางเทคนิค (Markdown & Mermaid Diagram)

### 2.2 🚀 Run ID (`RUN-*`)
* รูปแบบ: `RUN-SPEC-<EPOCH_TIMESTAMP>` (เช่น `RUN-SPEC-1790886114806`)
* บันทึก: เวลาเริ่ม-จบ, Wall Duration, Total Tokens, Throughput (t/s)

### 2.3 🤖 Model ID (`MODEL-*`)

| Model Registry ID | Model Full Name | Architecture / Quant | Target VRAM |
|---|---|---|:---:|
| `MODEL-MELLUM2-THINK` | `hf.co/JetBrains/Mellum2-12B-A2.5B-Thinking-GGUF-Q4_K_M:Q4_K_M` | 12B MoE (2.5B Active) Q4_K_M | 8.11 GB |
| `MODEL-MELLUM2-INST` | `hf.co/JetBrains/Mellum2-12B-A2.5B-Instruct-GGUF-Q4_K_M:Q4_K_M` | 12B MoE (2.5B Active) Q4_K_M | 8.11 GB |
| `MODEL-QWEN35-CODER` | `hf.co/mradermacher/Qwen3.5-9B-Coder-GGUF:Q4_K_M` | 9B Dense Q4_K_M | 6.40 GB |
| `MODEL-GEMMA4-12B` | `hf.co/unsloth/gemma-4-12b-it-GGUF:UD-Q4_K_XL` | 12B Dense UD-Q4_K_XL | 8.05 GB |
| `MODEL-AROOW-RUST` | `hf.co/sillykiwi/Aroow-Rust-Coder-9B-Q4_K_S-GGUF:Q4_K_S` | 9B Dense Q4_K_S | 5.05 GB |
| `MODEL-SUSHI-CODER` | `hf.co/bigatuna/Qwen3.5-9b-Sushi-Coder-RL-GGUF:Q4_K_M` | 9B Dense Q4_K_M | 5.59 GB |

### 2.4 ⚙️ Setting ID (`SET-*`) (Inference Hyperparameters)

| Setting ID | Description / Use-Case | Temperature | Top-P | Min-P | Repeat Penalty | Context Size |
|---|---|:---:|:---:|:---:|:---:|:---:|
| `SET-MELLUM-THINK-OFFICIAL` | Official HF Thinking Preset | `0.60` | `0.95` | `0.05` | `1.10` | 131,072 |
| `SET-MELLUM-INST-OFFICIAL` | Official HF Instruct Preset | `0.60` | `0.95` | `0.05` | `1.10` | 131,072 |
| `SET-DETERMINISTIC-ZERO` | Strict Zero-Variance Code Audit | `0.00` | `1.00` | `0.00` | `1.00` | 32,768 |
| `SET-CODER-PRECISE-02` | Precise Technical Spec Synthesis | `0.20` | `0.95` | `0.05` | `1.10` | 32,768 |
| `SET-GEMMA-SENIOR-03` | Senior Engineering Critique | `0.30` | `0.90` | `0.05` | `1.05` | 32,768 |

### 2.5 🖥️ Machine ID (`MACH-*`) (Hardware Profile)

| Machine Registry ID | Host / Node Name | CPU | GPU & VRAM | RAM | Driver / CUDA |
|---|---|---|---|:---:|:---:|
| `MACH-LOCAL-RTX3060-I7` | Primary Dev Workstation | Intel Core i7-8700K (6C/12T @ 3.7GHz) | NVIDIA RTX 3060 (12,288 MiB GDDR6) | 16 GB | Driver 616.92 / CUDA 12.x |
| `MACH-WORKER-NODE-02` | Secondary Inference Node | AMD Ryzen 9 5900X (12C/24T) | Dual RTX 3060 (24GB Pool) | 32 GB | Driver 555.42 / CUDA 12.4 |

### 2.6 📦 Runtime ID / Software ID (`ENV-*` / `SW-*`) (Software Stack & Engines)

| Runtime / Software ID | Category | Primary Engine & Version | Test Harness & Driver | OS Platform |
|---|---|---|---|---|
| `ENV-OLLAMA-V035-NODE24` | Local LLM Daemon | Ollama Engine v0.35.0 (CUDA backend) | Node.js v24.16.0 / Fetch API | Windows 11 Pro 64-bit |
| `ENV-VLLM-V063-LINUX` | High-Throughput Server | vLLM v0.6.3 (PagedAttention) | Python 3.11 / OpenAI Client | Ubuntu 22.04 LTS |
| `ENV-LLAMACPP-B3800` | Native C++ Engine | llama.cpp server build b3800 | cURL / Native REST | Windows 11 Pro 64-bit |

---

## 3. Evaluation Rubric (100 Points Total)

| Rubric Metric | Max Points | Verification Criteria & Ground Truth |
|---|:---:|---|
| **1. Known Defect Detection** | 35 pts | ชี้จุดบกพร่อง 5 จุด: (1) Markdown squashed (2) `queries_nvidia_smi.rs:58` ผิด (3) `scanner.rs:13` ผิด (4) Mermaid syntax block หลุด (5) Logging prefix `[WARN:telemetry]` ปนเปื้อน |
| **2. Markdown & Mermaid Quality** | 25 pts | แยกย่อหน้าถูกต้อง, ตารางสมบูรณ์, Sequence diagram เรนเดอร์ได้ 100% |
| **3. Traceability & Contracts** | 20 pts | อ้างอิงพาธ [`commands/share.rs`](file:///d:/local-llm-hub/src-tauri/src/commands/share.rs), [`models/types.rs`](file:///d:/local-llm-hub/src-tauri/src/models/types.rs), [`tests/test_lan_share.rs`](file:///d:/local-llm-hub/src-tauri/tests/test_lan_share.rs) ได้ถูกต้อง |
| **4. Architectural Suggestions** | 20 pts | เสนอแนะฟีเจอร์ความปลอดภัยและ UX (Web Portal, PIN Auth, QR Code, Bandwidth Throttling) |

---

## 4. Automated Execution & Traceability

สั่งรัน Benchmark ผ่าน Script ด้วย 6-Tuple Schema อัตโนมัติ:
```bash
node scripts/benchmark_spec_refinement.mjs <MODEL_ID> [SETTING_ID] [MACHINE_ID] [RUNTIME_ID]
```
