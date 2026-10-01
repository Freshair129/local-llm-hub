# FEAT-023: Chat Preflight Token Estimator & Context Overflow Guard

| Field | Value |
|---|---|
| **Feature ID** | `FEAT-023` |
| **Domain** | Inference Gateway |
| **Status** | Planned (Phase 6 / P2 Roadmap) |
| **Requirements** | [FR-007](../../../requirements/FR-007-chat-interface.md), [NFR-001](../../../requirements/NFR-001-performance.md) |
| **ADR Reference** | [ADR-009](../../../adr/ADR-009-feature-gap-remediation-and-p2-roadmap.md) |
| **Target Components** | [`src/js/chat.js`](file:///d:/local-llm-hub/src/js/chat.js), [`src/index.html`](file:///d:/local-llm-hub/src/index.html) |

---

## 1. Overview

FEAT-023 ช่วยป้องกันปัญหาการส่งคำสั่ง (Prompt) ที่ยาวเกินขนาด Context Window ของโมเดล โดยคำนวณและแสดงสถานะปริมาณ Token ล่วงหน้าแบบ Real-time บนหน้าต่าง Chat Playground:
1. **Live Token Meter**: ขณะที่ผู้ใช้พิมพ์ข้อความหรือ Paste โค้ด ระบบจะคำนวณขนาด token โดยประมาณทันที
2. **Context Threshold Warning**:
   - 🟢 **Safe**: < 70% ของ Context Length (เช่น < 5,734 tokens สำหรับ 8K context)
   - 🟡 **Warning**: 70% – 90% แสดงแถบสีเหลืองเตือนว่าใกล้เต็ม
   - 🔴 **Danger**: > 90% แสดงแถบสีแดงและขึ้นข้อความแจ้งเตือนความเสี่ยงที่คำตอบจะถูก truncate
3. **Zero Keystroke Latency**: ใช้อัลกอริทึม Hybrid BPE Heuristic ตาม ADR-009 โดยไม่กระทบความลื่นไหลในการพิมพ์

---

## 2. Technical Contracts & UI Specification

### 2.1 UI Placement
- ตำแหน่ง: มุมล่างขวาของ Textarea ก่อนปุ่ม `Send`
- Format: `[Live Tokens] / [Model Max Context] (Usage %)`
  - ตัวอย่าง: `1,420 / 8,192 tokens (17%)`

### 2.2 Heuristic Estimation Formula
```javascript
function estimateTokenCount(text) {
  if (!text) return 0;
  // Thai & Unicode CJK weight (~1.8 chars/token)
  const thaiCjkMatches = text.match(/[\u0E00-\u0E7F\u4E00-\u9FFF]/g) || [];
  const latinCodeText = text.replace(/[\u0E00-\u0E7F\u4E00-\u9FFF]/g, '');
  const thaiTokens = Math.ceil(thaiCjkMatches.length / 1.8);
  const latinTokens = Math.ceil(latinCodeText.length / 3.9);
  return thaiTokens + latinTokens;
}
```
