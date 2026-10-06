# RCA: Sanitize Public Benchmark Catalog Inputs

| Field | Value |
|---|---|
| Date | 2026-10-04 (Asia/Bangkok) |
| Status | Mitigated; sanitized source snapshots and regression coverage added |
| Risk | MEDIUM; affects catalog evidence ingestion and public repository inputs |

## Symptom

The approved public commit scope includes benchmark manifests, summaries, verification records, and diagnostics as catalog inputs. Raw summaries also contain model-generated answer text, so committing those source files would exceed the approved scope.

## Evidence

- The allowlisted raw summaries include a `finalAnswers` field.
- Per-task rows include answer/thinking length fields and some error strings; raw error values are not needed to calculate catalog metrics.
- Raw manifests can contain absolute model file paths.
- The catalog builder previously read directly from `eval/reports/runs` and used those same locations as evidence paths.

## Root Cause

The ingestion boundary allowlisted run directories but did not project their contents onto a public-safe metadata schema. Benchmark metrics and provenance were stored alongside raw outputs and machine-local paths in the same JSON files.

## Why the Issue Escaped Detection

Earlier checks verified the number and category of candidate input files and searched known path strings, but did not inspect the source JSON schema for raw answer fields before staging.

## Proposed Prevention

Export only the catalog-required manifest, metric, option, identity, verification, and diagnostic fields into `eval/catalog_sources`. Reduce error values to booleans, retain only basenames for model files, and record hashes of original local artifacts in the verification metadata. Add a fixture test proving raw answer text and absolute paths do not survive export. Keep original run artifacts local and inspect the exact staged file list before commit.
