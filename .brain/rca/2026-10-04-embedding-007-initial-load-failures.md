# RCA: EMBED-007 initial model-load and result-ledger failures

## Symptom

The first common MTEB SciFact test attempted all 15 local embedding candidates. Eleven returned retrieval scores on the initial runtime. CodeRankEmbed and Voyage-4-Nano HF failed during model loading; the E5 IQ4_XS GGUF returned HTTP 500; and the Voyage F16 GGUF returned 1,024 dimensions where the frozen profile expects 2,048. Two custom-code loader exceptions initially appeared in logs but not the ledger.

## Evidence

- Run: EMBED-007, MTEB 2.22.2, SciFact `default/test`, dataset revision `d56462d0e63a25450459c4f213e49ffdb866f7f9`; RTX 5060 Ti 16 GB.
- All 15 local preflights recorded weight-file SHA-256 values matching their model sidecars.
- Initial runtime: PyTorch 2.14.0+cu130, Transformers 5.16.1, Sentence Transformers 6.0.1. Ollama 0.35.1.
- CodeRank's `AutoConfig` returned `NomicBertConfig` from dynamic module namespace `coderankembed.abd41cce1cd729b9`; the `AutoModel` class referenced `NomicBertConfig` from `coderankembed.ef2e6d3d00addd86`. The source files have matching SHA-256 values, but Python loaded distinct class identities and the `isinstance` check failed. The model config records Transformers 4.45.1.
- CodeRank passed MTEB SciFact after the runner forwarded `trust_remote_code=True` through the SentenceTransformer constructor and used an isolated Transformers 4.45.1 / Sentence Transformers 5.3.0 environment. Result: nDCG@10 0.56458.
- Voyage's local config records Transformers 4.51.3. That runtime failed because local remote code imports `transformers.masking_utils`, which is absent in 4.51.3. Voyage passed in an isolated Transformers 4.57.1 / Sentence Transformers 5.3.0 environment. Result: nDCG@10 0.75229; output shape 2,048.
- The E5 GGUF failed on both local Ollama `/api/embed` and `/v1/embeddings` with HTTP 500. The response says llama-server terminated because the BERT model needs to define a token-type count.
- Voyage F16 GGUF returned 1,024 dimensions by default and also returned 1,024 after `/api/embed` requests with `dimensions=1024` and `dimensions=2048`. Its frozen HF profile expects 2,048.
- The original runner had no exception-to-ledger handler around `make_encoder`; the model-load exception occurred before the performance-smoke handler. Runtime versions were also absent from result rows.
- The first corrected runner wrote model-load exceptions per selected task, but a performance-smoke exception still produced only a model-level row. The E5 IQ4_XS and Voyage F16 ledger records contain model/status/stage/error but no task identity, so their 22 matrix cells were not explicitly terminalized.

## Root Cause

- **Runner ledger gap — confirmed and resolved for this matrix:** model-construction exceptions bypassed terminal result recording, and performance-smoke exceptions were recorded only at model level. The external benchmark runner now writes one task-identified failure row per selected task for either stage and records runtime versions. Reruns wrote 11 failure rows each for E5 IQ4_XS and Voyage F16, covering their frozen task matrix.
- **CodeRankEmbed — confirmed and resolved for this run:** two Python class identities were loaded for the same custom Nomic-BERT config source, and the trust-remote-code flag was not forwarded through the SentenceTransformer constructor as required by the model-card loading path. The card-aligned isolated runtime and corrected flag resolved model loading.
- **Voyage-4-Nano HF — confirmed and resolved for this run:** the local model code and its config's recorded Transformers version do not match; 4.51.3 lacks an imported module required by the local code. The local code loaded and scored under Transformers 4.57.1 with Sentence Transformers 5.3.0.
- **E5 GGUF — confirmed backend cause:** the local GGUF does not supply the token-type-count metadata required by Ollama's BERT executor.
- **Voyage F16 GGUF — confirmed output limitation, lower-level cause unresolved:** this local GGUF/Ollama path produces at most 1,024 output dimensions even when the API is asked for 2,048. The evidence does not identify whether the conversion or the runtime imposes the cap.

## Why the issue escaped detection

The preflight verified weight hashes but did not validate each custom loader or actual output dimension. Earlier smoke checks covered BGE-M3 and HF E5, not the custom Transformers loader or these GGUF variants. The runner caught inference and task errors but not model-construction errors, and the first E5 error record omitted Ollama's response body.

## Proposed Prevention

- Run audited custom-code models in isolated environments that match the loaded local code, and record actual library versions with every result.
- Keep a model-load exception boundary that writes terminal statuses while cleanup remains in `finally`.
- Validate actual vector dimension against the frozen profile before scoring; preserve backend errors without storing input text or corpus rows.
- Do not alter or repair GGUF artifacts without source conversion metadata and an explicit compatibility test.

## Resolution

The external benchmark runner now forwards `trust_remote_code` using the SentenceTransformer constructor parameter, catches model-load and performance-smoke errors into task-identified ledger rows, and records runtime versions. The updated runner passes `py_compile`. Card-compatible runs produced valid SciFact scores for CodeRankEmbed and Voyage-4-Nano HF. The E5 and Voyage GGUF candidates remain failed compatibility checks; reruns wrote task-specific failure records across their full frozen task matrix. No model files or application source were changed. German, NFCorpus, and CodeSearchNet cells remain pending; Thai E5-small, BGE-M3, and BGE-M3 Q4 have each completed both selected Thai tasks.
