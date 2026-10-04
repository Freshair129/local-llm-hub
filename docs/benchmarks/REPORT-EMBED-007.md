# EMBED-007 — Interim local embedding benchmark report

| Field | Value |
|---|---|
| Report ID | REPORT-EMBED-007 |
| Version | 0.2 |
| Status | Interim; Thai follow-up complete for three candidates; full task matrix pending |
| Protocol | [BENCH-SPEC-EMBEDDINGS-001 v1.0.3](BENCH-SPEC-EMBEDDINGS-001.md) |
| Run | EMBED-007, MTEB 2.22.2 |
| Host context (verified live during this run) | NVIDIA GeForce RTX 5060 Ti 16 GB; Intel Core i7-14700KF; 31.76 GiB visible system RAM; Windows 11 Pro build 26300; NVIDIA driver 617.14; CUDA UMD 13.4 |

## Scope and method

This report records the initial local-backend screen for all 15 candidates, SciFact quality results where the candidate reached MTEB, and completed Thai retrieval cells. The frozen protocol defines 11 task/subset cells per model, or 165 cells total. The present screen is partial; its SciFact scores do not establish a multilingual, code-search, domain-wide, or overall model ranking.

MTEB SciFact ran on `default/test` at dataset revision `d56462d0e63a25450459c4f213e49ffdb866f7f9`. Thai runs use MIRACL hard negatives `th/dev`, revision `d7d94fa4b946cec4a27c84653aa0cf6b33f74a3c`, and Belebele Thai `test`, revision `979a211276faa22f671e69d096634193567cfd05`. Each model used its frozen model-card input profile in the protocol. The run used local weights only and made no hosted embedding API calls.

Default Python runtime: Python 3.12.10, PyTorch 2.14.0+cu130, Transformers 5.16.1, Sentence Transformers 6.0.1, MTEB 2.22.2. CodeRankEmbed's compatible retry used Transformers 4.45.1 and Sentence Transformers 5.3.0; Voyage-4-Nano HF used Transformers 4.57.1 and Sentence Transformers 5.3.0. GGUF tests used local Ollama 0.35.1. Every successful SciFact run used the same task and dataset revision; the two failed GGUF cells have no retrieval score.

## SciFact retrieval quality

Scores are MTEB's official `nDCG@10` main score, with `MRR@10` and `Recall@100` included for context. Higher is better within this task. Rows are not an overall leaderboard.

| Candidate | Status | nDCG@10 | MRR@10 | Recall@100 | Evaluation seconds | Result note |
|---|---:|---:|---:|---:|---:|---|
| `bge-m3` | PASS | 0.64336 | 0.60805 | 0.90367 | 133.374 | HF |
| `bge-m3-q4_k_m` | PASS | 0.63298 | 0.59562 | 0.90033 | 166.894 | GGUF via Ollama |
| `bge-small-en-v1.5-q4_k_m` | PASS | 0.71758 | 0.68155 | 0.95333 | 83.948 | English model |
| `coderankembed` | PASS | 0.56458 | 0.53014 | 0.84967 | 148.712 | Code-focused; SciFact is out of domain |
| `german-rag-bge-m3-merged-x-snowflake-arctic-hessian-ai-q8_0` | PASS | 0.68042 | 0.65533 | 0.91000 | 154.298 | German-focused; SciFact is out of domain |
| `jina-code-embeddings-0.5b` | PASS | 0.54051 | 0.50257 | 0.88922 | 113.282 | Code-focused; SciFact is out of domain |
| `jina-code-embeddings-1.5b` | PASS | 0.56082 | 0.52057 | 0.89167 | 277.968 | Code-focused; SciFact is out of domain |
| `jina-embeddings-v5-omni-nano-retrieval-q4_k_m` | PASS | 0.66764 | 0.63699 | 0.88167 | 94.079 | Retrieval-tuned |
| `jina-embeddings-v5-omni-nano-text-matching-q4_k_m` | PASS | 0.45583 | 0.42873 | 0.68667 | 91.860 | Text-matching model; retrieval result exploratory |
| `jina-embeddings-v5-omni-small-text-matching-q4_k_m` | PASS | 0.66278 | 0.62510 | 0.91667 | 311.345 | Text-matching model; retrieval result exploratory |
| `multilingual-e5-small` | PASS | 0.67700 | 0.64514 | 0.92500 | 39.006 | HF |
| `multilingual-e5-small-iq4_xs` | FAIL | — | — | — | — | Ollama BERT executor returned HTTP 500; model requires token-type-count metadata |
| `voyage-4-nano` | PASS | 0.75229 | 0.72139 | 0.96333 | 97.211 | HF; compatible isolated runtime |
| `voyage-4-nano-f16` | FAIL | — | — | — | — | Local Ollama output is 1,024 dimensions; frozen profile expects 2,048 |
| `wemm-embedding-2b-q4_k_m` | PASS | 0.41377 | 0.37211 | 0.82389 | 556.005 | GGUF via Ollama |

