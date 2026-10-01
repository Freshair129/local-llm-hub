# FEAT-025: Model Tag Taxonomy & Faceted Bento Grid Filter

| Field | Value |
|---|---|
| **Feature ID** | `FEAT-025` |
| **Domain** | Model Management |
| **Status** | Planned (Phase 6 / P2 Roadmap) |
| **Requirements** | [FR-002](../../../requirements/FR-002-model-aggregation.md), [FR-004](../../../requirements/FR-004-model-card.md) |
| **ADR Reference** | [ADR-009](../../../adr/ADR-009-feature-gap-remediation-and-p2-roadmap.md) |
| **Target Components** | [`src/js/model.js`](file:///d:/local-llm-hub/src/js/model.js), [`src/index.html`](file:///d:/local-llm-hub/src/index.html) (`view-models`) |

---

## 1. Overview

FEAT-025 ช่วยเพิ่มประสิทธิภาพในการค้นหาและจัดระเบียบโมเดลในคลัง Local LLM ซึ่งมีมากกว่า 50 รายการ โดยการเพิ่มระบบ Faceted Filtering ตามหมวดหมู่งาน:
1. **5-Tier Tag Taxonomy**:
   - `💻 Coding`: โมเดลเฉพาะทางด้านการเขียนโค้ด (เช่น Qwen-Coder, Aroow-Rust, DeepSeek-Coder)
   - `🧠 Reasoning & Thinking`: โมเดลที่มี Thinking / CoT tokens (เช่น Mellum2-Thinking, Qwen-Thinking)
   - `💬 Chat & Roleplay`: โมเดลสนทนาทั่วไป (เช่น Llama-3-Instruct, Gemma-2-IT)
   - `👁️ Multimodal & Vision`: โมเดลรับอินพุตภาพ (เช่น Llama-3.2-Vision, Qwen2-VL)
   - `⚡ Small / Edge (<= 3B)`: โมเดลขนาดเล็กที่กิน VRAM ต่ำ รันบนฮาร์ดแวร์จำกัดได้สบาย
2. **Interactive Bento Pills**:
   - ปุ่ม Tag Pills ด้านบนของหน้ารายการโมเดล ผู้ใช้คลิกเพื่อกรองโมเดลได้ในทันที
   - อัปเดตตัวเลขจำนวนโมเดลในแต่ละหมวดหมู่แบบ Dynamic
3. **Zero Backend Overhead**: ทำงานบน In-Memory Cache ของ UI ไม่ต้องยิง query เพิ่มเติม
