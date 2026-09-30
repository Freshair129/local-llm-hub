# FEAT-021: GPU Telemetry & MSI Afterburner Control Center

**Domain**: Observability & Telemetry  
**Traceability**: `FR-006`, `SPEC-002`, `ADR-007`  
**Status**: Implemented  

## Overview
Full telemetry tracking and real-time GPU hardware tuning inspired by MSI Afterburner:
- Real-time GPU telemetry: Core Clock (MHz), Memory Clock (MHz), VRAM Buffer, Core Temp (°C), Hotspot Temp (°C), Board Power Draw (W), Fan RPM, CUDA Core load (%).
- Interactive Tuning Controls:
  - Core Clock Offset Slider (`-500 MHz` to `+500 MHz`).
  - Memory Clock Offset Slider (`-1000 MHz` to `+1500 MHz`).
  - Power Target Limit Slider (`50%` to `115%`).
  - Fan Duty Control: Automatic Curve vs Manual Duty Slider (`0%` to `100%`) invoking Tauri `set_fan_duty`.
- Tuning Profiles / Presets:
  - `⚡ AI Inference Boost`: +150 MHz Core, +600 MHz Mem, 100% Power, 70% Fan.
  - `🤫 Quiet / Low Temp`: -100 MHz Core, 80% Power, Auto Quiet Fan.
  - `🚀 Max Overclock`: +220 MHz Core, +1000 MHz Mem, 110% Power, 85% Fan.
  - `🔄 Stock Default`: +0 MHz Core, +0 MHz Mem, 100% Power, Auto Fan.

## UI Component
- View panel: `view-gpu-tuning`
- Script: `src/js/gpu_tuning.js`
