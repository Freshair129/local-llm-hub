// src-tauri/src/commands/backends.rs
// trace:implements FR-001
//! Backend health probing service implementation for Ollama, vLLM, HuggingFace cache, and local GGUF folders.
//! Compliant with ADR-100 (Safe Error Handling, Zero Panics, Strict Result types).

use crate::commands::models::{fetch_ollama_loaded_model_names, ollama_model_identity_matches};
use crate::models::types::ProbeResult;
use crate::state::BackendConfig;
use serde_json::Value;
use std::path::Path;
use std::time::{Duration, Instant};

const PROBE_TIMEOUT_SECS: u64 = 5;
const MAX_RETRIES: usize = 1;
const OLLAMA_STATE_VERIFY_TIMEOUT: Duration = Duration::from_secs(8);
const OLLAMA_STATE_POLL_INTERVAL: Duration = Duration::from_millis(200);

/// Probes an HTTP endpoint with a 5-second timeout and 1 retry on transient failure.
async fn probe_http_endpoint(
    client: &reqwest::Client,
    backend_name: &str,
    target_url: &str,
    version_extractor: impl Fn(&str) -> Option<String>,
) -> ProbeResult {
    let mut last_error = String::new();

    for attempt in 0..=MAX_RETRIES {
        let start = Instant::now();
        let request_res = client
            .get(target_url)
            .timeout(Duration::from_secs(PROBE_TIMEOUT_SECS))
            .send()
            .await;

        match request_res {
            Ok(response) => {
                let latency_ms = start.elapsed().as_millis() as u64;
                if response.status().is_success() {
                    let body_text = response.text().await.unwrap_or_default();
                    let version = version_extractor(&body_text);
                    return ProbeResult::online(backend_name, latency_ms, version);
                } else {
                    last_error = format!(
                        "HTTP {} {} returned from {}",
                        response.status().as_u16(),
                        response.status().canonical_reason().unwrap_or("Unknown"),
                        target_url
                    );
                }
            }
            Err(err) => {
                if err.is_timeout() {
                    last_error = format!(
                        "Request to {} timed out after {}s",
                        target_url, PROBE_TIMEOUT_SECS
                    );
                } else if err.is_connect() {
                    last_error = format!(
                        "Connection refused at {}. Ensure backend service is running.",
                        target_url
                    );
                } else {
                    last_error = format!("Network error: {}", err);
                }
            }
        }

        // Brief delay before retry if transient failure occurred
        if attempt < MAX_RETRIES {
            tokio::time::sleep(Duration::from_millis(150)).await;
        }
    }

    ProbeResult::offline(backend_name, last_error)
}

/// Probes the Ollama backend server via /api/version
pub async fn probe_ollama(client: &reqwest::Client, base_url: &str) -> ProbeResult {
    let clean_url = base_url.trim_end_matches('/');
    let target = format!("{}/api/version", clean_url);

    probe_http_endpoint(client, "ollama", &target, |body| {
        #[derive(serde::Deserialize)]
        struct OllamaVersion {
            version: Option<String>,
        }
        serde_json::from_str::<OllamaVersion>(body)
            .ok()
            .and_then(|v| v.version)
    })
    .await
}

/// Probes the vLLM backend server via /v1/models or /health
pub async fn probe_vllm(client: &reqwest::Client, base_url: &str) -> ProbeResult {
    let clean_url = base_url.trim_end_matches('/');
    let target = format!("{}/v1/models", clean_url);

    probe_http_endpoint(client, "vllm", &target, |body| {
        #[derive(serde::Deserialize)]
        struct VllmModels {
            data: Option<Vec<serde_json::Value>>,
        }
        serde_json::from_str::<VllmModels>(body)
            .ok()
            .and_then(|m| m.data.map(|list| format!("{} model(s) loaded", list.len())))
    })
    .await
}

