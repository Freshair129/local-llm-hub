# WORKFLOW-BENCH — Execution Workflow Comparison Protocol

| Field | Value |
|---|---|
| **Document ID** | `WORKFLOW-BENCH` |
| **Version** | `0.1.0` |
| **Status** | Protocol draft; runner not implemented |
| **Related** | [SPEC-WORKFLOW-001](../ai-system/MULTI_AGENT_WORKFLOW_SPEC.md), [SPEC-EVAL-002](SPEC-EVAL-002-evaluation-hardening.md), [SPEC-LLM-Benchmark-Harness](SPEC-LLM-Benchmark-Harness.md) |

## 1. Purpose

WORKFLOW-BENCH compares complete execution configurations, not just model IDs. It answers which workflow produces the most independently verified successful repository tasks for a given cost, latency, and hardware budget.

This is a separate track from model benchmarks such as FR-002, FR-006, and HumanEval+. Those remain useful for model screening. A workflow run must include its planner/worker/reviewer roles, orchestration policy, repair limit, tools, model settings, and deterministic verification gates.

**Current status:** this document defines the protocol only. The existing evaluation harness is task-oriented and the existing multi-agent script is not a controlled comparative runner. No WORKFLOW-BENCH result should be reported until the requirements in Section 8 are implemented and a run produces complete artifacts.

## 2. Research questions

1. At the same task budget, which configuration has the highest verified success rate?
2. At a preregistered quality target, which configuration has the lowest total cost per verified success?
3. How do quality, latency, retries, critical failures, VRAM, GPU time, and energy vary by task category?
4. For which task categories does a multi-agent or hybrid workflow improve the result enough to justify its overhead?

The unit under comparison is an **execution configuration**: a versioned DAG of agent roles, exact model/provider IDs, per-role settings, tool permissions, test policy, retry policy, and resource limits.

## 3. Candidate configuration matrix

These are candidate cells, not claims that the providers or runner are currently configured. Resolve each alias to an exact provider model ID or local Ollama tag at run time, and save that identity in the run manifest.

| ID | Configuration | Required workflow |
|---|---|---|
| `CFG-SOL-1` | Sol High, one agent | One agent plans and implements; deterministic gates run; allow only the preregistered repair budget. |
| `CFG-ASTRA-1` | Astra High, one agent | Same single-agent contract and repair budget as `CFG-SOL-1`. |
| `CFG-LUNA-MAX-1` | Luna Max, one agent | Single agent with the same task, tools, gates, and total budget cap. |
| `CFG-LUNA-MAX-6` | Luna Max, six-role gated multi-agent | Six roles: Planner → Executor → separate Reviewer and Verifier → Tester → conditional Repairer when visible gates or reviews fail. Deterministic tools run the visible and final held-out suites; the Tester may propose visible tests but cannot replace the fixed suite. |
| `CFG-LUNA-MED-6` | Luna Medium, six-role gated multi-agent | Same six roles, prompts, graph, context boundaries, gates, and budgets as `CFG-LUNA-MAX-6`; only the configured effort changes. |
| `CFG-MELLUM21-6` | Local Mellum 2.1, six-role gated multi-agent | Same six roles and gates. Record the exact Ollama tag, model digest/quantization when available, settings, and whether roles reuse one loaded model. |
| `CFG-HYBRID-1` | Sol planner + Luna worker(s) + independent reviewer | Pin the reviewer identity before the run. Do not select or change the reviewer after seeing candidate outputs. |

For every cell, freeze: exact model ID and version, effort, temperature and other sampling settings, context/output limits, system prompts, tool list, orchestration graph, model-call order, retry/repair limits, and per-run cost ceiling. Provider aliases such as “Luna” are not sufficient run provenance.

### Six-role contract

