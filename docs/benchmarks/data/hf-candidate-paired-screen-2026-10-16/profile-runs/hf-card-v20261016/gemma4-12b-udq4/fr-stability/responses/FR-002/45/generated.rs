// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut result = raw.to_string();

    // Strip registry prefixes
    let prefixes = ["registry.ollama.ai/library/", "library/", "hf.co/"];
    for prefix in prefixes {
        if result.starts_with(prefix) {
            result.drain(0..prefix.len());
            break;
        }
    }

    // Strip quantization suffixes (case-insensitive)
    let suffixes = ["-q4_0", "-q4_k_m", "-q4_k_s", ":q4_0", ":q4_k_m", ":q4_k_s"];
    let mut suffix_to_remove = 0;
    let lower_result = result.to_lowercase();

    for suffix in suffixes {
        if lower_result.ends_with(suffix) {
            suffix_to_remove = suffix.len();
            break;
        }
    }

    if suffix_to_remove > 0 {
        result.truncate(result.len() - suffix_to_remove);
    }

    // Convert result to lowercase
    result.to_lowercase()
}