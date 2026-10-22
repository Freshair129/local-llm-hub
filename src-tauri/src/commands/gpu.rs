// src-tauri/src/commands/gpu.rs
// trace:implements FR-006
//! Real-time Hardware, GPU VRAM, and System Resource Telemetry Service.
//! Compliant with ADR-100 (Safe Error Handling, Zero Panics, Non-blocking async).

use crate::models::types::{GpuInfo, HardwareTelemetry, ProcessMetric};
use std::sync::{Mutex, OnceLock};
use std::time::Duration;
use sysinfo::{CpuRefreshKind, MemoryRefreshKind, RefreshKind, System};

/// Global persistent System instance for continuous delta-based CPU & Memory telemetry.
/// Eliminates redundant allocations and unnecessary thread sleeping on every poll cycle.
static GLOBAL_SYSTEM: OnceLock<Mutex<System>> = OnceLock::new();

fn get_global_system() -> &'static Mutex<System> {
    GLOBAL_SYSTEM.get_or_init(|| {
        let mut sys = System::new_with_specifics(
            RefreshKind::new()
                .with_cpu(CpuRefreshKind::everything())
                .with_memory(MemoryRefreshKind::everything()),
        );
        sys.refresh_memory();
        sys.refresh_cpu();
        Mutex::new(sys)
    })
}

/// Collects live Host RAM (total, used) and continuous delta-based CPU utilization %
async fn collect_system_resources() -> (u64, u64, f32) {
    tokio::task::spawn_blocking(|| {
        let mut sys = match get_global_system().lock() {
            Ok(guard) => guard,
            Err(poisoned) => {
                eprintln!("[WARN:telemetry] Global system mutex poisoned, recovering inner lock.");
                poisoned.into_inner()
            }
        };

        sys.refresh_memory();
        sys.refresh_cpu();

        let total = sys.total_memory();
        let used = sys.used_memory();
        let cpu_usage = sys.global_cpu_info().cpu_usage();

        (total, used, cpu_usage)
    })
    .await
    .unwrap_or_else(|err| {
        eprintln!("[ERROR:telemetry] Failed to collect host system resources: {err}");
        (0, 0, 0.0)
    })
}

/// Runs nvidia-smi with a strict timeout and parses CSV output into structured GpuInfo models
async fn query_nvidia_smi() -> Vec<GpuInfo> {
    let mut cmd = tokio::process::Command::new("nvidia-smi");
    cmd.kill_on_drop(true);
    cmd.args([
        "--query-gpu=index,name,memory.used,memory.total,utilization.gpu,temperature.gpu",
        "--format=csv,noheader,nounits",
    ]);

    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW

    let output_res = tokio::time::timeout(Duration::from_millis(600), cmd.output()).await;

    match output_res {
        Ok(Ok(output)) if output.status.success() => {
            let stdout_str = String::from_utf8_lossy(&output.stdout);
            return parse_nvidia_smi_output(&stdout_str);
        }
        Ok(Ok(output)) => {
            eprintln!(
                "[WARN:telemetry] nvidia-smi exited with status {}: {}",
                output.status,
                String::from_utf8_lossy(&output.stderr)
            );
        }
        Ok(Err(e)) => {
            eprintln!("[INFO:telemetry] GPU monitoring unavailable because nvidia-smi could not start: {e}");
        }
        Err(_) => {
            eprintln!("[WARN:telemetry] nvidia-smi call timed out after 600ms.");
        }
    }

    Vec::new()
}

fn parse_nvidia_smi_output(output: &str) -> Vec<GpuInfo> {
    output
        .lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.split(',').map(str::trim).collect();
            if parts.len() < 6 || parts[1].is_empty() || parts[1] == "[Not Found]" {
                return None;
            }

            let index = parts[0].parse::<u32>().ok()?;
            let mem_used_mb = parts[2].parse::<u64>().ok()?;
            let mem_total_mb = parts[3].parse::<u64>().ok()?;
            let utilization_pct = parts[4].parse::<u32>().ok()?;
            if mem_total_mb == 0 {
                return None;
            }

            Some(GpuInfo {
                index,
                name: parts[1].to_string(),
                vram_used_bytes: mem_used_mb * 1024 * 1024,
                vram_total_bytes: mem_total_mb * 1024 * 1024,
                utilization_pct,
                temperature_c: parts[5].parse::<u32>().ok(),
            })
        })
        .collect()
}

