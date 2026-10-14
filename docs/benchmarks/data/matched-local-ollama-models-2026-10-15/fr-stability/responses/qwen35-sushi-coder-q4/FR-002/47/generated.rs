// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    // Handle empty input safely without panic
    if raw.is_empty() {
        return String::new();
    }

    // Step 1: Strip registry prefixes (case-sensitive as they are fixed strings)
    let mut normalized = raw.to_string();
    
    // Remove 'registry.ollama.ai/library/' prefix
    if normalized.starts_with("registry.ollama.ai/library/") {
        normalized = normalized[24..].to_string();
    }
    // Remove 'library/' prefix
    else if normalized.starts_with("library/") {
        normalized = normalized[8..].to_string();
    }
    // Remove 'hf.co/' prefix
    else if normalized.starts_with("hf.co/") {
        normalized = normalized[6..].to_string();
    }

    // Step 2: Strip quantization suffixes (case-insensitive)
    // Suffixes to strip: -q4_0, -q4_k_m, -q4_k_s, :q4_0, :q4_k_m, :q4_k_s
    let quantization_suffixes = [
        "-q4_0", "-q4_k_m", "-q4_k_s",
        ":q4_0", ":q4_k_m", ":q4_k_s",
    ];

    for suffix in quantization_suffixes.iter() {
        let suffix_lower = suffix.to_lowercase();
        let len = suffix_lower.len();
        if normalized.len() > len && normalized.to_lowercase().ends_with(&suffix_lower) {
            normalized = normalized[..normalized.len() - len].to_string();
        }
    }

    // Step 3: Convert to lowercase (final step)
    normalized = normalized.to_lowercase();

    normalized
}