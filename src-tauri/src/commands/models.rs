// src-tauri/src/commands/models.rs
// trace:implements FR-002
//! Model discovery, normalization (BR-002), and multi-backend aggregation service.
//! Compliant with ADR-100 (Safe Error Handling, Strict Result types, Zero panics).

use crate::models::types::{DuplicateInfo, ProbeResult, UnifiedModel};
use crate::state::BackendConfig;
use std::path::Path;

/// Normalizes a raw model name or file path into a canonical name according to BR-002.
/// Rules:
/// 1. lowercase
/// 2. Remove quantization suffixes: q4_k_m, q4_0, q5_k_m, q8_0, f16, f32, mxfp4, gguf, ggml
/// 3. Replace delimiters `[-_/]` and non-numeric dots with space, trim, collapse spaces
/// 4. Remove version tags: `:latest`, `:v1.0`
pub fn normalize_model_name(raw: &str) -> String {
    // trace:implements FR-002
    let mut s = raw.to_lowercase();

    // 1. Strip common file extensions
    if let Some(stripped) = s.strip_suffix(".gguf") {
        s = stripped.to_string();
    } else if let Some(stripped) = s.strip_suffix(".bin") {
        s = stripped.to_string();
    } else if let Some(stripped) = s.strip_suffix(".safetensors") {
        s = stripped.to_string();
    }

    // 2. Remove version tags like :latest, :v1.0, :v2
    if let Some(idx) = s.rfind(':') {
        let tag = &s[idx + 1..];
        if tag == "latest" || (tag.starts_with('v') && tag[1..].chars().any(|c| c.is_ascii_digit())) {
            s.truncate(idx);
        } else {
            // e.g. :7b, :14b -> replace ':' with space
            s.replace_range(idx..=idx, " ");
        }
    }

    // 3. Replace delimiters `[-/]` and non-numeric `.` with space, but preserve `_` temporarily for quantization detection
    let chars: Vec<char> = s.chars().collect();
    let mut preprocessed = Vec::new();
    let len = chars.len();

    for i in 0..len {
        let c = chars[i];
        if c == '-' || c == '/' {
            preprocessed.push(' ');
        } else if c == '.' {
            let prev_is_digit = i > 0 && chars[i - 1].is_ascii_digit();
            let next_is_digit = i + 1 < len && chars[i + 1].is_ascii_digit();
            if prev_is_digit && next_is_digit {
                preprocessed.push('.');
            } else {
                preprocessed.push(' ');
            }
        } else {
            preprocessed.push(c);
        }
    }

    let token_str: String = preprocessed.into_iter().collect();

    // 4. Quantization tokens to discard
    let quant_tokens = [
        "q4_k_m", "q4_k_s", "q5_k_m", "q5_k_s", "q8_0", "q4_0", "q4_1",
        "mxfp4", "f16", "f32", "iq3_m", "iq4_nl", "gguf", "ggml"
    ];

    let mut final_tokens = Vec::new();
    for token in token_str.split_whitespace() {
        let clean_token = token.trim();
        if clean_token.is_empty() {
            continue;
        }

        // Check if token matches quantization tag
        if quant_tokens.contains(&clean_token) {
            continue;
        }

        // Replace any remaining internal underscores with space (e.g. model_name -> model name)
        let sub_tokens: Vec<&str> = clean_token.split('_').filter(|sub| !sub.is_empty()).collect();
        for sub in sub_tokens {
            final_tokens.push(sub.to_string());
        }
    }

    final_tokens.join(" ")
}

/// Extracts quantization tag if present in the model name
pub fn extract_quantization(raw: &str) -> Option<String> {
    let lower = raw.to_lowercase();
    let patterns = [
        "q4_k_m", "q4_k_s", "q5_k_m", "q5_k_s", "q8_0", "q4_0", "q4_1",
        "mxfp4", "f16", "f32", "iq3_m", "iq4_nl"
    ];
    for p in &patterns {
        if lower.contains(p) {
            return Some(p.to_uppercase());
        }
    }
    None
}

