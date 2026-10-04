# BENCH-SPEC-EMBEDDINGS-001 — Local embedding retrieval evaluation

| Field | Value |
|---|---|
| Document ID | BENCH-SPEC-EMBEDDINGS-001 |
| Version | 1.1.1 |
| Status | Frozen retrieval profiles; full matrix in progress; approved batch-4/4-inputs/s transport candidate awaiting long-task validation; Windows cache-path overflow confirmed |
| Complexity / risk | C-2 / MEDIUM |
| Parent | [FR-018 GPU model and VRAM advisor](../requirements/FR-018-model-vram-advisor.md), [SPEC-EVAL-002](SPEC-EVAL-002-evaluation-hardening.md) |
| Peer | [SPEC-LLM-Benchmark-Harness](SPEC-LLM-Benchmark-Harness.md) |
| Hardware | NVIDIA GeForce RTX 5060 Ti 16 GB; Intel Core i7-14700KF; 31.76 GiB visible system RAM; Windows 11 Pro build 26300; NVIDIA driver 617.14 |
| Run ID | EMBED-007 |
| Scope | 15 installed local embedding model records; no cloud embedding API |

## Objective

Measure local embedding quality for retrieval, encoding speed, and memory use on the same RTX 5060 Ti. Use frozen public test splits from the Massive Text Embedding Benchmark (MTEB), including Thai, English BEIR-derived, and code retrieval tasks. Report each task and model variant independently; do not combine heterogeneous task scores into a single rank or call this a complete MTEB/BEIR leaderboard result.

The repository's current evaluation framework is primarily for code-generating agents. This protocol keeps embedding evaluation in a separate runner and report, without changing its scoring or application runtime.

## Candidates

All 15 installed model records are in scope:

`bge-m3`, `bge-m3-q4_k_m`, `bge-small-en-v1.5-q4_k_m`, `coderankembed`, `german-rag-bge-m3-merged-x-snowflake-arctic-hessian-ai-q8_0`, `jina-code-embeddings-0.5b`, `jina-code-embeddings-1.5b`, `jina-embeddings-v5-omni-nano-retrieval-q4_k_m`, `jina-embeddings-v5-omni-nano-text-matching-q4_k_m`, `jina-embeddings-v5-omni-small-text-matching-q4_k_m`, `multilingual-e5-small`, `multilingual-e5-small-iq4_xs`, `voyage-4-nano`, `voyage-4-nano-f16`, and `wemm-embedding-2b-q4_k_m`.

The model slug, local format, source repository when present, weight SHA-256, quantization, and runtime are recorded separately. Full-precision and quantized copies remain separate candidates. Missing metadata or an unusable backend is reported as a blocked/not-run slot, never silently dropped.

## Frozen task matrix

Run each candidate against the complete published evaluation split and explicitly selected language subset below. The split name is part of the task identity; do not relabel a development split as a test split.

| MTEB task | Language / purpose | Why included |
|---|---|---|
| `MIRACLRetrievalHardNegatives.v2` | subsets `th` and `de`; split `dev`; Thai and German monolingual retrieval | Human-judged multilingual retrieval with pooled hard negatives; Thai coverage plus a direct German-RAG check |
| `BelebeleRetrieval` | subset `tha_Thai-tha_Thai`; split `test`; Thai query to Thai passage | Thai retrieval from MTEB's multilingual reading-comprehension task; use the monolingual pair only |
| `SciFact` | split `test`; English scientific claim-to-evidence retrieval | BEIR-derived zero-shot retrieval task |
| `NFCorpus` | split `test`; English biomedical information retrieval | BEIR-derived domain retrieval task |
| `CodeSearchNetRetrieval` | split `test`; Python, JavaScript, Go, Ruby, Java, PHP | Standard code-search task in MTEB; report each language separately |

