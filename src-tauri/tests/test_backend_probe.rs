// src-tauri/tests/test_backend_probe.rs
// trace:verifies FR-001
// trace:verifies TC-FEAT-001-INTEG
//! Feature Integration Test: Probing backends concurrently and validating SLA & error handling.

use std::time::Instant;
use tauri_app_lib::commands::backends::probe_all_backends;
use tauri_app_lib::state::BackendConfig;

#[tokio::test]
async fn test_tc_feat_001_backend_probe_integration() {
    let start = Instant::now();
    let config = BackendConfig {
        ollama_url: "http://127.0.0.1:11434".to_string(),
        vllm_url: "http://127.0.0.1:8000".to_string(),
        hf_cache_dir: std::env::temp_dir().to_str().unwrap_or("").to_string(),
        gguf_dir: std::env::temp_dir().to_str().unwrap_or("").to_string(),
    };

    let results = probe_all_backends(&config).await;
    let elapsed = start.elapsed();

    // Verification 1: Must return results for all 4 backends
    assert_eq!(results.len(), 4, "Must probe exactly 4 configured backends");

    // Verification 2: Execution time must be well within SLA (5 seconds)
    assert!(
        elapsed.as_secs() <= 5,
        "Concurrent probe exceeded 5s SLA: took {:?}",
        elapsed
    );

    // Verification 3: Ollama backend check (daemon is active on 11434)
    let ollama_res = results.iter().find(|r| r.backend == "ollama");
    assert!(ollama_res.is_some(), "Ollama probe result must exist");
    let ollama = ollama_res.unwrap();
    println!("Live Ollama Probe Result: {:?}", ollama);
    assert_eq!(
        ollama.status, "online",
        "Live Ollama daemon should report online"
    );
    assert!(ollama.latency_ms.is_some(), "Latency should be recorded");

    // Verification 4: vLLM backend check (port 8000 is not running -> human readable offline)
    let vllm_res = results.iter().find(|r| r.backend == "vllm");
    assert!(vllm_res.is_some(), "vLLM probe result must exist");
    let vllm = vllm_res.unwrap();
    assert_eq!(
        vllm.status, "offline",
        "Unreachable vLLM should report offline"
    );
    assert!(
        vllm.error_message
            .as_ref()
            .map(|s| s.contains("Connection refused"))
            .unwrap_or(false),
        "Offline message must be human-readable, got: {:?}",
        vllm.error_message
    );
}