1. **Planner:** receives the task, repository context, and acceptance criteria; emits a bounded implementation plan.
2. **Executor:** receives the task, approved plan, and allowed source context; emits the candidate patch.
3. **Reviewer:** checks the candidate diff against the request and repository constraints; receives no Planner/Executor private reasoning or other reviewer verdicts.
4. **Verifier:** separately maps acceptance criteria to the candidate and identifies unmet criteria; it receives no Reviewer verdict or private reasoning.
5. **Tester:** may suggest or write additional visible tests. These tests are supplemental and cannot alter or replace the frozen deterministic or held-out suites.
6. **Repairer:** is a distinct conditional call, invoked only after visible checks or the isolated Reviewer/Verifier reports a blocking issue. It receives the candidate, task, and permitted visible feedback, subject to the frozen repair limit.

The deterministic test runner is a program, not an LLM role. “Independent review” means separate calls with isolated review contexts. Reusing the same underlying model for Reviewer and Verifier tests role/context separation, not model diversity; claims of independent model judgment require distinct, preregistered model identities. If any role is skipped or merged, give that graph a different configuration ID.

## 4. Task corpus and matched-run design

- Use the same task IDs, task text, repository snapshot, base commit, visible context, tools, dependency state, visible tests, and hidden tests for every configuration.
- Every attempt starts from a fresh isolated checkout at the pinned base commit. A previous configuration's patch, generated tests, or conversation must never enter another configuration's context.
- Keep hidden acceptance tests unavailable to all model roles. The test runner, not an LLM reviewer, determines pass/fail.
- Cover at least these task families: focused code change, defect repair, multi-file feature, repository integration, and security-sensitive change. Report each family separately as well as the aggregate.
- Existing FR-002 and FR-006 tasks may be used for a smoke/pilot slice after checking for prompt or training leakage. They are too narrow by themselves to establish general multi-agent coding quality.
- Freeze task definitions and hidden-test hashes before confirmatory runs. Record exclusions and corpus changes; do not silently remove a task because one configuration performs poorly.
- Use paired runs: each configuration receives each selected task under the same task seed. Randomize configuration order within task blocks to reduce order, temperature, and cache effects.
- Freeze the task/seed schedule and task weights in advance. If multiple seeds are used per task, aggregate seeds within each task first and give tasks equal weight unless a different weighting is preregistered.
- For a paired task/seed block, retry an infrastructure failure at most once with the same frozen configuration and a fresh sandbox. Do not replace a difficult task. If a configuration still fails operationally, retain that cell as an `INFRA_FAILURE`; do not drop successful results from the other configurations in the operational score.
- If a task/seed block is invalid because the shared fixture, base commit, or measurement setup is broken, invalidate the whole paired block for every configuration with evidence and retain its artifacts. A configuration-specific runner fault remains that configuration's operational outcome.

Run a small pilot to estimate runtime, token use, variance, and task difficulty. Use that pilot to set budgets and perform a power/sample-size calculation before the confirmatory run. Pilot data must be labeled exploratory and excluded from confirmatory claims if it was used to tune the configurations.

## 5. Gates and outcome classification

**Verified success** requires all required deterministic gates to pass on the exact saved final diff after it has been applied to the pinned sandbox: patch validity, scope, build/compile, existing tests, held-out tests, and required security checks. Acceptance criteria must be mapped to executable checks where possible. LLM review scores are diagnostic only and cannot turn a failed deterministic gate into a pass.

Each gate records exactly one state: `PASS`, `FAIL`, `NOT_RUN`, or `NOT_APPLICABLE`, with an evidence reference and reason. A required gate in `NOT_RUN`, a missing command/suite, absent evidence, or an unapproved `NOT_APPLICABLE` state fails closed and cannot yield `VERIFIED_SUCCESS`. Gate outcomes must refer to the same final artifact hash; an earlier patch passing does not validate a later patch.

The held-out suite is run **once, after final artifact selection**, and is never run inside the repair loop. Its tests, assertions, expected values, logs, per-test results, and intermediate pass/fail feedback are unavailable to every model role and cannot guide repair. The external scorer records the final held-out result. If adaptive hidden-test feedback is intentionally studied later, it must be a separately named configuration with a frozen query budget and leakage analysis.

Classify outcomes separately:

