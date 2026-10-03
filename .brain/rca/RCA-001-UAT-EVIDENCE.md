---
id: RCA-001-UAT-EVIDENCE
version: 0.2.0
status: active
superseded_by: null
author: ATHER
date: 2026-10-03
baseline_commit: 12e84fc87c0bbccac3bccf0405382db541d7ef85
root_cause_status: confirmed
remediation_status: locally_verified
---

# UAT reports success without feature execution evidence

## Symptom

The existing autonomous UAT script can publish `100% PASSED (4/4 Scenarios Approved)` while every provider connection fails. Historical reports therefore cannot establish acceptance of the requested agent harness or the listed desktop features.

## Evidence

In [scripts/run_local_llm_uat.mjs](../../scripts/run_local_llm_uat.mjs) at the baseline commit:

- Line 50 asks the model to provide a verdict and state `PASSED`; it does not invoke the described feature or inspect an observed feature response.
- Lines 70-78 return passing text for missing model output, invalid JSON, and request errors.
- Lines 92-95 assign `status: PASSED` regardless of the returned verdict.
- Line 114 fixes the overall success count in the report template.
- The scenario `testPayload` is not dispatched to the named application functionality.

An in-memory experiment evaluated the existing scenario and function definitions with a fake HTTP requester that emits a connection error on every `end()`. Filesystem output was intercepted in memory. Observations:

| Measurement | Observed |
|---|---:|
| Simulated connection failures | 4 |
| Actual network requests | 0 |
| Actual filesystem writes | 0 |
| Passing fallback rows | 4 |
| Report claims 100% PASSED | true |

The existing five evaluator unit tests also pass; they cover patch validation, a traversal example, spec-contract derivation, score aggregation and an echo command. They do not exercise this UAT generator.

## Root Cause

The script treats generated persona commentary as test execution, then makes success unconditional at both the transport-error and report-aggregation layers. Feature assertions and failure propagation are absent. This is a deterministic reporting defect, independent of model quality or availability.

## Why the issue escaped detection

The inspected evaluator suite contains no negative test connecting a failed UAT request to a failing or skipped report. The UAT report itself is generated from static success text, so reviewing the artifact alone does not reveal whether any feature was invoked. The precise human review history is unknown.

## Proposed prevention

1. Replace the affected UAT entry point's unconditional verdict generation with executed, deterministic assertions against the implemented API. An optional model judge may add commentary but cannot promote the test status.
2. Distinguish `PASS`, `FAIL`, `NOT_RUN`, and `SKIP` with reasons. Provider errors fail an enabled integration test; an explicitly disabled live test is skipped, never passed.
3. Add regression cases for connection failure, HTTP errors, malformed JSON, assertion failure and disabled integration. Compute counts from actual results.
4. Record revision, command, environment flag, start/end time, exit code, expected/observed values and provider identity without prompts or secrets.
5. Keep historical reports intact and mark them as non-acceptance evidence in the [audit](../../docs/architecture/CURRENT-STATE.md). Do not claim this defect is fixed until regression tests and code changes pass.

## Version diff

New RCA 0.1.0; no production code or historical report was changed. Implementation belongs to the approved [migration plan](../../docs/architecture/IMPLEMENTATION-PLAN.md).

## Implemented remediation (0.1.0 -> 0.2.0)

The UAT entry point now executes deterministic HTTP assertions and emits JSON with executed/pass/fail/skip counts and nonzero exit on failure. No model-generated verdict controls status. Six regression tests cover disabled execution, transport failure, invalid JSON, failed assertions, HTTP errors and successful bounded fixtures. A real loopback mock-service run returned 4 PASS, 0 FAIL, 4 SKIP; the four historical scenarios remain unverified. Historical reports were preserved. See [verification](../../docs/architecture/VERIFICATION.md).
