// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut result = raw;

    // Strip registry prefixes
    if result.starts_with("registry.ollama.ai/library/") {
        result = &result["registry.ollama.ai/library/".len()..];
    } else if result.starts_with("library/") {
        result = &result["library/".len()..];
    } else if result.starts_with("hf.co/") {
        result = &result["hf.co/".len()..];
    }

    // Strip quantization suffixes (case-insensitive)
    let suffixes = [
        "-q4_0", "-q4_k_m", "-q4_k_s",
        ":q4_0", ":q4_k_m", ":q4_k_s",
        "-Q4_0", "-Q4_K_M", "-Q4_K_S",
        ":Q4_0", ":Q4_K_M", ":Q4_K_S",
    ];

    for suffix in &suffixes {
        if result.ends_with(suffix) {
            result = &result[..result.len() - suffix.len()];
            break;
        }
    }

    // Convert to lowercase
    result.to_lowercase()
}