Protocol lock: MTEB `2.22.2`; dataset revisions `MIRACLRetrievalHardNegatives.v2=d7d94fa4b946cec4a27c84653aa0cf6b33f74a3c`, `BelebeleRetrieval=979a211276faa22f671e69d096634193567cfd05`, `SciFact=d56462d0e63a25450459c4f213e49ffdb866f7f9`, `NFCorpus=ec0fa4fe99da2ff19ca1214b7966684033a58814`, and `CodeSearchNetRetrieval=68e8f0731a656fa4bd5b7c81936d95ad48a39bfe`. These are MTEB dataset revisions, not model revisions.

These are five selected official tasks, with two MIRACL subsets and six CodeSearchNet language sub-results: 11 task/subset cells per model and 165 cells total. This is not the entire MTEB, BEIR, or CodeSearchNet suite. MIRACL's published evaluation split here is `dev`; the other tasks use `test`. Do not downsample queries/corpus, tune prompts on an evaluation split, train on an evaluation split, or claim aggregate leaderboard equivalence. If a task cannot complete within the hardware guard, record the exact reason and do not substitute a private or generated set under the same task label.

## Frozen model-card input profiles

Use these exact query/document prefixes; `none` means raw text. The model profile is frozen across the task matrix. `768`/`896` dimensional model outputs remain at their card defaults; quantized candidates are not dimension-truncated. Maximum lengths, pooling, and normalization come from the local Hugging Face Sentence-Transformers files or upstream card. GGUF candidates use their local Ollama importer and the upstream card's prompt convention. The source card or conversion page is linked per row.

