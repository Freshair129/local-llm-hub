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
| FEAT-010 | GPU VRAM Monitor | Draft | ❌ |
| FEAT-011 | RAM Monitor | Draft | ❌ |

---

## Owned Requirements

| ID | Title | Priority | Status |
|----|-------|----------|--------|
| [FR-006](../../requirements/FR-006-gpu-monitor.md) | GPU / RAM Monitoring | P1 | Draft |
| [NFR-001](../../requirements/NFR-001-performance.md) | Performance | P0 | Draft |

---

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
