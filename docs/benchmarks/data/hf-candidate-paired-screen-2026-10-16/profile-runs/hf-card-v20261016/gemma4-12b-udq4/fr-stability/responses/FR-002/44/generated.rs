// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut result = raw.to_string();

    // Strip registry prefixes
    let prefixes = ["registry.ollama.ai/library/", "library/", "hf.co/"];
    for &prefix in &prefixes {
        if result.starts_with(prefix) {
            result = result[prefix.len()..].to_string();
            break;
        }
    }

    // Strip quantization suffixes (case-insensitive)
    let suffixes = ["-q4_0", "-q4_k_m", "-q4_k_s", ":q4_0", ":q4_k_m", ":q4_k_s"];
    let current_lower = result.to_lowercase();
    for &suffix in &suffixes {
        if current_lower.ends_with(suffix) {
            let len = suffix.len();
            if result.len() >= len {
                result.truncate(result.len() - len);
                break;
            }
        }
    }

    // Convert result to lowercase
    result.to_lowercase()
}