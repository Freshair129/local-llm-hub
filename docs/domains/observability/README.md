# Domain: Observability

| Field | Value |
|-------|-------|
| **Domain ID** | observability |
| **Version** | 1.0.0 |
| **Status** | Draft |
| **Owner** | Boss |
| **Created** | 2026-09-28 |

---

## Charter

Domain นี้รับผิดชอบ **การแสดงสถานะ resource ของระบบ** ได้แก่ GPU VRAM, RAM usage, GPU utilization และ temperature แบบ real-time

เป้าหมายคือให้ developer รู้ว่า **สามารถโหลดโมเดลเพิ่มได้อีกไหม** ก่อนสั่ง start

---

## Owned Features

| Feature ID | Name | Status | Cross-domain? |
|------------|------|--------|---------------|
| [FEAT-010](features/FEAT-010-gpu-vram-monitor.md) | GPU VRAM Monitor & Hardware Sensor Poller | Active | ❌ |
| [FEAT-011](features/FEAT-011-ram-cpu-monitor.md) | RAM Monitor & Top Process Ranker | Active | ❌ |
| [FEAT-018](features/FEAT-018-digital-twin.md) | 3D Hardware Digital Twin Simulation | Active | ❌ |
| [FEAT-020](features/FEAT-020-cpu-per-core-telemetry.md) | CPU Per-Core Telemetry | Active | ❌ |
| [FEAT-021](features/FEAT-021-gpu-afterburner-tuning.md) | GPU Fan & Afterburner Curve Tuning | Active | ❌ |
| [FEAT-022](features/FEAT-022-hardware-surfaces-storage-motherboard.md) | Motherboard & Storage Hardware Surfaces | Active | ❌ |

---

## Owned Requirements

| ID | Title | Priority | Status |
|----|-------|----------|--------|
| [FR-006](../../requirements/FR-006-gpu-monitor.md) | GPU / RAM Monitoring | P1 | Active |
| [FR-016](../../requirements/FR-016-3d-hardware-digital-twin.md) | 3D Hardware Digital Twin Simulation | P1 | Active |
| [NFR-001](../../requirements/NFR-001-performance.md) | Performance | P0 | Active |

---

## Technical Specifications & Architecture

| Document ID | Title | Scope |
|---|---|---|
| [SPEC-002](SPEC-002-hardware-telemetry-sensors.md) | Comprehensive Hardware Telemetry Sensor Topology | i7-8700K (12T), RTX 3060, NCT6795D, NVMe SSD |
| [ADR-007](../../adr/ADR-007-push-telemetry-events.md) | Single-Source Push-Based Telemetry via Tauri Events | Background sampler emitting `telemetry://snapshot` |

## Boundaries

```
IN SCOPE:
  - Call nvidia-smi และ parse output
  - RAM stats ผ่าน sysinfo
  - Real-time polling loop (ทุก 2 วินาที)
  - VRAM warning เมื่อ > 90%
  - Render gauges ใน Monitor page

OUT OF SCOPE:
  - Power management / throttling
  - Multi-GPU load balancing
  - Network bandwidth monitoring
```

---

## Fallback

หาก `nvidia-smi` ไม่พบ:
- ซ่อน GPU gauge
- แสดงข้อความ "GPU monitoring unavailable — nvidia-smi not found"
- RAM monitoring ยังทำงานได้ปกติ

ดูรายละเอียดใน [FR-006](../../requirements/FR-006-gpu-monitor.md)
