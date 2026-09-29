//! Sensor abstraction layer for hardware telemetry.
//!
//! Provides a `SensorProvider` trait and implementations:
//! - `SysinfoProvider`: Baseline OS provider using `sysinfo` (CPU cores, RAM, Disks, Networks).
//! - `LhmProvider`: Deep hardware provider talking NDJSON to the bundled LibreHardwareMonitor sidecar.

pub mod lhm_provider;
pub mod sysinfo_provider;

use serde::{Deserialize, Serialize};

/// A single normalized hardware sensor reading.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SensorReading {
    /// Stable sensor identifier, e.g. `"/intelcpu/0/load/2"` or `"/lpc/nct6795d/0/temperature/0"`.
    pub id: String,
    /// Human readable label, e.g. `"CPU Core #1 Thread #1"`, `"GPU Core"`.
    pub name: String,
    /// Owning hardware component, e.g. `"Intel Core i7-8700K"`, `"NVIDIA GeForce RTX 3060"`, `"Nuvoton NCT6795D"`.
    pub hw: String,
    /// Sensor kind: `"temperature"`, `"voltage"`, `"fan"`, `"control"`, `"load"`, `"clock"`, `"power"`, `"data"`, etc.
    pub kind: String,
    /// Current numerical value.
    pub value: f64,
    /// Unit string, e.g. `"°C"`, `"V"`, `"RPM"`, `"%"`, `"MHz"`, `"W"`, `"GB"`, `"MB"`.
    pub unit: String,
}

/// A source of [`SensorReading`]s. Implementations must be cheap to query and
/// must never panic in [`SensorProvider::read_all`].
pub trait SensorProvider: Send + Sync {
    fn name(&self) -> &str;
    fn available(&self) -> bool;
    fn read_all(&self) -> Vec<SensorReading>;
}
