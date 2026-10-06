---
id: RCA-004-MAIN-MERGE-IDENTITIES
version: 0.1.0
status: active
superseded_by: null
author: ATHER
owner: Boss
date: 2026-10-06
complexity: C-2
risk: MEDIUM
---

# Main integration: package scripts and requirement identity

## Symptom

The user authorized merging the Hub branch into main. Integrating main `9147dd0` into the tested branch `91b86ce` produced one textual conflict in package.json and two requirements named FR-018.

## Evidence

Git merge reports only package.json unmerged. Hub added desktop:test while main added bench:export-catalog-sources, bench:catalog and test:advisor. Both sides retained eval:smoke. Source index/main JS additions merge without textual conflict.

Hub [FR-018 configuration](../../docs/requirements/FR-018-configuration-registry.md) is referenced by its implemented routing/session/tool/API contracts. Main's GPU Advisor independently used FR-018 for a different requirement. Source inspection found its identity references in PRD-SDD, D-traceability and model-management README; advisor JS/tests have no FR-018 annotations. FR-024 is unused at this integration point.

## Root Cause

Parallel branches changed the same scripts object and allocated the same flat requirement ID independently. This is an integration collision, not a runtime defect in either feature.

## Why the issue escaped detection

Each branch was internally consistent before integration. A textual merge cannot detect a duplicate logical ID in two differently named files. The Hub documentation suite's FR-018 discovery would also include the unrelated advisor document after merge.

## Proposed prevention / authorized merge resolution

Preserve the union of package scripts. Reidentify the advisor requirement as FR-024, update its three direct reference locations and register advisor/requirement/RCA in the graph. Preserve the advisor criteria and runtime behavior. Keep existing Hub IDs stable because code, packets and acceptance lineage already bind them. Parent/peer review: PRD-SDD, FEAT-GPU-MODEL-ADVISOR, FR-018 configuration and STD-001 flat-registry uniqueness. These are necessary preservation steps within the user's explicit merge authorization, not new feature scope.

Verify no unmerged entries/conflict markers, unique FR filename IDs and resolvable references, then run combined offline Python, Node advisor/catalog/evaluation/desktop contracts and existing Rust checks where affected. Record actual results in the PR; no live model/installer claim. Preserve the original main checkout until remote merge is verified.

## Version diff

New RCA 0.1.0. Advisor requirement FR-018 -> FR-024 (identity only). Package/app/native contract versions unchanged.
