# Finalist suite checkpoint: 2026-10-19

**Status: paused and incomplete.** This bundle records the first three samples of the Hauhau Qwen3.5 9B Aggressive Q4_K_M finalist FR run. It is a checkpoint, not a completed benchmark or a model ranking.

The local-16K FR stability run completed FR-002 seeds 42, 43, and 44 (3 of 60 expected samples). Two passed the strict gate; seed 43 did not compile. FR-006 has not started, and HumanEval+ has not started. Keep all 57 remaining FR samples in the denominator when the run resumes.

The run used an NVIDIA GeForce RTX 3060 12 GB with Ollama 0.40.5. Profile: num_ctx=16384, num_predict=81920, temperature=0.6, top_p=0.95, top_k=20, and repeat_penalty=1.0. The exact model tag and per-sample metadata are in runs/hauhau-qwen35-9b-q4/fr-stability/results.json. The source fixture snapshot is included at source/test_set.json; its SHA-256 is recorded in DATA_INDEX.json.

The bundle contains the three generated responses, model thinking text, Rust source, compiler output, and harness output. Compiled .exe and .pdb files are omitted. Absolute local benchmark paths in textual outputs are replaced with <LOCAL_BENCHMARK_ROOT>. The original local run artifacts are unchanged. DATA_INDEX.json lists SHA-256 checksums for every other bundle file.

See the checkpoint review (../../reviews/hf-candidate-finalist-suite-2026-10-19.md) and the paired screen review (../../reviews/hf-candidate-paired-screen-2026-10-16.md) for context.
