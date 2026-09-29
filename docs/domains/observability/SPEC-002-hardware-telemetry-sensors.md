# SPEC-002: Comprehensive Hardware Telemetry Sensor Topology

| Field | Value |
|-------|-------|
| **Document ID** | SPEC-002 |
| **Domain** | Observability |
| **Status** | Active |
| **Related** | [FR-006](../../requirements/FR-006-gpu-monitor.md), [FR-016](../../requirements/FR-016-3d-hardware-digital-twin.md), [ADR-007](../../adr/ADR-007-push-telemetry-events.md) |
| **Hardware Baseline** | Intel Core i7-8700K (12T), NVIDIA GeForce RTX 3060 (12GB GDDR6), Nuvoton NCT6795D Super I/O, NVMe SSD + SATA Storage |
| **Origin Reference** | `G:\.ollama_blobs_root\docs\SPEC-Hardware-Telemetry-GUI.md`, `G:\.ollama_blobs_root\docs\M3-sensor-audit.md` |

---

## 1. Purpose & Scope

This specification defines the hardware telemetry sensor mapping, unit conventions, and data collection pipeline for monitoring local LLM inference workstations. High-performance LLM inference exerts extreme simultaneous thermal and memory stress across GPU, CPU, and PCIe buses; having an unambiguous sensor taxonomy ensures accurate digital twin simulation ([FR-016](../../requirements/FR-016-3d-hardware-digital-twin.md)) and prevention of thermal throttling.

---

## 2. Sensor Topology & Measurement Matrix

### 2.1 CPU Subsystem (Intel Core i7-8700K — 6 Cores / 12 Threads)
- **Cores & Threads**: 12 logical execution units.
- **Utilization & Frequency**:
  - Per-thread utilization percentage (`0.0% – 100.0%`).
  - Core clock frequency (`MHz` / `GHz`).
  - Bus clock speed.
- **Thermal Architecture**:
  - Core package temperature (`°C`).
  - Per-core temperature sensors (Core 0 to Core 5).
  - **Distance-to-TjMax**: Distance in degrees Celsius until thermal throttling activation (`TjMax = 100°C`).
- **Power & Voltage**:
  - Package power draw (`Watts`).
  - CPU VCore voltage (`Volts`).

### 2.2 GPU Subsystem (NVIDIA GeForce RTX 3060 — 12GB GDDR6)
- **Compute Engines**:
  - Core GPU utilization (`%`).
  - CUDA execution load (`%`).
  - Memory controller load (`%`).
  - Video encoder / decoder load (`%`).
- **Memory Architecture**:
  - Total VRAM: 12,288 MB.
  - Dedicated VRAM allocated / free (`MB`).
  - Memory clock frequency (`MHz`).
  - PCIe Rx / Tx bandwidth throughput (`MB/s`).
- **Thermal & Acoustics**:
  - GPU Core Temperature (`°C`).
  - GPU Hotspot Temperature (`°C`).
  - Dual PWM Cooling Fan speeds: Fan 1 RPM / Fan 2 RPM (`RPM` and `%`).
  - Total board power draw (`Watts`).

### 2.3 Motherboard Subsystem (Nuvoton NCT6795D Super I/O)
- **Voltage Rails**:
  - `+12V`, `+5V`, `+3.3V`, `VCore`, `DRAM Voltage`.
- **System Temperatures**:
  - Motherboard VRM / MOS temperature (`°C`).
  - PCH / Chipset temperature (`°C`).
  - System ambient sensor (`°C`).
- **Chassis & Cooler Fans**:
  - CPU Fan 1 (PWM cooler for digital twin simulation).
  - Chassis intake and exhaust fan RPM headers (up to 6 tachometer channels).

### 2.4 Storage & Memory Subsystem (RAM & NVMe SSD)
- **System Memory**:
  - 32GB Dual-Channel DDR4.
  - Capacity used / free (`GB`).
  - Sub-timing metrics: `tCL, tRCD, tRP, tRAS` in nanoseconds (`ns`).
- **Storage Volumes**:
  - Primary OS Drive (Drive C: NVMe M.2 SSD).
  - Secondary Models Storage (Drive G: / Drive O: High-capacity storage roots).
  - Metrics: Read / write throughput (`MB/s`), active queue time, temperature (`°C`), and write activity triggers for LED animation.

---

## 3. Data Acquisition Pipeline

```
┌──────────────────────────────────────┐
│       Hardware Providers             │
│  - nvidia-smi / NVML (GPU)          │
│  - sysinfo (CPU, RAM, Disks, Net)    │
│  - LibreHardwareMonitor Provider     │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│  Single Persistent Sampler (Rust)    │
│  - AppState-cached state             │
│  - 2000ms cadence (ADR-007)          │
│  - Zero panic error handling (ADR-100│
└──────────────────┬───────────────────┘
                   │
                   ▼  Tauri Event: `telemetry://snapshot`
┌──────────────────────────────────────┐
│   Presentation Layer                 │
│   - Observability Dashboard          │
│   - 3D Digital Twin (FEAT-018)       │
│   - Real-time VRAM/RAM Alarms        │
└──────────────────────────────────────┘
```

---

## 4. Fallback & Graceful Degradation Rules

1. **NVML / nvidia-smi Missing**: If NVIDIA GPU management tools are not found, GPU metrics set `gpu_available: false` and render fallback notification without affecting CPU or RAM telemetry.
2. **Missing Sensor Channels**: Any unavailable sensor channel (e.g. absent fan RPM or auxiliary motherboard probe) emits `None` / `null` rather than dummy zero readings to avoid misleading diagnostics.
3. **Cumulative Network Delta**: Network metrics maintain persistent cumulative byte counters in `AppState` to compute smooth transfer speed (`MB/s`) across ticks rather than recreating network interfaces every sample.
