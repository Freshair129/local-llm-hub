# Local Hugging Face coding candidate screen

- **Run:** 2026-10-16 through 2026-10-17
- **Hardware:** NVIDIA GeForce RTX 3060 12 GB
- **Runtime:** Ollama 0.40.5; F: candidate store `127.0.0.1:11435`, C: store `127.0.0.1:11434`
- **Source commit:** [`3ca2f066dcf3c4875d1444e51e8c2d92e0bb5bb5`](https://github.com/Freshair129/local-llm-hub/commit/3ca2f066dcf3c4875d1444e51e8c2d92e0bb5bb5)

The resumed paired screen covered 11 coding candidates with two profiles each. Gemma 4's two profiles ran before the remaining serial queue; the other 20 profiles completed one at a time. Each profile ran FR-002 and FR-006 with seeds 42–46. The runner unloaded before and after each inference and checked `/api/ps`; no other model was loaded on C: during these runs. All Huihui samples were fully resident on the RTX 3060 GPU.

The local profile uses the shared Mellum sampler and 32K context. The HF-card profile uses each model's documented Hugging Face settings or a recorded upstream/fallback where its GGUF card omits sampler values. Exact settings, card URLs, per-sample outcomes, generated code, tests, and compiler/harness logs are in the [data bundle](../data/hf-candidate-paired-screen-2026-10-16/README.md) and its [checksum index](../data/hf-candidate-paired-screen-2026-10-16/DATA_INDEX.json).

## Huihui Qwythos 9B result

The installed candidate is `hf.co/mradermacher/Huihui-Qwythos-9B-Claude-Mythos-5-1M-abliterated-i1-GGUF:Q4_K_M`. Its GGUF card gives no sampler values; the HF-card profile therefore follows upstream Qwythos quick-start values: `temperature=0.6`, `top_p=0.95`, `top_k=20`, repetition penalty `1.05`, `num_ctx=16384`, and `num_predict=16384`. The local profile used `temperature=0.6`, `top_p=0.95`, `top_k=20`, repetition penalty `1.0`, `num_ctx=32768`, and `num_predict=81920`.

The local profile scored **2/10** (FR-002 0/5; FR-006 2/5). The HF-card profile scored **3/10** (FR-002 0/5; FR-006 3/5). The card profile's FR-002 seeds 45 and 46 each reached the 16K output cap at 16,188 tokens, taking 354.8 and 349.5 seconds. The card score equals the subset baseline of 3/10; it does not show a useful signal above baseline. Huihui remains on F: and is not advanced to the finalist suite or registered on C:.

## Paired profile results

| Model | Profile | FR-002 | FR-006 | Strict total | Mean generation speed | Mean wall time FR-002 / FR-006 |
|---|---|---:|---:|---:|---:|---:|
| Gemma 4 12B UD-Q4_K_XL | local 32K | 5/5 | 5/5 | **10/10** | 35.03 tokens/s | 312.5 s / 66.8 s |
| Gemma 4 12B UD-Q4_K_XL | HF card | 5/5 | 5/5 | **10/10** | 33.78 tokens/s | 236.1 s / 79.8 s |
| Hauhau Qwen3.5 9B Q4_K_M | local 32K | 4/5 | 5/5 | **9/10** | 47.45 tokens/s | 212.6 s / 94.5 s |
| Hauhau Qwen3.5 9B Q4_K_M | HF card 128K | 4/5 | 5/5 | **9/10** | 47.52 tokens/s | 199.2 s / 86.0 s |
| Qwythos 9B llmfan Q4_K_M | local 32K | 0/5 | 1/5 | **1/10** | 46.58 tokens/s | 631.8 s / 45.5 s |
| Qwythos 9B llmfan Q4_K_M | HF card 16K | 0/5 | 1/5 | **1/10** | 44.44 tokens/s | 127.4 s / 61.4 s |
| Jackrong Qwopus3.5 9B v3 Q4_K_M | local 32K | 1/5 | 4/5 | **5/10** | 52.32 tokens/s | 122.2 s / 36.0 s |
| Jackrong Qwopus3.5 9B v3 Q4_K_M | HF card fallback 16K | 1/5 | 4/5 | **5/10** | 52.28 tokens/s | 118.1 s / 36.9 s |
| AnkitAI Parable Qwen3 4B Q4_K_M | local 32K | 0/5 | 2/5 | **2/10** | 83.36 tokens/s | 93.5 s / 28.1 s |
| AnkitAI Parable Qwen3 4B Q4_K_M | HF card inherited sampler 16K | 0/5 | 2/5 | **2/10** | 83.20 tokens/s | 89.5 s / 27.4 s |
| mradermacher Llama 3.1 8B ThaiInstruct Q4_K_M | local 32K | 1/5 | 0/5 | **1/10** | 60.74 tokens/s | 12.4 s / 11.8 s |
| mradermacher Llama 3.1 8B ThaiInstruct Q4_K_M | HF card fallback 16K | 1/5 | 0/5 | **1/10** | 60.73 tokens/s | 8.7 s / 11.8 s |
| mradermacher Nemotron Orchestrator 8B Q4_K_M | local 32K | 1/5 | 0/5 | **1/10** | 58.21 tokens/s | 24.2 s / 20.6 s |
| mradermacher Nemotron Orchestrator 8B Q4_K_M | HF card fallback 16K | 1/5 | 0/5 | **1/10** | 58.30 tokens/s | 20.6 s / 20.2 s |
| KevinJK51 Qwen3.6-12B Hightop Q4_K_M | local 32K | 0/5 | 0/5 | **0/10** | 41.44 tokens/s | 365.1 s / 515.8 s |
| KevinJK51 Qwen3.6-12B Hightop Q4_K_M | HF card fallback 16K | 0/5 | 0/5 | **0/10** | 42.03 tokens/s | 200.2 s / 261.9 s |
| mradermacher Huihui Qwythos 9B Abliterated Q4_K_M | local 32K | 0/5 | 2/5 | **2/10** | 50.98 tokens/s | 428.6 s / 76.4 s |
| mradermacher Huihui Qwythos 9B Abliterated Q4_K_M | HF card 16K (upstream sampler) | 0/5 | 3/5 | **3/10** | 47.83 tokens/s | 199.5 s / 49.0 s |

Generation speed is the arithmetic mean of per-sample generation rates; outputs have different lengths, so speed is diagnostic. Mean wall time includes model loading. The legacy Ollama 0.40.4 screen is kept separate from these resumed 0.40.5 outcomes.

## Provisional ranking by best profile

| Rank | Candidate | Local 32K | HF card | Best screen | Screening result |
|---:|---|---:|---:|---:|---|
| 1 | Gemma 4 12B UD-Q4_K_XL | 10/10 | 10/10 | **10/10** | Above baseline; finalist eligible |
| 2 | Hauhau Qwen3.5 9B Q4_K_M | 9/10 | 9/10 | **9/10** | Above baseline; finalist eligible |
| 3 | Jackrong Qwopus3.5 9B v3 Q4_K_M | 5/10 | 5/10 | **5/10** | Above baseline; finalist eligible |
| 4 | mradermacher Huihui Qwythos 9B Abliterated Q4_K_M | 2/10 | 3/10 | **3/10** | Matches baseline; no advancement |
| 5 | AnkitAI Parable Qwen3 4B Q4_K_M | 2/10 | 2/10 | **2/10** | Below baseline |
| 5 | Empero Qwythos 9B Q4_K_M | 2/10 | 1/10 | **2/10** | Below baseline |
| 7 | Qwythos 9B llmfan Q4_K_M | 1/10 | 1/10 | **1/10** | Below baseline |
| 7 | mradermacher Llama 3.1 8B ThaiInstruct Q4_K_M | 1/10 | 1/10 | **1/10** | Below baseline |
| 7 | mradermacher Nemotron Orchestrator 8B Q4_K_M | 1/10 | 1/10 | **1/10** | Below baseline |
| 10 | DavidAU Llama 3.2 4X3B MoE Q4_K_M | 0/10 | 0/10 | **0/10** | Below baseline |
| 10 | KevinJK51 Qwen3.6-12B Hightop Q4_K_M | 0/10 | 0/10 | **0/10** | Below baseline |
## Triage

The same FR task/seed subset scored 3/10 for the Sushi Coder Q4 baseline. The resumed profiles that exceed that subset baseline are Gemma 4 (10/10), Hauhau Qwen3.5 (9/10), and Jackrong Qwopus3.5 (5/10). These results are screen results, not full-suite scores. Full FR evaluation at 30 seeds per task plus HumanEval+ (164 tasks) remains required before a candidate qualifies for registration.

No candidate was copied or registered in the C: store from this screen. The reranker and OCR/vision models remain excluded from coding FR scores pending purpose-specific evaluations.

## Protocol

Strict pass requires a fenced code answer, successful Rust compilation, all task harness tests passing, the required adjacent trace comment, and no `unwrap`, `expect`, or `panic!`. The fixture is `scripts/benchmark_mellum_thinking_vs_instruct.mjs`; the test-set snapshot SHA-256 and all per-sample data are in `DATA_INDEX.json`. Results are separated from the earlier Ollama 0.40.4 screen.