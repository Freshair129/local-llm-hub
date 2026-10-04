// src-tauri/src/commands/proxy.rs
// trace:implements FR-008
//! LiteLLM Unified Proxy Sidecar Configuration and Lifecycle Service.
//! Generates OpenAI-compatible routing configuration for all detected backends.
//! Compliant with ADR-100 (Safe Error Handling, Zero Panics).

use crate::models::types::{ApiKeyRecord, ProxyStatus, UnifiedModel};
use crate::state::SharedAppState;
use std::fs::File;
use std::io::Write;
use std::path::Path;

/// Generates LiteLLM config.yaml from unified model registry
pub fn generate_litellm_config(
    models: &[UnifiedModel],
    ollama_endpoint: &str,
    vllm_endpoint: &str,
    output_path: &Path,
) -> Result<String, String> {
    let mut yaml = String::from("model_list:\n");

    for m in models {
        let clean_name = m.name.split(':').next().unwrap_or(&m.name);
        match m.backend.to_lowercase().as_str() {
            "ollama" => {
                yaml.push_str(&format!(
                    "  - model_name: \"{}\"\n    litellm_params:\n      model: \"ollama/{}\"\n      api_base: \"{}\"\n",
                    clean_name, m.name, ollama_endpoint.trim_end_matches('/')
                ));
            }
            "vllm" => {
                yaml.push_str(&format!(
                    "  - model_name: \"{}\"\n    litellm_params:\n      model: \"openai/{}\"\n      api_base: \"{}\"\n",
                    clean_name, m.name, vllm_endpoint.trim_end_matches('/')
                ));
            }
            _ => {
                // Other models can be routed through local Ollama or native adapters
            }
        }
    }

    yaml.push_str("\nlitellm_settings:\n  drop_params: true\n  set_verbose: false\n");

    if let Some(parent) = output_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let mut file =
        File::create(output_path).map_err(|e| format!("Failed to create config file: {}", e))?;
    file.write_all(yaml.as_bytes())
        .map_err(|e| format!("Failed to write config: {}", e))?;

    Ok(yaml)
}

/// Checks current status of LiteLLM proxy
pub async fn check_proxy_status(
    port: u16,
    config_path: &str,
    models: &[UnifiedModel],
) -> ProxyStatus {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(800))
        .build()
        .unwrap_or_default();

    let health_url = format!("http://127.0.0.1:{}/health", port);
    let running = client
        .get(&health_url)
        .send()
        .await
        .map(|r| r.status().is_success())
        .unwrap_or(false);

    let registered_names = models.iter().map(|m| m.name.clone()).collect::<Vec<_>>();

    ProxyStatus {
        running,
        port,
        config_path: config_path.to_string(),
        registered_models: registered_names,
        base_url: format!("http://127.0.0.1:{}", port),
    }
}

/// Creates a new LiteLLM-compatible API Key with granular permissions
pub async fn create_api_key_entry(
    state: &SharedAppState,
    name: String,
    role: String,
    allowed_models: Vec<String>,
    max_budget: Option<f64>,
    tpm_limit: Option<u64>,
    rpm_limit: Option<u64>,
    duration_days: Option<u32>,
) -> Result<ApiKeyRecord, String> {
    if name.trim().is_empty() {
        return Err("API Key name cannot be empty".to_string());
    }

    let role_clean = role.trim().to_lowercase();
    let validated_role = match role_clean.as_str() {
        "admin" | "developer" | "read_only" => role_clean,
        _ => "developer".to_string(),
    };

    let models = if allowed_models.is_empty() {
        vec!["*".to_string()]
    } else {
        allowed_models
    };

    let new_key = ApiKeyRecord::new(
        name.trim(),
        validated_role,
        models,
        max_budget,
        tpm_limit,
        rpm_limit,
        duration_days,
    );

    let mut guard = state.lock().await;
    guard.api_keys.push(new_key.clone());
    Ok(new_key)
}

/// Lists all configured API keys
pub async fn list_api_keys_entries(state: &SharedAppState) -> Vec<ApiKeyRecord> {
    let guard = state.lock().await;
    guard.api_keys.clone()
}

