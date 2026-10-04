// src-tauri/src/commands/chat.rs
// trace:implements FR-007
//! Interactive Chat Inference Engine for Local LLM Hub.
//! Compliant with ADR-100 (Safe Error Handling, Zero Panics).

use crate::models::types::{ChatRequest, ChatResponse};
use crate::state::BackendConfig;
use std::time::Instant;

/// Executes a chat completion against the designated backend with keep_alive: "15m"
pub async fn execute_chat(
    client: &reqwest::Client,
    config: &BackendConfig,
    request: &ChatRequest,
) -> Result<ChatResponse, String> {
    let start = Instant::now();
    let backend = request.backend.as_deref().unwrap_or("ollama");

    match backend.to_lowercase().as_str() {
        "ollama" => {
            let base_url = config.ollama_url.trim_end_matches('/');
            let target = format!("{}/api/chat", base_url);

            let ollama_messages = request
                .messages
                .iter()
                .map(|m| {
                    serde_json::json!({
                        "role": m.role,
                        "content": m.content
                    })
                })
                .collect::<Vec<_>>();

            let payload = serde_json::json!({
                "model": request.model,
                "messages": ollama_messages,
                "stream": false,
                "keep_alive": "15m",
                "options": {
                    "temperature": request.temperature.unwrap_or(0.7),
                    "num_predict": request.max_tokens.unwrap_or(2048)
                }
            });

            let resp = client
                .post(&target)
                .json(&payload)
                .timeout(std::time::Duration::from_secs(120))
                .send()
                .await
                .map_err(|e| format!("Chat request failed: {}", e))?;

            let duration_ms = start.elapsed().as_millis() as u64;

            if !resp.status().is_success() {
                return Err(format!(
                    "Ollama error HTTP {}: {}",
                    resp.status(),
                    resp.text().await.unwrap_or_default()
                ));
            }

            #[derive(serde::Deserialize)]
            struct OllamaChatReply {
                message: Option<OllamaMsg>,
                prompt_eval_count: Option<u64>,
                eval_count: Option<u64>,
                eval_duration: Option<u64>,
            }
            #[derive(serde::Deserialize)]
            struct OllamaMsg {
                content: Option<String>,
            }

            let data = resp
                .json::<OllamaChatReply>()
                .await
                .map_err(|e| format!("Failed to parse response: {}", e))?;
            let content = data.message.and_then(|m| m.content).unwrap_or_default();
            let prompt_tokens = data.prompt_eval_count.unwrap_or(0);
            let completion_tokens = data.eval_count.unwrap_or(0);
            let eval_dur_s = (data.eval_duration.unwrap_or(1) as f64) / 1e9;
            let tps = if eval_dur_s > 0.0 && completion_tokens > 0 {
                (completion_tokens as f64 / eval_dur_s * 10.0).round() / 10.0
            } else {
                0.0
            };

            Ok(ChatResponse {
                role: "assistant".to_string(),
                content,
                prompt_tokens,
                completion_tokens,
                duration_ms,
                tps,
            })
        }
        "vllm" => {
            let base_url = config.vllm_url.trim_end_matches('/');
            let target = format!("{}/v1/chat/completions", base_url);

            let payload = serde_json::json!({
                "model": request.model,
                "messages": request.messages,
                "temperature": request.temperature.unwrap_or(0.7),
                "max_tokens": request.max_tokens.unwrap_or(2048)
            });

            let resp = client
                .post(&target)
                .json(&payload)
                .timeout(std::time::Duration::from_secs(120))
                .send()
                .await
                .map_err(|e| format!("vLLM chat request failed: {}", e))?;

            let duration_ms = start.elapsed().as_millis() as u64;

            if !resp.status().is_success() {
                return Err(format!(
                    "vLLM error HTTP {}: {}",
                    resp.status(),
                    resp.text().await.unwrap_or_default()
                ));
            }

            #[derive(serde::Deserialize)]
            struct VllmChoice {
                message: Option<VllmMessage>,
            }
            #[derive(serde::Deserialize)]
            struct VllmMessage {
                content: Option<String>,
            }
            #[derive(serde::Deserialize)]
            struct VllmUsage {
                prompt_tokens: Option<u64>,
                completion_tokens: Option<u64>,
            }
            #[derive(serde::Deserialize)]
            struct VllmReply {
                choices: Option<Vec<VllmChoice>>,
                usage: Option<VllmUsage>,
            }

            let data = resp
                .json::<VllmReply>()
                .await
                .map_err(|e| format!("Failed to parse vLLM reply: {}", e))?;
            let content = data
                .choices
                .and_then(|c| c.into_iter().next())
                .and_then(|c| c.message)
                .and_then(|m| m.content)
                .unwrap_or_default();

            let prompt_tokens = data
                .usage
                .as_ref()
                .and_then(|u| u.prompt_tokens)
                .unwrap_or(0);
            let completion_tokens = data
                .usage
                .as_ref()
                .and_then(|u| u.completion_tokens)
                .unwrap_or(0);
            let dur_s = duration_ms as f64 / 1000.0;
            let tps = if dur_s > 0.0 && completion_tokens > 0 {
                (completion_tokens as f64 / dur_s * 10.0).round() / 10.0
            } else {
                0.0
            };

            Ok(ChatResponse {
                role: "assistant".to_string(),
                content,
                prompt_tokens,
                completion_tokens,
                duration_ms,
                tps,
            })
        }
        _ => Err(format!(
            "Direct chat not supported for backend '{}'",
            backend
        )),
    }
}

