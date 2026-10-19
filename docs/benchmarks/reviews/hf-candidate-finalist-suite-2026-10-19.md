# Finalist suite checkpoint — 2026-10-19

**Status: paused after three samples; results are provisional.**

## Candidate and protocol

- **Model:** hf.co/HauhauCS/Qwen3.5-9B-Uncensored-HauhauCS-Aggressive:Q4_K_M
- **Model card:** [HauhauCS Qwen3.5 9B Aggressive](https://huggingface.co/HauhauCS/Qwen3.5-9B-Uncensored-HauhauCS-Aggressive)
- **Hardware/runtime:** NVIDIA GeForce RTX 3060 12 GB; Ollama 0.40.5.
- **Profile:** matched local-16K comparison, num_ctx=16384, num_predict=81920, temperature=0.6, top_p=0.95, top_k=20, repeat_penalty=1.0.
- **Full suite:** FR-002 and FR-006, 30 seeds each (42–71), 60 samples expected. HumanEval+ has 164 tasks and is run after FR.
- **Strict gate:** response has a fenced code block; Rust compilation and all task harness tests pass; required trace comment is adjacent to the target function; no unwrap, expect, or panic!.

## Checkpoint results

| Task | Seed | Generated tokens | Wall time | Compile | Harness | Strict |
|---|---:|---:|---:|---|---|---|
| FR-002 | 42 | 5,037 | 128.6 s | Pass | Pass | **Pass** |
| FR-002 | 43 | 9,719 | 190.1 s | Fail | Not run | Fail |
| FR-002 | 44 | 6,696 | 133.5 s | Pass | Pass | **Pass** |

So far, FR-002 has 2 strict passes in 3 samples. FR-006 has no samples yet; 57 FR samples remain. HumanEval+ has not started. The seed 43 compile failure is a quality outcome, not an infrastructure failure. These data are insufficient to determine whether this model should rank above the other finalists.

At the pause point, the benchmark runner was stopped, both Ollama endpoints reported no resident models, and the GPU had returned to low utilization. The complete per-sample checkpoint and textual evidence are in the [data bundle](../data/hf-candidate-finalist-suite-2026-10-19/README.md), with checksums in its [index](../data/hf-candidate-finalist-suite-2026-10-19/DATA_INDEX.json). The earlier paired screen is documented [here](hf-candidate-paired-screen-2026-10-16.md).
