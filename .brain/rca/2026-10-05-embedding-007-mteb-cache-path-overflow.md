# RCA — EMBED-007 Windows MTEB result-cache path overflow

| Field | Value |
|---|---|
| Date | 2026-10-05 |
| Run | EMBED-007, MTEB 2.22.2 |
| Risk | MEDIUM — local benchmark cache and run duration only |
| Status | Root cause confirmed by a path-length probe; short hashed cache-path correction approved and under implementation |

## Symptom

Nine embedding-matrix cells failed with `FileNotFoundError` while MTEB wrote task-result JSON under a nested per-model, per-task cache directory. The path included a `no_revision_available` component for local Ollama models, which initially made a missing revision look like the cause.

## Evidence

- The ledger contains eight result-cache `FileNotFoundError` cells for the German-RAG GGUF and one for Jina Omni small text-matching. Their calculated task-result paths are 260–268 characters. Shorter task paths for those same models, including NFCorpus, completed.
- The full current cache layout reaches 278 characters across the frozen 165-cell matrix. This comes from nesting the benchmark cache root, model slug, task/subset directory, MTEB `results` directory, model slug again, revision label, and task filename.
- Windows `LongPathsEnabled` is `0` on this host. Using the same Python environment as the benchmark, a scratch file write at 270 characters returned `FileNotFoundError` after successfully creating its parent directories. The scratch directory was removed after the probe.
- MTEB 2.22.2 `ResultCache.save_to_cache` creates the result file's parent directories before `TaskResult.to_disk` opens the JSON file. The failure at the final file path plus the matching Windows probe confirms the path-length limit; `no_revision_available` is a path segment, not the root cause.
- A proposed 12-character deterministic hash of model/task/subset in the per-cell cache root calculates to a maximum full result path of 195 characters for all 165 cells, while preserving full model/task identity in the benchmark ledger.

## Root Cause

The local runner builds an over-nested MTEB result-cache path. Some complete file paths meet or exceed Windows' legacy 260-character limit while long-path support is disabled. The parent directories can be created, but opening the result JSON at the full path fails. MTEB surfaces this as `FileNotFoundError`, so the reported missing file obscures the path-length cause.

## Why the issue escaped detection

The earlier model and task checks verified loading, inference, and scores but did not write a result JSON at the longest generated path. The runner stored only exception type and message, without a traceback or path-length guard. The first long cache failures were therefore interpreted as missing result/revision metadata.

## Proposed prevention

Use a short deterministic per-cell cache directory derived from the model slug, task name, and subset. Assert that all 165 generated result paths are below 260 characters and run an isolated cache-write smoke using the benchmark environment. Then retry only the result-cache failures and preserve the complete cell identity in the ledger. Do not change Windows registry settings or model/task evaluation profiles as a workaround.
