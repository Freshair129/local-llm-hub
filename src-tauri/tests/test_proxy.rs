// src-tauri/tests/test_proxy.rs
// trace:verifies FR-008
//! Integration tests for LiteLLM Unified Proxy configuration generator and status checker.

use tauri_app_lib::commands::proxy::{check_proxy_status, generate_litellm_config};
use tauri_app_lib::models::types::UnifiedModel;

#[tokio::test]
async fn test_proxy_config_generation_and_status() {
    let temp_dir = std::env::temp_dir().join("test_proxy_suite");
    let _ = std::fs::create_dir_all(&temp_dir);
    let config_path = temp_dir.join("proxy_config.yaml");

    let model = UnifiedModel::new("ollama:mellum2", "mellum2:12b", "mellum2 12b", "ollama", "gguf", 8000000000, None, true);

    let gen_res = generate_litellm_config(&[model.clone()], "http://127.0.0.1:11434", "http://127.0.0.1:8000", &config_path);
    assert!(gen_res.is_ok(), "Config generation should succeed");

    let status = check_proxy_status(4000, config_path.to_str().unwrap(), &[model]).await;
    assert_eq!(status.port, 4000);
    assert_eq!(status.registered_models.len(), 1);
    assert_eq!(status.base_url, "http://127.0.0.1:4000");

    let _ = std::fs::remove_dir_all(temp_dir);
}
