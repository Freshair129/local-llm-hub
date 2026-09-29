// src-tauri/tests/test_chat.rs
// trace:verifies FR-007
//! Integration tests for Chat Playground engine and error safety.

use tauri_app_lib::commands::chat::execute_chat;
use tauri_app_lib::models::types::{ChatMessage, ChatRequest};
use tauri_app_lib::state::BackendConfig;

#[tokio::test]
async fn test_chat_offline_ollama_graceful_error() {
    let client = reqwest::Client::new();
    let mut cfg = BackendConfig::default();
    cfg.ollama_url = "http://127.0.0.1:54321".to_string(); // offline port

    let req = ChatRequest {
        model: "mellum2".to_string(),
        messages: vec![ChatMessage {
            role: "user".to_string(),
            content: "Hi".to_string(),
        }],
        backend: Some("ollama".to_string()),
        temperature: Some(0.7),
        max_tokens: Some(50),
    };

    let res = execute_chat(&client, &cfg, &req).await;
    assert!(res.is_err());
    assert!(res.unwrap_err().contains("Chat request failed"));
}
