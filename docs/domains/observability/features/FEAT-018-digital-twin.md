# FEAT-018: 3D Hardware Digital Twin Simulation

| Field | Value |
|-------|-------|
| **Feature ID** | FEAT-018 |
| **Domain** | Observability |
| **Status** | Active |
| **Requirement** | [FR-016](../../../requirements/FR-016-3d-hardware-digital-twin.md) |
| **Component** | `src/js/digital_twin_3d.js` |

---

## Overview
Interactive 3D WebGL Digital Twin of the local host machine, providing real-time spatial observability of hardware components:
- **Motherboard PCB**: Dark Slate substrate with bus tracks and PCIe x16 slot.
- **CPU Heatsink & PWM Fan**: Dynamic rotational speed matching CPU load + thermal color glow on IHS and heatpipes.
- **NVIDIA GeForce RTX 3060**: Dual cooling fans rotating according to real-time GPU load and fan curve.
- **Dual-Channel RAM Sticks**: High-frequency memory modules with heatshields.
- **M.2 NVMe SSD**: Blinking activity LED synchronized with model blob I/O operations.

## Architecture & Controls
- **Engine**: Three.js WebGL with PCFSoftShadowMap and exponential fog.
- **OrbitControls**: Left-click rotation, right-click pan, scroll-wheel zoom.
- **Camera Presets**: `Isometric`, `RTX 3060 Focus`, `CPU Cooler`, `Top-Down PCB`.
- **Telemetry Hook**: Driven by `updateDigitalTwinTelemetry()` wired to hardware telemetry polling loop.
