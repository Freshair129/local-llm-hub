# FEAT-029: HW Telemetry Benchmark Recorder & Error Logger

| ข้อมูลเอกสาร | รายละเอียด |
|---|---|
| **Feature ID** | `FEAT-029` |
| **Domain** | `Observability & Telemetry` |
| **Requirements** | `FR-006` |
| **Status** | `Implemented / Production Ready` |
| **Standard** | `STD-003`, `SPEC-WORKFLOW-001` |

---

## 1. Feature Overview
`FEAT-029` ให้บริการบันทึกข้อมูลฮาร์ดแวร์เรียลไทม์ (Hardware Telemetry TimeSeries Logger) สำหรับนำไปประกอบผลการทดสอบ Benchmark ของโมเดล AI บนการ์ดจอ RTX 3060 CUDA:
1. **HW Benchmark Telemetry Recorder:** บันทึกค่า GPU Core Temp, Hotspot Temp, VRAM Usage, Board Power Draw, และ CPU Load แบบอนุกรมเวลา (TimeSeries 1,000ms sampling rate) เป็นไฟล์ `.json` หรือ `.csv`
2. **Structured Error Log Audit:** บันทึกข้อผิดพลาด (Error Trace) ของงานโมเดลแยกอิสระ พร้อมนับ `failed_tasks` และประทับเวลา ISO 8601

---

## 2. Technical Implementation
- **Frontend Controller:** `src/js/observability.js` & `src/js/sensors.js`
- **Data Model:** `src/js/state.js` & `src/model_stats.json`
- **Export Formats:** JSON, CSV (Auto-downloaded upon stopping recorder)

---

## 3. Usage Example
```javascript
import { startHwRecording, stopHwRecording } from './js/observability.js';

// Start recording before benchmark
startHwRecording(1000); // Sample every 1 sec

// Run model benchmark...

// Stop and auto-download CSV/JSON report
const logData = stopHwRecording('csv');
```
