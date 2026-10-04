---
id: FR-011
title: Multi-Model Arena & Side-by-Side Evaluation
domain: inference-gateway
owner: Boss
status: active
superseded_by: null
version: 0.2.0
priority: P1
features:
  - FEAT-013
cross_domains:
  - observability
  - model-management
implements_test:
  - TC-FEAT-013-INTEG
---

# FR-011: Multi-Model Arena & Side-by-Side Evaluation

## 1. Description
ระบบประลองโมเดลแบบแบ่งหน้าจอซ้าย-ขวา (Side-by-Side Split View) ที่เปิดโอกาสให้ผู้ใช้งานส่งคำถามหรือโจทย์โค้ดเดียวกันไปยังโมเดล 2 ตัวพร้อมกัน เพื่อวัดผลและเปรียบเทียบประสิทธิภาพแบบเรียลไทม์

## 2. Acceptance Criteria (AC)

Current buffered-mode override, approved in [HUB-ACCEPTANCE-REPAIR](../plans/HUB-ACCEPTANCE-REPAIR.md): both selectors use the shared inference catalog, not physical inventory when Hub mode is enabled. Each call uses `request.model` and the selected backend, and renders `ChatResponse.content`. Only reported completion tokens count; missing usage is `Not reported`. TTFT is `Not measured`. A measured output-token rate uses end-to-end elapsed time and is labeled accordingly. No random values or character-count token guesses. Winner indication requires two finite measured rates. Both concurrent requests must settle before the busy guard releases, including errors. Empty or failed catalog disables execution. The older decode-throughput/TTFT requirements below are deferred until streaming instrumentation exists.
- **AC-1**: มีหน้าจอ Split Screen แสดง Candidate A (น้ำเงิน) และ Candidate B (ม่วง) พร้อมตัวเลือกโมเดลจากรายการที่สแกนพบ
- **AC-2**: รองรับการเลือก System Persona จากคลัง (`PERSONAS`) เพื่อกำหนดกรอบพฤติกรรมของทั้งสองโมเดลให้เท่าเทียมกัน
- **AC-3**: วัดผลและแสดงตัวชี้วัดความเร็วแบบเรียลไทม์:
  - **Tokens per second (t/s)**: คำนวณจาก `eval_count / eval_duration`
  - **Time to First Token (TTFT)**: ในหน่วยมิลลิวินาที (ms)
  - **Total Generated Tokens**: จำนวนโทเคนที่สร้างขึ้น
- **AC-4**: ไฮไลต์ผู้ชนะ (Winner Badge 👑) อัตโนมัติบนโมเดลที่ทำความเร็วได้สูงกว่า

## 3. Traceability
- **Code Symbol**: [`src/js/arena.js`](../../src/js/arena.js)
- **Styles**: [`src/styles.css`](../../src/styles.css) (`.arena-grid`, `.arena-card`, `.arena-winner`)

Version diff 0.1.0 -> 0.2.0: Shared inference catalog, canonical buffered response, truthful unavailable metrics and concurrent error recovery; focused and native tests are in eval/desktop/.
