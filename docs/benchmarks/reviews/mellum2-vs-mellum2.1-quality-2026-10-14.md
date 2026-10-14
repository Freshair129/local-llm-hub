# Mellum2 Thinking vs Mellum2.1 Thinking: interim quality comparison

**Status:** Interim. Mellum2 Q4_K_M has completed the repeated FR test. Mellum2 Q6_K and the matched HumanEval+ runs remain pending; this is not the final version comparison.

## Matched FR-002 / FR-006 test

The prompt and Rust harness were taken from [`benchmark_mellum_thinking_vs_instruct.mjs`](https://github.com/Freshair129/local-llm-hub/blob/main/scripts/benchmark_mellum_thinking_vs_instruct.mjs). The test-set SHA-256 is `d9142c138d5a40a02064564259104c04c0686ef36eec63a3d031c5dab0087200`, matching the completed Mellum2.1 Q4/Q6 run.

| Model | Quant | FR-002 strict pass | FR-006 strict pass | Total | Wilson 95% CI |
|---|---|---:|---:|---:|---|
| Mellum2 Thinking | Q4_K_M | 15/30 (50.0%) | 13/30 (43.3%) | 28/60 (46.7%) | 34.6–59.1% |
| Mellum2.1 Thinking | Q4_K_M | 27/30 (90.0%) | 26/30 (86.7%) | 53/60 (88.3%) | 77.8–94.2% |

Paired outcomes across the same task and seed (42–71): both passed 25; Mellum2 only 3; Mellum2.1 only 28; both failed 4. On these two repository tasks, the Q4 result favors Mellum2.1. The set contains only two function tasks, so it does not establish a general advantage across coding work.

Strict pass requires generated code to compile, pass the task tests, include the required adjacent trace comment, and avoid `unwrap`, `expect`, and `panic!`.

## Run settings and safeguards

- Hardware: NVIDIA GeForce RTX 3060 12GB; Ollama 0.40.4.
- Both versions used the same Thinking variant, `num_ctx=16384`, `temperature=0.6`, `top_p=0.95`, `top_k=20`, `repeat_penalty=1.0`, `num_predict=81920`, and seeds 42–71.
- Models were run serially. The harness checked `/api/ps` before and after each inference, discarded/retried any sample with an unexpected resident model, and unloaded the target between quant groups.
- Mellum2 Q4 has 60 saved samples. No unexpected resident model was found during those accepted samples. `/api/ps` was empty after stopping at the Q4 boundary.

## Pending before a final recommendation

- Mellum2 Thinking Q6_K repeated FR run.
- Matched HumanEval+ (EvalPlus) generation and evaluation for Mellum2 Q4_K_M and Q6_K.
- Final comparison against the already completed Mellum2.1 Q4_K_M/Q6_K results.

The model cards recommend `temperature=0.6`, `top_p=0.95`, `top_k=20` for both Thinking models. The local context is 16,384 tokens, below the cards' 131,072-token maximum. The matched HumanEval+ protocol uses a common 8,192-token output cap and greedy sampling to keep the established benchmark run bounded; this is lower than the cards' recommended maximum output setting.

### Sources

- [Local LLM Hub Mellum benchmark fixture](https://github.com/Freshair129/local-llm-hub/blob/main/scripts/benchmark_mellum_thinking_vs_instruct.mjs)
- [Mellum2 Thinking model card](https://huggingface.co/JetBrains/Mellum2-12B-A2.5B-Thinking-GGUF-Q4_K_M)
- [Mellum2.1 Thinking model card](https://huggingface.co/JetBrains/Mellum2.1-12B-A2.5B-Thinking-GGUF)

