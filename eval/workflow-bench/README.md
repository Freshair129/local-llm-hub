# Workflow benchmark pilot

This directory contains a fail-closed six-role runner and one exploratory Mellum2.1 pilot. It checks the workflow implementation on one coding task and one seed. It is not a confirmatory benchmark and must not be used to rank models.

## Run

The pilot is frozen to `mellum:latest` by Ollama digest. Keep the checkout clean before running it.

```bash
npm run workflow-bench:test
npm run workflow-bench:pilot
```

The pilot checks `ollama list`, unloads resident models from available local Ollama endpoints, invokes the single configured model serially, and verifies Ollama residency after the run. Artifacts are written under `eval/workflow-bench/results/` and include the exact final diff, role usage, gate states, and hidden-suite hashes.

## Held-out suite

The pilot's held-out tests live outside the public checkout at `%USERPROFILE%\.ollama\benchmarks\workflow-bench\pilot-001\hidden.test.mjs`. The task file names the suite but contains no test contents. The runner hashes it, runs it once against the final candidate, and records only the state and output hashes. It does not send hidden test contents, logs, or pass/fail feedback to model roles. Do not copy this suite into Git or print its contents in benchmark reports.

The harness fixtures create their own synthetic held-out suite inside a temporary test repository. They verify that the suite runs once and that hidden feedback does not enter any role prompt or result artifact.

## Pilot settings and limits

The local Ollama call enables thinking and uses temperature `0.6`, `top_p=0.95`, `top_k=20`, `repeat_penalty=1.0`, and `num_ctx=16384`. The current per-role output budget is `num_predict=14336`, leaving room for the prompt within the 16K context. This is lower than the model-card maximum and the larger output cap used by the earlier FR benchmark. All three pilot attempts reached their configured output caps before producing executor JSON; they are preserved, and capped malformed responses are classified as resource limits. No acceptance gates ran, so this workflow pilot is inconclusive. Its latency, usage, and resource observations are exploratory only; no confidence interval, power claim, or model ranking is produced.

The confirmatory requirements and decision rules remain in [WORKFLOW-BENCH](../../docs/benchmarks/WORKFLOW-BENCH.md). Batch comparison, preregistered sample size, and complete cost accounting are still required before making comparative claims.
