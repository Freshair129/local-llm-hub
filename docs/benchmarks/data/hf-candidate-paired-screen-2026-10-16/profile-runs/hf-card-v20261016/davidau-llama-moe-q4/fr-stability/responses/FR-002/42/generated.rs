// trace:implements FR-002

pub fn normalize_model_name(raw: &str) -> String {
    // Strip registry prefixes
    let raw = raw.replace("registry.ollama.ai/library/", "").replace("library/", "");

    // Strip quantization suffixes
    let raw = raw
        .to_lowercase()
        .replace("-q4_0".to_lowercase(), "")
        .replace("-q4_k_m".to_lowercase(), "")
        .replace("-q4_k_s".to_lowercase(), "")
        .replace("://q4_0".to_lowercase(), "")
        .replace("://q4_k_m".to_lowercase(), "")
        .replace("://q4_k_s".to_lowercase(), "");

    raw
}