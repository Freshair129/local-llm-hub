---
id: FR-022
domain: inference-gateway
owner: Boss
status: active
superseded_by: null
version: 0.2.0
priority: P0
features: [CROSS-FEAT-002]
depends_on:
  - FR-018
---

# Scoped persistent memory

Deliver the corresponding approved [target contracts](../architecture/TARGET-ARCHITECTURE.md) with acceptance criteria H10 H18 in the [acceptance plan](../architecture/IMPLEMENTATION-PLAN.md). No full OpenAI parity, public multi-tenancy, arbitrary sandbox claim or hidden cloud fallback.

## Interface lock

MemoryStore.store(namespace: Namespace, key: str, value: str) -> MemoryRecord; retrieve / search / update / delete; SQLiteMemory.close() -> None

Component scope: runtime/local_llm_hub/memory.py. Tests live in runtime/tests/test_scoped_memory.py and focused integration fixtures.

## Verification

Map the listed H criteria to executed deterministic tests, including failure paths. Record actual results in the verification report; source presence is not acceptance.

## Version diff

New requirement derived from the approved 0.2.0 architecture.