/// Fetches models from Ollama via /api/tags
pub async fn fetch_ollama_models(client: &reqwest::Client, base_url: &str) -> Vec<UnifiedModel> {
    let clean_url = base_url.trim_end_matches('/');
    let target = format!("{}/api/tags", clean_url);

    let resp = match client.get(&target).send().await {
        Ok(r) if r.status().is_success() => r,
        _ => return Vec::new(),
    };

    #[derive(serde::Deserialize)]
    struct OllamaModelDetails {
        format: Option<String>,
        quantization_level: Option<String>,
    }

    #[derive(serde::Deserialize)]
    struct OllamaTagModel {
        name: String,
        size: Option<u64>,
        details: Option<OllamaModelDetails>,
    }

    #[derive(serde::Deserialize)]
    struct OllamaTagsResponse {
        models: Option<Vec<OllamaTagModel>>,
    }

    let body = match resp.json::<OllamaTagsResponse>().await {
        Ok(b) => b,
        Err(_) => return Vec::new(),
    };

    let mut results = Vec::new();
    if let Some(list) = body.models {
        for m in list {
            let canonical = normalize_model_name(&m.name);
            let quant = m.details.as_ref().and_then(|d| d.quantization_level.clone())
                .or_else(|| extract_quantization(&m.name));
            let fmt = m.details.as_ref().and_then(|d| d.format.clone())
                .unwrap_or_else(|| "gguf".to_string());

            let mut model = UnifiedModel::new(
                format!("ollama:{}", m.name),
                m.name,
                canonical,
                "ollama",
                fmt,
                m.size.unwrap_or(0),
                quant,
                false,
            );
            model.tags = classify_model_tags(&model.name, &model.format, model.size_bytes);
            results.push(model);
        }
    }

    results
}

/// Fetches models from vLLM via /v1/models
pub async fn fetch_vllm_models(client: &reqwest::Client, base_url: &str) -> Vec<UnifiedModel> {
    let clean_url = base_url.trim_end_matches('/');
    let target = format!("{}/v1/models", clean_url);

    let resp = match client.get(&target).send().await {
        Ok(r) if r.status().is_success() => r,
        _ => return Vec::new(),
    };

    #[derive(serde::Deserialize)]
    struct VllmModelEntry {
        id: String,
    }

    #[derive(serde::Deserialize)]
    struct VllmResponse {
        data: Option<Vec<VllmModelEntry>>,
    }

    let body = match resp.json::<VllmResponse>().await {
        Ok(b) => b,
        Err(_) => return Vec::new(),
    };

    let mut results = Vec::new();
    if let Some(list) = body.data {
        for m in list {
            let canonical = normalize_model_name(&m.id);
            let quant = extract_quantization(&m.id);

            let mut model = UnifiedModel::new(
                format!("vllm:{}", m.id),
                m.id,
                canonical,
                "vllm",
                "safetensors",
                0,
                quant,
                false,
            );
            model.tags = classify_model_tags(&model.name, &model.format, model.size_bytes);
            results.push(model);
        }
    }

    results
}

/// Scans local GGUF directory for files
pub fn scan_gguf_models(gguf_dir: &str) -> Vec<UnifiedModel> {
    if gguf_dir.trim().is_empty() {
        return Vec::new();
    }
    let p = Path::new(gguf_dir);
    if !p.exists() || !p.is_dir() {
        return Vec::new();
    }

    let mut results = Vec::new();
    if let Ok(entries) = std::fs::read_dir(p) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension() {
                    if ext.eq_ignore_ascii_case("gguf") {
                        let filename = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                        let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                        let canonical = normalize_model_name(&filename);
                        let quant = extract_quantization(&filename);

                        let mut model = UnifiedModel::new(
                            format!("gguf:{}", filename),
                            filename,
                            canonical,
                            "gguf",
                            "gguf",
                            size,
                            quant,
                            false,
                        );
                        model.tags = classify_model_tags(&model.name, &model.format, model.size_bytes);
                        results.push(model);
                    }
                }
            }
        }
    }
    results
}

// trace:implements FEAT-025
/// Automatically classify model tags based on naming patterns, metadata, and byte size
pub fn classify_model_tags(name: &str, _format: &str, size_bytes: u64) -> Vec<String> {
    let lower = name.to_lowercase();
    let mut tags = Vec::new();

    if lower.contains("coder") || lower.contains("code") || lower.contains("starcoder") || lower.contains("rust") || lower.contains("dev") {
        tags.push("Coding".to_string());
    }
    if lower.contains("think") || lower.contains("reason") || lower.contains("r1") || lower.contains("qwq") || lower.contains("cot") {
        tags.push("Reasoning".to_string());
    }
    if lower.contains("vision") || lower.contains("vl") || lower.contains("visual") || lower.contains("multimodal") {
        tags.push("Vision".to_string());
    }
    if lower.contains("instruct") || lower.contains("chat") || lower.contains("conversation") || lower.contains("-it") || lower.contains(":it") {
        tags.push("Chat".to_string());
    }
    if size_bytes > 0 && size_bytes <= 3_500_000_000 {
        tags.push("Edge".to_string());
    }
    if tags.is_empty() {
        tags.push("General".to_string());
    }
    tags
}

