---
id: CR-HUB-001
version: 0.2.0
status: active
superseded_by: null
owner: Boss
author: ATHER
date: 2026-10-06
complexity: C-3
risk: HIGH
approval: user approved P1 on 2026-10-06
source_commit: 9263210bc23d5ba40a38b918e83eb4c2329acc01
---

# CR-HUB-001 — ให้ Local LLM Hub รองรับ Zuri ในฐานะ agent backend

## คำขอและผลลัพธ์ที่ต้องการ

ผู้ใช้ขอให้เปลี่ยนที่ repository ของ Local LLM Hub และเขียน CR พร้อมสเปกก่อนลงโค้ด เมื่อ 2026-10-06 (Asia/Bangkok) เอกสารนี้อยู่ใน source worktree `O:\local-llm-hub-worktrees\harness-design` ไม่ใช่ packaged application ใน `O:\local-llm-hub` สถานะก่อนจัดทำเอกสาร: branch `feat/local-llm-agent-harness`, HEAD ตาม frontmatter, working tree สะอาด

ข้อเสนอ: ให้ Hub เป็นเจ้าของ agent execution ผ่าน native API โดยเริ่มจาก service แยกบนเครื่องเดียวกัน Zuri เป็นเจ้าของงาน บทบาท คลัง skills และการอนุมัติทางธุรกิจ Ollama เป็นเจ้าของ inference process แยกจาก Hub

การอนุมัติเอกสารฉบับนี้ครอบคลุม **P1: Hub backend contract และ offline verification** เท่านั้น การเชื่อม Zuri จริง การเรียกโมเดลจริง และการบรรจุ sidecar ต้องมีแผนการส่งมอบของระยะนั้น ไม่ถือว่ารับรองโดยปริยาย

## ปัญหาและ RCA

[RCA-003](../../.brain/rca/RCA-003-ZURI-BACKEND-CONTRACT-GAPS.md) ยืนยันจาก source ว่า native structured output มีอยู่แล้ว แต่การเชื่อม Zuri ขาดสัญญา version/capability discovery, inference controls และหลักฐานผลการรันที่ผูกกับ request ส่วน chat compatibility API จงใจไม่รองรับ streaming/tools จึงเปลี่ยน base URL อย่างเดียวไม่ได้

ปัญหา marketing เช่นข้อความไม่เปลี่ยนและอ้าง source ผิดเป็น acceptance ของ Zuri การเปลี่ยน backend ไม่ได้พิสูจน์ว่าแก้ปัญหาเหล่านี้ได้

## ข้อเสนอและขอบเขต

สัญญาและ AC ใช้ [SPEC-HUB-ZURI-001](SPEC-HUB-ZURI-001-agent-backend.md) เป็นแหล่งเดียว

| ระยะ | ผลงาน | สถานะ/อำนาจจากการอนุมัติ CR นี้ |
|---|---|---|
| P1 — Hub contract | Native capability discovery, explicit inference settings, strict tool-output parsing, opt-in run evidence, offline contract tests และ docs | PROPOSED; ขออนุมัติ implementation ระยะนี้ |
| P2 — Zuri pilot | Adapter ใน Zuri, marketing fixture เดิม, manual semantic review และ bounded live experiment | DEFERRED; ต้องมีสเปก/งบ run และอนุมัติแยก |
| P3 — Managed sidecar | Zuri เปิด/ปิด Hub runtime, package/version pin, readiness และ process ownership | DEFERRED; ไม่รวม launcher หรือ installer ใน P1 |

P1 ไม่เพิ่ม OpenAI streaming parity, ไม่ฝัง Python เข้า Electron, ไม่ย้ายทั้งหมดจาก OpenCode, ไม่สร้าง UI, ไม่ดาวน์โหลดโมเดล และไม่เริ่ม/หยุด Ollama ไม่เพิ่ม cloud routing, dynamic skill upload, arbitrary request-level tool grants หรือ generic provider payload passthrough

## ผลกระทบต่อ parent และ peer

| เอกสาร | การเปลี่ยนที่เสนอ |
|---|---|
| [Target architecture](../architecture/TARGET-ARCHITECTURE.md), [ADR-HUB-001](../architecture/adr/ADR-001-agent-runtime.md) | รักษา separate Python service, single worker, opt-in client และ model server แยกกัน เพิ่ม client contract โดยไม่เปลี่ยนเจ้าของระบบเดิม |
| [CROSS-FEAT-002](../features/CROSS-FEAT-002-agent-harness.md) | ต่อขยาย harness ให้ client ภายนอกตรวจความเข้ากันได้ |
| [FR-018](../requirements/FR-018-configuration-registry.md) | เพิ่ม inference settings ที่ operator กำหนดและตรวจแบบ strict |
| [FR-019](../requirements/FR-019-routing-providers.md) | ส่ง settings โดยไม่สูญหาย เก็บหลักฐานแต่ละ provider attempt และ reject duplicate JSON keys |
| [FR-020](../requirements/FR-020-agent-sessions.md) | คง session ownership; เพิ่ม evidence ที่ผูกกับ run และ structured output |
| [FR-021](../requirements/FR-021-tool-permissions.md) | บันทึก hash ของผล read ที่ส่งคืนจริงโดยไม่เพิ่มสิทธิ์ |
| [FR-023](../requirements/FR-023-hub-api-evaluation.md) | เพิ่ม discovery route และ evidence response แบบ opt-in; รักษา chat subset เดิม |
| [Deployment](../local-deployment.md) | P1 ใช้ service แยก; wheel ปัจจุบันไม่ใช่หลักฐานของ sidecar installer |

