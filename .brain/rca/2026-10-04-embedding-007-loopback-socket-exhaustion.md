# RCA — EMBED-007 Windows Ollama loopback socket exhaustion

| Field | Value |
|---|---|
| Date | 2026-10-04 |
| Run | EMBED-007, MTEB 2.22.2 |
| Risk | MEDIUM — local benchmark harness and run duration only |
| Status | Socket failure reproduced under batch size 8 and average pacing; machine-wide socket pressure attribution remains partial |

## Symptom

The initial full-matrix pass for `bge-small-en-v1.5-q4_k_m` failed on MIRACL Thai, MIRACL German, and CodeSearchNet Java. A later BGE-M3 pass also failed on CodeSearchNet JavaScript after the runner enabled its 18-input/s average pacer. Ollama returned HTTP 400 from `/v1/embeddings`; the embedded error said that it could not dial its local runner's `/tokenize` endpoint because Windows had insufficient socket buffer space or a full queue. Other BGE-M3 cells passed, including German MIRACL and four other longer retrieval/code tasks.

## Evidence

- The BGE-small log records the exact `/tokenize` socket error after 18:56 on MIRACL Thai, again on MIRACL German, and on CodeSearchNet Java. Its task summary is 8 PASS and 3 FAIL across 11 cells.
- Windows reported a TCP dynamic port range of 16,384. A `netstat` snapshot after the failure showed 15,790 IPv4 TIME_WAIT rows, 15,761 remote-loopback rows, and 29 non-loopback rows. Of those, 394 rows targeted runner port 64337 and 124 targeted Ollama port 11434. TIME_WAIT row count is not a count of unique local ports; most connections targeted other local endpoints, so the source of the majority is not attributed to this benchmark.
- The runner is Ollama v0.35.1. Its pinned source configures the internal runner HTTP transport with `DisableKeepAlives: true` ([v0.35.1 source](https://github.com/ollama/ollama/blob/v0.35.1/llm/llama_server.go#L2513-L2527)). The [Ollama bulk-embedding report](https://github.com/ollama/ollama/issues/18392) describes Windows loopback socket exhaustion under sustained embedding, explains the per-input internal requests, and reports no failures after pacing at 18 inputs per second.
- This runner invokes MTEB serially (`num_proc=1`); its ordinary 20-sample performance smoke does not exercise sustained corpus volume.
- The revised run's BGE-M3 CodeSearchNet JavaScript row records the same Windows socket-buffer/queue error with `mteb_max_inputs_per_second=18.0`; host free RAM was 10.35 GiB and free GPU memory was 13.77 GiB at task start. The cell failed after 112 seconds. BGE-M3 German MIRACL (`4,003.274` sec), NFCorpus, Python, Go, Ruby, Java, and PHP passed under the pacing guard.
- BGE-M3 Q4 MIRACL German later failed after 16 minutes 52 seconds with the same `/tokenize` socket error while using the 18-input/s average and 64-input batch. Host free RAM was 11.31 GiB and free GPU memory was 14.22 GiB at task start. This reproduces the transport failure under a second model and task, without crossing the host/GPU low-memory guards.
- The runner's pacer delays between API requests by the number of inputs in each payload. The MTEB batch size for BGE-M3 is 64, so a single request may still deliver 64 inputs as one burst; the 18-input/s value is a long-run average and not a per-request concurrency bound.
- A Windows TCP snapshot after this later failure showed 6,143 IPv4 TIME_WAIT rows, of which 6,103 were remote-loopback rows, 119 targeted the current runner port, and 31 targeted Ollama port 11434. These are state rows rather than unique local ports. The majority of loopback rows targeted other local endpoints and remain unattributed.
- Jina Omni small text-matching's Thai MIRACL `dev` cell failed after 63m50s with the same Ollama `/tokenize` socket-buffer/queue error. Its ledger records batch size 8, the 18-input/s average pacer, 7.92 GiB free host RAM, and 8.42 GiB free GPU memory at task start. The batch-8 guard therefore did not prevent a long-run failure; this was not an OOM or low-memory-guard stop.

## Root Cause

Ollama v0.35.1 disables keep-alive on its internal HTTP client to the model runner. Long embedding jobs therefore create repeated loopback connections. The Windows networking stack rejected tokenizer connections with `WSAENOBUFS`/queue exhaustion. The 18-input/s pacer limited average throughput but allowed a 64-input request burst; changing the request batch to 8 did not prevent the same error after 63m50s. Repeated evidence supports a local loopback transport/resource failure, but the contribution of Ollama's connection churn versus broader machine-wide socket pressure remains unconfirmed. This is not a retrieval-score failure or model-profile mismatch.

## Why the issue escaped detection

The earlier SciFact screen and 20-example performance smoke completed before sustained request volume accumulated. The first pacing change was validated against an upstream report and an average-rate fake-clock test, but did not account for the MTEB request batch size and was incorrectly described as a strict per-second bound. The batch-8 guard was checked with mapping/compile assertions but had not completed a representative long task before the report described it as under validation. Existing preflight guards checked host RAM and GPU VRAM but did not validate long-run socket behavior.

## Prevention

The batch-8 plus 18-input/s setting is insufficient for long tasks. The approved validation candidate is batch size 4 with a 4-input/s average pacer; it must pass a representative long MIRACL task before any socket-failed cell is retried or the guard is called sufficient. Keep the frozen prompts, dataset revisions, and model profiles unchanged; the independent performance smoke remains unpaced and is reported separately. Do not change Windows TCP settings, restart the user's Ollama service, or unload unrelated models as part of mitigation. The separate cache-path defect is documented in [RCA EMBED-007 Windows MTEB cache-path overflow](2026-10-05-embedding-007-mteb-cache-path-overflow.md).