- `QUALITY_FAIL`: invalid or incomplete implementation, failed AC, compile/test/security failure, or exhausted repair budget.
- `RESOURCE_LIMIT`: configuration exceeds its frozen token, wall-time, VRAM, or cost limit. Count this as a configuration outcome; do not remove it from the denominator.
- `INFRA_FAILURE`: provider/network/service interruption independent of the workflow. Preserve the attempt and logs; apply only a preregistered retry rule.
- `INVALID_RUN`: contaminated base state, missing provenance, altered hidden tests, or broken measurement. Exclude only with an explicit reason and retain the artifact.

A configuration-specific `INFRA_FAILURE` or `INVALID_RUN` remains a non-success in the operational denominator, and any incurred cost remains counted. It may be omitted from conditional quality only under the definitions below, with operational completion and excluded-cell counts shown. A shared-fixture invalidation removes the entire paired task/seed block from all configurations.

Critical security failures are reported as a separate safety outcome and disqualify a configuration from a “recommended” result for that task family. A model-generated test suite or reviewer verdict is never ground truth.

## 6. Metrics and decision rules

### Primary metrics

- **Operational verified-success rate** = verified successes / all scheduled task/seed/configuration cells. Infrastructure failures remain in the denominator and are not successes; shared-fixture invalidations remove the entire paired block from every configuration.
- **Conditional quality rate** = verified successes / completed valid attempts, reported separately alongside operational completion rate. For paired quality intervals, use only complete matched task/seed blocks and show how many were excluded for infrastructure failure; never present this conditional result without the operational rate.
- **Cost per verified success** = total measured execution cost / number of verified successes. Report undefined when there are zero verified successes.
- **Quality at fixed budget**: compare verified success rates under the same preregistered per-task budget cap.
- **Cost to matched quality**: among configurations that meet the preregistered quality and safety target, compare total cost per verified success.

### Secondary metrics

Report median and p95 wall time; model-call count; repair rate; input, output, cached, and reasoning tokens when supplied by the provider; tokens/second; compile/test failure categories; critical security failures; peak VRAM; CPU offload; GPU-active time; and energy use when measured.

Before setting a fixed budget or comparing cost per success, preregister a common cost boundary and unit. Include every billable model/tool call and retry, plus test and orchestration compute under the same rule for every configuration; count failed billable calls. Include model loading and shared host costs either for all configurations or for none, and state which. For hosted inference, use actual provider usage and a dated price snapshot. For local inference, report measured energy cost, GPU/CPU time, and resource use. Keep provider billing, local incremental energy, and estimated fully loaded hardware cost as separate components; label amortization assumptions. Make an overall hosted-versus-local monetary ranking only when all cells use the same declared total-cost model. Otherwise, compare quality and report the cost dimensions separately; do not call one universally cheaper.

For the confirmatory report, calculate paired 95% confidence intervals by a stratified task-cluster bootstrap with 10,000 resamples: resample task IDs within task family and retain every configuration and scheduled seed for each sampled task. Use equal task weights after aggregating seeds within each task. For conditional-quality intervals, use complete matched task/seed blocks and report their count. Freeze this method, sample size, quality target, and non-inferiority margin before confirmatory runs. Use a one-sided 95% interval for a preregistered non-inferiority claim; the example 3 percentage-point margin is a candidate policy, not a default conclusion. If the sample is underpowered, report descriptive results only.

## 7. Resource and execution controls

- Do not run two benchmark configurations concurrently on the RTX 3060. Before local runs, unload unrelated Ollama models, inspect `ollama ps`, and verify the exact installed tag with `ollama list`.
- For a multi-role local workflow, execute roles serially unless concurrency itself is an explicitly named configuration. Record every model load/unload, offload, and resource-limit event. Never compare a GPU-resident run with an unreported CPU-offloaded run as if hardware conditions matched.
- Use a fixed timeout, tool policy, environment image, and dependency cache for each task/configuration pair.
- Capture start/end timestamps, host and GPU state, driver/runtime versions, and baseline utilization. Pause and release model/GPU resources after a requested benchmark checkpoint; verify both model residency and runner process cleanup.
- Do not expose API keys in prompts, artifacts, logs, or committed configuration files.

