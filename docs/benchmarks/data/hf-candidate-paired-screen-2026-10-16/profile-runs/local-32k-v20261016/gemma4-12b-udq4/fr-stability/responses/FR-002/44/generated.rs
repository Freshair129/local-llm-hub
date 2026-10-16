// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut result = raw.to_string();

    // Strip registry prefixes
    if let Some(stripped) = result.strip_prefix("registry.ollama.ai/library/") {
        result = stripped.to_string();
    } else if let Some(stripped) = result.strip_prefix("library/") {
        result = stripped.to_string();
    } else if let Some(stripped) = result.strip_prefix("hf.co/") {
        result = stripped.to_string();
    }

    // Strip quantization suffixes (case-insensitive)
    let suffixes = ["-q4_0", "-q4_k_m", "-q4_k_s", ":q4_0", ":q4_k_m", ":q4_k_s"];
    for suffix in suffixes {
        if result.to_lowercase().ends_with(suffix) {
            let suffix_len = suffix.len();
            if result.len() >= suffix_len {
                result.truncate(result.len() - suffix_len);
                break;
            }
        }
    }

    // Convert result to lowercase
    result.to_lowercase()
}