# FEAT-014: Token ROI & Cloud API Cost Savings Calculator

| Field | Value |
|---|---|
| **Feature ID** | `FEAT-014` |
| **Domain** | Model Management & Analytics |
| **Status** | Implemented & Verified |
| **Rust Component** | [`src-tauri/src/models/types.rs`](file:///d:/local-llm-hub/src-tauri/src/models/types.rs) |
| **Frontend Component** | [`src/js/stats.js`](file:///d:/local-llm-hub/src/js/stats.js), [`src/index.html`](file:///d:/local-llm-hub/src/index.html) (`view-stats`) |

---

## 1. Overview

FEAT-014 คำนวณความคุ้มค่าและผลตอบแทนจากการลงทุน (ROI) ในการรัน Local LLM บนการ์ดจอ RTX 3060 เปรียบเทียบกับการเสียเงินเรียก Cloud API (เช่น OpenAI GPT-4o):
1. **Token Accounting**: บันทึกจำนวน Prompt Tokens และ Completion Tokens ทุกครั้งที่มีการเรียกใช้งานผ่าน Chat หรือ Arena
2. **Cost Calculation**:
   - Baseline เทียบกับราคา OpenAI GPT-4o API:
     - Prompt: $2.50 ต่อ 1M tokens
     - Completion: $10.00 ต่อ 1M tokens
   - คำนวณยอดเงินสะสมที่ประหยัดได้ (Total Estimated Savings in USD / THB)
3. **Hardware Amortization**: คำนวณจุดคุ้มทุนเทียบกับราคาฮาร์ดแวร์การ์ดจอ RTX 3060 (เช่น 10,000 THB)
