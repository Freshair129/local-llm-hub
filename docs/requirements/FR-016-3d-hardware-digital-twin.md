# FR-016: 3D Hardware Digital Twin Simulation

## Status
- **Status**: Approved
- **Domain**: Observability
- **Owner**: local-llm-hub core team
- **Traces To**: FEAT-018
- **Implements**: Interactive 3D WebGL Physical Hardware Digital Twin & Thermal Simulation

---

## 1. Problem Statement
Monitoring local LLM inference load, GPU temperature, and memory constraints solely through flat numbers and 2D meters fails to convey spatial hardware topology, thermals, and fan dynamics during intensive multi-model routing or benchmark runs on RTX 3060 hardware.

Inspired by the GHT Command Center, an interactive 3D digital twin of the host system provides high-fidelity observability into real physical hardware states.

---

## 2. Requirements

### 2.1 Functional Requirements
- **FR-016.1 (Interactive 3D Simulation Canvas)**: The system MUST render a WebGL 3D scene using Three.js inside `#view-twin` containing:
  - Motherboard PCB (Dark Slate with illuminated bus traces and PCIe x16 slot).
  - CPU Heatsink Tower (Aluminum fin stack, 8 copper heatpipes) with a 120mm PWM fan that rotates dynamically based on CPU utilization.
  - Dedicated NVIDIA GeForce RTX 3060 graphics card with dual cooling fans rotating according to real-time GPU load and fan curve.
  - Dual-Channel DDR4 RAM sticks with heatspreaders.
  - M.2 NVMe SSD with blinking activity LED simulating Ollama blob read/write operations.
- **FR-016.2 (Real-time Telemetry Color Mapping)**: The 3D CPU IHS and heatpipe glow MUST dynamically change color in real-time based on hardware temperature:
  - Cyan (`#5bc0eb`): Cool (<45°C)
  - Amber (`#ff8a1e`): Normal / Moderate Load (45°C – 68°C)
  - Red (`#ff3333`): High Thermal / Throttle Threshold (>68°C)
- **FR-016.3 (OrbitControls Navigation)**: The 3D view MUST support smooth mouse rotation, panning, and zoom via `OrbitControls`.
- **FR-016.4 (Camera Presets)**: The system MUST provide instant one-click smooth tweened camera presets:
  - `Isometric`: Default 45° perspective view of whole motherboard.
  - `RTX 3060 Focus`: Close-up of GPU card and dual fans.
  - `CPU Cooler`: Focus on CPU heatsink tower and rotating fan.
  - `Top-Down PCB`: Orthogonal top-down view of board layout and RAM.
- **FR-016.5 (Clean Lifecycle & Non-Blocking)**: The 3D rendering loop MUST cleanly pause or resize on viewport change and not leak memory or block the main thread.

---

## 3. Traceability

```
FR-016
  ├── implements ← src/js/digital_twin_3d.js::initDigitalTwin
  ├── implements ← src/js/digital_twin_3d.js::updateDigitalTwinTelemetry
  ├── implements ← src/js/observability.js::updateTelemetryDOM
  ├── implements ← src/index.html::#view-twin
  └── verified_by ← tests/browser/test_twin_3d_render
```
