# RCA EMBED-007 Voyage-4-Nano CodeSearchNet CUDA OOM

| Field | Value |
|---|---|
| RCA ID | RCA-EMBED-007-VOYAGE-CODESEARCHNET-OOM |
| Date | 2026-10-05 |
| Status | Root cause confirmed; retry pending a fresh resource check and approved run setting |
| Related run | EMBED-007, Voyage-4-Nano HF, MTEB 2.22.2 |

## Symptom

Voyage-4-Nano passed CodeSearchNet Python, then the JavaScript retrieval cell ended with CUDA out of memory. The runner stopped the model's remaining Go, Ruby, Java, and PHP cells and recorded each as `NOT_RUN`. The JavaScript cell has no retrieval score.

## Evidence

- The ledger records MTEB batch size 8 for the JavaScript cell and `resources_at_start.gpu_free_gib = 4.36`, `gpu_used_gib = 11.32`.
- The CUDA exception reports zero free GPU memory while attempting a 17,179,869,184-byte allocation on a device with 17,074,421,760 bytes total. PyTorch reports 13.70 GiB allocated and 2.11 GiB reserved but unallocated.
- The Voyage profile uses MTEB batch size 8 and a static `min_vram_gib` of 4. The pre-task resource guard checks free VRAM against that minimum; 4.36 GiB passed it by 0.36 GiB.
- The runner's OOM path records the failed cell and marks later candidate cells `NOT_RUN`; the ledger contains four such language rows.

## Root Cause

The JavaScript retrieval evaluation's working set exceeded the GPU memory available to the Voyage-4-Nano HF run at batch size 8. The task began with only 4.36 GiB free, then exhausted the remaining device memory and could not satisfy its next 16 GiB allocation request. The static 4 GiB per-profile guard did not provide sufficient task-specific headroom.

## Why the issue escaped detection

The pre-task guard applies one profile-level VRAM minimum to every task. It does not estimate the memory needed for a task's corpus or dynamically lower the HF MTEB batch size. The available 4.36 GiB therefore passed the guard even though the JavaScript task later required more memory.

## Proposed prevention

Keep the OOM and subsequent `NOT_RUN` statuses visible in the matrix. Before retrying these cells, verify host and GPU availability, document a lower HF MTEB batch as a run-specific setting, and retry the failed cell plus the four unrun languages serially. Preserve the original batch-8 results and settings for the already-passed cells. Do not claim the reduced-batch retry is equivalent performance evidence.
