# RCA — EMBED-007 Windows Ollama loopback socket exhaustion

| Field | Value |
|---|---|
| Date | 2026-10-04 |
| Run | EMBED-007, MTEB 2.22.2 |
| Risk | MEDIUM — local benchmark harness and run duration only |
| Status | Root cause mechanism confirmed; local socket pressure attribution is partial |

## Symptom

The initial full-matrix pass for `bge-small-en-v1.5-q4_k_m` failed on MIRACL Thai, MIRACL German, and CodeSearchNet Java. The runner returned HTTP 400 from local Ollama `/v1/embeddings`; the embedded error said that Ollama could not dial its local runner at `127.0.0.1:64337/tokenize` because Windows had insufficient socket buffer space or a full queue. Other BGE-small cells passed.

## Evidence

- The BGE-small log records the exact `/tokenize` socket error after 18:56 on MIRACL Thai, again on MIRACL German, and on CodeSearchNet Java. Its task summary is 8 PASS and 3 FAIL across 11 cells.
- Windows reported a TCP dynamic port range of 16,384. A `netstat` snapshot after the failure showed 15,790 IPv4 TIME_WAIT rows, 15,761 remote-loopback rows, and 29 non-loopback rows. Of those, 394 rows targeted runner port 64337 and 124 targeted Ollama port 11434. TIME_WAIT row count is not a count of unique local ports; most connections targeted other local endpoints, so the source of the majority is not attributed to this benchmark.
- The runner is Ollama v0.35.1. Its pinned source configures the internal runner HTTP transport with `DisableKeepAlives: true` ([v0.35.1 source](https://github.com/ollama/ollama/blob/v0.35.1/llm/llama_server.go#L2513-L2527)). The [Ollama bulk-embedding report](https://github.com/ollama/ollama/issues/18392) describes Windows loopback socket exhaustion under sustained embedding, explains the per-input internal requests, and reports no failures after pacing at 18 inputs per second.
- This runner invokes MTEB serially (`num_proc=1`); its ordinary 20-sample performance smoke does not exercise sustained corpus volume.

## Root Cause

Ollama v0.35.1 disables keep-alive on its internal HTTP client to the model runner. Long embedding jobs therefore create repeated loopback connections. During the MIRACL and CodeSearchNet cells, the Windows networking stack rejected a tokenizer connection with `WSAENOBUFS`/queue exhaustion. The observed socket state was under broad local pressure; the benchmark's precise share of machine-wide TIME_WAIT connections is unknown. This is a local Ollama transport/resource failure, not a retrieval-score failure or model-profile mismatch.

## Why the issue escaped detection

The earlier SciFact screen and 20-example performance smoke completed before sustained request volume accumulated. Existing preflight guards checked host RAM and GPU VRAM but did not pace Ollama inputs or inspect socket pressure.

## Prevention

The local benchmark runner will pace Ollama-backed MTEB traffic to at most 18 input items per second. This retains the frozen model prompts, dataset revisions, and batch profiles; it changes evaluation wall time but not the embedding inputs or retrieval metrics. The independent performance smoke remains unpaced and is reported separately. Retry the three BGE-small cells that failed in the initial pass. Do not change Windows TCP settings, restart the user's Ollama service, or unload unrelated models as part of this mitigation.
