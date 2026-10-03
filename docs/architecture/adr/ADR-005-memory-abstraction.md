---
id: HUB-ADR-005
version: 0.3.0
status: active
superseded_by: null
decision_status: accepted
author: ATHER
date: 2026-10-03
risk: MEDIUM
---

# HUB-ADR-005: scoped memory interface with local SQLite persistence

## Context

Browser preferences and model execution statistics are not agent memory. The new runtime needs session, project and agent scopes without a database server or provider coupling. The desktop settings decision in [legacy ADR-006](../../adr/ARCHITECTURE.md) remains applicable to its existing data.

## Proposed decision

Define a `MemoryStore` interface with store, retrieve, literal bounded search, update and delete. Implement it using Python's SQLite support, parameterized queries, transactions, an explicit schema version and a configured local state directory. Avoid an ORM unless implementation demonstrates a need.

A memory address includes scope, project ID, owner identity (agent/session) and record ID. Authorization constructs this namespace before storage access. Never accept a caller-supplied arbitrary namespace or concatenate it into SQL. Project records are shareable only with configured project access; agent and session records enforce their narrower owners.

Persist project/agent memory across restarts. Sessions and their conversational/task state are in-memory initially; session memory expires and does not restore a session implicitly. Store minimal timestamps and provenance, impose record/search size limits, and keep raw credentials and full prompts out of automatic persistence.

Retrieved memory is untrusted data added to a bounded context segment. Retrieval cannot modify system instructions, tools or permission configuration. Do not put retrieval logic inside providers or conflate truncating history with deleting persistent memory.

## Alternatives considered

| Alternative | Reason not selected |
|---|---|
| Shared JSON files | Requires custom atomic update/concurrency handling as records grow. |
| Postgres or Redis | Additional service is unnecessary for the initial local process. |
| Vector database / GenesisBlockDB | Keep possible behind the interface; semantic indexing is not required for CRUD and bounded search. |
| Framework-specific conversation serialization as the memory store | Couples long-lived data to the execution library and mixes temporary context with persistent knowledge. |

## Consequences and verification

Memory is a new persistence boundary; it does not migrate existing desktop settings or analytics. Future schema upgrades require versioned migrations and a preservation/rollback plan. Blocking SQLite operations must not stall the asynchronous inference loop.

Acceptance: H10-H11 and H18 in the [plan](../IMPLEMENTATION-PLAN.md), including reopen persistence, concurrent updates, expiry and cross-scope denial. Rollback preserves the database for recovery.

## Version diff

Historical proposal 0.1.0: No database was created and no existing data was migrated.

Approval delta 0.1.0 → 0.2.0: user approved the design on 2026-10-03; implementation is authorized within these boundaries.

Implementation delta 0.2.0 -> 0.3.0: decision implemented within the [verified checkpoint](../VERIFICATION.md). Historical statements above describe the proposal date, not current implementation status.