/// Probes local HuggingFace cache directory
pub fn probe_hf(cache_dir: &str) -> ProbeResult {
    let start = Instant::now();
    let target_path = if cache_dir.trim().is_empty() {
        // Default to standard huggingface hub location
        if let Ok(user_home) = std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME")) {
            format!("{}/.cache/huggingface/hub", user_home.replace('\\', "/"))
        } else {
            String::new()
        }
    } else {
        cache_dir.to_string()
    };

    if target_path.is_empty() {
        return ProbeResult::offline(
            "hf",
            "HF cache path not configured and home directory inaccessible",
        );
    }

    let p = Path::new(&target_path);
    if p.exists() && p.is_dir() {
        let latency_ms = start.elapsed().as_millis() as u64;
        let count = match std::fs::read_dir(p) {
            Ok(entries) => entries.filter_map(|e| e.ok()).count(),
            Err(_) => 0,
        };
        ProbeResult::online(
            "hf",
            latency_ms,
            Some(format!("{} entries in {}", count, target_path)),
        )
    } else {
        ProbeResult::offline("hf", format!("Directory not found: {}", target_path))
    }
}

/// Probes local GGUF directory
pub fn probe_gguf(gguf_dir: &str) -> ProbeResult {
    let start = Instant::now();
    if gguf_dir.trim().is_empty() {
        return ProbeResult::offline("gguf", "GGUF directory path is not configured");
    }

    let p = Path::new(gguf_dir);
    if p.exists() && p.is_dir() {
        let latency_ms = start.elapsed().as_millis() as u64;
        let count = match std::fs::read_dir(p) {
            Ok(entries) => entries
                .filter_map(|e| e.ok())
                .filter(|e| {
                    e.path()
                        .extension()
                        .map(|ext| ext.eq_ignore_ascii_case("gguf"))
                        .unwrap_or(false)
                })
                .count(),
            Err(_) => 0,
        };
        ProbeResult::online(
            "gguf",
            latency_ms,
            Some(format!("{} .gguf files found", count)),
        )
    } else {
        ProbeResult::offline("gguf", format!("Directory not found: {}", gguf_dir))
    }
}

/// Concurrently probes all configured backends
pub async fn probe_all_backends(config: &BackendConfig) -> Vec<ProbeResult> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(PROBE_TIMEOUT_SECS))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    let ollama_fut = probe_ollama(&client, &config.ollama_url);
    let vllm_fut = probe_vllm(&client, &config.vllm_url);
    let hf_res = probe_hf(&config.hf_cache_dir);
    let gguf_res = probe_gguf(&config.gguf_dir);

    let (ollama_res, vllm_res) = tokio::join!(ollama_fut, vllm_fut);

    vec![ollama_res, vllm_res, hf_res, gguf_res]
}

// trace:implements FR-005
/// Starts or warms up a model on the designated backend.
/// For Ollama: sends an empty prompt with keep_alive: "15m" to load the model into GPU memory.
pub async fn start_model(
    client: &reqwest::Client,
    backend_config: &BackendConfig,
    backend: &str,
    model_name: &str,
) -> Result<String, String> {
    match backend.to_lowercase().as_str() {
        "ollama" => {
            let base_url = backend_config.ollama_url.trim_end_matches('/');
            let target = format!("{}/api/generate", base_url);
            let payload = serde_json::json!({
                "model": model_name,
                "prompt": "",
                "keep_alive": "15m",
                "stream": false
            });
            let resp = client
                .post(&target)
                .json(&payload)
                .timeout(Duration::from_secs(60))
                .send()
                .await
                .map_err(|e| format!("Failed to connect to Ollama: {}", e))?;

            require_ollama_success(resp, "load").await?;
            verify_ollama_model_state(client, base_url, model_name, true).await?;
            Ok(format!("Ollama confirms '{}' is loaded", model_name))
        }
        "vllm" => Err(format!(
            "vLLM model '{}' is served by the external server; Hub does not manage its lifecycle",
            model_name
        )),
        "gguf" => Err(format!(
            "GGUF model '{}' is a local file; configure an inference server before loading it",
            model_name
        )),
        _ => Err(format!("Unsupported backend '{}'", backend)),
    }
}

