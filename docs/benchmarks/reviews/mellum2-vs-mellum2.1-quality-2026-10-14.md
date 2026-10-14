# Mellum2 Thinking vs Mellum2.1 Thinking: matched Q4_K_M and Q6_K comparison

**Status: Complete.** Both model versions were tested at Q4_K_M and Q6_K on the same RTX 3060 12GB, using the same FR fixture and HumanEval+ protocol. Each repeated FR result contains 60 scored samples; HumanEval+ contains one completion for each of 164 tasks.

## Findings

- Mellum2.1 scored higher than Mellum2 at both quantizations: FR strict pass was 53/60 vs 28/60 at Q4, and 56/60 vs 29/60 at Q6. HumanEval+ was 149/164 vs 140/164 at Q4, and 151/164 vs 139/164 at Q6.
- Changing Mellum2 from Q4 to Q6 barely changed these quality results: FR rose by one strict pass, while HumanEval+ fell by one task. Mellum2.1 Q6 was numerically ahead of Q4 by three FR passes and two HumanEval+ tasks, a small difference with overlapping confidence intervals.
- The evidence favors Mellum2.1 as the version to use. It does not establish a decisive Q6 advantage over Q4. Choose Q4 when VRAM headroom and throughput matter; Q6 is reasonable when prioritizing its small measured quality edge and it fits fully on the GPU.

## Matched FR-002 / FR-006 results

