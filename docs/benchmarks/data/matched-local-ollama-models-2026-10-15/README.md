# Data bundle: additional installed Ollama models

This bundle backs [the comparison report](../../reviews/matched-local-ollama-models-2026-10-15.md). It contains complete per-seed FR outcome records, retained FR response/source/test text, all 164 HumanEval+ generations and per-task evaluator outcomes, run metadata, and model tags.

## Layout

- fr-stability/*.json: all 60 scored samples per model, checks, run metadata, contamination events, and infrastructure failures.
- fr-stability/responses/: per-task/per-seed response, generated source, test source, compiler output, and harness output. Compiled .exe and .pdb build artifacts are omitted.
- human-eval-plus/<model>/: raw and normalized generations, generation details/log, EvalPlus per-task results, evaluator summary, and run metadata.
- model-config/: exact installed Ollama tags and quantization.
- source/test_set.json: the fixture snapshot used for the FR task hash recorded in DATA_INDEX.json.

DATA_INDEX.json lists run settings and SHA-256 checksums for every file in this bundle except the index itself. The full local run directory, including excluded build artifacts and runner scripts, remains under the user's .ollama benchmark folder.
