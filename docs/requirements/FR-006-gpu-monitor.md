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

ระบบต้องแสดง GPU VRAM และ RAM usage แบบ real-time เพื่อให้ผู้ใช้วางแผนการโหลดโมเดลได้

## Acceptance Criteria

1. **WHEN** user เปิด Monitor page **THEN** system SHALL เริ่ม polling GPU stats ทุก 2 วินาที
2. **WHEN** GPU stats ได้รับ **THEN** system SHALL update gauge animation ภายใน 200ms
3. **WHEN** VRAM usage เกิน 90% **THEN** system SHALL เปลี่ยน gauge สีแดงและแสดง toast warning
4. **WHEN** nvidia-smi ไม่พบ **THEN** system SHALL ซ่อน GPU section และแสดง "GPU monitoring unavailable"
5. **WHEN** user ออกจาก Monitor page **THEN** system SHALL หยุด polling (ไม่ waste CPU background)
6. **IF** มีหลาย GPU **THEN** system SHALL แสดง gauge แยกต่างหากสำหรับแต่ละ GPU

## Data Points ที่ต้องแสดง

| Metric | Unit | Source |
|--------|------|--------|
| VRAM Used / Total | GB | nvidia-smi |
| GPU Utilization | % | nvidia-smi |
| GPU Temperature | °C | nvidia-smi |
| Power Draw | W | nvidia-smi |
| RAM Used / Total | GB | sysinfo crate |

## Polling Command

```
nvidia-smi --query-gpu=index,name,memory.used,memory.total,utilization.gpu,temperature.gpu,power.draw \
           --format=csv,noheader,nounits
```

## Color Zones (gauge)

| Range | Color | Meaning |
|-------|-------|---------|
| 0–70% | 🟢 Green | ปลอดภัย โหลดโมเดลได้ |
| 70–90% | 🟡 Yellow | ระวัง พื้นที่จำกัด |
| > 90% | 🔴 Red | Warning อาจโหลดไม่ได้ |

## Traceability

```
FR-006
  ├── implements ← src-tauri/src/commands/gpu.rs::get_gpu_stats
  ├── implements ← src/js/pages/monitor.js::startMonitoring
  ├── implements ← src/js/components/gpuGauge.js::GPUGauge
  └── verified_by ← tests/gpu_test.rs::test_nvidia_smi_parse
                  ← tests/gpu_test.rs::test_gpu_stats_no_nvidia_smi_fallback
```