// trace:implements FR-003
/// Returns backend priority rank based on BR-001:
/// Ollama (1) > vLLM (2) > GGUF (3) > HuggingFace (4) > Unknown (5)
pub fn backend_priority_rank(backend: &str) -> u8 {
    match backend.to_lowercase().as_str() {
        "ollama" => 1,
        "vllm" => 2,
        "gguf" => 3,
        "hf" | "huggingface" => 4,
        _ => 5,
    }
}

// trace:implements FR-003
/// Detects duplicate models across backends according to canonical name (BR-001).
/// Marks is_duplicate = true, determines preferred backend, and sets duplicate_backends.
pub fn dedup_models(models: &[UnifiedModel]) -> (Vec<UnifiedModel>, Vec<DuplicateInfo>) {
    use std::collections::{HashMap, HashSet};

    let mut groups: HashMap<String, Vec<usize>> = HashMap::new();
    for (idx, m) in models.iter().enumerate() {
        if !m.canonical_name.is_empty() {
            groups.entry(m.canonical_name.clone()).or_default().push(idx);
        }
    }

    let mut result_models = models.to_vec();
    let mut duplicate_infos = Vec::new();

    for (canonical_name, indices) in groups {
        let unique_backends: HashSet<String> = indices
            .iter()
            .map(|&i| result_models[i].backend.clone())
            .collect();

        // AC 1: duplicate only when present in more than 1 distinct backend
        if unique_backends.len() > 1 {
            let mut backend_list: Vec<String> = unique_backends.into_iter().collect();
            backend_list.sort_by_key(|b| backend_priority_rank(b));

            // Select preferred entry according to priority: Ollama > vLLM > GGUF > HF
            let mut best_idx = indices[0];
            let mut best_rank = backend_priority_rank(&result_models[best_idx].backend);

            for &idx in &indices[1..] {
                let rank = backend_priority_rank(&result_models[idx].backend);
                if rank < best_rank {
                    best_rank = rank;
                    best_idx = idx;
                }
            }

            let preferred_backend = result_models[best_idx].backend.clone();

            let mut instances = Vec::new();
            for &idx in &indices {
                result_models[idx].is_duplicate = true;
                result_models[idx].is_preferred = idx == best_idx;
                result_models[idx].duplicate_group = Some(canonical_name.clone());
                result_models[idx].duplicate_backends = backend_list.clone();
                instances.push(result_models[idx].clone());
            }

            duplicate_infos.push(DuplicateInfo {
                canonical_name,
                preferred_backend,
                instances,
            });
        } else {
            for &idx in &indices {
                result_models[idx].is_duplicate = false;
                result_models[idx].is_preferred = false;
                result_models[idx].duplicate_group = None;
                result_models[idx].duplicate_backends = Vec::new();
            }
        }
    }

    duplicate_infos.sort_by(|a, b| a.canonical_name.cmp(&b.canonical_name));
    (result_models, duplicate_infos)
}

/// Aggregates models from all online backends, normalizes, deduplicates, and sorts alphabetically A→Z.
pub async fn aggregate_models(
    config: &BackendConfig,
    probes: &[ProbeResult],
) -> Vec<UnifiedModel> {
    let client = reqwest::Client::new();
    let mut unified = Vec::new();

    // Check online status per probe
    let ollama_online = probes.iter().any(|p| p.backend == "ollama" && p.is_online());
    let vllm_online = probes.iter().any(|p| p.backend == "vllm" && p.is_online());
    let gguf_online = probes.iter().any(|p| p.backend == "gguf" && p.is_online());

    if ollama_online {
        let mut ollama_models = fetch_ollama_models(&client, &config.ollama_url).await;
        unified.append(&mut ollama_models);
    }

    if vllm_online {
        let mut vllm_models = fetch_vllm_models(&client, &config.vllm_url).await;
        unified.append(&mut vllm_models);
    }

    if gguf_online {
        let mut gguf_models = scan_gguf_models(&config.gguf_dir);
        unified.append(&mut gguf_models);
    }

    // Deduplicate across backends per FR-003
    let (mut deduped, _) = dedup_models(&unified);

    // Sort alphabetically by canonical_name (A→Z) per AC 4
    deduped.sort_by(|a, b| a.canonical_name.cmp(&b.canonical_name));

    deduped
}