// trace:implements FEAT-023
/// Real-time token estimation using fast hybrid BPE heuristic
pub fn estimate_chat_tokens(
    prompt: &str,
    max_context_length: Option<usize>,
) -> crate::models::types::TokenEstimateResult {
    let mut ascii_len = 0usize;
    let mut cjk_unicode_len = 0usize;

    for ch in prompt.chars() {
        if ch.is_ascii() {
            ascii_len += 1;
        } else {
            cjk_unicode_len += 1;
        }
    }

    // Heuristic:
    // ASCII / English / Code ~ 3.8-4.0 chars per token
    // Unicode / CJK / Thai ~ 1.5-2.0 chars per token
    let ascii_tokens = (ascii_len as f32 / 3.8).ceil() as usize;
    let unicode_tokens = (cjk_unicode_len as f32 / 1.7).ceil() as usize;
    let total_estimated = ascii_tokens + unicode_tokens;

    let max_ctx = max_context_length.unwrap_or(8192);
    crate::models::types::TokenEstimateResult::new(total_estimated, max_ctx)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::types::{ChatMessage, ContextThresholdLevel};

    // trace:verifies FR-007
    #[tokio::test]
    async fn test_execute_chat_unsupported_backend() {
        let client = reqwest::Client::new();
        let cfg = BackendConfig::default();
        let req = ChatRequest {
            model: "test-model".to_string(),
            messages: vec![ChatMessage {
                role: "user".to_string(),
                content: "Hello".to_string(),
            }],
            backend: Some("unsupported".to_string()),
            temperature: None,
            max_tokens: None,
        };

        let res = execute_chat(&client, &cfg, &req).await;
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("Direct chat not supported"));
    }

    // trace:verifies FEAT-023
    #[test]
    fn test_estimate_chat_tokens_thresholds() {
        // Safe range
        let prompt_safe = "Hello world, this is a test prompt.";
        let res_safe = estimate_chat_tokens(prompt_safe, Some(4096));
        assert_eq!(res_safe.threshold, ContextThresholdLevel::Safe);
        assert!(!res_safe.is_overflow_risk);
        assert!(res_safe.estimated_tokens > 0);

        // Warning range (e.g. ~75% of 100 max tokens)
        let prompt_medium = "a".repeat(300); // 300 / 3.8 ~ 79 tokens
        let res_warning = estimate_chat_tokens(&prompt_medium, Some(100));
        assert_eq!(res_warning.threshold, ContextThresholdLevel::Warning);
        assert!(!res_warning.is_overflow_risk);

        // Danger range (>90% of 100 max tokens)
        let prompt_overflow = "a".repeat(400); // 400 / 3.8 ~ 106 tokens
        let res_danger = estimate_chat_tokens(&prompt_overflow, Some(100));
        assert_eq!(res_danger.threshold, ContextThresholdLevel::Danger);
        assert!(res_danger.is_overflow_risk);
    }
}