/// Toggles active/revoked status of an API key
pub async fn toggle_api_key_status(state: &SharedAppState, key_id: &str) -> Result<bool, String> {
    let mut guard = state.lock().await;
    if let Some(key) = guard.api_keys.iter_mut().find(|k| k.key_id == key_id) {
        key.active = !key.active;
        Ok(key.active)
    } else {
        Err(format!("API Key with ID '{}' not found", key_id))
    }
}

/// Deletes an API key
pub async fn delete_api_key_entry(state: &SharedAppState, key_id: &str) -> Result<bool, String> {
    let mut guard = state.lock().await;
    let initial_len = guard.api_keys.len();
    guard.api_keys.retain(|k| k.key_id != key_id);
    if guard.api_keys.len() < initial_len {
        Ok(true)
    } else {
        Err(format!("API Key with ID '{}' not found", key_id))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::create_shared_state;

    // trace:verifies FR-008
    #[test]
    fn test_generate_litellm_config_structure() {
        let temp_dir = std::env::temp_dir().join("test_litellm_dir");
        let _ = std::fs::create_dir_all(&temp_dir);
        let config_file = temp_dir.join("config.yaml");

        let m1 = UnifiedModel::new(
            "ollama:test",
            "llama3:latest",
            "llama3",
            "ollama",
            "gguf",
            4000000000,
            None,
            true,
        );
        let m2 = UnifiedModel::new(
            "vllm:qwen",
            "qwen2.5",
            "qwen2.5",
            "vllm",
            "safetensors",
            7000000000,
            None,
            true,
        );

        let res = generate_litellm_config(
            &[m1, m2],
            "http://127.0.0.1:11434",
            "http://127.0.0.1:8000",
            &config_file,
        );
        assert!(res.is_ok());

        let content = std::fs::read_to_string(&config_file).expect("read generated config");
        assert!(content.contains("model_name: \"llama3\""));
        assert!(content.contains("ollama/llama3:latest"));
        assert!(content.contains("openai/qwen2.5"));
        assert!(content.contains("drop_params: true"));

        let _ = std::fs::remove_dir_all(temp_dir);
    }

    // trace:verifies FR-008
    #[tokio::test]
    async fn test_api_key_management_lifecycle() {
        let shared = create_shared_state();

        // 1. Initial should contain default master key
        let initial_keys = list_api_keys_entries(&shared).await;
        assert_eq!(initial_keys.len(), 1);
        assert_eq!(initial_keys[0].role, "admin");

        // 2. Create new scoped key
        let created = create_api_key_entry(
            &shared,
            "test-worker".to_string(),
            "developer".to_string(),
            vec!["mellum2".to_string()],
            Some(5.0),
            Some(30000),
            Some(30),
            Some(30),
        )
        .await
        .expect("create key");

        assert_eq!(created.name, "test-worker");
        assert_eq!(created.role, "developer");
        assert_eq!(created.allowed_models, vec!["mellum2".to_string()]);
        assert_eq!(created.max_budget, Some(5.0));
        assert!(created.active);

        // 3. List should have 2 keys
        let keys_after = list_api_keys_entries(&shared).await;
        assert_eq!(keys_after.len(), 2);

        // 4. Toggle active status (revoke)
        let toggled = toggle_api_key_status(&shared, &created.key_id)
            .await
            .expect("toggle status");
        assert!(!toggled); // now false (revoked)

        // 5. Delete key
        let deleted = delete_api_key_entry(&shared, &created.key_id)
            .await
            .expect("delete key");
        assert!(deleted);
        let keys_final = list_api_keys_entries(&shared).await;
        assert_eq!(keys_final.len(), 1);
    }

    // trace:verifies FR-008
    #[tokio::test]
    async fn test_api_key_empty_name_error() {
        let shared = create_shared_state();
        let res = create_api_key_entry(
            &shared,
            "   ".to_string(),
            "developer".to_string(),
            vec![],
            None,
            None,
            None,
            None,
        )
        .await;
        assert!(res.is_err());
        assert_eq!(res.unwrap_err(), "API Key name cannot be empty");
    }
}
