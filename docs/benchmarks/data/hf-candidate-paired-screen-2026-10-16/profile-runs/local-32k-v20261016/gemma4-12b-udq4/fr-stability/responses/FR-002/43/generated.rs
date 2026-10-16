// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut result = raw.to_string();

    // Strip registry prefixes
    let prefixes = ["registry.ollama.ai/library/", "library/", "hf.co/"];
    for prefix in prefixes {
        if result.starts_with(prefix) {
            result.replace_range(..prefix.len(), "");
            break;
        }
    }

    // Strip quantization suffixes (case-insensitive)
    let suffixes = ["-q4_0", "-q4_k_m", "-q4_k_s", ":q4_0", ":q4_k_m", ":q4_k_s"];
    let lower_result = result.to_lowercase();
    for suffix in suffixes {
        if lower_result.ends_with(suffix) {
            let suffix_len = suffix.len();
            // Update result to the lowercase version without the suffix
            result = lower_result[..lower_result.len() - suffix_len].to_string();
            break;
        }
    }

    // Convert result to lowercase
    result.to_lowercase()
}