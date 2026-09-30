# FEAT-020: CPU Deep Telemetry — Per-Core Monitoring

**Domain**: Observability & Telemetry  
**Traceability**: `FR-006`, `SPEC-002`, `ADR-007`  
**Status**: Implemented  

## Overview
Provides granular per-core hardware metrics extracted via `sysinfo` and LibreHardwareMonitor (LHM):
- Per-core utilization percentage (0 - 100%) with dynamic load status color coding.
- Per-core real-time clock frequency in MHz.
- Per-core thermal readings in °C.
- CPU Package total power draw (Watts) and Core VCore voltage regulation (Volts).

## UI Component
- View panel: `view-cpu`
- Script: `src/js/cpu_telemetry.js`
- Real-time cadence synchronization through `select-telemetry-rate`.
