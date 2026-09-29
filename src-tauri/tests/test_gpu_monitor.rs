// src-tauri/tests/test_gpu_monitor.rs
// trace:verifies FR-006
//! Integration test for hardware and GPU observability telemetry.

use tauri_app_lib::commands::gpu::poll_hardware_telemetry;

#[tokio::test]
async fn test_hardware_telemetry_fields() {
    let telemetry = poll_hardware_telemetry().await;
    assert!(telemetry.system_ram_total_bytes > 0, "System RAM total must be > 0");
    assert!(telemetry.system_ram_used_bytes <= telemetry.system_ram_total_bytes, "RAM used must be <= total");
    assert!(telemetry.cpu_usage_pct >= 0.0, "CPU percentage must be >= 0");
    assert!(!telemetry.gpus.is_empty(), "At least one GPU entry must be returned");
    
    let gpu = &telemetry.gpus[0];
    assert!(gpu.vram_total_bytes > 0, "GPU VRAM total must be > 0");
    assert!(gpu.vram_used_bytes <= gpu.vram_total_bytes, "GPU VRAM used must be <= total");
}
