// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut result = String::from_utf8_lossy(raw).to_string();
    
    // Strip registry prefixes
    if let Some(prefix) = result.strip_prefix("registry.ollama.ai/library/") {
        result = prefix.to_string();
    } else if let Some(prefix) = result.strip_prefix("library/") {
        result = prefix.to_string();
    } else if let Some(prefix) = result.strip_prefix("hf.co/") {
        result = prefix.to_string();
    }
    
    // Strip quantization suffixes (case-insensitive)
    let suffixes = [
        "-q4_0", "-q4_k_m", "-q4_k_s", ":q4_0", ":q4_k_m", ":q4_k_s",
    ];
    
    for &suf in &suffixes {
        if let Some(rest) = result.strip_suffix(suf) {
            result = rest.to_string();
            break; // Only remove the first matching suffix
        }
    }
    
    result.to_lowercase()
}