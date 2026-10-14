# Local Ollama results for additional installed models — 2026-10-15

**Status: complete.** Two exact installed model tags with existing Local LLM Hub references were evaluated locally using the same FR stability and HumanEval+ protocol as the Mellum2 / Mellum2.1 comparison. The earlier comparison is published in [Mellum2 Thinking vs Mellum2.1 Thinking](mellum2-vs-mellum2.1-quality-2026-10-14.md).

## Results across the tested models

| Model | Quant | FR strict | HumanEval base | HumanEval+ |
|---|---|---:|---:|---:|
| Mellum2.1 Thinking | Q6_K | 56/60 (93.3%) | 159/164 (97.0%) | 151/164 (92.1%) |
| Mellum2.1 Thinking | Q4_K_M | 53/60 (88.3%) | 159/164 (97.0%) | 149/164 (90.9%) |
| Mellum2 Thinking | Q6_K | 29/60 (48.3%) | 147/164 (89.6%) | 139/164 (84.8%) |
| Mellum2 Thinking | Q4_K_M | 28/60 (46.7%) | 149/164 (90.9%) | 140/164 (85.4%) |
| Mellum2 12B Instruct | Q4_K_M | 28/60 (46.7%) | 144/164 (87.8%) | 138/164 (84.1%) |
| Qwen3.5 9B Sushi Coder RL | Q4_K_M | 21/60 (35.0%) | 132/164 (80.5%) | 121/164 (73.8%) |

The Mellum2 and Mellum2.1 figures come from the earlier matched comparison. The two additional model rows are new runs from 2026-10-15. Their per-model evidence and checksums are in the [data bundle](../data/matched-local-ollama-models-2026-10-15/README.md).

## New local runs

| Installed model | FR-002 strict | FR-006 strict | FR compiled | FR harness passed | HumanEval+ output-cap hits |
|---|---:|---:|---:|---:|---:|
| Mellum2 12B Instruct Q4_K_M | 28/30 | 0/30 | 28/60 | 28/60 | 0/164 |
| Qwen3.5 9B Sushi Coder RL Q4_K_M | 10/30 | 11/30 | 47/60 | 34/60 | 3/164 |

FR strict pass requires a fenced code block, successful Rust compilation, all task assertions passing, the required adjacent trace comment, and no unwrap, expect, or panic. The Instruct model's FR-006 generations did not pass the strict gate; per-seed checks are retained in the data bundle.

Exact installed tags:

- Mellum2 Instruct: hf.co/JetBrains/Mellum2-12B-A2.5B-Instruct-GGUF-Q4_K_M:Q4_K_M
- Qwen3.5 Sushi Coder RL: hf.co/bigatuna/Qwen3.5-9b-Sushi-Coder-RL-GGUF:Q4_K_M

## Protocol and collection notes

- Hardware: NVIDIA GeForce RTX 3060 12 GB; Ollama 0.40.4. Models ran sequentially, with no unrelated resident models before or after each run.
- FR stability: tasks FR-002 and FR-006, 30 seeds each (42–71), same fixture SHA-256 d9142c138d5a40a02064564259104c04c0686ef36eec63a3d031c5dab0087200, num_ctx=16384, temperature=0.6, top_p=0.95, top_k=20, repeat_penalty=1.0, num_predict=81920.
- HumanEval+: EvalPlus 0.3.1, default 164-task dataset with hash fe585eb4df8c88d844eeb463ea4d0302, one greedy sample per task, num_ctx=16384, num_predict=8192, top_p=0.95, top_k=20, repeat_penalty=1.0, seed=1.
- The HumanEval+ output cap is 8192 tokens, below the model-card maximum; do not compare these scores directly with model-card scores.
- Two Qwen FR-002 samples (seeds 60 and 61) used 16,188 generated tokens each and produced no fenced code before the 16K context was exhausted. They remain scored as model-quality failures.
- Two non-streaming FR requests returned fetch failed after about five minutes while Ollama was still generating. Collection switched to Ollama streaming JSON aggregation for seed 60 onward and all FR-006 requests. The prompt, seed, sampling, context, output cap, and scoring did not change. The accepted seed-60 sample is scored once; two fetch failures and one interrupted attempt are excluded.
- This is a quality comparison. Per-sample timing and generation-rate fields are retained in the raw FR data, but no speed ranking is claimed.

The results keep Mellum2.1 Thinking as the default family for local coding on this machine. Q6_K has the top measured scores, while the earlier report recommends Q4_K_M for the normal balance of quality, VRAM headroom, and throughput.