The top SciFact candidate in this screen is Voyage-4-Nano HF (`nDCG@10=0.75229`). That finding applies to this English scientific retrieval task and does not establish a general winner. The two text-matching-tuned Jina candidates are exploratory for retrieval under their published training objective.

## Thai retrieval quality

| Candidate | Task and split | Status | nDCG@10 | MRR@10 | Recall@100 | Evaluation seconds |
|---|---|---:|---:|---:|---:|---:|
| `multilingual-e5-small` | MIRACL Thai hard negatives, `dev` | PASS | 0.74955 | 0.77151 | 0.98627 | 304.761 |
| `multilingual-e5-small` | Belebele Thai, `test` | PASS | 0.87606 | 0.85331 | 0.98889 | 7.964 |
| `bge-m3` | MIRACL Thai hard negatives, `dev` | PASS | 0.82728 | 0.85069 | 0.99293 | 1,804.637 |
| `bge-m3` | Belebele Thai, `test` | PASS | 0.91400 | 0.89533 | 0.99444 | 23.252 |
| `bge-m3-q4_k_m` | MIRACL Thai hard negatives, `dev` | PASS | 0.81639 | 0.83317 | 0.99254 | 1,808.659 |
| `bge-m3-q4_k_m` | Belebele Thai, `test` | PASS | 0.90980 | 0.89111 | 0.99444 | 24.632 |

E5-small used the card-required `query: ` and `passage: ` prefixes, 512-token limit, mean pooling, and L2 normalization. The results are task-specific and should not be compared numerically across MIRACL and Belebele. On the same task/split, Q4 BGE-M3 trailed full BGE-M3 by 0.01089 nDCG@10 on MIRACL and 0.00420 on Belebele. All three Thai-tested candidates passed both tasks.

## Local latency and memory screening

Latency is single-query embedding latency over 20 samples (`p50`/`p95`). Query/document throughput uses batch size 32. GPU delta and runner RSS are the observed peaks during MTEB plus the performance smoke check, not isolated load-only measurements. Host memory is the minimum available during the run. These numbers describe this one PC and are not MTEB quality metrics.

