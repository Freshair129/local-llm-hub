---
id: RCA-003-ZURI-BACKEND-CONTRACT-GAPS
version: 0.2.0
status: active
superseded_by: null
owner: Boss
author: ATHER
date: 2026-10-06
source_commit: 9263210bc23d5ba40a38b918e83eb4c2329acc01
---

# RCA-003 — ช่องว่างสัญญาระหว่าง Zuri กับ Hub native agent backend

## Symptom

Zuri ต้องการใช้ Hub รัน agent พร้อม structured output และคงค่าควบคุมของ QA เดิม แต่เปลี่ยน URL ของ OpenCode มาเป็น Hub chat route โดยตรงไม่ได้ และยังไม่มี evidence contract ให้ client ตรวจ inference settings / input reads ที่เกิดขึ้นจริงใน run

นี่คือ integration gap เทียบกับความต้องการใหม่ ไม่ใช่คำกล่าวว่า Hub ผิดสเปกเดิม หรือว่า Hub เป็นสาเหตุที่โมเดลแก้ marketing ไม่สำเร็จ

## Evidence

ตรวจ source ที่ commit ใน frontmatter เมื่อ 2026-10-06:

| หลักฐานใน repo | ข้อสังเกต |
|---|---|
| [api.py](../../runtime/local_llm_hub/api.py) `ChatInput`, `RunInput`, `create_app` | chat จำกัด `stream: false`, ไม่มี tools/response_format; native run รับ input/session_id; ไม่มี client contract discovery |
| [config.py](../../runtime/local_llm_hub/config.py) `AgentDefinition` | มี output_schema/context_budget/max_tokens แต่ไม่มี configured inference settings สำหรับ reasoning_effort/top_p/presence_penalty |
| [pydantic_driver.py](../../runtime/local_llm_hub/pydantic_driver.py) `RoutedModel.request`, `PydanticDriver.run` | temperature fallback 0.2; ใช้ StructuredDict และ jsonschema; retries=0 |
| [providers.py](../../runtime/local_llm_hub/providers.py) `OpenAICompatibleProvider.complete` | payload ส่ง temperature/max_tokens/tools; ไม่มี reasoning_effort/top_p/presence_penalty; tool arguments ผ่าน json.loads ปกติ |
| [models.py](../../runtime/local_llm_hub/models.py) `RunResult` | response มี IDs/output/usage แต่ไม่มี settings receipt หรือ read hash |
| [tools.py](../../runtime/local_llm_hub/tools.py) `ToolRegistry.execute` | log tool completion ระบุ run/session/tool แต่ไม่ใช่ hash ของข้อมูลที่โมเดลอ่าน |
| [test_api.py](../../runtime/tests/test_api.py), [target](../../docs/architecture/TARGET-ARCHITECTURE.md) | text-only compatibility เป็นข้อจำกัดตั้งใจและมี tests; ไม่ใช่ streaming implementation ที่เสีย |

หลักฐานภายนอก repo: Zuri app 0.5.1 snapshot 5.0.10 FAIL, raw SHA-256 `8bfed82866227c9d934a4de27896293b619c945229bc55ae3a0b16b78e436599`; ตรวจจาก `O:\testzuri\zuri-agent-office\.brain\rca\marketing-canonical-live-failure.md` และ `docs/ZURI-MARKETING-HUB-AUDIT.md` เมื่อ 2026-10-06 พบ fenced JSON, Headline ไม่เปลี่ยน และ source quotation จาก draft ไม่มีการคัดลอก private runtime profile หรือ credentials มาไว้ใน Hub

## Root Cause

1. OpenCode client workflow กับ Hub text-only chat subset เป็นคนละสัญญา จึงต่อแทนกันด้วย URL ไม่ได้ ต้องใช้ native agent API และ adapter ที่กำหนดเจ้าของ agent loop ชัดเจน
2. Inference settings ที่ Zuri ต้องควบคุมยังไม่ถูกแทนใน config/domain request/provider payload ตลอดเส้นทาง การคงค่าเดิมจึงยังพิสูจน์ไม่ได้
3. Run response เดิมมุ่งคืนคำตอบและ usage ไม่ใช่หลักฐานสำหรับตรวจการอ่านไฟล์/ค่าที่ส่งใน provider attempt จึงต้องมี additive evidence contract
4. json.loads ปกติไม่ปฏิเสธ duplicate object keys ทำให้ข้อมูลกำกวมถูกยุบก่อน schema validation ได้ ข้อนี้เป็นพฤติกรรม parser ที่ตรวจจาก source ไม่ใช่เหตุการณ์ duplicate keys ที่พบใน live run

ไม่ยืนยันสาเหตุภายในโมเดลของ unchanged edits, false reasons หรือ source substitution การย้าย backend จะแก้เฉพาะ integration/representation boundary และยังต้องผ่าน semantic review

## Why the issue escaped detection

Tests เดิมทดสอบตาม text-only/native-agent contracts ที่อนุมัติ และ structured fixture แบบง่าย ไม่ได้ทดสอบ Zuri client หรือความเท่าเทียมของ sampling controls ช่องว่างนี้จึงยังอยู่นอก acceptance เดิม ส่วน marketing failure ไม่ได้หลุดการตรวจ: Zuri ตัดสิน FAIL และเก็บหลักฐานแล้ว

## Proposed prevention

ใช้ [CR-HUB-001](../../docs/plans/CR-HUB-001-zuri-agent-backend.md) และ [สเปก](../../docs/plans/SPEC-HUB-ZURI-001-agent-backend.md) เพิ่ม typed discovery/settings/evidence, strict duplicate-key rejection และ negative tests โดยคง business acceptance ที่ Zuri การรับรอง Hub กับการรับรอง marketing เป็นคนละ gate

## Version diff

ไม่มี -> 0.1.0 draft; วิเคราะห์ source และขอบเขตที่ยืนยันได้ ไม่มีการแก้ code หรืออ้างว่ารัน live integration สำเร็จ

## P1 implementation checks — 2026-10-06

Focused first green attempt: 70 PASS / 1 FAIL / 1 SKIP. The failure was in the new fallback fixture before dispatch: model_copy retained the original `chat` alias on the backup, so ModelRegistry correctly rejected a duplicate alias. Root cause is fixture construction, not fallback routing; clear the backup aliases and rerun the same assertion. It did not escape detection. Prevention: give every synthetic fallback a distinct registry identity.

Ruff also found two newly expanded import lists and a nested function closing over loop-local settings. The function was called synchronously, but an iterative traversal removes the closure warning and retains the same bounded graph walk. These are in-scope implementation/lint corrections, not changes to approved contracts.

Mock parity check reproduced two failures: `json:{"answer":1,"answer":42}` and `json:{"answer":NaN}` were accepted by MockProvider while the new HTTP boundary rejected both. Cause: mock directive parsing still used the old json.loads path. Existing positive mock tests did not contain ambiguous/non-finite JSON. Prevention: use the same strict parser for explicit mock JSON/tool directives and keep these two negative regressions. This is offline fixture parity, not evidence that a live model emitted either case.

## Approval delta 0.1.0 -> 0.2.0

User approved with "approve" on 2026-10-06. P1 Hub implementation and offline tests are authorized; P2 live/Zuri adapter and P3 sidecar remain deferred. Earlier proposal-status and NOT_RUN text records the pre-approval checkpoint. Internal interface lock is in the Zuri packets; no public signature or scope expansion is authorized.
