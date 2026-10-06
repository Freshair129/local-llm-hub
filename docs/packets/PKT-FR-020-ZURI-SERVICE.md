---
id: PKT-FR-020-ZURI-SERVICE
fr_id: FR-020
layer: service
version: 0.1.0
status: active
superseded_by: null
interface: LOCKED
approval: user approved CR-HUB-001 P1 on 2026-10-06
---

# Zuri P1 — FR-020 service

## 1. Statement
Implement only this layer of the approved native Hub client contract.

## 2. Acceptance criteria
AC-HZ-06 AC-HZ-07 AC-HZ-08 AC-HZ-12; exact expected results in [SPEC section 9](../plans/SPEC-HUB-ZURI-001-agent-backend.md#9-acceptance-criteria-และ-test-mapping). Add focused failing tests before implementation.

## 3. Relevant SDD
[Approved SPEC](../plans/SPEC-HUB-ZURI-001-agent-backend.md) sections 3–8. Preserve [parent](../architecture/TARGET-ARCHITECTURE.md) and [CR scope](../plans/CR-HUB-001-zuri-agent-backend.md).

## 4. API / schema lock
AgentRuntime.run and AgentDriver.run signatures unchanged. DriverResult adds evidence: RunEvidence|None=None. RoutedModel owns optional per-run attempts and final_arguments_sha256; validates final tool combinations before SDK execution. PydanticDriver handlers use RunContext tool_call_id and per-run read collector. Build evidence from exact input/schema/trace; never from model assertions. Session IDs/request IDs from ToolContext. No shared mutable trace across drivers or delegated sessions.

## 5. Business / security rules
Single trusted operator; no new grants; no raw content logging; schema PASS is not business acceptance. Offline mock-only execution in P1.

## 6. Guard rails / CMP
Only runtime/local_llm_hub/{pydantic_driver.py; agent_driver.py; agents.py}, focused tests listed in SPEC section 8 and linked docs. Preserve existing callers with defaults. No adjacent refactor or dependency change. Stop and amend design if a public contract change is required.

## 7. Current CMP code
Baseline commit `9263210bc23d5ba40a38b918e83eb4c2329acc01`; exact source references and pre-change hashes:
- [current pydantic_driver.py](../../runtime/local_llm_hub/pydantic_driver.py) — baseline SHA-256 `3fb259ad368b0b8b8a322e110b5257f8db4ece52d0cbb0394b70cc54391fc461`
- [current agent_driver.py](../../runtime/local_llm_hub/agent_driver.py) — baseline SHA-256 `6c2c35ce9330d0862ff6d0cdd27ae4129cf26fb04788d2fc33886783dcf6e0d2`
- [current agents.py](../../runtime/local_llm_hub/agents.py) — baseline SHA-256 `7e8228254df42cd50a67ef569e046e0a8e6afe779b6e3d5253579ab97a2f6447`

## 8. Target TC
TC-HUB-ZURI-MOCK-001: authenticated native client -> scoped actual reads -> structured output -> bound evidence. Existing failure/permission/session regression suite remains required.

## 9. Token ceiling / order
8,000 tokens per unit; sequential single writer. Order: FR-018 schema -> FR-019 routing -> FR-021 read evidence -> FR-020 driver -> FR-023 API. Child read evidence cannot satisfy parent reads.

## Version diff
Absent -> 0.1.0 active, interface lock under approved CR. Implementation/closure NOT_RUN at packet issuance. No completion lineage before verified source commit.

## Local verification checkpoint

The packet ACs pass in the [P1 source-bound offline receipt](../plans/HUB-ZURI-P1-VERIFICATION.md), 2026-10-06. Source is uncommitted; retain LOCKED active packet without claiming merged/closed lineage. P2/P3 are not included.
