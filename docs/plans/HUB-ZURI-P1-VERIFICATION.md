---
id: HUB-ZURI-P1-VERIFICATION
version: 0.2.0
status: active
superseded_by: null
owner: Boss
author: ATHER
date: 2026-10-06
complexity: C-3
risk: HIGH
source_commit: 9263210bc23d5ba40a38b918e83eb4c2329acc01
---

# Zuri P1 — offline verification

Scope: approved [CR-HUB-001](CR-HUB-001-zuri-agent-backend.md), [SPEC-HUB-ZURI-001](SPEC-HUB-ZURI-001-agent-backend.md). Tested implementation is now source commit `57b965f92c57ad31669a3b24dea760d20f54ee93`, based on the baseline commit above. This receipt does not claim deployment, live inference, marketing acceptance or sidecar packaging.

## Executed development checks

- Pre-change runtime baseline excluding documentation and live: 58 PASS / 1 SKIP / 5 DESELECTED. Windows symlink creation was unavailable; live cases explicitly excluded.
- Test-first: 32 FAIL / 5 PASS in focused selection before implementation; missing contracts, ambiguous JSON and structured-final checks reproduced. Not a release result.
- First implemented selection: 70 PASS / 1 FAIL / 1 SKIP; duplicate synthetic fallback alias was rejected correctly. Corrected fixture and recorded [RCA](../../.brain/rca/RCA-003-ZURI-BACKEND-CONTRACT-GAPS.md).
- Intermediate full non-documentation offline suite: 101 PASS / 1 SKIP / 5 DESELECTED; Ruff and strict mypy (20 modules) PASS.
- Additional mock strict-boundary tests reproduced 2 FAIL before sharing the strict parser; final verification follows below.

## Final gate

**PASS for the approved P1 offline contract scope**, with one existing host-specific test skipped. Executed 2026-10-06; no live provider inference.

| Gate | Result |
|---|---|
| Full Python offline suite | **107 PASS / 0 FAIL / 1 SKIP / 5 DESELECTED**, 16.74 seconds |
| Existing Windows true-symlink test | SKIP: host does not permit symlink creation; no privilege setting changed |
| Ruff | PASS, all runtime source/tests |
| Strict mypy | PASS, 20 source modules |
| Documentation | PASS, metadata/links/fences for 46 docs, graph 127 nodes / 194 edges, requirement DAG and source/test trace checks |
| Patch whitespace | PASS |
| Architecture/compatibility review | PASS by author within the approved P1 boundary; no independent review claimed |

Commands: `.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider -m "not integration" --junitxml=.hub/zuri-p1/offline-1.xml`; `.venv/Scripts/python.exe -B -m ruff check runtime`; `.venv/Scripts/python.exe -B -m mypy --cache-dir=.hub/mypy-zuri`; `git diff --check`.

Local ignored evidence: `.hub/zuri-p1/offline-1.xml`, SHA-256 `e69730735fce13c9c37de1937ad74e6b52643cc74ad7936dbf3775baedc4d868`. Source/test hash receipt: `.hub/zuri-p1/receipt-1.json`, SHA-256 `d4a85a68ce9f7136ef738480e5dc5696bf56d17a45ca7d61feaeb7fedbc6a3f2`; binds 32 Python files to this uncommitted checkpoint. The baseline commit alone is not the implemented-source identity. Receipts contain no provider credentials or live model results. All AC rows below have executed passing tests in that JUnit file.

## Acceptance traceability

| AC | Executable evidence |
|---|---|
| AC-HZ-01 | test_api.py::test_native_capability_discovery |
| AC-HZ-02 | test_configuration_registry.py::test_settings_defaults_and_validation; test_settings_endpoint_support_before_run; test_fallback_settings_checked_at_config_load |
| AC-HZ-03 | test_routing_providers.py::test_inference_settings_reach_wire; test_agent_runtime.py::test_agent_settings_survive_sdk_and_context |
| AC-HZ-04 | test_routing_providers.py::test_settings_checked_for_fallback |
| AC-HZ-05 | test_routing_providers.py::test_strict_provider_and_tool_json; test_strict_response_envelope; test_agent_runtime.py::test_mock_structured_json_uses_same_strict_boundary |
| AC-HZ-06 | test_agent_runtime.py::test_structured_final_boundary |
| AC-HZ-07 | test_agent_runtime.py::test_run_evidence_binding_and_opt_out |
| AC-HZ-08 | test_agent_runtime.py::test_current_run_read_evidence; test_delegated_reads_are_not_parent_evidence; test_tool_permissions.py::test_read_evidence_bounded_and_denied |
| AC-HZ-09 | test_agent_runtime.py::test_attempt_accounting_and_privacy; test_concurrent_evidence_isolated_and_bounded; test_fallback_attempt_evidence; test_evidence_budget_discards_failed_run; test_cancelled_evidence_does_not_leak_into_next_run |
| AC-HZ-10 | test_api.py::test_legacy_api_and_isolation_regression plus existing auth/session/cancellation/permission regressions |
| AC-HZ-11 | test_api.py::test_native_client_mock_workflow |
| AC-HZ-12 | test_agent_runtime.py::test_schema_pass_is_not_business_acceptance |

Test filenames above are under runtime/tests. New API tests use in-process ASGI and provider HTTP tests use httpx.MockTransport. Real SDK execution is not real-model evidence. Existing permission tests use bounded local temporary files/processes, never a model server.

## Architecture review and remaining boundaries

Single Hub agent loop, operator-owned config, unchanged native run input/chat subset, explicit settings check, strict provider boundary and per-run evidence align with parent/peer contracts. The author reviewed the diff; no independent agent review is claimed. No DB migration, dependency change, Rust/Electron edit, packaged-app replacement or Zuri source change.

P2 Zuri adapter/live marketing: NOT_RUN. P3 sidecar: NOT_RUN. Effective provider sampling and GPU behavior: NOT_MEASURED. Windows privilege-dependent symlink case is reported separately from junction/path tests. Snapshot 5.0.10 remains FAIL. No commit/push or completed-packet lineage is claimed without a tested source commit.

## Version diff

CR/SPEC/RCA 0.1.0 draft -> 0.2.0 active approval. Five Zuri packets: absent -> 0.1.0 LOCKED. Native client contract: absent -> 0.2.0; evidence: absent -> 0.1.0. Package 0.1.0 and Zuri app 0.5.1 unchanged. New verification 0.1.0.

## Source commit and lineage — 2026-10-06

User authorized commit/push. Source commit `57b965f92c57ad31669a3b24dea760d20f54ee93` contains the tested P1 implementation, tests and approved documents. All 32 Python worktree hashes still match the frozen receipt; no runtime changes followed verification. Five append-only [packet lineage](../lineage/packet-lineage.jsonl) entries bind the shared offline suite and component hashes to that source commit. Historical uncommitted/NOT_RUN statements above describe their earlier checkpoints. Publication targets `origin/feat/local-llm-agent-harness`; this does not merge into main or qualify P2/P3.

Version diff: verification 0.1.0 -> 0.2.0 adds tested-source identity and local checkpoint lineage; native contract, evidence and package versions unchanged.
