# FEAT-010: NVIDIA GPU VRAM & Hardware Sensor Monitor

| Field | Value |
|---|---|
| **Feature ID** | `FEAT-010` |
| **Domain** | Observability |
| **Status** | Implemented & Verified |
| **Requirements** | [FR-006](../../../requirements/FR-006-gpu-monitor.md), [NFR-001](../../../requirements/NFR-001-performance.md) |
| **Rust Component** | [`src-tauri/src/commands/gpu.rs`](file:///d:/local-llm-hub/src-tauri/src/commands/gpu.rs) |
| **Test Suite** | [`tests/test_gpu_monitor.rs`](file:///d:/local-llm-hub/src-tauri/tests/test_gpu_monitor.rs) |

---

## 1. Overview

FEAT-010 ให้บริการดึงและรายงานสถิติการใช้งานการ์ดจอ NVIDIA (เช่น RTX 3060 12GB):
1. ยิงคำสั่ง `nvidia-smi` แบบ Asynchronous เพื่อดึงค่า:
   - GPU Name & Driver Version
   - VRAM Used / Total / Free (MB)
   - GPU Core Utilization (%)
   - GPU Temperature (°C)
2. มี Safety Fallback หากระบบไม่มี `nvidia-smi` จะสลับเป็น Mock/Synthetic Telemetry เพื่อป้องกันแอปพลิเคชันค้าง
3. ส่งแจ้งเตือน VRAM Warning เมื่อการใช้งานเกิน 90% ของความจุการ์ดจอ
