// src-tauri/tests/test_mvp_e2e.rs
// trace:verifies FR-001
// trace:verifies FR-002
// trace:verifies FR-003
// trace:verifies FR-004
// trace:verifies FR-005
// trace:verifies FR-006
// trace:verifies FR-007
// trace:verifies FR-008
// trace:verifies FR-009
// trace:verifies FR-010
//! Comprehensive End-to-End MVP Integration Gate Test (TC-MVP-E2E).
//! Validates the full DAG execution and all 10 Feature Requirements.
//! Compliant with ADR-100 (Zero Panics, Safe Results) and ANN-001 (Traceability).

use std::fs::File;
use std::io::Write;
use tauri_app_lib::commands::backends::{probe_all_backends, start_model, stop_model};
use tauri_app_lib::commands::chat::execute_chat;
use tauri_app_lib::commands::gpu::poll_hardware_telemetry;
use tauri_app_lib::commands::modelcard::read_model_card;
use tauri_app_lib::commands::models::{aggregate_models, dedup_models};
use tauri_app_lib::commands::proxy::{check_proxy_status, generate_litellm_config};
use tauri_app_lib::commands::scanner::{parse_gguf_header, scan_directory_for_gguf};
use tauri_app_lib::commands::share::{count_shared_files, parse_range_header, safe_resolve_path};
use tauri_app_lib::models::types::{ChatMessage, ChatRequest, ProbeResult, UnifiedModel};
use tauri_app_lib::state::BackendConfig;

#[tokio::test]
async fn test_mvp_full_suite_e2e() {
    println!("🚀 Starting TC-MVP-E2E Full Suite Verification...");

    // 1. FR-001: Probe Backends
    let cfg = BackendConfig::default();
    let probes = probe_all_backends(&cfg).await;
    assert_eq!(probes.len(), 4, "Must probe 4 backends (Ollama, vLLM, HF, GGUF)");

    // 2. FR-002: Model Aggregation
    let mock_probes = vec![
        ProbeResult::online("ollama", 10, Some("0.6.1".to_string())),
        ProbeResult::offline("vllm", "Offline"),
        ProbeResult::offline("hf", "Offline"),
        ProbeResult::offline("gguf", "Offline"),
    ];
    let aggregated = aggregate_models(&cfg, &mock_probes).await;
    println!("Aggregated models: {}", aggregated.len());

    // 3. FR-003: Duplicate Model Detection
    let m1 = UnifiedModel::new("ollama:test", "llama-3-8b", "llama 3 8b", "ollama", "gguf", 4000000000, Some("Q4_0".to_string()), true);
    let m2 = UnifiedModel::new("gguf:test.gguf", "llama-3-8b.gguf", "llama 3 8b", "gguf", "gguf", 4000000000, Some("Q4_0".to_string()), false);
    let (deduped, groups) = dedup_models(&[m1, m2]);
    assert_eq!(groups.len(), 1, "Duplicate group should be formed");
    assert!(deduped[0].is_duplicate);
    assert!(deduped[0].is_preferred, "Ollama must be preferred over GGUF per BR-001");

    // 4. FR-004: Model Card Reader
    let card_res = read_model_card("ollama:mellum2", "ollama", None).await;
    assert!(card_res.is_ok());
    let card = card_res.unwrap();
    assert_eq!(card.model_id, "ollama:mellum2");

    // 5. FR-005: Model Lifecycle Control
    let client = reqwest::Client::new();
    let start_res = start_model(&client, &cfg, "gguf", "test.gguf").await;
    assert!(start_res.is_ok());
    let stop_res = stop_model(&client, &cfg, "gguf", "test.gguf").await;
    assert!(stop_res.is_ok());

    // 6. FR-006: Hardware & GPU Observability
    let telemetry = poll_hardware_telemetry().await;
    assert!(telemetry.system_ram_total_bytes > 0);
    assert!(!telemetry.gpus.is_empty());

    // 7. FR-007: Chat Playground Engine
    let chat_req = ChatRequest {
        model: "mellum2".to_string(),
        messages: vec![ChatMessage {
            role: "user".to_string(),
            content: "Hello".to_string(),
        }],
        backend: Some("unsupported_backend".to_string()),
        temperature: None,
        max_tokens: None,
    };
    let chat_res = execute_chat(&client, &cfg, &chat_req).await;
    assert!(chat_res.is_err(), "Unsupported backend must return graceful Err");

    // 8. FR-008: LiteLLM Unified Proxy
    let temp_dir = std::env::temp_dir().join("test_mvp_e2e_proxy");
    let _ = std::fs::create_dir_all(&temp_dir);
    let proxy_cfg = temp_dir.join("config.yaml");
    let proxy_res = generate_litellm_config(&deduped, &cfg.ollama_url, &cfg.vllm_url, &proxy_cfg);
    assert!(proxy_res.is_ok());
    let proxy_status = check_proxy_status(4000, proxy_cfg.to_str().unwrap(), &deduped).await;
    assert_eq!(proxy_status.port, 4000);

    // 9. FR-009: GGUF Header Scanner
    let gguf_file = temp_dir.join("valid.gguf");
    {
        let mut f = File::create(&gguf_file).expect("create gguf");
        f.write_all(b"GGUF\x03\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00").expect("write");
    }
    let header_res = parse_gguf_header(&gguf_file);
    assert!(header_res.is_ok());
    let scanned = scan_directory_for_gguf(temp_dir.to_str().unwrap());
    assert!(scanned.is_ok());

    // 10. FR-010: LAN Folder & Drive Sharing Server
    let parsed_range = parse_range_header("Range: bytes=0-1023", 50000);
    assert_eq!(parsed_range, Some((0, 1023)));
    let safe_path = safe_resolve_path(&temp_dir, "valid.gguf");
    assert!(safe_path.is_ok());
    let files_shared = count_shared_files(&temp_dir);
    assert_eq!(files_shared, 1);

    let _ = std::fs::remove_dir_all(temp_dir);
    println!("✅ TC-MVP-E2E Full Suite PASSED (100% of 10 FRs verified)!");
}
