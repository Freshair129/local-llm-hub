//! Sysinfo-backed sensor provider.
//!
//! Wraps system metrics from `sysinfo` and exposes them as a flat tree of `SensorReading`s.
//! Guaranteed to be available on all platforms as a baseline sensor tree.

use std::sync::Mutex;
use sysinfo::{Disks, Networks, System};

use super::{SensorProvider, SensorReading};

pub struct SysinfoProvider {
    system: Mutex<System>,
    networks: Mutex<Networks>,
}

impl SysinfoProvider {
    pub fn new() -> Self {
        SysinfoProvider {
            system: Mutex::new(System::new_all()),
            networks: Mutex::new(Networks::new_with_refreshed_list()),
        }
    }
}

impl Default for SysinfoProvider {
    fn default() -> Self {
        Self::new()
    }
}

impl SensorProvider for SysinfoProvider {
    fn name(&self) -> &str {
        "sysinfo"
    }

    fn available(&self) -> bool {
        true
    }

    fn read_all(&self) -> Vec<SensorReading> {
        let mut readings = Vec::new();
        let hw = "System (sysinfo)";

        // 1. CPU & Memory
        {
            let mut sys = match self.system.lock() {
                Ok(guard) => guard,
                Err(poisoned) => poisoned.into_inner(),
            };
            sys.refresh_cpu();
            sys.refresh_memory();

            let cpus = sys.cpus();
            if !cpus.is_empty() {
                let avg = cpus.iter().map(|c| c.cpu_usage()).sum::<f32>() / cpus.len() as f32;
                readings.push(SensorReading {
                    id: "/sysinfo/cpu/total/load".to_string(),
                    name: "CPU Total Load".to_string(),
                    hw: hw.to_string(),
                    kind: "load".to_string(),
                    value: avg as f64,
                    unit: "%".to_string(),
                });

                for (i, cpu) in cpus.iter().enumerate() {
                    readings.push(SensorReading {
                        id: format!("/sysinfo/cpu/{}/load", i),
                        name: format!("CPU Core #{}", i),
                        hw: hw.to_string(),
                        kind: "load".to_string(),
                        value: cpu.cpu_usage() as f64,
                        unit: "%".to_string(),
                    });
                }
            }

            let bytes_to_gb = |b: u64| b as f64 / (1024.0 * 1024.0 * 1024.0);
            let total = sys.total_memory();
            let used = sys.used_memory();
            readings.push(SensorReading {
                id: "/sysinfo/memory/used".to_string(),
                name: "Memory Used".to_string(),
                hw: hw.to_string(),
                kind: "data".to_string(),
                value: bytes_to_gb(used),
                unit: "GB".to_string(),
            });
            readings.push(SensorReading {
                id: "/sysinfo/memory/total".to_string(),
                name: "Memory Total".to_string(),
                hw: hw.to_string(),
                kind: "data".to_string(),
                value: bytes_to_gb(total),
                unit: "GB".to_string(),
            });
            if total > 0 {
                readings.push(SensorReading {
                    id: "/sysinfo/memory/load".to_string(),
                    name: "Memory Load".to_string(),
                    hw: hw.to_string(),
                    kind: "load".to_string(),
                    value: (used as f64 / total as f64) * 100.0,
                    unit: "%".to_string(),
                });
            }
        }

        // 2. Disks
        let disks = Disks::new_with_refreshed_list();
        for (i, disk) in disks.list().iter().enumerate() {
            let total = disk.total_space();
            if total == 0 {
                continue;
            }
            let used = total.saturating_sub(disk.available_space());
            let mount = disk.mount_point().to_string_lossy().to_string();
            readings.push(SensorReading {
                id: format!("/sysinfo/disk/{}/load", i),
                name: format!("Disk {} Used", mount),
                hw: "Storage (sysinfo)".to_string(),
                kind: "load".to_string(),
                value: (used as f64 / total as f64) * 100.0,
                unit: "%".to_string(),
            });
        }

        // 3. Network Interfaces
        let mut networks = match self.networks.lock() {
            Ok(guard) => guard,
            Err(poisoned) => poisoned.into_inner(),
        };
        networks.refresh();
        let bytes_to_mb = |b: u64| b as f64 / (1024.0 * 1024.0);
        for (name, data) in networks.iter() {
            readings.push(SensorReading {
                id: format!("/sysinfo/net/{}/rx", name),
                name: format!("{} Received", name),
                hw: "Network (sysinfo)".to_string(),
                kind: "data".to_string(),
                value: bytes_to_mb(data.total_received()),
                unit: "MB".to_string(),
            });
            readings.push(SensorReading {
                id: format!("/sysinfo/net/{}/tx", name),
                name: format!("{} Transmitted", name),
                hw: "Network (sysinfo)".to_string(),
                kind: "data".to_string(),
                value: bytes_to_mb(data.total_transmitted()),
                unit: "MB".to_string(),
            });
        }

        readings
    }
}