#[cfg(test)]
mod tests {
    use super::*;

    // trace:verifies FR-002
    #[test]
    fn test_normalize_model_name_br002_examples() {
        // Spec test: Meta-Llama-3.2-3B-Instruct.Q4_K_M.gguf → meta llama 3.2 3b instruct
        let input1 = "Meta-Llama-3.2-3B-Instruct.Q4_K_M.gguf";
        let norm1 = normalize_model_name(input1);
        assert_eq!(norm1, "meta llama 3.2 3b instruct");

        // Spec test: qwen2.5-coder:7b → qwen2.5 coder 7b
        let input2 = "qwen2.5-coder:7b";
        let norm2 = normalize_model_name(input2);
        assert_eq!(norm2, "qwen2.5 coder 7b");

        // Tag suffix removal test
        let input3 = "llama3:latest";
        let norm3 = normalize_model_name(input3);
        assert_eq!(norm3, "llama3");
    }

    // trace:verifies FR-002
    #[test]
    fn test_extract_quantization() {
        assert_eq!(extract_quantization("model.q4_k_m.gguf"), Some("Q4_K_M".to_string()));
        assert_eq!(extract_quantization("model-mxfp4.gguf"), Some("MXFP4".to_string()));
        assert_eq!(extract_quantization("model-f16.bin"), Some("F16".to_string()));
        assert_eq!(extract_quantization("plain-model"), None);
    }

    // trace:verifies FR-002
    #[tokio::test]
    async fn test_aggregate_models_empty_when_all_offline() {
        let config = BackendConfig::default();
        let probes = vec![
            ProbeResult::offline("ollama", "Connection refused"),
            ProbeResult::offline("vllm", "Connection refused"),
            ProbeResult::offline("gguf", "Directory not found"),
        ];

        let models = aggregate_models(&config, &probes).await;
        assert!(models.is_empty(), "When all backends offline, must return empty list");
    }

    // trace:verifies FR-003
    #[test]
    fn test_dedup_models_br001_priority() {
        let m_ollama = UnifiedModel::new(
            "ollama:llama3",
            "llama3:latest",
            "llama3",
            "ollama",
            "gguf",
            4000000000,
            Some("Q4_0".to_string()),
            false,
        );

        let m_gguf = UnifiedModel::new(
            "gguf:llama3.gguf",
            "llama3.gguf",
            "llama3",
            "gguf",
            "gguf",
            4000000000,
            Some("Q4_0".to_string()),
            false,
        );

        let m_unique = UnifiedModel::new(
            "ollama:mellum2",
            "mellum2:latest",
            "mellum2",
            "ollama",
            "gguf",
            7000000000,
            Some("Q4_K_M".to_string()),
            false,
        );

        let input = vec![m_ollama, m_gguf, m_unique];
        let (deduped, groups) = dedup_models(&input);

        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].canonical_name, "llama3");
        assert_eq!(groups[0].preferred_backend, "ollama");

        let llama_ollama = deduped.iter().find(|m| m.backend == "ollama" && m.canonical_name == "llama3").unwrap();
        assert!(llama_ollama.is_duplicate);
        assert!(llama_ollama.is_preferred);
        assert_eq!(llama_ollama.duplicate_backends, vec!["ollama", "gguf"]);

        let llama_gguf = deduped.iter().find(|m| m.backend == "gguf" && m.canonical_name == "llama3").unwrap();
        assert!(llama_gguf.is_duplicate);
        assert!(!llama_gguf.is_preferred);

        let unique = deduped.iter().find(|m| m.canonical_name == "mellum2").unwrap();
        assert!(!unique.is_duplicate);
        assert!(!unique.is_preferred);
    }

    // trace:verifies FEAT-025
    #[test]
    fn test_classify_model_tags() {
        let coder_tags = classify_model_tags("qwen3.5:9b-coder-q4_k_m", "gguf", 6000000000);
        assert!(coder_tags.contains(&"Coding".to_string()));

        let think_tags = classify_model_tags("mellum2-12b-thinking", "gguf", 7000000000);
        assert!(think_tags.contains(&"Reasoning".to_string()));

        let edge_tags = classify_model_tags("llama-3.2-1b-instruct", "gguf", 1200000000);
        assert!(edge_tags.contains(&"Edge".to_string()));
        assert!(edge_tags.contains(&"Chat".to_string()));

        let vision_tags = classify_model_tags("qwen2-vl-7b-instruct", "gguf", 5000000000);
        assert!(vision_tags.contains(&"Vision".to_string()));
    }
}