| Candidate | Query latency p50/p95 (ms) | Query/doc throughput (items/s) | GPU memory delta (GiB) | Runner RSS (MiB) | Minimum host free (GiB) |
|---|---:|---:|---:|---:|---:|
| `bge-m3` | 22.25 / 54.23 | 179 / 86 | 0.85 | 2,222 | 4.46 |
| `bge-m3-q4_k_m` | 25.02 / 281.85 | 211 / 175 | 0.37 | 1,047 | 5.83 |
| `bge-small-en-v1.5-q4_k_m` | 13.94 / 40.75 | 305 / 329 | 0.20 | 994 | 8.60 |
| `coderankembed` | 8.59 / 10.08 | 1,276 / 1,642 | 14.46 | 6,449 | 3.34 |
| `german-rag-bge-m3-merged-x-snowflake-arctic-hessian-ai-q8_0` | 25.38 / 267.08 | 182 / 174 | 0.49 | 967 | 5.89 |
| `jina-code-embeddings-0.5b` | 18.01 / 19.66 | 937 / 1,529 | 2.10 | 2,187 | 7.66 |
| `jina-code-embeddings-1.5b` | 22.57 / 22.88 | 533 / 695 | 4.12 | 2,249 | 7.26 |
| `jina-embeddings-v5-omni-nano-retrieval-q4_k_m` | 31.78 / 303.57 | 279 / 301 | 0.64 | 958 | 7.51 |
| `jina-embeddings-v5-omni-nano-text-matching-q4_k_m` | 26.79 / 34.84 | 42 / 149 | 0.64 | 958 | 7.52 |
| `jina-embeddings-v5-omni-small-text-matching-q4_k_m` | 11.49 / 29.43 | 30 / 184 | 6.12 | 1,069 | 6.10 |
| `multilingual-e5-small` | 5.35 / 6.99 | 2,140 / 3,325 | 1.52 | 2,037 | 7.92 |
| `bge-m3-q4_k_m` | 27.13 / 46.89 | 192 / 157 | 0.41 | 2,209 | 4.07 |
| `voyage-4-nano` | 18.21 / 20.60 | 1,428 / 1,557 | 2.33 | 2,123 | 8.63 |
| `wemm-embedding-2b-q4_k_m` | 33.79 / 44.27 | 88 / 37 | 5.09 | 987 | 5.41 |

CodeRankEmbed's run approached the resource guard: measured GPU delta was 14.46 GiB, runner RSS was 6,449 MiB, and minimum host free memory was 3.34 GiB. The task completed, but additional large CodeRank runs require a fresh resource check and must not begin while free host memory is below the protocol threshold. BGE-M3 Q4's minimum host free memory was 4.07 GiB, just above the in-run stop threshold. The failed GGUF candidates have no valid throughput or latency result and are omitted above.

## Failures and root causes

- **CodeRankEmbed HF:** the first load failed because Transformers loaded duplicate dynamic `NomicBertConfig` class identities and the custom-code flag was not passed through the SentenceTransformer constructor. It passed SciFact using a compatible isolated Transformers 4.45.1 / Sentence Transformers 5.3.0 environment after the runner was corrected.
- **Voyage-4-Nano HF:** the model's local custom code imports a module absent from the card-configured Transformers 4.51.3 runtime. It passed SciFact using Transformers 4.57.1 / Sentence Transformers 5.3.0.
- **E5 IQ4_XS GGUF:** local Ollama's BERT executor exited because the GGUF does not define the required token-type count. Both `/api/embed` and `/v1/embeddings` failed; there is no score.
- **Voyage F16 GGUF:** local Ollama returned 1,024 dimensions for default, 1,024, and requested 2,048 output dimensions. This violates the frozen profile; whether the conversion or runtime causes the cap remains unresolved.

Detailed evidence and prevention actions are recorded in [RCA EMBED-007](../../.brain/rca/2026-10-04-embedding-007-initial-load-failures.md). No model files or application source were changed.

## Completion status and next work

At this report revision, 41 of 165 candidate-task cells have terminal results: 19 PASS with scores and 22 FAIL at performance smoke; 124 cells have not started. All 15 candidates have a SciFact screen: 13 returned scores and E5 IQ4 / Voyage F16 failed before MTEB. The updated runner records 11 task-specific performance-smoke failures for each incompatible candidate. Thai E5-small, BGE-M3, and BGE-M3 Q4 each passed both selected Thai tasks. No benchmark process is active now. Do not interpret the report as completion of the full matrix.

Next, continue with German MIRACL and the remaining NFCorpus and CodeSearchNet language cells as resource guards permit. Keep raw task artifacts and absolute paths outside the public report and repository.

## Version history

- 0.1 — initial interim screen: all 15 SciFact cells, E5-small Thai cells, latency/memory smoke data, loader compatibility findings, and pending matrix status.
- 0.2 — added full-precision and Q4 BGE-M3 Thai results, task-specific failure rows for both incompatible GGUF candidates, verified live host metadata, and corrected terminal/pending cell counts.
