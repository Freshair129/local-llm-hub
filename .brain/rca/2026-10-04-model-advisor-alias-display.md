# RCA: Model Advisor alias missing from result cards

## Symptom

Every benchmark card in Model Advisor displayed `alias ไม่มี`, although the imported benchmark catalog contains model aliases.

## Evidence

- Browser inspection at `http://127.0.0.1:18765/` showed `BENCH-5060TI-GENERAL-005 · GENERAL · alias ไม่มี`.
- The matching catalog record stores the value at `run.model.alias` (`llh-general-gemma-agentic:bench005`); `run.alias` is absent.
- `src/js/model_advisor.js` line 279 interpolated `run.alias`.

## Root Cause

The card renderer read the alias from the run root instead of the nested model object defined by the catalog schema.

## Why the issue escaped detection

Catalog contract and advisor logic tests checked source data and filtering, but no browser assertion checked the rendered model alias.

## Proposed prevention

Read the nested field used by the schema and verify a real catalog card renders its alias during browser smoke testing. Keep the catalog schema covered by the catalog tests.

## Resolution

The card renderer now reads `run.model.alias`. After reloading, browser verification showed aliases on all 45 cards and no `alias ไม่มี` fallbacks.
