// trace:implements FR-023
//! Opt-in loopback bridge. An enabled but unavailable hub never falls back silently.
use crate::models::types::{ChatRequest, ChatResponse, UnifiedModel};
use serde::Serialize;
use serde_json::{json, Value};
use std::time::{Duration, Instant};

#[derive(Debug, Serialize, PartialEq)]
pub struct ChatModelOption {
    pub id: String,
    pub name: String,
    pub model: String,
    pub backend: String,
}

#[derive(Debug, Serialize)]
pub struct ChatCatalog {
    pub mode: &'static str,
    pub models: Vec<ChatModelOption>,
}

impl ChatCatalog {
    pub fn legacy(models: &[UnifiedModel]) -> Self {
        Self {
            mode: "legacy",
            models: models
                .iter()
                .map(|model| ChatModelOption {
                    id: model.id.clone(),
                    name: model.name.clone(),
                    model: model.name.clone(),
                    backend: model.backend.clone(),
                })
                .collect(),
        }
    }
}

pub struct HubBridge {
    base: reqwest::Url,
    token: String,
    client: reqwest::Client,
}

impl HubBridge {
    pub fn from_env() -> Result<Option<Self>, String> {
        Self::configured(
            std::env::var("LOCAL_LLM_HUB_URL").ok().as_deref(),
            std::env::var("LOCAL_LLM_HUB_TOKEN").ok().as_deref(),
        )
    }

    fn configured(base: Option<&str>, token: Option<&str>) -> Result<Option<Self>, String> {
        let Some(base) = base else { return Ok(None) };
        let url = reqwest::Url::parse(base).map_err(|_| "HUB_CONFIG_INVALID")?;
        if !matches!(url.scheme(), "http" | "https")
            || !matches!(url.host_str(), Some("127.0.0.1" | "localhost" | "[::1]"))
            || !url.username().is_empty()
            || url.password().is_some()
            || url.query().is_some()
            || url.fragment().is_some()
            || url.path() != "/"
        {
            return Err("HUB_CONFIG_INVALID: bridge requires a loopback origin".into());
        }
        let token = token.filter(|s| s.len() >= 16).ok_or("HUB_AUTH_REQUIRED")?;
        let client = reqwest::Client::builder()
            .no_proxy()
            .redirect(reqwest::redirect::Policy::none())
            .timeout(Duration::from_secs(125))
            .build()
            .map_err(|_| "HUB_CLIENT_ERROR")?;
        Ok(Some(Self {
            base: url,
            token: token.into(),
            client,
        }))
    }

    async fn post(&self, path: &str, payload: Value) -> Result<Value, String> {
        self.request(reqwest::Method::POST, path, Some(payload))
            .await
    }

    async fn request(
        &self,
        method: reqwest::Method,
        path: &str,
        payload: Option<Value>,
    ) -> Result<Value, String> {
        let url = self.base.join(path).map_err(|_| "HUB_CONFIG_INVALID")?;
        let mut request = self.client.request(method, url).bearer_auth(&self.token);
        if path == "v1/models" {
            request = request.timeout(Duration::from_secs(10));
        }
        if let Some(payload) = payload {
            request = request.json(&payload);
        }
        let mut response = request
            .send()
            .await
            .map_err(|_| "HUB_UNAVAILABLE: check the configured local runtime")?;
        if !response.status().is_success() {
            return Err(format!(
                "HUB_REQUEST_FAILED: HTTP {}",
                response.status().as_u16()
            ));
        }
        let mut body = Vec::new();
        while let Some(chunk) = response.chunk().await.map_err(|_| "HUB_RESPONSE_INVALID")? {
            if body.len() + chunk.len() > 2_000_000 {
                return Err("HUB_RESPONSE_TOO_LARGE".into());
            }
            body.extend_from_slice(&chunk);
        }
        serde_json::from_slice(&body).map_err(|_| "HUB_RESPONSE_INVALID".into())
    }

    pub async fn catalog(&self) -> Result<ChatCatalog, String> {
        let data = self
            .request(reqwest::Method::GET, "v1/models", None)
            .await?;
        let rows = data["data"].as_array().ok_or("HUB_RESPONSE_INVALID")?;
        let mut models = Vec::new();
        for row in rows {
            let enabled = row["enabled"].as_bool().ok_or("HUB_RESPONSE_INVALID")?;
            if !enabled {
                continue;
            }
            let id = row["id"]
                .as_str()
                .filter(|id| !id.is_empty())
                .ok_or("HUB_RESPONSE_INVALID")?;
            models.push(ChatModelOption {
                id: id.into(),
                name: id.into(),
                model: id.into(),
                backend: "hub".into(),
            });
        }
        Ok(ChatCatalog {
            mode: "hub",
            models,
        })
    }

    pub async fn chat(&self, request: &ChatRequest) -> Result<ChatResponse, String> {
        let start = Instant::now();
        let result = self
            .post(
                "v1/chat/completions",
                json!({
                    "model": request.model, "messages": request.messages, "stream": false,
                    "temperature": request.temperature.unwrap_or(0.2),
                    "max_tokens": request.max_tokens.unwrap_or(1024)
                }),
            )
            .await?;
        let content = result["choices"][0]["message"]["content"]
            .as_str()
            .ok_or("HUB_RESPONSE_INVALID")?;
        // Existing desktop DTO uses zero for unavailable usage. Native API retains absence.
        let prompt_tokens = result["usage"]["prompt_tokens"].as_u64().unwrap_or(0);
        let completion_tokens = result["usage"]["completion_tokens"].as_u64().unwrap_or(0);
        let duration_ms = start.elapsed().as_millis() as u64;
        Ok(ChatResponse {
            role: "assistant".into(),
            content: content.into(),
            prompt_tokens,
            completion_tokens,
            duration_ms,
            tps: if duration_ms > 0 {
                completion_tokens as f64 * 1000.0 / duration_ms as f64
            } else {
                0.0
            },
        })
    }

