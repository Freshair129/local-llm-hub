// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut current = raw;

    // 1. Strip registry prefixes
    if let Some(stripped) = current.strip_prefix("registry.ollama.ai/library/") {
        current = stripped;
    } else if let Some(stripped) = current.strip_prefix("library/") {
        current = stripped;
    } else if let Some(stripped) = current.strip_prefix("hf.co/") {
        current = stripped;
    }

    // 2. Strip quantization suffixes (case-insensitive)
    let suffixes = ["-q4_0", "-q4_k_m", "-q4_k_s", ":q4_0", ":q4_k_m", ":q4_k_s"];
    for suffix in suffixes {
        let suffix_lower = suffix.to_lowercase();
        if current.to_lowercase().ends_with(&suffix_lower) {
            let len = suffix_lower.len();
            current = &current[..current.len() - len];
            break;
        }
    }

    // 3. Convert result to lowercase
    current.to_lowercase()
}