// trace:implements FR-005
/// Stops or unloads a model from memory on the designated backend.
/// For Ollama: sends keep_alive: 0 to evict the model immediately from GPU VRAM.
pub async fn stop_model(
    client: &reqwest::Client,
    backend_config: &BackendConfig,
    backend: &str,
    model_name: &str,
) -> Result<String, String> {
    match backend.to_lowercase().as_str() {
        "ollama" => {
            let base_url = backend_config.ollama_url.trim_end_matches('/');
            let target = format!("{}/api/generate", base_url);
            let payload = serde_json::json!({
                "model": model_name,
                "keep_alive": 0,
                "stream": false
            });
            let resp = client
                .post(&target)
                .json(&payload)
                .timeout(Duration::from_secs(15))
                .send()
                .await
                .map_err(|e| format!("Failed to connect to Ollama: {}", e))?;

            require_ollama_success(resp, "unload").await?;
            verify_ollama_model_state(client, base_url, model_name, false).await?;
            Ok(format!("Ollama confirms '{}' is unloaded", model_name))
        }
        "vllm" => Err(format!(
            "vLLM model '{}' is served by the external server; Hub does not manage its lifecycle",
            model_name
        )),
        "gguf" => Err(format!(
            "GGUF model '{}' is a local file; Hub has no process to unload",
            model_name
        )),
        _ => Err(format!("Unsupported backend '{}'", backend)),
    }
}

async fn require_ollama_success(
    response: reqwest::Response,
    operation: &str,
) -> Result<(), String> {
    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|err| format!("Could not read Ollama {operation} acknowledgement: {err}"))?;
    if !status.is_success() {
        return Err(format!("Ollama returned status {status}: {body}"));
    }
    let value = serde_json::from_str::<Value>(&body).map_err(|err| {
        format!("Ollama {operation} returned an invalid JSON acknowledgement: {err}")
    })?;
    if let Some(error) = value.get("error").filter(|error| !error.is_null()) {
        return Err(format!(
            "Ollama {operation} failed: {}",
            error.as_str().unwrap_or("backend returned an error field")
        ));
    }
    if value.get("done").and_then(Value::as_bool) != Some(true) {
        return Err(format!(
            "Ollama {operation} acknowledgement did not confirm completion"
        ));
    }
    Ok(())
}

async fn verify_ollama_model_state(
    client: &reqwest::Client,
    base_url: &str,
    model_name: &str,
    expected_loaded: bool,
) -> Result<(), String> {
    verify_ollama_model_state_with_timing(
        client,
        base_url,
        model_name,
        expected_loaded,
        OLLAMA_STATE_VERIFY_TIMEOUT,
        OLLAMA_STATE_POLL_INTERVAL,
    )
    .await
}

async fn verify_ollama_model_state_with_timing(
    client: &reqwest::Client,
    base_url: &str,
    model_name: &str,
    expected_loaded: bool,
    timeout: Duration,
    poll_interval: Duration,
) -> Result<(), String> {
    let deadline = tokio::time::Instant::now() + timeout;
    let mut last_error = None;

    loop {
        match fetch_ollama_loaded_model_names(client, base_url).await {
            Ok(names) => {
                let is_loaded = names
                    .iter()
                    .any(|name| ollama_model_identity_matches(name, model_name));
                if is_loaded == expected_loaded {
                    return Ok(());
                }
            }
            Err(err) => last_error = Some(err),
        }

        if tokio::time::Instant::now() >= deadline {
            let state = if expected_loaded {
                "loaded"
            } else {
                "unloaded"
            };
            let detail = last_error
                .map(|error| format!(" Last status check failed: {error}"))
                .unwrap_or_default();
            return Err(format!(
                "Ollama acknowledged the request but did not confirm '{}' is {state} through /api/ps.{detail}",
                model_name
            ));
        }

        tokio::time::sleep(poll_interval.min(timeout)).await;
    }
}

