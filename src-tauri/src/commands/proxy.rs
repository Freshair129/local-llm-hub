// src-tauri/src/commands/proxy.rs
// trace:implements FR-008
//! LiteLLM Unified Proxy Sidecar Configuration and Lifecycle Service.
//! Generates OpenAI-compatible routing configuration for all detected backends.
//! Compliant with ADR-100 (Safe Error Handling, Zero Panics).

use crate::models::types::{ProxyStatus, UnifiedModel};
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

    let mut file = File::create(output_path).map_err(|e| format!("Failed to create config file: {}", e))?;
    file.write_all(yaml.as_bytes()).map_err(|e| format!("Failed to write config: {}", e))?;

    Ok(yaml)
}

/// Checks current status of LiteLLM proxy
pub async fn check_proxy_status(port: u16, config_path: &str, models: &[UnifiedModel]) -> ProxyStatus {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(800))
        .build()
        .unwrap_or_default();

    let health_url = format!("http://127.0.0.1:{}/health", port);
    let running = client.get(&health_url).send().await.map(|r| r.status().is_success()).unwrap_or(false);

    let registered_names = models
        .iter()
        .map(|m| m.name.clone())
        .collect::<Vec<_>>();

    ProxyStatus {
        running,
        port,
        config_path: config_path.to_string(),
        registered_models: registered_names,
        base_url: format!("http://127.0.0.1:{}", port),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // trace:verifies FR-008
    #[test]
    fn test_generate_litellm_config_structure() {
        let temp_dir = std::env::temp_dir().join("test_litellm_dir");
        let _ = std::fs::create_dir_all(&temp_dir);
        let config_file = temp_dir.join("config.yaml");

        let m1 = UnifiedModel::new("ollama:test", "llama3:latest", "llama3", "ollama", "gguf", 4000000000, None, true);
        let m2 = UnifiedModel::new("vllm:qwen", "qwen2.5", "qwen2.5", "vllm", "safetensors", 7000000000, None, true);

        let res = generate_litellm_config(&[m1, m2], "http://127.0.0.1:11434", "http://127.0.0.1:8000", &config_file);
        assert!(res.is_ok());

        let content = std::fs::read_to_string(&config_file).expect("read generated config");
        assert!(content.contains("model_name: \"llama3\""));
        assert!(content.contains("ollama/llama3:latest"));
        assert!(content.contains("openai/qwen2.5"));
        assert!(content.contains("drop_params: true"));

        let _ = std::fs::remove_dir_all(temp_dir);
    }
}
