---
id: FR-011
title: Multi-Model Arena & Side-by-Side Evaluation
domain: inference-gateway
owner: Boss
status: implemented
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
