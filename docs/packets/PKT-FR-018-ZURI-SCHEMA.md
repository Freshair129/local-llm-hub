---
id: PKT-FR-018-ZURI-SCHEMA
fr_id: FR-018
layer: schema
version: 0.1.0
status: active
superseded_by: null
interface: LOCKED
approval: user approved CR-HUB-001 P1 on 2026-10-06
---

# Zuri P1 — FR-018 schema

## 1. Statement
Implement only this layer of the approved native Hub client contract.

## 2. Acceptance criteria
AC-HZ-02; exact expected results in [SPEC section 9](../plans/SPEC-HUB-ZURI-001-agent-backend.md#9-acceptance-criteria-และ-test-mapping). Add focused failing tests before implementation.

## 3. Relevant SDD
[Approved SPEC](../plans/SPEC-HUB-ZURI-001-agent-backend.md) sections 3–8. Preserve [parent](../architecture/TARGET-ARCHITECTURE.md) and [CR scope](../plans/CR-HUB-001-zuri-agent-backend.md).

## 4. API / schema lock
InferenceSettings(temperature: strict finite float=0.2, top_p: strict finite float|None=None, presence_penalty: strict finite float|None=None, reasoning_effort: Literal[none]|None=None). SentSettings extends settings with max_tokens. EndpointDefinition.supported_inference_settings tuple; AgentDefinition.inference_settings and emit_run_evidence. Typed ProviderAttempt, ReadEvidence, RunEvidence; ToolCall.arguments_sha256 excluded from serialized messages; RunResult.evidence optional. InferenceRequest settings fields and sent_settings() -> SentSettings, optional_settings() -> set[str]. Settings.validate checks before run through load_config; public request DTOs unchanged.

## 5. Business / security rules
Single trusted operator; no new grants; no raw content logging; schema PASS is not business acceptance. Offline mock-only execution in P1.

## 6. Guard rails / CMP
Only runtime/local_llm_hub/{config.py; models.py}, focused tests listed in SPEC section 8 and linked docs. Preserve existing callers with defaults. No adjacent refactor or dependency change. Stop and amend design if a public contract change is required.

## 7. Current CMP code
Baseline commit `9263210bc23d5ba40a38b918e83eb4c2329acc01`; exact source references and pre-change hashes:
- [current config.py](../../runtime/local_llm_hub/config.py) — baseline SHA-256 `795a01acd323a365f63f0f8b269b3f113dcac25d42cee1c4f1654a10e68dead1`
- [current models.py](../../runtime/local_llm_hub/models.py) — baseline SHA-256 `6fe875f6a60e7709407f53e1495648e7ee5a917671459c81e244770582231bd1`

## 8. Target TC
TC-HUB-ZURI-MOCK-001: authenticated native client -> scoped actual reads -> structured output -> bound evidence. Existing failure/permission/session regression suite remains required.

## 9. Token ceiling / order
8,000 tokens per unit; sequential single writer. Order: FR-018 schema -> FR-019 routing -> FR-021 read evidence -> FR-020 driver -> FR-023 API. Child read evidence cannot satisfy parent reads.

## Version diff
Absent -> 0.1.0 active, interface lock under approved CR. Implementation/closure NOT_RUN at packet issuance. No completion lineage before verified source commit.

## Local verification checkpoint

The packet ACs pass in the [P1 source-bound offline receipt](../plans/HUB-ZURI-P1-VERIFICATION.md), 2026-10-06. Source is uncommitted; retain LOCKED active packet without claiming merged/closed lineage. P2/P3 are not included.
