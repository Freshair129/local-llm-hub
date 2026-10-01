# FEAT-016: System Prompt & Inference Preset Manager

| Field | Value |
|---|---|
| **Feature ID** | `FEAT-016` |
| **Domain** | Inference Gateway |
| **Status** | Implemented & Verified |
| **Requirements** | [FR-013](../../../requirements/FR-013-prompt-presets.md) |
| **Frontend Component** | [`src/js/chat.js`](file:///d:/local-llm-hub/src/js/chat.js) |

---

## 1. Overview

FEAT-016 จัดเตรียมชุด System Prompts และ Hyperparameter Presets ที่ปรับแต่งมาเฉพาะสำหรับงานแต่ละประเภท:
1. **Engineering Roles**: Senior Software Architect, Rust Systems Programmer, Code Review Auditor, Thai Explainer
2. **Preset Parameters**: Temperature, Top-P, Min-P, Repeat Penalty, Context Length
3. **One-Click Injection**: ผู้ใช้สามารถคลิกเลือก Role เพื่อสลับ System Prompt และ Sampling Settings ในหน้าต่าง Chat และ Arena ได้ทันที
