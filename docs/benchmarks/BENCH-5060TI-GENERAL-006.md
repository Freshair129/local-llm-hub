# BENCH-5060TI-GENERAL-006 — Qwen3-4B local baseline

| Field | Value |
|---|---|
| Version | 1.0.0 |
| Date | 2026-10-04 (Asia/Bangkok) |
| Status | User authorized; execution pending |
| Complexity / risk | C-2 / MEDIUM |
| Parent | [SPEC-EVAL-002](SPEC-EVAL-002-evaluation-hardening.md) |
| Peer | [GENERAL-005](BENCH-5060TI-GENERAL-005.md) |

## Objective and scope

Register the already-installed local `qwen3:4b` under the new alias `llh-general-qwen3-4b:bench006` and test it as one additional coding-transfer baseline. Use the same two frozen Rust tasks and seeds 42, 43, and 44 used by GENERAL-005: FR-002 and FR-006, for six planned requests. This does not broaden the suite or make claims about general Thai, medical, document, or agentic capability.

Run from the isolated worktree based on the pushed repository commit. Keep the working tree clean at inference start and place temporary run files under ignored `target/benchmark-5060ti`. Do not overwrite the source model or any existing alias. Do not download weights, change prompts, retry a failed request, lower a token limit after observing an answer, repair model output, or promote a result into product routing.

## Model identity and settings

- Local source: Ollama `qwen3:4b`, runtime digest `sha256:359d7dd4bcdab3d86b87d73ac27966f4dbb9f5efdfcc75d34a8764a09474fae7`; Ollama reports GGUF, Q4_K_M, 4.0B parameters, and 2,497,293,931 bytes.
- Guidance source: [Qwen/Qwen3-4B](https://huggingface.co/Qwen/Qwen3-4B/tree/1cfa9a7208912126459214e8b04321603b3df60c). The local GGUF is not verified byte-for-byte against an HF safetensors file; attribute sampling settings to the HF source model and local identity to the Ollama digest.
- Thinking mode: enabled. The HF card says thinking is the default and recommends temperature 0.6, top-p 0.95, top-k 20, and min-p 0.
- HF context/output allocation: `num_ctx=40960`, `num_predict=32768`, matching the card's 8,192-token typical prompt plus 32,768-token output allocation. This is a bounded test configuration, not a long-context claim.
- Remaining local controls: repeat penalty 1, repeat-last-n 64, presence/frequency penalties 0; record these as Ollama/local controls where the HF card does not recommend a value.
- Timeout: 900,000 ms per request. Seeds: 42, 43, 44. Settings and task hashes are frozen in the profile before inference.

## Execution and safety gates

1. Confirm worktree HEAD, clean Git status, task/heldout hashes, base-model digest, distinct alias, idle Ollama residency, and at least 12,000 MiB free GPU memory. Refuse to evict unrelated resident models.
2. Create the derived Ollama alias from the local source tag and verify its sampler, thinking capability, template, and runtime digest. Run one model at a time; unload between tasks and at completion.
3. Generate exactly six requests with the existing runner. Record requests, raw answers/thinking, response metadata, sampled device memory, and runtime placement only under local ignored or untracked run artifacts.
4. Inspect every generated Rust source and execution-review flag before running compiler or test binaries. Then run visible and heldout Rust tests, along with guard, trace, and single-Rust-fence checks. Do not execute flagged output.
5. Account for every slot as PASS, FAIL, BLOCKED, TRUNCATED, or NOT_RUN. Verify saved request settings/hashes, prior artifacts, and an unloaded final model state. Report observed metrics separately from the 11-model GENERAL-005 cohort.

## Acceptance

- The isolated worktree was clean when generation began.
- The new alias is distinct and the original `qwen3:4b` remains unchanged.
- All six slots have explicit outcomes and the exact frozen request settings.
- Generated code was inspected before execution; all validation evidence is local.
- The report distinguishes HF settings from unverified HF weight matching and does not claim performance on other GPUs.

## Outcome

Pending execution.
