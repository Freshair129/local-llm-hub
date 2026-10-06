// src-tauri/tests/test_model_aggregation.rs
// trace:verifies FR-002
// trace:verifies TC-FEAT-005-INTEG
//! Feature Integration Test: Model aggregation across Ollama, GGUF directory, and normalization.

use std::time::Instant;
use tauri_app_lib::commands::backends::probe_all_backends;
use tauri_app_lib::commands::models::aggregate_models;
use tauri_app_lib::state::BackendConfig;

#[tokio::test]
async fn test_tc_feat_005_model_aggregation_integration() {
    let start = Instant::now();
    let config = BackendConfig {
        ollama_url: "http://127.0.0.1:11434".to_string(),
        vllm_url: "http://127.0.0.1:8000".to_string(),
        hf_cache_dir: "models/huggingface".to_string(),
        gguf_dir: "models/gguf".to_string(),
    };

    // 1. Probes
    let probes = probe_all_backends(&config).await;

    // 2. Aggregate
    let models = aggregate_models(&config, &probes).await;
    let elapsed = start.elapsed();

    println!("Total Aggregated Models Found: {}", models.len());
    for m in models.iter().take(5) {
        println!(
            "  - [{}] {} -> canonical: '{}'",
            m.backend, m.name, m.canonical_name
        );
    }

    // Verification 1: Must find models from online Ollama backend
    assert!(
        !models.is_empty(),
        "Aggregated models list should not be empty"
    );

    // Verification 2: Each model must have valid canonical_name
    for m in &models {
        assert!(
            !m.canonical_name.is_empty(),
            "Canonical name must not be empty for {}",
            m.name
        );
        assert!(!m.backend.is_empty(), "Backend identifier must be set");
    }

    // Verification 3: Alphabetical sorting by canonical_name (A→Z) per AC 4
    for i in 1..models.len() {
        assert!(
            models[i - 1].canonical_name <= models[i].canonical_name,
            "Models must be sorted alphabetically: '{}' was after '{}'",
            models[i - 1].canonical_name,
            models[i].canonical_name
        );
    }

    println!("TC-FEAT-005 Passed in {:?}", elapsed);
}