เอกสาร active เดิมยังไม่ถูกแก้สัญญาหรือเปลี่ยนสถานะในรอบเสนอ หลังอนุมัติจึงเพิ่ม version delta และ interface-locked packets ตาม [STD-003](../standards/STD-003-implementation-unit-and-packet.md) ก่อนเขียน code; ห้ามขยาย signature นอกสเปกโดยไม่ทบทวน CR

## ความเสี่ยงและทางเลือก

ความเสี่ยง HIGH เพราะคร่อม config/provider/agent/API และข้อมูลหลักฐาน แม้ P1 เป็น additive: ค่า inference ที่ถูกละเลยทำให้เปรียบเทียบผิด, evidence อาจเปิดเผยข้อมูล, session หรือสิทธิ์อาจถูกตีความเป็น multi-tenant, และ client อาจใช้ structured PASS แทน semantic PASS วิธีป้องกันและ test อยู่ในสเปก

ทางเลือกที่ไม่เลือก: เปลี่ยน chat URL อย่างเดียว (contract ไม่ตรง), import legacy evaluation harness ทั้งชุด (มีข้อจำกัดเรื่องหลักฐาน), ฝัง runtime เข้า Zuri process (ผูก packaging โดยยังไม่พิสูจน์ integration) เลือก native API เพราะใช้ agent/session/permission boundary ที่มีอยู่

## เกณฑ์อนุมัติและปิดงาน

1. ผู้ใช้รับรองขอบเขต P1, ownership และ API/config/evidence contracts ในสเปก
2. AC-HZ-01 ถึง AC-HZ-12 มี test และผลจริง; mock PASS ต้องติดป้าย mock
3. Docs/graph/trace annotations และ regression ของ runtime เดิมผ่าน; ไม่มี known regression ในขอบเขต
4. P1 ผ่านแล้วรายงานว่า Hub contract พร้อมตรวจ integration เท่านั้น; P2/P3 ยัง NOT_RUN
5. เก็บ failure และข้อจำกัดตามจริง ไม่เปลี่ยนผล Zuri snapshot 5.0.10 และไม่อ้างว่า marketing แก้แล้ว

## การตรวจเอกสารและ version diff

ก่อนแก้เอกสาร: existing documentation suite **3 PASS** (2026-10-06); ไม่ใช่ acceptance ของสเปกใหม่ ผลตรวจฉบับส่งมอบบันทึกในสเปก

CR: ไม่มี -> **0.1.0 draft**. SPEC: ไม่มี -> **0.1.0 draft**. RCA: ไม่มี -> **0.1.0 draft**. App/runtime package versions และ active architecture **คงเดิม**. Implementation, live inference, Zuri integration, sidecar packaging: **NOT_RUN**. ไม่มี commit/push ในรอบเอกสารนี้

Please review and approve this documentation. I will generate the code once approved.

จุดรออนุมัตินี้มาจาก R5 ใน AGENTS.md ที่ผู้ใช้ส่ง: “Output the proposed documentation → STOP → ask for approval.” เอกสารนี้ไม่ได้อนุมัติตัวเอง

## Approval delta 0.1.0 -> 0.2.0

User approved with "approve" on 2026-10-06. P1 Hub implementation and offline tests are authorized; P2 live/Zuri adapter and P3 sidecar remain deferred. Earlier proposal-status and NOT_RUN text records the pre-approval checkpoint. Internal interface lock is in the Zuri packets; no public signature or scope expansion is authorized.

## P1 local implementation outcome — 2026-10-06

P1 implementation and offline acceptance PASS: 107 passed, 1 existing Windows symlink privilege skip, 5 live tests deselected; Ruff/mypy/docs checks pass. See [source-bound verification](HUB-ZURI-P1-VERIFICATION.md). This supersedes P1 NOT_RUN/pending statements at earlier proposal/approval checkpoints only. P2 Zuri/live and P3 sidecar remain NOT_RUN. Native client 0.2.0 and evidence 0.1.0 are locally implemented, package versions unchanged. Source remains uncommitted; no deployment or packet merge/closure is claimed.
