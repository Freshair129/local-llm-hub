---
id: PKT-FR-019-ZURI-SERVICE
fr_id: FR-019
layer: service
version: 0.1.0
status: active
superseded_by: null
interface: LOCKED
approval: user approved CR-HUB-001 P1 on 2026-10-06
---

# Zuri P1 — FR-019 service

## 1. Statement
Implement only this layer of the approved native Hub client contract.

## 2. Acceptance criteria
AC-HZ-03 AC-HZ-04 AC-HZ-05 AC-HZ-09; exact expected results in [SPEC section 9](../plans/SPEC-HUB-ZURI-001-agent-backend.md#9-acceptance-criteria-และ-test-mapping). Add focused failing tests before implementation.

## 3. Relevant SDD
[Approved SPEC](../plans/SPEC-HUB-ZURI-001-agent-backend.md) sections 3–8. Preserve [parent](../architecture/TARGET-ARCHITECTURE.md) and [CR scope](../plans/CR-HUB-001-zuri-agent-backend.md).

## 4. API / schema lock
strict_json_loads(value: str|bytes) -> Any rejects duplicate keys and non-finite values. Provider.complete(request,model) unchanged. ModelRouter.complete(request: RouteRequest, *, attempts: list[ProviderAttempt]|None=None) -> RoutedResponse. Record only dispatched attempts in finally; explicit endpoint settings allowlist before dispatch. Provider hashes raw tool argument string before SDK dict conversion. RouteRequest public serialization unchanged.

## 5. Business / security rules
Single trusted operator; no new grants; no raw content logging; schema PASS is not business acceptance. Offline mock-only execution in P1.

## 6. Guard rails / CMP
Only runtime/local_llm_hub/{providers.py; router.py}, focused tests listed in SPEC section 8 and linked docs. Preserve existing callers with defaults. No adjacent refactor or dependency change. Stop and amend design if a public contract change is required.

## 7. Current CMP code
Baseline commit `9263210bc23d5ba40a38b918e83eb4c2329acc01`; exact source references and pre-change hashes:
- [current providers.py](../../runtime/local_llm_hub/providers.py) — baseline SHA-256 `178490a7d790f6a4bbf9500fe84ee05be3a1209e557eaf6e25fca13ffd8f8c62`
- [current router.py](../../runtime/local_llm_hub/router.py) — baseline SHA-256 `ec98d90cfd9c5a75018730a7577dadc45fdf534d79f5db5a97dda3e4b8e8da08`

## 8. Target TC
TC-HUB-ZURI-MOCK-001: authenticated native client -> scoped actual reads -> structured output -> bound evidence. Existing failure/permission/session regression suite remains required.

## 9. Token ceiling / order
8,000 tokens per unit; sequential single writer. Order: FR-018 schema -> FR-019 routing -> FR-021 read evidence -> FR-020 driver -> FR-023 API. Child read evidence cannot satisfy parent reads.

## Version diff
Absent -> 0.1.0 active, interface lock under approved CR. Implementation/closure NOT_RUN at packet issuance. No completion lineage before verified source commit.

## Local verification checkpoint

The packet ACs pass in the [P1 source-bound offline receipt](../plans/HUB-ZURI-P1-VERIFICATION.md), 2026-10-06. Source is uncommitted; retain LOCKED active packet without claiming merged/closed lineage. P2/P3 are not included.
