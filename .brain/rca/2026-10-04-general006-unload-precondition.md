# RCA: unload must require resident model state

## Symptom

At the start of a clean benchmark, Ollama reports no resident models, but the harness still calls /api/generate with keep_alive set to 0 to unload the candidate. This adds an unnecessary model endpoint call before the first measured prompt and relies on endpoint behavior for an already-unloaded model.

## Evidence

- scripts/benchmark_5060ti_pilot.mjs: generate() calls unload(candidate.alias) before each task.
- Before this benchmark, ollama ps returned an empty model list.
- Before correction, unload() checked that no unrelated model was resident, then unconditionally issued request('generate', { model: alias, keep_alive: 0 }).

## Root Cause

The unload helper treated “no unrelated model is loaded” as proof that the candidate itself was loaded. It did not check candidate residency before invoking the unload endpoint.

## Why the issue escaped detection

The existing harness regression test covered request construction, code inspection, and compile/test outcomes. It did not verify the unloaded initial state or the unload helper's no-resident path.

## Proposed prevention

Return immediately when the requested alias is absent from /api/ps; only invoke Ollama's unload behavior for a resident alias. Keep the preflight residency check and verify the runtime is empty before and after the benchmark.

## Verification status

Source-level cause is confirmed. Whether the old empty-state endpoint call was rejected or briefly loaded the model was not separately exercised; the correction removes that unnecessary call for a known-empty state.
