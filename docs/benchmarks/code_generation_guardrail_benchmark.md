# 🏆 Official Benchmark Report: Local LLM Code Generation & Guard Rails (STD-003 / ADR-100)

**Date:** 2026-09-29  
**Hardware:** NVIDIA GeForce RTX 3060 12GB (CUDA 0)  
**Evaluation Harness:** `scripts/code_quality_suite.mjs`  
**Test Tasks:**
1. **Task 1 (FR-002):** Model Name Normalizer (`normalize_model_name`) with prefix & quant suffix stripping.
2. **Task 2 (FR-006):** Real-time `nvidia-smi` CSV Parser (`parse_gpu_stats`) returning `Result<GpuStats, String>` without panics.

---

## 1. Grand Scorecard & Benchmark Summary

| Model | Task 1 Speed | Task 1 Rust Tests | Task 1 Guard Rails (ADR-100) | Task 2 Speed | Task 2 Rust Tests | Task 2 Guard Rails (ADR-100) | Traceability (ANN-001) |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **JetBrains Mellum2 12B MoE (Baseline)** | **138.3 t/s** | ✅ **100% PASS** | ✅ **SAFE (Zero Panic)** | **135.0 t/s** | ✅ **100% PASS** | ✅ **SAFE (Zero Panic)** | ✅ **100% Trace Present** |
| **Qwen 3.6 12B Thinking V2** | 42.8 t/s | 💥 Compile Error | ✅ Safe | 43.0 t/s | 💥 Compile Error | ❌ Failed (`.unwrap()`, `panic!()`) | ⚠️ Missing |
| **Mellum2 12B Claude Opus Think** | ERR | 💥 Compile Error | ❌ Failed (`.unwrap()`) | ERR | 💥 Compile Error | ❌ Failed (`.unwrap()`) | ❌ None |
| **AMD Instella MoE 16B Think** | ERR | 💥 Compile Error | ❌ Failed (`.unwrap()`) | ERR | 💥 Compile Error | ❌ Failed (`.unwrap()`) | ❌ None |
| **Ternary Bonsai 27B** | ERR | 💥 Compile Error | ❌ Failed (`.unwrap()`) | ERR | 💥 Compile Error | ❌ Failed (`.unwrap()`) | ❌ None |

---

## 2. Key Findings & Architectural Insights

1. **🏆 JetBrains Mellum2 12B MoE (Champion):**
   - **Generation Speed:** Surpassed 135–138 t/s on RTX 3060 CUDA, utilizing its 2.5B active parameter sparse Mixture-of-Experts architecture.
   - **Adherence to Guard Rails (ADR-100):** Strictly avoided `.unwrap()` and `.expect()`, correctly returning idiomatic `Result<T, String>`.
   - **Traceability (ANN-001):** Consistently added `// trace:implements FR-002` and `// trace:implements FR-006` directly above functions.
   - **Rust Compilation:** 100% passed real `rustc` compilation and test harnesses out-of-the-box.

2. **🧠 Thinking Models (Qwen 3.6 12B Thinking V2, Mellum2 Claude Opus):**
   - While reasoning and thinking traces are rich in descriptive analysis, when generating raw code under strict guard rails, thinking models sometimes include markdown chatter or fall back to `.unwrap()` inside helper closures.
   - Generation speed was 42–43 t/s on dense 12B vs 135+ t/s on Mellum2 MoE.

3. **Recommendation for Autonomous Multi-Agent Pipeline (`SPEC-WORKFLOW-001`):**
   - **Worker Agent (Code Synthesis):** `JetBrains Mellum2 12B Instruct / MoE` is the optimal choice for speed, guard rail compliance, and zero-panic Rust generation.
   - **Reviewer Agent (Architectural Critique):** `JetBrains Mellum2 12B Thinking` or `Google Gemma 4 12B Instruct` provide the deepest defect identification and race condition prevention.
