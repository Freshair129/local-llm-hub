---
id: FR-006
title: GPU / RAM Monitoring
domain: observability
owner: Boss
status: draft
priority: P1
features:
  - FEAT-010
  - FEAT-011
cross_domains: []
implements_test:
  - TEST-006
---

# FR-006 — GPU / RAM Monitoring

## Statement

ระบบแสดง GPU telemetry ที่ตรวจวัดได้และ RAM telemetry เพื่อช่วยให้ผู้ใช้ตรวจสอบทรัพยากร ระบบต้องแยกค่าที่อ่านไม่ได้ออกจากค่าศูนย์อย่างชัดเจน

## Acceptance Criteria

1. **WHEN** native telemetry มี GPU readings **THEN** system SHALL แสดง readings ที่ได้รับจาก `nvidia-smi` และ sensor provider โดยไม่เติมค่าประมาณ
2. **WHEN** utilization เป็น `0` **THEN** system SHALL แสดง `0`; เมื่อ field หายหรืออ่านไม่ได้ SHALL แสดง `Unavailable`
3. **WHEN** nvidia-smi ไม่พบหรือคำสั่งล้มเหลว **THEN** native command SHALL คืน GPU list ว่างและ UI SHALL แสดง `Unavailable` โดยไม่สร้าง GPU จำลอง
4. **WHEN** system ไม่มี power, hotspot, fan หรือ clock sensor **THEN** field เหล่านั้น SHALL แสดง `Unavailable`
5. Current dashboard presents the first GPU in the native telemetry list; separate multi-GPU cards and live hardware acceptance remain unverified.
6. CPU/RAM fallback behavior and cross-application VRAM ownership are outside the verified GPU telemetry scope and SHALL NOT be represented as measured GPU state.

## Data Points ที่ต้องแสดง

| Metric | Unit | Source |
|--------|------|--------|
| VRAM Used / Total | GB | `nvidia-smi`; unavailable if absent |
| GPU Utilization | % | `nvidia-smi`; preserves measured zero |
| GPU Core Temperature | °C | `nvidia-smi`; nullable |
| GPU Hotspot | °C | native sensor provider when available; otherwise `Unavailable` |
| Fan Speed | RPM or % | native sensor provider when available; otherwise `Unavailable` |
| Clocks | MHz | native sensor provider when available; otherwise `Unavailable` |
| Board Power | W | native sensor provider when available; otherwise `Unavailable` |
| RAM Used / Total | GB | native system telemetry; current UI fallback must be checked separately |

## Polling Command

```
nvidia-smi --query-gpu=index,name,memory.used,memory.total,utilization.gpu,temperature.gpu \
           --format=csv,noheader,nounits
```

The current native query reads GPU index, name, VRAM used/total, utilization and core temperature. It does not read power draw, hotspot, fan or clocks.

## Color Zones (gauge)

| Range | Color | Meaning |
|-------|-------|---------|
| 0–70% | 🟢 Green | Lower reported GPU utilization; does not guarantee a model will fit |
| 70–90% | 🟡 Yellow | Higher GPU utilization |
| > 90% | 🔴 Red | Very high GPU utilization; VRAM capacity is shown separately |

## Traceability

```
FR-006
  ├── implements ← src-tauri/src/commands/gpu.rs::query_nvidia_smi
  ├── implements ← src-tauri/src/commands/gpu.rs::poll_hardware_telemetry
  ├── implements ← src/js/observability.js::updateTelemetryDOM
  ├── implements ← src/js/gpu_telemetry_view.js::gpuTelemetryView
  └── verified_by ← src-tauri/src/commands/gpu.rs tests
                  ← eval/desktop/gpu_telemetry_view.test.mjs
```