    pub async fn run(
        &self,
        agent_id: &str,
        input: &str,
        session_id: Option<&str>,
    ) -> Result<Value, String> {
        if agent_id.is_empty()
            || agent_id.len() > 80
            || !agent_id
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b"_.-".contains(&b))
        {
            return Err("HUB_AGENT_INVALID".into());
        }
        self.post(
            &format!("v1/agents/{agent_id}/run"),
            json!({"input": input, "session_id": session_id}),
        )
        .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    // trace:verifies FR-023
    #[tokio::test]
    async fn catalog_uses_enabled_logical_ids_and_fails_closed() {
        for (body, expected) in [
            (
                r#"{"data":[{"id":"logical-a","enabled":true,"private_url":"do-not-export"},{"id":"disabled","enabled":false}]}"#,
                Some("logical-a"),
            ),
            (r#"{"data":[{"id":"missing-enabled"}]}"#, None),
            (r#"{"unexpected":[]}"#, None),
        ] {
            let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
            let bridge = HubBridge::configured(
                Some(&format!("http://{}", listener.local_addr().unwrap())),
                Some("test-only-token-1234"),
            )
            .unwrap()
            .unwrap();
            let server = tokio::spawn(async move {
                let (mut stream, _) = listener.accept().await.unwrap();
                let mut request = Vec::new();
                loop {
                    let mut chunk = [0; 1024];
                    let size = stream.read(&mut chunk).await.unwrap();
                    assert!(size > 0);
                    request.extend_from_slice(&chunk[..size]);
                    if request.windows(4).any(|v| v == b"\r\n\r\n") {
                        break;
                    }
                }
                let request = String::from_utf8(request).unwrap();
                assert!(request.starts_with("GET /v1/models "));
                assert!(request
                    .to_lowercase()
                    .contains("authorization: bearer test-only-token-1234"));
                stream
                    .write_all(
                        format!(
                            "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                            body.len(),
                            body
                        )
                        .as_bytes(),
                    )
                    .await
                    .unwrap();
            });
            let result = bridge.catalog().await;
            server.await.unwrap();
            if let Some(id) = expected {
                let catalog = result.unwrap();
                assert_eq!(catalog.mode, "hub");
                assert_eq!(catalog.models.len(), 1);
                assert_eq!(catalog.models[0].model, id);
                assert_eq!(catalog.models[0].backend, "hub");
                let json = serde_json::to_string(&catalog).unwrap();
                assert!(!json.contains("do-not-export") && !json.contains("token"));
            } else {
                assert_eq!(result.unwrap_err(), "HUB_RESPONSE_INVALID");
            }
            assert!(bridge
                .catalog()
                .await
                .unwrap_err()
                .starts_with("HUB_UNAVAILABLE"));
        }
    }

    // trace:verifies FR-023
    #[test]
    fn legacy_catalog_keeps_physical_names_and_backend() {
        let model = UnifiedModel::new(
            "vllm:physical",
            "backend-name",
            "physical",
            "vllm",
            "gguf",
            0,
            None,
            false,
        );
        let catalog = ChatCatalog::legacy(&[model]);
        assert_eq!(catalog.mode, "legacy");
        assert_eq!(catalog.models[0].id, "vllm:physical");
        assert_eq!(catalog.models[0].model, "backend-name");
        assert_eq!(catalog.models[0].backend, "vllm");
    }

    #[test]
    fn opt_in_and_credentials_fail_closed() {
        assert!(HubBridge::configured(None, None).unwrap().is_none());
        assert!(HubBridge::configured(Some("http://127.0.0.1:8787"), None).is_err());
        assert!(
            HubBridge::configured(Some("https://example.com"), Some("test-only-token-1234"))
                .is_err()
        );
    }

    #[tokio::test]
    async fn mock_http_bridge_preserves_chat_shape_and_reports_outage() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let bridge = HubBridge::configured(
            Some(&format!("http://{address}")),
            Some("test-only-token-1234"),
        )
        .unwrap()
        .unwrap();
        let server = tokio::spawn(async move {
            let (mut stream, _) = listener.accept().await.unwrap();
            let mut buffer = vec![0; 8192];
            let length = stream.read(&mut buffer).await.unwrap();
            assert!(
                String::from_utf8_lossy(&buffer[..length]).contains("POST /v1/chat/completions")
            );
            let body = r#"{"choices":[{"message":{"content":"bridge-ok"}}]}"#;
            stream.write_all(format!("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", body.len(), body).as_bytes()).await.unwrap();
        });
        let request = ChatRequest {
            model: "mock-local".into(),
            messages: vec![],
            backend: None,
            temperature: None,
            max_tokens: None,
        };
        let response = bridge.chat(&request).await.unwrap();
        assert_eq!(response.content, "bridge-ok");
        assert_eq!(response.completion_tokens, 0);
        server.await.unwrap();
        assert!(bridge
            .chat(&request)
            .await
            .unwrap_err()
            .starts_with("HUB_UNAVAILABLE"));
    }
}