| Local candidate | Query prefix | Document prefix | Card-derived profile and source |
|---|---|---|---|
| `bge-m3` | none | none | 8,192 tokens; dense 1,024-dim; no query instruction. [BAAI card](https://huggingface.co/BAAI/bge-m3) |
| `bge-m3-q4_k_m` | none | none | Same BGE-M3 dense profile at Q4_K_M. [BAAI card](https://huggingface.co/BAAI/bge-m3), [GGUF source](https://huggingface.co/gpustack/bge-m3-GGUF) |
| `bge-small-en-v1.5-q4_k_m` | `Represent this sentence for searching relevant passages: ` | none | 512 tokens; 384-dim; BAAI recommends this query instruction for short-query retrieval. [BAAI card](https://huggingface.co/BAAI/bge-small-en-v1.5), [GGUF source](https://huggingface.co/ChristianAzinn/bge-small-en-v1.5-gguf) |
| `coderankembed` | `Represent this query for searching relevant code: ` | none | 8,192 tokens; CLS pooling; model card requires this query prefix. The local Nomic-BERT custom architecture was source-audited; loading still requires local `trust_remote_code`. [Model card](https://huggingface.co/nomic-ai/CodeRankEmbed) |
| `german-rag-bge-m3-merged-x-snowflake-arctic-hessian-ai-q8_0` | `search_query: ` | none | 8,192 tokens; 1,024-dim; use the card's query convention. Report German MIRACL separately; other language/task results are out-of-domain checks. [Model card](https://huggingface.co/avemio/German-RAG-BGE-M3-MERGED-x-SNOWFLAKE-ARCTIC-HESSIAN-AI), [GGUF source](https://huggingface.co/avemio/German-RAG-BGE-M3-MERGED-x-SNOWFLAKE-ARCTIC-HESSIAN-AI-Q8_0-GGUF) |
| `jina-code-embeddings-0.5b` | `Find the most relevant code snippet given the following query:\n` | `Candidate code snippet:\n` | 8,192-token cap from the card's inference example (model supports 32,768); BF16; left padding; last-token pooling; 896-dim. [Model card](https://huggingface.co/jinaai/jina-code-embeddings-0.5b) |
| `jina-code-embeddings-1.5b` | `Find the most relevant code snippet given the following query:\n` | `Candidate code snippet:\n` | 8,192-token cap from the card's inference example (model supports 32,768); BF16; left padding; last-token pooling; 1,536-dim. [Model card](https://huggingface.co/jinaai/jina-code-embeddings-1.5b) |
| `jina-embeddings-v5-omni-nano-retrieval-q4_k_m` | `Query: ` | `Document: ` | 8,192 tokens; last-token pooling; retrieval-tuned. [Model card](https://huggingface.co/jinaai/jina-embeddings-v5-omni-nano-retrieval) |
| `jina-embeddings-v5-omni-nano-text-matching-q4_k_m` | `Document: ` | `Document: ` | 8,192 tokens; text-matching-tuned, not retrieval-tuned; this retrieval score is exploratory. [Model card](https://huggingface.co/jinaai/jina-embeddings-v5-omni-nano-text-matching) |
| `jina-embeddings-v5-omni-small-text-matching-q4_k_m` | `Document: ` | `Document: ` | 32,768 tokens; text-matching-tuned, not retrieval-tuned; this retrieval score is exploratory. [Model card](https://huggingface.co/jinaai/jina-embeddings-v5-omni-small-text-matching) |
| `multilingual-e5-small` | `query: ` | `passage: ` | 512 tokens; mean pooling plus L2 normalization. [Model card](https://huggingface.co/intfloat/multilingual-e5-small) |
| `multilingual-e5-small-iq4_xs` | `query: ` | `passage: ` | 512 tokens; inherited E5 input contract. Local file is named IQ4_XS while its local manifest reports GGUF `IQ3_XS`; retain the mismatch in the result identity. [Model card](https://huggingface.co/intfloat/multilingual-e5-small), [GGUF source](https://huggingface.co/cstr/multilingual-e5-small-GGUF) |
| `voyage-4-nano` | `Represent the query for retrieving supporting documents: ` | `Represent the document for retrieval: ` | 32,768 tokens; BF16; mean pooling plus L2 normalization. The local Qwen3 bidirectional architecture was source-audited and requires local `trust_remote_code`; use SDPA on this Windows/CUDA environment. [Model card](https://huggingface.co/voyageai/voyage-4-nano) |
| `voyage-4-nano-f16` | `Represent the query for retrieving supporting documents: ` | `Represent the document for retrieval: ` | Same Voyage prompt convention, F16 GGUF. Community conversion; source identity is recorded, but output parity with original HF weights is unverified. [HF card](https://huggingface.co/voyageai/voyage-4-nano), [GGUF conversion](https://huggingface.co/jsonMartin/voyage-4-nano-gguf) |
| `wemm-embedding-2b-q4_k_m` | none | none | Q4_K_M; 2,048-dim L2-normalized embeddings with last-token pooling; text-only inputs in this retrieval test. [WeMM GGUF card](https://huggingface.co/DreamBlooms/WeMM-Embedding-2B-GGUF) |

For CodeRankEmbed and Voyage, the model cards require custom architecture code for the local Transformers loader. The local Python files were checked for network access, subprocess creation, dynamic `eval`/`exec`, and unrelated file writes before enabling `trust_remote_code`; no such behavior was found. Their normal local weight/tokenizer reads are expected. The Jina code models use the standard Qwen2 architecture and do not need remote code.

## Model input contract

1. Use the installed local weight files for each registered candidate; do not pull model weights or call hosted embedding APIs.
2. Use the model's official MTEB implementation where it supports the installed checkpoint. Otherwise follow that model's published Hugging Face model-card instructions for query/document prefixes, task prompts, pooling, normalization, maximum sequence length, and truncation.
3. Freeze one per-model input profile before its first scored task. Record the source of each setting. Do not adjust a setting after seeing scores.
4. Keep query and document encoding paths distinct where the model card or MTEB task defines them. Preserve the task's language/subset and test split exactly.
5. Use one model at a time. Warm up before timed measurements; release only benchmark-created aliases/residency before the next candidate. Never unload or delete an unrelated model.
6. Do not execute model-provided Python unless its local source is reviewed and the profile records that decision. Default to local-only loading with remote code disabled.

## Metrics and reporting

- **Retrieval quality:** MTEB task's official `ndcg_at_10` main score and other official retrieval metrics returned by the task implementation. Keep each model/task row separate.
- **Encoding performance:** warm document and query examples/second; single-query embedding latency p50 and p95; model load and first-warmup time.
- **Memory:** peak dedicated GPU memory from `nvidia-smi` and peak runner process RSS. Record the measurement interval and whether the model ran in Ollama or the Python process.
- **System context:** GPU model/VRAM, driver, operating system, CPU/RAM, Ollama/Python/torch/transformers/MTEB versions, backend, batch size, precision, sequence limit, and task/data revisions.
- Keep raw model I/O, per-call measurements, task caches, and generated embeddings local under ignored `target/benchmark-5060ti/embedding-007` or a separate cache. Publish only compact metrics, hashes, settings, and reproducibility notes.

Latency is measured locally and is not part of MTEB's retrieval quality score. Runtime results are specific to this single GPU and machine.

## Safety and resource guards

- Preflight all model artifacts, SHA-256 values, running Ollama models, GPU/host memory, and task revisions before scored inference.
- Run serially; start a task only when available VRAM is at least the model's frozen minimum and available host RAM is at least 6 GiB.
- Stop before starting a new batch if host available memory falls below 4 GiB. Do not evict unrelated models/processes or clear user caches.
- On Windows Ollama v0.35.1, the runner spaces requests by their input count to an 18-input/s average. This is not a strict per-request burst limit: an MTEB call can send the configured batch of 64 inputs at once. BGE-M3 CodeSearchNet JavaScript and BGE-M3 Q4 German MIRACL failed with loopback socket errors under this setting. Newly started Ollama processes cap MTEB batches at 8, but Jina Omni small text-matching still failed on Thai MIRACL after 63m50s with the same socket error. Treat batch 8 plus 18 inputs/s as insufficient for long tasks; the next transport setting needs a separate representative-task validation. Record each cell's actual rate and batch settings in its local ledger. These transport guards change elapsed time, not model prompts or ranking metrics. Keep the independent performance smoke unpaced and report it separately. See [RCA EMBED-007 loopback socket pressure](../../.brain/rca/2026-10-04-embedding-007-loopback-socket-exhaustion.md) and the [upstream Ollama report](https://github.com/ollama/ollama/issues/18392).
- Keep MTEB's Windows result-cache file paths below the legacy 260-character limit. Nine current cache failures have paths calculated at 260–268 characters; the full 165-cell matrix's current nested layout reaches 278 characters. `LongPathsEnabled` is 0 on this host, and a 270-character write probe using the benchmark Python environment failed with the same `FileNotFoundError`. The approved local runner patch uses a short deterministic per-cell cache directory, calculated to keep every matrix path at or below 195 characters. See [RCA EMBED-007 Windows MTEB cache-path overflow](../../.brain/rca/2026-10-05-embedding-007-mteb-cache-path-overflow.md).
- Download only benchmark datasets to a dedicated cache outside the repository. Do not redistribute dataset rows.
- If an Ollama alias is needed for a local GGUF, use a unique `llh-embed-007-<slug>` name, confirm it did not exist before creation, and remove only aliases created by this run after confirming the process is unloaded.
- Retain raw run artifacts locally. No raw dataset, embedding matrix, local absolute path, or model response is included in a public commit.

## Acceptance

- All 15 candidate records are listed with local format and resolved weight identity.
- Each of the 165 model/task/subset cells has a terminal status: PASS, FAIL, BLOCKED, OOM, or NOT_RUN with evidence.
- MTEB task versions, data revisions, prompts/settings, quality scores, speed, and memory are traceable to the frozen run.
- Test/latency artifacts stay local; the report contains no absolute machine path.
- The final report does not claim full-suite or multi-GPU coverage.

## Current execution record

The initial SciFact model screen covers all 15 candidates: 13 returned SciFact scores, and 2 failed the local backend smoke check before entering MTEB. The runner records 11 task-specific performance-smoke FAIL rows for each incompatible candidate; those rows are outside the 165-cell matrix. E5-small completed all 11 cells. BGE-small completed an initial 11-cell pass with 8 PASS and 3 socket-related FAIL. The Jina retrieval-tuned candidate completed MIRACL Thai and its resource guard marked nine other cells BLOCKED while another Ollama model was active. BGE-M3 and BGE-M3 Q4 each completed all 11 cells with 10 PASS and one socket-related FAIL. Jina Omni nano text-matching completed 10 PASS and one FAIL. Jina Omni small text-matching completed 9 PASS and two infrastructure FAIL under batch 8 and 18 inputs/s. Across the latest ledger, 135 of 165 matrix cells have terminal status (87 PASS, 39 FAIL, 9 BLOCKED), with 30 cells remaining nonterminal. The batch-8 socket guard is insufficient for long-running MIRACL, and nine MTEB cache writes failed on overlong Windows paths. This is interim evidence only and does not satisfy the full 165-cell acceptance criterion. See [REPORT-EMBED-007](REPORT-EMBED-007.md) for scores, runtime, and per-cell transport settings.

## References

- [MTEB overview and task protocol](https://docs.mteb.org/overview/)
- [MTEB retrieval tasks](https://docs.mteb.org/overview/available_tasks/retrieval/)
- [MTEB available benchmarks, including MTEB(tha, v1)](https://docs.mteb.org/overview/available_benchmarks/)
- [MTEB model/task API and prompt support](https://github.com/embeddings-benchmark/mteb)
- [MIRACL multilingual retrieval dataset](https://github.com/project-miracl/miracl)
- [BEIR heterogeneous retrieval benchmark](https://github.com/beir-cellar/beir)
- [CodeSearchNet dataset and evaluation](https://github.com/github/CodeSearchNet)

## Version history

- 1.0.0 — froze the local 15-model retrieval matrix, task splits, metrics, model-input rules, and resource guards.
- 1.0.1 — corrected MTEB's official MIRACL split to `dev`, pinned exact Thai subsets, task revisions, and the MTEB package version.
- 1.0.2 — added German MIRACL coverage and froze HF-card query/document prompts and local custom-code audit outcomes for all 15 candidates; clarified 165 result cells.
- 1.0.3 — corrected parent-document links and verified host metadata, linked the interim screening report, and recorded current execution status without weakening the 165-cell acceptance criterion.
- 1.0.4 — updated the execution record for E5-small's completed 11-cell matrix and the current 49 terminal results; the frozen benchmark protocol and 165-cell acceptance criterion are unchanged.
- 1.0.5 — documented an 18-input/s Ollama evaluation cap after a Windows loopback socket failure; model profiles, task splits, metrics, and acceptance criteria remain unchanged.
- 1.0.6 — recorded the first Jina Thai result and nine resource-guarded cells to retry; matrix counts updated without changing the frozen profiles or acceptance criterion.
- 1.0.7 — recorded that the 18-input/s average pacer did not prevent a long BGE-M3 socket failure, clarified its 64-input request burst, and updated the interim matrix count; retrieval profiles and acceptance criteria remain unchanged.
- 1.0.8 — added the BGE-M3 Q4 socket failure, distinguished average pacing from request-burst control, and recorded a new 8-input MTEB batch guard as not yet validated.
- 1.0.9 — recorded all BGE-M3 Q4 task outcomes, updated the interim matrix count, and noted that end-to-end validation of the 8-input batch guard has started.
- 1.1.0 — recorded the failed long-task validation of the batch-8 guard, confirmed the Windows MTEB cache-path overflow, and updated the matrix count; model/task profiles and the 165-cell acceptance criterion are unchanged.
- 1.1.1 — recorded approval for a short hashed local cache path and an Ollama transport-validation candidate capped at batch 4 and 4 inputs/s; these transport limits do not alter model profiles or task acceptance.
