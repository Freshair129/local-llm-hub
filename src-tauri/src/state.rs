// src-tauri/src/state.rs
// trace:implements PRJ-002
//! Thread-safe Central Application State container for Local LLM Hub.
//! Compliant with ADR-100 (Safe Error Handling, No panics, Strict Result types).

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;

/// Status of an external LLM inference backend
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum BackendStatus {
    Online,
    Offline,
    Degraded,
    Probing,
}

impl Default for BackendStatus {
    fn default() -> Self {
        BackendStatus::Offline
    }
}

/// Backend endpoint and path configurations
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BackendConfig {
    pub ollama_url: String,
    pub vllm_url: String,
    pub hf_cache_dir: String,
    pub gguf_dir: String,
}

impl Default for BackendConfig {
    fn default() -> Self {
        Self {
            ollama_url: "http://127.0.0.1:11434".to_string(),
            vllm_url: "http://127.0.0.1:8000".to_string(),
            hf_cache_dir: String::new(),
            gguf_dir: String::new(),
        }
    }
}

use std::collections::HashMap;
pub use crate::models::types::{ApiKeyRecord, ModelStats, UnifiedModel, WorkerNodeConfig};

/// Lifecycle status of the embedded LiteLLM proxy process
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum LiteLLMStatus {
    Stopped,
    Starting,
    Running { port: u16, pid: u32 },
    Error(String),
}

impl Default for LiteLLMStatus {
    fn default() -> Self {
        LiteLLMStatus::Stopped
    }
}

/// Central application state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppState {
    pub backends: BackendConfig,
    pub models: Vec<UnifiedModel>,
    pub model_stats: HashMap<String, ModelStats>,
    pub litellm_process: Option<u32>,
    pub litellm_status: LiteLLMStatus,
    #[serde(default)]
    pub api_keys: Vec<ApiKeyRecord>,
    #[serde(default)]
    pub worker_nodes: Vec<WorkerNodeConfig>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            backends: BackendConfig::default(),
            models: Vec::new(),
            model_stats: HashMap::new(),
            litellm_process: None,
            litellm_status: LiteLLMStatus::default(),
            api_keys: vec![
                ApiKeyRecord {
                    key_id: "key_master_hub".to_string(),
                    key_secret: "sk-local-hub".to_string(),
                    name: "Master Hub Key (Admin)".to_string(),
                    role: "admin".to_string(),
                    allowed_models: vec!["*".to_string()],
                    max_budget: None,
                    spend: 0.0,
                    tpm_limit: None,
                    rpm_limit: None,
                    created_at: 1700000000000,
                    expires_at: None,
                    active: true,
                }
            ],
            worker_nodes: vec![
                WorkerNodeConfig {
                    node_id: "node_master_01".to_string(),
                    host: "127.0.0.1".to_string(),
                    port: 11434,
                    status: "online".to_string(),
                    vram_free_mb: 12288,
                    active_tasks: 0,
                    last_seen_timestamp: 1700000000000,
                }
            ],
        }
    }
}

/// Thread-safe shared handle type for Tauri State
pub type SharedAppState = Arc<Mutex<AppState>>;

/// Helper to create an initialized thread-safe state container
pub fn create_shared_state() -> SharedAppState {
    Arc::new(Mutex::new(AppState::default()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_app_state() {
        let state = AppState::default();
        assert_eq!(state.backends.ollama_url, "http://127.0.0.1:11434");
        assert_eq!(state.backends.vllm_url, "http://127.0.0.1:8000");
        assert!(state.models.is_empty());
        assert_eq!(state.litellm_process, None);
        assert_eq!(state.litellm_status, LiteLLMStatus::Stopped);
        assert_eq!(state.api_keys.len(), 1);
        assert_eq!(state.api_keys[0].key_secret, "sk-local-hub");
    }

    #[tokio::test]
    async fn test_concurrent_state_mutation() {
        let shared = create_shared_state();
        let mut handles = Vec::new();

        for i in 0..10 {
            let state_clone = Arc::clone(&shared);
            handles.push(tokio::spawn(async move {
                let mut guard = state_clone.lock().await;
                guard.models.push(UnifiedModel::new(
                    format!("model_{}", i),
                    format!("Model {}", i),
                    format!("model {}", i),
                    "ollama",
                    "gguf",
                    1024 * 1024 * i,
                    Some("Q4_K_M".to_string()),
                    false,
                ));
            }));
        }

        for h in handles {
            let res = h.await;
            assert!(res.is_ok());
        }

        let guard = shared.lock().await;
        assert_eq!(guard.models.len(), 10);
    }
}
