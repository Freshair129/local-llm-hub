# BENCH-5060TI-GENERAL-005: Register and test eleven local LLM configurations

Status: execution authorized by the user's request to register models and test, following the eleven untested general LLM configurations. Complexity C-2; operational risk MEDIUM. Parent: [SPEC-EVAL-002](SPEC-EVAL-002-evaluation-hardening.md). Peers: [HF-003](BENCH-5060TI-HF-003.md), [JACK-004](BENCH-5060TI-JACK-004.md).

## Scope and acceptance

Register the eleven catalog entries of kind llm in F:/Models under separate llh-general-* aliases. Preserve source files, existing aliases, prior evidence and product routing. The same two frozen Rust tasks and seeds 42/43/44 produce 66 planned slots. This is a coding-transfer probe, not validation of medical, cooking, document, Thai, agentic or multimodal expertise. Other 36 non-LLM entries and further repairs of previously tested coders are outside this round.

1. Snapshot the catalog and local metadata, verify hashes against local metadata, pin retrievable HF cards/configs and match HF weight hashes where available. Unknown provenance remains explicit; do not invent source identity from a filename. Safetensors may be imported by Ollama without quantization, with the resulting representation recorded. No remote weights downloads or edits to source weights.
2. Apply model-specific HF sampling guidance when identified. Distinguish exact-model recommendations, usage examples, base-model guidance and local fallback. Default missing controls to the recorded local preset; never describe fallback as HF-recommended. Freeze settings before generation. Context/output limits are bounded machine controls rather than a claim to reproduce long-context author evaluations.
3. Register serially with no alias overwrite. Record native runtime templates, capabilities, digests and any import errors. Use native templates unless a documented compatibility issue requires a separate candidate. Unsupported imports are blocked slots, not model-quality failures.
4. Generate serially, one resident model at a time, checking for unrelated residency. Unload between tasks and models. Preserve cold/warm latency, token counts, reasoning and raw final answers, sampled VRAM and runtime placement. Permit ordinary CPU offload and label it. Never silently lower context, change settings or retry failed slots after seeing outcomes.
5. Inspect generated code before compiler execution. Reuse the existing compiler/visible/held-out/guard/trace checks plus a separate whole-response single-Rust-fence format gate. Keep functional, code-gate and combined outcomes separate. Infrastructure errors and output-budget exhaustion remain explicit. No answer repairs or promotion into product routing.
6. Account for all 66 slots, including blocked/NOT_RUN. Verify request/profile/source hashes, prior artifact preservation, relevant harness self-tests and unloaded final state. Save a registry/profile, reproducible preparation recipe and report with version diff.

## Minimal implementation

Add this benchmark ID to the existing runner's save-error/continue allowlist, so one unsupported model does not abort the other ten candidates. No scoring changes. Add round-specific source/preparation/audit scripts under the new run evidence directory. Snapshot the old harness before changing its allowlist; prior generated evidence remains immutable.

## Resource and provenance decisions

Template compatibility addendum: Q4 Typhoon's local GGUF was confirmed to have no tokenizer.chat_template, and its imported alias uses a plain completion fallback. Preserve the frozen native round; after its completion register a separate llh-general-typhoon-q4-chat:bench005 alias using only the author's text-role ChatML framing (no task-specific system rules) and run six additional slots in TYPHOON-CHAT-5060TI-2026-10-03. Do not overwrite native results or call the comparison a new unseen benchmark. [RCA](../../.brain/rca/2026-10-03-typhoon-q4-missing-chat-template.md).

Pre-inference compatibility revision: Ollama 0.35.1 direct safetensors import failed because its MLX runtime is unavailable on this Windows host. Preserve the initial registration manifest separately. Convert affected safetensors to unquantized BF16/F16 GGUF using pinned official llama.cpp tooling in target/benchmark-5060ti, record conversion hashes and commands, then register without alias overwrite. Original model files stay intact. This changes storage representation, not to a lower-bit quantization. See [RCA](../../.brain/rca/2026-10-03-safetensors-mlx-import.md).

The installed device is an RTX 5060 Ti with 16 GB VRAM, not the skill's historical RTX 3060. Apply only its serial-residency rule here; no multi-agent SWE pipeline is needed. Safetensors candidates are Qwen3 0.6B and Typhoon 4B. Softnix Q8 weights alone approach available GPU capacity; report actual CPU/GPU placement rather than forcing full offload. The final settings table and source limitations will be recorded before inference.

## Frozen settings before inference

| Alias | T / top_p / top_k / repeat | Thinking | Context / output cap | Provenance |
|---|---|---|---|---|
| llh-general-gemma-agentic:bench005 | 0.6/0.95/20/1 | true | 16384/8192 | Local fallback; exact HF source unknown |
| llh-general-dark-champion:bench005 | 0.7/0.95/40/1.1 | native | 8192/4096 | Author linked sampler guide; local temperature 0.7 and repeat 1.1 selected within author ranges; smoothing unsupported, author repetition alternative used |
| llh-general-ornith:bench005 | 0.6/0.95/20/1 | true | 16384/8192 | Exact HF precise-coding sampling recipe |
| llh-general-qwen25-small:bench005 | 0.7/0.8/20/1.1 | native | 8192/4096 | HF upstream Instruct generation_config; local GGUF source identity needs runtime metadata corroboration, no exact HF weight match |
| llh-general-qwen3-small:bench005 | 0.6/0.95/20/1 | true | 16384/8192 | Exact HF thinking sampling recommendation |
| llh-general-qwen35:bench005 | 0.6/0.95/20/1 | true | 16384/8192 | HF upstream precise-coding thinking recipe; Ollama GGUF exact HF file provenance not established |
| llh-general-softnix:bench005 | 0.6/0.95/20/1 | native | 8192/4096 | Local fallback; exact card supplies no numeric sampling recipe |
| llh-general-thaidoc:bench005 | 0.6/0.95/20/1 | native | 16384/8192 | Local fallback; exact card supplies no numeric sampling recipe |
| llh-general-thai-medapp:bench005 | 0.4/0.9/20/1.05 | native | 8192/512 | HF source-model stabilized generation_config and recommended interactive cap; not a medical benchmark |
| llh-general-typhoon-bf16:bench005 | 0.6/0.95/20/1.05 | native | 8192/4096 | HF author example temp/top_p and recommended repetition penalty; native non-thinking template |
| llh-general-typhoon-q4:bench005 | 0.6/0.95/20/1.05 | native | 8192/4096 | HF source author example temp/top_p and recommended repetition penalty; native template |

Other neutral controls and source pins are in eval/config/general-5060ti-profiles.json. DavidAU uses min_p=0.05; others use 0. All use repeat_last_n=64, presence/frequency penalties=0. Missing top_k values use local20. Exact HF weight matching is recorded per file; local-metadata-only provenance does not block this explicitly labelled local probe.

## Completed outcome

All eleven configurations registered and returned all 66 planned responses. Five requests exhausted the local output ceiling (Ornith 3, Qwen3.5 2); there were no inference runtime errors or NOT_RUN slots. Raw source inspection preceded compiler/tests. The separate Typhoon explicit-template comparison completed six additional requests, with byte-identical final answers and the same scores as native Q4; it did not improve code quality. Prior artifacts and aliases stayed unchanged, and models were unloaded after both runs. [Report, score table and usage](../../eval/reports/BENCH-5060TI-GENERAL-2026-10-03.md).
