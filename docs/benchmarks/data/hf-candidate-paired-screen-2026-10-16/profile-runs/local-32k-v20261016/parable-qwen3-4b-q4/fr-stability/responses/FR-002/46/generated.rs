pub fn normalize_model_name(raw: &str) -> String {
    // trace:implements FR-002
    let mut result = raw.to_string();

    // Step 1: strip registry prefixes
    for prefix in ["registry.ollama.ai/library/", "library/", "hf.co/"] {
        if result.starts_with(prefix) {
            result = result.trim_start_matches(prefix).to_string();
        }
    }

    // Step 2: strip quantization suffixes (case-insensitive)
    let suffixes = ["-q4_0", "-q4_k_m", "-q4_k_s", ":q4_0", ":q4_k_m", ":q4_k_s"];
    let result_lower = result.to_lowercase();
    for suffix in suffixes {
        if result_lower.ends_with(suffix) {
            result = result.trim_end_matches(suffix).to_string();
        }
    }

    // Step 3: convert to lowercase
    result.to_lowercase()
}