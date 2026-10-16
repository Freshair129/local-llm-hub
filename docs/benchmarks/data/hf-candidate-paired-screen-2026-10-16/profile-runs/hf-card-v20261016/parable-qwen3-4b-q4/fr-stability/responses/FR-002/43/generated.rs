pub fn normalize_model_name(raw: &str) -> String {
    // trace:implements FR-002
    let mut normalized = raw.to_string();

    // Step 1: Strip registry prefixes
    if normalized.starts_with("registry.ollama.ai/library/") {
        normalized = normalized.trim_start_matches("registry.ollama.ai/library/").to_string();
    } else if normalized.starts_with("library/") {
        normalized = normalized.trim_start_matches("library/").to_string();
    } else if normalized.starts_with("hf.co/") {
        normalized = normalized.trim_start_matches("hf.co/").to_string();
    }

    // Step 2: Strip quantization suffixes (case-insensitive)
    let suffixes = ["-q4_0", "-q4_k_m", "-q4_k_s", ":q4_0", ":q4_k_m", ":q4_k_s"];
    normalized = normalized.to_lowercase();
    for suffix in suffixes {
        if normalized.ends_with(suffix) {
            normalized = normalized.trim_end_matches(suffix).to_string();
        }
    }

    normalized
}