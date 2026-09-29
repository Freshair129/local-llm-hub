// src-tauri/tests/test_model_control.rs
// trace:verifies FR-005
//! Integration test for model lifecycle start/stop control and VRAM keep-alive policies.

use tauri_app_lib::commands::backends::{start_model, stop_model};
use tauri_app_lib::state::BackendConfig;

#[tokio::test]
async fn test_model_lifecycle_unsupported_backend() {
    let client = reqwest::Client::new();
    let cfg = BackendConfig::default();
    let res = start_model(&client, &cfg, "unknown_backend", "dummy").await;
    assert!(res.is_err());
    assert!(res.unwrap_err().contains("Unsupported backend"));

    let res_stop = stop_model(&client, &cfg, "unknown_backend", "dummy").await;
    assert!(res_stop.is_err());
    assert!(res_stop.unwrap_err().contains("Unsupported backend"));
}

#[tokio::test]
async fn test_model_lifecycle_gguf_ready() {
    let client = reqwest::Client::new();
    let cfg = BackendConfig::default();
    let res = start_model(&client, &cfg, "gguf", "llama-3.gguf").await;
    assert!(res.is_ok());
    assert!(res.unwrap().contains("ready for direct inference"));

    let res_stop = stop_model(&client, &cfg, "gguf", "llama-3.gguf").await;
    assert!(res_stop.is_ok());
    assert!(res_stop.unwrap().contains("unloaded"));
}
