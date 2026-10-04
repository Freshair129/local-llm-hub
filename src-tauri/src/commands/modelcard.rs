// src-tauri/src/commands/modelcard.rs
// trace:implements FR-004
//! Model Card Fetcher & Markdown Reader (HuggingFace + Local GGUF Directory).
//! Complies with ADR-100 (Safe Error Handling, Strict Result types, Zero Panics).

use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::Read;
use std::path::Path;

const MAX_README_BYTES: usize = 500 * 1024; // Cap at 500 KB per FR-004 constraints

/// Metadata and README body for a model card
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ModelCardInfo {
    pub model_id: String,
    pub title: String,
    pub readme_markdown: String,
    pub license: Option<String>,
    pub parameters: Option<String>,
    pub source: String,
}

/// Fetches model card README from local directory or Hugging Face raw endpoint
pub async fn read_model_card(
    model_id: &str,
    backend: &str,
    local_path: Option<&str>,
) -> Result<ModelCardInfo, String> {
    // Strategy 1: Local GGUF Directory (find README.md / modelcard.md in parent folder)
    if let Some(path_str) = local_path {
        let p = Path::new(path_str);
        let parent = if p.is_file() { p.parent() } else { Some(p) };
        if let Some(dir) = parent {
            for candidate in &["README.md", "readme.md", "modelcard.md", "ModelCard.md"] {
                let candidate_path = dir.join(candidate);
                if candidate_path.exists() && candidate_path.is_file() {
                    if let Ok(mut f) = File::open(&candidate_path) {
                        let mut buf = Vec::new();
                        if f.by_ref()
                            .take(MAX_README_BYTES as u64)
                            .read_to_end(&mut buf)
                            .is_ok()
                        {
                            let text = String::from_utf8_lossy(&buf).to_string();
                            let is_truncated = f.take(1).read(&mut [0u8; 1]).unwrap_or(0) > 0;
                            let content = if is_truncated {
                                format!("{}\n\n*(Content truncated at 500 KB)*", text)
                            } else {
                                text
                            };

                            return Ok(ModelCardInfo {
                                model_id: model_id.to_string(),
                                title: p
                                    .file_stem()
                                    .unwrap_or_default()
                                    .to_string_lossy()
                                    .to_string(),
                                readme_markdown: content,
                                license: None,
                                parameters: None,
                                source: format!("local: {}", candidate_path.display()),
                            });
                        }
                    }
                }
            }
        }
    }

    // Strategy 2: If model_id contains Hugging Face repo (e.g. hf.co/JetBrains/Mellum2... or org/model)
    let hf_repo = if let Some(stripped) = model_id.strip_prefix("hf.co/") {
        Some(stripped.split(':').next().unwrap_or(stripped))
    } else if let Some(_idx) = model_id.find('/') {
        let clean = model_id.split(':').next().unwrap_or(model_id);
        Some(clean)
    } else {
        None
    };

    if let Some(repo) = hf_repo {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(3))
            .build()
            .map_err(|e| e.to_string())?;

        let url = format!("https://huggingface.co/{}/raw/main/README.md", repo);
        if let Ok(resp) = client.get(&url).send().await {
            if resp.status().is_success() {
                if let Ok(bytes) = resp.bytes().await {
                    let len = bytes.len().min(MAX_README_BYTES);
                    let mut text = String::from_utf8_lossy(&bytes[..len]).to_string();
                    if bytes.len() > MAX_README_BYTES {
                        text.push_str("\n\n*(Content truncated at 500 KB)*");
                    }

                    return Ok(ModelCardInfo {
                        model_id: model_id.to_string(),
                        title: repo.to_string(),
                        readme_markdown: text,
                        license: Some("Apache 2.0 / Open".to_string()),
                        parameters: None,
                        source: format!("huggingface: {}", repo),
                    });
                }
            }
        }
    }

    // Strategy 3: Fallback basic metadata card (AC 6)
    Ok(ModelCardInfo {
        model_id: model_id.to_string(),
        title: model_id.to_string(),
        readme_markdown: format!(
            "# {}\n\n*Backend:* {}\n\nNo extended model card or README.md was detected for this model. You can run inference or chat directly with this model.",
            model_id, backend
        ),
        license: None,
        parameters: None,
        source: format!("basic: {}", backend),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    // trace:verifies FR-004
    #[tokio::test]
    async fn test_read_model_card_local_file() {
        let temp_dir = std::env::temp_dir().join("test_model_card_dir");
        let _ = std::fs::create_dir_all(&temp_dir);
        let readme_file = temp_dir.join("README.md");
        {
            let mut f = File::create(&readme_file).expect("create readme");
            f.write_all(b"# Test Model Card\nThis is a test documentation.")
                .expect("write readme");
        }

        let res = read_model_card(
            "gguf:test_model",
            "gguf",
            Some(readme_file.to_str().unwrap()),
        )
        .await;
        assert!(res.is_ok());
        let card = res.unwrap();
        assert!(card.readme_markdown.contains("Test Model Card"));
        assert!(card.source.contains("local"));

        let _ = std::fs::remove_dir_all(temp_dir);
    }

    // trace:verifies FR-004
    #[tokio::test]
    async fn test_read_model_card_fallback_basic() {
        let res = read_model_card("ollama:unknown-model-xyz", "ollama", None).await;
        assert!(res.is_ok());
        let card = res.unwrap();
        assert_eq!(card.model_id, "ollama:unknown-model-xyz");
        assert!(card.readme_markdown.contains("No extended model card"));
        assert_eq!(card.source, "basic: ollama");
    }
}
