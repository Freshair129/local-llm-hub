# FEAT-010: NVIDIA GPU VRAM & Hardware Sensor Monitor

| Field | Value |
|---|---|
| **Feature ID** | `FEAT-010` |
| **Domain** | Observability |
| **Status** | Partial; focused contract tests pass; live GPU acceptance pending |
| **Requirements** | [FR-006](../../../requirements/FR-006-gpu-monitor.md), [NFR-001](../../../requirements/NFR-001-performance.md) |
| **Rust Component** | [`src-tauri/src/commands/gpu.rs`](file:///d:/local-llm-hub/src-tauri/src/commands/gpu.rs) |
| **Test Suite** | [`tests/test_gpu_monitor.rs`](file:///d:/local-llm-hub/src-tauri/tests/test_gpu_monitor.rs) |

---

## 1. Overview

FEAT-010 อ่านและแสดงสถิติการ์ดจอที่ระบบตรวจพบ:
1. ยิงคำสั่ง `nvidia-smi` แบบ Asynchronous เพื่อดึงค่า:
   - GPU Index & Name
   - VRAM Used / Total (MB)
   - GPU Core Utilization (%)
   - GPU Core Temperature (°C), when supplied
2. เมื่อ `nvidia-smi` ไม่มีหรืออ่านไม่สำเร็จ native command คืน list ว่าง; UI แสดง `Unavailable` และไม่สร้างค่าจำลอง
3. The dashboard uses the first GPU returned by native telemetry. Multi-GPU presentation and live GPU acceptance are not verified.

## Verification scope

- Rust fixture tests cover parsing, unavailable command output, Ollama-independent GPU command behavior, and related command contract cases; see the readiness report for exact commands and results.
- JavaScript helper tests cover missing values and preserve measured zero utilization.
- GPU hardware readings, sensor-provider availability, fan or power telemetry, and actual alert behavior have not been exercised in the reserved-GPU session.