/// Polls system RAM, CPU load, and NVIDIA GPU stats safely by aggregating helper routines
pub async fn poll_hardware_telemetry() -> HardwareTelemetry {
    // 1. Collect System RAM and CPU via separate routine
    let (ram_total, ram_used, cpu_pct) = collect_system_resources().await;

    // 2. Query NVIDIA GPUs via dedicated nvidia-smi CLI routine
    let gpus = query_nvidia_smi().await;

    HardwareTelemetry {
        system_ram_used_bytes: ram_used,
        system_ram_total_bytes: ram_total,
        cpu_usage_pct: cpu_pct,
        gpus,
    }
}

// trace:implements FR-006
/// Collects and ranks active processes by CPU or Memory usage (Task Manager style)
pub async fn poll_top_processes(sort_by_mem: bool, limit: usize) -> Vec<ProcessMetric> {
    tokio::task::spawn_blocking(move || {
        let mut sys = System::new();
        sys.refresh_processes();
        // Minimal sampling interval for process CPU ticks
        std::thread::sleep(Duration::from_millis(25));
        sys.refresh_processes();

        let mut list: Vec<ProcessMetric> = sys
            .processes()
            .iter()
            .map(|(pid, p)| {
                let disk = p.disk_usage();
                ProcessMetric {
                    pid: pid.to_string(),
                    name: p.name().to_string(),
                    cpu_usage: (p.cpu_usage() * 10.0).round() / 10.0,
                    memory_bytes: p.memory(),
                    virtual_memory_bytes: p.virtual_memory(),
                    disk_read_bytes: disk.total_read_bytes,
                    disk_written_bytes: disk.total_written_bytes,
                }
            })
            .collect();

        if sort_by_mem {
            list.sort_by(|a, b| b.memory_bytes.cmp(&a.memory_bytes));
        } else {
            list.sort_by(|a, b| b.cpu_usage.total_cmp(&a.cpu_usage));
        }

        list.truncate(limit);
        list
    })
    .await
    .unwrap_or_else(|err| {
        eprintln!("[ERROR:telemetry] Failed to poll top processes: {err}");
        Vec::new()
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    // trace:verifies FR-006
    #[tokio::test]
    async fn test_poll_hardware_telemetry() {
        let telemetry = poll_hardware_telemetry().await;
        assert!(telemetry.system_ram_total_bytes > 0);
        assert!(telemetry.gpus.iter().all(|gpu| gpu.vram_total_bytes > 0));
    }

    // trace:verifies FR-006
    #[test]
    fn unavailable_or_malformed_nvidia_smi_output_has_no_gpu_readings() {
        assert!(parse_nvidia_smi_output("").is_empty());
        assert!(parse_nvidia_smi_output("not,numeric,telemetry").is_empty());
        assert!(parse_nvidia_smi_output("0,RTX 3060,not-a-number,12288,12,48").is_empty());
    }

    // trace:verifies FR-006
    #[test]
    fn parses_only_reported_nvidia_smi_values() {
        let gpus = parse_nvidia_smi_output("0,RTX 3060,4000,12288,12,48");
        assert_eq!(gpus.len(), 1);
        assert_eq!(gpus[0].name, "RTX 3060");
        assert_eq!(gpus[0].vram_used_bytes, 4_000 * 1024 * 1024);
        assert_eq!(gpus[0].vram_total_bytes, 12_288 * 1024 * 1024);
        assert_eq!(gpus[0].utilization_pct, 12);
        assert_eq!(gpus[0].temperature_c, Some(48));
    }

    // trace:verifies FR-006
    #[tokio::test]
    async fn test_collect_system_resources() {
        let (total, used, _cpu) = collect_system_resources().await;
        assert!(total > 0, "Total RAM should be greater than 0");
        assert!(used > 0, "Used RAM should be greater than 0");
    }

    // trace:verifies FR-006
    #[tokio::test]
    async fn test_poll_top_processes() {
        let processes = poll_top_processes(false, 10).await;
        assert!(
            !processes.is_empty(),
            "should capture running host processes"
        );
        assert!(processes.len() <= 10);
    }
}
