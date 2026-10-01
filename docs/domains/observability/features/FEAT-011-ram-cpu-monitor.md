# FEAT-011: System RAM & Host CPU Process Ranker

| Field | Value |
|---|---|
| **Feature ID** | `FEAT-011` |
| **Domain** | Observability |
| **Status** | Implemented & Verified |
| **Requirements** | [FR-006](../../../requirements/FR-006-gpu-monitor.md) |
| **Rust Component** | [`src-tauri/src/commands/gpu.rs`](file:///d:/local-llm-hub/src-tauri/src/commands/gpu.rs), [`src-tauri/src/sensors/sysinfo_provider.rs`](file:///d:/local-llm-hub/src-tauri/src/sensors/sysinfo_provider.rs) |
| **Frontend Component** | [`src/js/process_manager.js`](file:///d:/local-llm-hub/src/js/process_manager.js) |

---

## 1. Overview

FEAT-011 ทำหน้าที่มอนิเตอร์หน่วยความจำหลัก (Host RAM) และจัดอันดับโปรเซสที่ใช้ทรัพยากรสูงสุดในระบบ Windows (Process Ranker):
1. **Host RAM & Swap**: รายงาน Total RAM, Used RAM, Available RAM และ Swap usage
2. **Top Process Ranking**: จัดอันดับ Top 10 โปรเซสที่กิน RAM และ CPU สูงสุดในเครื่อง เพื่อให้ผู้ใช้ทราบว่ามีโปรแกรมอื่นแย่งทรัพยากรขณะรัน LLM หรือไม่
3. **Adaptive Cadence Polling**: ผู้ใช้สามารถปรับรอบการตรวจวัดได้ตั้งแต่ 500ms ถึง 5s หรือกด Pause
