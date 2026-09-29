# SPEC-LLM-Benchmark-Harness: Repeatable Local LLM Benchmark Protocol

| Field | Value |
|-------|-------|
| **Document ID** | SPEC-BENCH-001 |
| **Domain** | Model Management & Inference Gateway |
| **Status** | Active |
| **Related** | [FR-011](../requirements/FR-011-model-arena.md), [FR-005](../requirements/FR-005-model-control.md), [ADR-007](../adr/ADR-007-push-telemetry-events.md) |
| **Hardware Target** | RTX 3060 (12GB VRAM), i7-8700K |
| **Origin Reference** | `G:\.ollama_blobs_root\docs\SPEC-LLM-Benchmark-Harness.md` |

---

## 1. Purpose & Scope

This specification defines a repeatable, reproducible benchmark harness protocol for evaluating local language models running under Ollama, vLLM, and llama.cpp backends. 

### Core Tenet: VRAM Discipline
On 12GB VRAM consumer hardware (RTX 3060), running multiple models concurrently degrades throughput and causes out-of-memory driver crashes. The harness enforces **serial execution (one model at a time)**:
1. Warm up model.
2. Execute the 4 benchmark tracks.
3. Record latency, tokens-per-second, and accuracy metrics.
4. Issue an unload request (`keep_alive: 0` for Ollama) before loading the next candidate.

---

## 2. Four Benchmark Evaluation Tracks

| Track ID | Benchmark Family | Focus Area | Success Metric & Rule |
|---|---|---|---|
| **1. `knowledge_mmlu_lite`** | MMLU / MMLU-Pro | Multi-domain reasoning & facts | Exact option letter match (`A, B, C, D`). Prompt strictly requests a single letter response. |
| **2. `math_gsm8k_lite`** | GSM8K | Grade-school multi-step arithmetic | Exact normalized numerical answer match. Evaluates chain-of-thought calculation accuracy. |
| **3. `code_humaneval_lite`** | HumanEval / MBPP | Algorithmic code synthesis | Unit test suite execution in a sandboxed Node VM. Requires `--allow-code-exec` flag for safety. |
| **4. `instruction_ifeval_lite`** | IFEval | Verifiable instruction following | Strict compliance with constraints (e.g. JSON format, word count constraints, no preamble). |

---

## 3. Operational Workflow

```
   ┌────────────────────────────────────────────────────────┐
   │ 1. Model Discovery: query backends for available models│
   └───────────────────────────┬────────────────────────────┘
                               │
                               ▼
   ┌────────────────────────────────────────────────────────┐
   │ 2. Warmup & Load: verify VRAM allocation               │
   └───────────────────────────┬────────────────────────────┘
                               │
                               ▼
   ┌────────────────────────────────────────────────────────┐
   │ 3. Execute 4 Tracks sequentially                       │
   │    - Measure TTFT (Time to First Token)                │
   │    - Measure Generation Throughput (tokens/second)     │
   │    - Verify Track Compliance & Accuracy Score          │
   └───────────────────────────┬────────────────────────────┘
                               │
                               ▼
   ┌────────────────────────────────────────────────────────┐
   │ 4. Unload Model (keep_alive: 0) & Release VRAM         │
   └───────────────────────────┬────────────────────────────┘
                               │
                               ▼
   ┌────────────────────────────────────────────────────────┐
   │ 5. Generate Markdown Report & Append to raw.jsonl      │
   └────────────────────────────────────────────────────────┘
```

---

## 4. Safety Guard Rails & Code Execution

- **Sandboxed Execution**: Executing generated code requires explicit user confirmation (`--allow-code-exec`). Without this argument, the coding track records `SKIPPED (Security Guardrail)` rather than executing arbitrary strings.
- **Resource Timeouts**: Each trial is bound by a maximum execution timeout (e.g. 60 seconds) to prevent infinite loops from hanging model generation.
- **VRAM Verification**: Prior to launching a trial, the harness queries [FR-006](../requirements/FR-006-gpu-monitor.md) to ensure dedicated VRAM usage has dropped below baseline thresholds.
