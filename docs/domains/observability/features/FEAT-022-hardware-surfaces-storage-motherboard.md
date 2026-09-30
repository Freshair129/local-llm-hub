# FEAT-022: Hardware Surfaces — Storage (NVMe) & Motherboard / Power

**Domain**: Observability & Telemetry  
**Traceability**: `FR-006`, `SPEC-002`, `ADR-007`  
**Status**: Implemented  

## Overview
Exposes dedicated monitoring surfaces for non-processor PC hardware components:
1. **Storage & NVMe Surface**:
   - Drive model name and PCIe link specification.
   - S.M.A.R.T. health status (e.g. 100% Good).
   - Real-time drive controller thermals (°C).
   - Read & write throughput bandwidth (MB/s).
   - Capacity allocation (Used GB / Total GB).
2. **Motherboard & Power Surface**:
   - Chipset and VRM MOSFET thermals (°C).
   - Chassis & Cooler fan header RPMs (AIO pump, intake, exhaust).
   - Multi-rail DC voltage monitoring (+12V, +5V, +3.3V, VCore).

## UI Component
- View panels: `view-storage-telemetry`, `view-motherboard-telemetry`
- Script: `src/js/hardware_surfaces.js`
