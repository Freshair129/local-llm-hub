// src-tauri/tests/test_modelcard.rs
// trace:verifies FR-004
//! Integration tests for Model Card Reader and Markdown Parser.
//! Complies with ADR-100 and ANN-001.

use std::fs::File;
use std::io::Write;
use tauri_app_lib::commands::modelcard::read_model_card;

#[tokio::test]
async fn test_modelcard_local_readme() {
    let temp_dir = std::env::temp_dir().join("test_modelcard_pkg");
    let _ = std::fs::create_dir_all(&temp_dir);
    let readme_path = temp_dir.join("README.md");
    {
        let mut f = File::create(&readme_path).expect("create file");
        f.write_all(b"# Llama 3 8B Instruct\nLicense: Apache-2.0\nDetailed description of model weights.").expect("write");
    }

    let result = read_model_card("gguf:llama-3", "gguf", Some(readme_path.to_str().unwrap())).await;
    assert!(result.is_ok(), "Expected successful read_model_card");
    let card = result.unwrap();
    assert!(card.readme_markdown.contains("Llama 3 8B Instruct"));
    assert!(card.source.starts_with("local:"));

    let _ = std::fs::remove_dir_all(temp_dir);
}

#[tokio::test]
async fn test_modelcard_fallback_basic() {
    let result = read_model_card("ollama:unknown-model", "ollama", None).await;
    assert!(result.is_ok());
    let card = result.unwrap();
    assert_eq!(card.model_id, "ollama:unknown-model");
    assert!(card.readme_markdown.contains("No extended model card"));
    assert_eq!(card.source, "basic: ollama");
}