## 8. Implementation requirements before the first scored run

The current `eval/harness/run-eval.mjs` evaluates one task/worker invocation and its result schema has no workflow-config or per-node accounting. The current `scripts/run_multi_agent_pipeline.mjs` is a prototype with a fixed model registry: it validates a generated patch but does not apply it before running gates, then runs those gates against `process.cwd()` rather than an isolated sandbox. It also does not create a fresh matched sandbox per configuration or persist complete per-call usage/cost provenance. In `eval/harness/test-runner.mjs`, a missing hidden-test command currently defaults to a passing state; in `eval/harness/run-eval.mjs`, the security gate defaults to `true` and is omitted from the final pass conjunction. The existing master harness also invokes hidden tests during repair attempts. Reusing these paths without correcting them could produce a false pass or leak hidden-test feedback. These are blockers for comparative claims.

Implement the following before scoring candidate configurations:

1. A versioned `workflow-config` contract for DAG nodes, model IDs, settings, tools, budgets, and retry rules.
2. A runner that executes each task/configuration/seed in an isolated checkout pinned to one base commit, applies and hashes each candidate/final diff, and verifies only the exact saved final artifact.
3. A per-node event log containing role, exact provider/model identity, prompt/config hashes, timestamps, usage, retries, response/artifact references, and errors. Keep secrets out of the log.
4. A result contract that binds each run to task, seed, corpus/test hashes, workflow-config hash, base commit, runtime, machine, resource measurements, explicit gate states, final artifact hash, outcome class, and cost breakdown.
5. Fail-closed gate validation: required suites/commands and evidence must exist; missing gates cannot pass; every gate must evaluate the same final artifact. Add harness fixtures proving a known-bad patch fails after application, an absent required suite fails closed, an unrun security gate cannot pass, and held-out feedback is not sent into repair.
6. A batch comparator that preserves scheduled denominators, task weighting, bounded retry rules, complete-pair counts, and the declared paired confidence-interval method; reports operational success, conditional quality, and completion rate separately; and provides fixed-budget, cost-per-success, and category-level results without aggregating away critical failures.
7. A shared cost boundary that includes retries and billable tool/model use, consistently treats common test/orchestration compute, and keeps hosted charges, local energy, and estimated amortized cost distinguishable.
8. Explicit separation of quality failures, resource-limit outcomes, infrastructure failures, and invalid runs, with frozen retry and whole-pair invalidation rules.
9. Safe cleanup and post-run verification for worktrees, runner processes, Ollama residency, and GPU state.

The existing `eval/schemas/result.schema.json` is strict (`additionalProperties: false`). Prefer a separate versioned workflow-run schema or a deliberate schema-version migration; do not silently add incompatible fields to existing result artifacts.

## 9. Reporting and interpretation

Each report must include the corpus version and hashes, exact workflow manifests, number of valid/excluded/failed attempts, outcome categories, task-level paired table, confidence intervals, total and per-success costs, latency/resource distributions, and critical failures. Include links to raw immutable per-run artifacts and a summary of missing provider usage or telemetry.

Do not rank a workflow from model-call counts, reviewer confidence, token price, or a small exploratory sample alone. The useful output is a task-category routing recommendation supported by verified success, cost, latency, and safety evidence.

## 10. Initial rollout

1. Implement contracts, runner isolation, event accounting, and cleanup without calling external providers.
2. Run harness-only fixtures to prove identical base commits, hidden-test isolation, and accounting behavior.
3. Run a labeled pilot on a small, leakage-reviewed task subset; tune budgets and calculate the confirmatory sample size.
4. Freeze configurations and protocol, then run the confirmatory comparison sequentially on local hardware.
5. Add hosted-provider configurations only when exact model IDs, usage reporting, and dated pricing data are available.
6. Publish raw artifacts and the report locally and in the repository; update the routing recommendation only after the confirmatory criteria are met.