// trace:implements FR-012
/// Pulls or downloads a model via Ollama API (/api/pull)
pub async fn pull_model(
    client: &reqwest::Client,
    backend_config: &BackendConfig,
    model_name: &str,
) -> Result<String, String> {
    if model_name.trim().is_empty() {
        return Err("Model name cannot be empty".to_string());
    }

    let base_url = backend_config.ollama_url.trim_end_matches('/');
    let target = format!("{}/api/pull", base_url);
    let payload = serde_json::json!({
        "name": model_name,
        "stream": false
    });

    let resp = client
        .post(&target)
        .json(&payload)
        .timeout(Duration::from_secs(600))
        .send()
        .await
        .map_err(|e| format!("Failed to connect to Ollama for pull: {}", e))?;

    if resp.status().is_success() {
        Ok(format!(
            "Model '{}' successfully downloaded/pulled.",
            model_name
        ))
    } else {
        let err_text = resp
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        Err(format!("Ollama pull error: {}", err_text))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::test_support::{spawn_json_http_fixture, FixtureReply};

    // trace:verifies FR-001
    #[test]
    fn test_probe_gguf_nonexistent_directory() {
        let res = probe_gguf("Z:/non_existent_path_test_12345");
        assert!(!res.is_online());
        assert_eq!(res.backend, "gguf");
        assert_eq!(res.status, "offline");
        assert!(res
            .error_message
            .unwrap_or_default()
            .contains("Directory not found"));
    }

    // trace:verifies FR-001
    #[test]
    fn test_probe_gguf_empty_path() {
        let res = probe_gguf("");
        assert!(!res.is_online());
        assert_eq!(res.backend, "gguf");
        assert!(res
            .error_message
            .unwrap_or_default()
            .contains("not configured"));
    }

    // trace:verifies FR-001
    #[test]
    fn test_probe_hf_existing_temp_directory() {
        let temp_dir = std::env::temp_dir();
        let res = probe_hf(temp_dir.to_str().unwrap_or(""));
        assert!(res.is_online());
        assert_eq!(res.backend, "hf");
        assert!(res.version.is_some());
    }

    // trace:verifies FR-001
    // trace:verifies FR-005
    #[tokio::test]
    async fn test_start_model_offline_endpoint() {
        let client = reqwest::Client::new();
        let mut cfg = BackendConfig::default();
        cfg.ollama_url = "http://127.0.0.1:54321".to_string();
        let res = start_model(&client, &cfg, "ollama", "test-model").await;
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("Failed to connect to Ollama"));
    }

    // trace:verifies FR-005
    #[tokio::test]
    async fn test_stop_model_offline_endpoint() {
        let client = reqwest::Client::new();
        let mut cfg = BackendConfig::default();
        cfg.ollama_url = "http://127.0.0.1:54321".to_string();
        let res = stop_model(&client, &cfg, "ollama", "test-model").await;
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("Failed to connect to Ollama"));
    }

    // trace:verifies FR-005
    #[tokio::test]
    async fn start_model_requires_acknowledgement_and_loaded_state() {
        let (base_url, fixture) = spawn_json_http_fixture(vec![
            FixtureReply::json(200, r#"{"response":"","done":true}"#),
            FixtureReply::json(
                200,
                r#"{"models":[{"name":"mellum:latest","model":"mellum:latest"}]}"#,
            ),
        ])
        .await;
        let client = reqwest::Client::new();
        let mut config = BackendConfig::default();
        config.ollama_url = base_url;

        let result = start_model(&client, &config, "ollama", "mellum:latest").await;
        assert!(result.is_ok(), "{result:?}");
        assert!(result.unwrap().contains("confirms"));

        let requests = fixture.await.expect("fixture task");
        assert!(requests[0].starts_with("POST /api/generate "));
        assert!(requests[0].contains(r#""keep_alive":"15m""#));
        assert!(requests[0].contains(r#""stream":false"#));
        assert!(requests[1].starts_with("GET /api/ps "));
    }

    // trace:verifies FR-005
    #[tokio::test]
    async fn stop_model_requires_acknowledgement_and_unloaded_state() {
        let (base_url, fixture) = spawn_json_http_fixture(vec![
            FixtureReply::json(200, r#"{"response":"","done":true}"#),
            FixtureReply::json(200, r#"{"models":[]}"#),
        ])
        .await;
        let client = reqwest::Client::new();
        let mut config = BackendConfig::default();
        config.ollama_url = base_url;

        let result = stop_model(&client, &config, "ollama", "mellum:latest").await;
        assert!(result.is_ok(), "{result:?}");
        assert!(result.unwrap().contains("confirms"));

        let requests = fixture.await.expect("fixture task");
        assert!(requests[0].starts_with("POST /api/generate "));
        assert!(requests[0].contains(r#""keep_alive":0"#));
        assert!(requests[1].starts_with("GET /api/ps "));
    }

    // trace:verifies FR-005
    #[tokio::test]
    async fn start_model_rejects_an_error_in_success_status_body() {
        let (base_url, _fixture) = spawn_json_http_fixture(vec![FixtureReply::json(
            200,
            r#"{"error":"model unavailable"}"#,
        )])
        .await;
        let client = reqwest::Client::new();
        let mut config = BackendConfig::default();
        config.ollama_url = base_url;

        let result = start_model(&client, &config, "ollama", "missing-model").await;
        assert!(result.unwrap_err().contains("model unavailable"));
    }

    // trace:verifies FR-005
    #[tokio::test]
    async fn start_model_rejects_malformed_success_acknowledgement() {
        let (base_url, _fixture) =
            spawn_json_http_fixture(vec![FixtureReply::json(200, "{")]).await;
        let client = reqwest::Client::new();
        let mut config = BackendConfig::default();
        config.ollama_url = base_url;

        let result = start_model(&client, &config, "ollama", "model:latest").await;
        assert!(result.unwrap_err().contains("invalid JSON acknowledgement"));
    }

    // trace:verifies FR-005
    #[tokio::test]
    async fn start_model_rejects_acknowledgement_without_done_true() {
        let (base_url, _fixture) =
            spawn_json_http_fixture(vec![FixtureReply::json(200, r#"{"response":""}"#)]).await;
        let client = reqwest::Client::new();
        let mut config = BackendConfig::default();
        config.ollama_url = base_url;

        let result = start_model(&client, &config, "ollama", "model:latest").await;
        assert!(result.unwrap_err().contains("did not confirm completion"));
    }

    // trace:verifies FR-005
    #[tokio::test]
    async fn loaded_state_verification_does_not_accept_a_different_tag() {
        let (base_url, _fixture) = spawn_json_http_fixture(vec![FixtureReply::json(
            200,
            r#"{"models":[{"name":"model:v2","model":"model:v2"}]}"#,
        )])
        .await;
        let client = reqwest::Client::new();

        let result = verify_ollama_model_state_with_timing(
            &client,
            &base_url,
            "model:v1",
            true,
            Duration::from_millis(10),
            Duration::from_millis(1),
        )
        .await;
        assert!(result
            .unwrap_err()
            .contains("did not confirm 'model:v1' is loaded"));
    }

    // trace:verifies FR-005
    #[tokio::test]
    async fn unmanaged_backends_report_lifecycle_as_unsupported() {
        let client = reqwest::Client::new();
        let config = BackendConfig::default();

        assert!(start_model(&client, &config, "vllm", "served-model")
            .await
            .unwrap_err()
            .contains("external server"));
        assert!(stop_model(&client, &config, "gguf", "model.gguf")
            .await
            .unwrap_err()
            .contains("no process"));
    }

    // trace:verifies FR-012
    #[tokio::test]
    async fn test_pull_model_empty_name() {
        let client = reqwest::Client::new();
        let cfg = BackendConfig::default();
        let res = pull_model(&client, &cfg, "   ").await;
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("Model name cannot be empty"));
    }

    // trace:verifies FR-012
    #[tokio::test]
    async fn test_pull_model_offline_endpoint() {
        let client = reqwest::Client::new();
        let mut cfg = BackendConfig::default();
        cfg.ollama_url = "http://127.0.0.1:54321".to_string();
        let res = pull_model(&client, &cfg, "qwen2.5-coder:7b").await;
        assert!(res.is_err());
        assert!(res
            .unwrap_err()
            .contains("Failed to connect to Ollama for pull"));
    }
}
