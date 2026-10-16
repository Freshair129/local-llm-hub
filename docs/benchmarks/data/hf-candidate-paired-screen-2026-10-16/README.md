# Resumed paired FR screen data

This bundle contains the resumed Ollama 0.40.5 FR screening run for 11 Hugging Face coding candidates. The first two Gemma 4 profiles completed before the remaining 20-profile serial queue. Every model has a local 32K profile and an HF-card profile, each using FR-002 and FR-006 with seeds 42–46.

`profile-runs/` keeps per-seed results, generated responses, source, tests, compiler output, and harness output. Compiled `.exe` and `.pdb` files are omitted. `profiles/` records each exact local/card profile plus its model-card source; the Huihui GGUF card gives no sampler values, so that profile records the upstream Qwythos quick-start settings. `source/test_set.json` is the fixture snapshot whose SHA-256 is recorded in `DATA_INDEX.json`.

Runs used an NVIDIA GeForce RTX 3060 12 GB and Ollama 0.40.5. The runner unloaded models and checked `/api/ps` before and after each inference; only one candidate ran at a time. The final resident-model list is empty. This short screen uses 5 seeds per task and is triage evidence, not a full FR or HumanEval+ evaluation. Registration requires the full-suite evidence described in the review.

The review and `DATA_INDEX.json` describe the 3/10 screen-subset baseline and finalist rule. Textual exports replace absolute user-specific benchmark paths with `<LOCAL_BENCHMARK_ROOT>`; original local artifacts remain unchanged. `DATA_INDEX.json` provides SHA-256 checksums for every other bundle file.