The prompt and Rust harness come from [`benchmark_mellum_thinking_vs_instruct.mjs`](https://github.com/Freshair129/local-llm-hub/blob/main/scripts/benchmark_mellum_thinking_vs_instruct.mjs). Test-set SHA-256: `d9142c138d5a40a02064564259104c04c0686ef36eec63a3d031c5dab0087200`.

| Model | Quant | FR-002 strict pass | FR-006 strict pass | Total | Wilson 95% CI |
|---|---|---:|---:|---:|---|
| Mellum2 Thinking | Q4_K_M | 15/30 (50.0%) | 13/30 (43.3%) | 28/60 (46.7%) | 34.6–59.1% |
| Mellum2.1 Thinking | Q4_K_M | 27/30 (90.0%) | 26/30 (86.7%) | 53/60 (88.3%) | 77.8–94.2% |
| Mellum2 Thinking | Q6_K | 15/30 (50.0%) | 14/30 (46.7%) | 29/60 (48.3%) | 36.2–60.7% |
| Mellum2.1 Thinking | Q6_K | 28/30 (93.3%) | 28/30 (93.3%) | 56/60 (93.3%) | 84.1–97.4% |

Strict pass requires a code block, Rust compilation, all harness tests, the required adjacent trace comment, and no `unwrap`, `expect`, or `panic!`.

Paired outcomes on the same task and seed (42–71):

| Version comparison | Both pass | Mellum2 only | Mellum2.1 only | Both fail |
|---|---:|---:|---:|---:|
| Q4_K_M | 25 | 3 | 28 | 4 |
| Q6_K | 25 | 4 | 31 | 0 |

Within-version Q4/Q6 paired FR outcomes were also close: Mellum2 had 14 pass on both, 14 Q4-only, 15 Q6-only, and 17 failures on both; Mellum2.1 had 49 pass on both, 4 Q4-only, 7 Q6-only, and no failures on both.

## HumanEval+ results (EvalPlus 0.3.1)

The evaluator used the same dataset hash `fe585eb4df8c88d844eeb463ea4d0302`, one sample per task, and the same output cap for all four model/quant runs.

| Model | Quant | HumanEval base | HumanEval+ | Wilson 95% CI on HumanEval+ | Output exceptions |
|---|---|---:|---:|---|---|
| Mellum2 Thinking | Q4_K_M | 149/164 (90.9%) | 140/164 (85.4%) | 79.1–90.0% | 6 cap-hit empty outputs |
| Mellum2 Thinking | Q6_K | 147/164 (89.6%) | 139/164 (84.8%) | 78.5–89.5% | 2 cap-hit empty outputs; 1 repeat-limit generation error |
| Mellum2.1 Thinking | Q4_K_M | 159/164 (97.0%) | 149/164 (90.9%) | 85.5–94.4% | 2 cap-hit empty outputs |
| Mellum2.1 Thinking | Q6_K | 159/164 (97.0%) | 151/164 (92.1%) | 86.9–95.3% | 1 cap-hit empty output |

The Mellum2 Q4 cap-hit tasks were HumanEval/64, /89, /116, /132, /141, and /145. Mellum2 Q6 hit the 8,192-token cap at /91 and /134; /146 returned Ollama `prediction aborted, token repeat limit reached` on all three attempts. That task is recorded as an empty sample and counted as a failure; no alternate sampling setting was substituted.

Paired outcomes for the HumanEval+ metric:

| Matched pair | Both pass | Left only | Right only | Neither passes |
|---|---:|---:|---:|---:|
| Mellum2 Q4 vs Q6 | 129 | Q4: 12 | Q6: 11 | 12 |
| Mellum2.1 Q4 vs Q6 | 148 | Q4: 1 | Q6: 4 | 11 |
| Mellum2 vs Mellum2.1 at Q4 | 138 | Mellum2: 3 | Mellum2.1: 11 | 12 |
| Mellum2 vs Mellum2.1 at Q6 | 135 | Mellum2: 5 | Mellum2.1: 17 | 7 |

## Run protocol and limits

- Hardware: NVIDIA GeForce RTX 3060 12GB; Ollama 0.40.4. Q4 and Q6 were run sequentially, with one benchmark model resident at a time. The harness checked `/api/ps` before and after every inference, unloaded unexpected models, and discarded contaminated attempts.
- FR runs used seeds 42–71, `num_ctx=16384`, `temperature=0.6`, `top_p=0.95`, `top_k=20`, `repeat_penalty=1.0`, and `num_predict=81920`. These are the model-card sampling recommendations with a local 16k context.
- HumanEval+ used `num_ctx=16384`, `num_predict=8192`, greedy `temperature=0`, `top_p=0.95`, `top_k=20`, `repeat_penalty=1.0`, and seed 1. The output cap is lower than the model cards’ 81,920-token setting, so these local results should not be compared directly with model-card scores.
- Mellum2 Q6 initially encountered two CUDA allocation errors while other VRAM was in use. Those infrastructure errors are stored separately and excluded from FR scores. After more VRAM became available, the complete Q6 run finished on GPU without CPU offload. The Ollama model list was empty after each benchmark completed.
- FR has only two repository functions; HumanEval+ has 164 tasks and one completion per task. The results support a comparison on these test sets, not a guarantee for all coding work. The observed Q4/Q6 differences are small relative to their confidence intervals.

## Artifacts

- Repeated FR report and per-sample data: `fr-stability/report.md` and `fr-stability/results.json`.
- Mellum2 HumanEval+ samples and generation details: `standard/q4-clean/` and `standard/q6-clean/`.
- EvalPlus summaries and per-task results: `standard/eval-results-q4/` and `standard/eval-results-q6/`.

### Sources

- [Local LLM Hub Mellum benchmark fixture](https://github.com/Freshair129/local-llm-hub/blob/main/scripts/benchmark_mellum_thinking_vs_instruct.mjs)
- [EvalPlus](https://github.com/evalplus/evalplus)
- [JetBrains Mellum2 Thinking model card](https://huggingface.co/JetBrains/Mellum2-12B-A2.5B-Thinking-GGUF-Q4_K_M)
- [JetBrains Mellum2.1 Thinking model card](https://huggingface.co/JetBrains/Mellum2.1-12B-A2.5B-Thinking-GGUF)

## Committed data and model settings

The [data bundle](../data/mellum2-vs-mellum2.1-2026-10-14/DATA_INDEX.json) contains the per-seed FR results, complete HumanEval+ per-task output, a compact pass/fail view, and portable Modelfile snapshots for both versions at Q4 and Q6. SHA-256 checksums are listed in the index.
