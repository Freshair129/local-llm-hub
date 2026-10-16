// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut s = raw;
    // Strip registry prefixes
    if let Some(rest) = s.strip_prefix("registry.ollama.ai/library/") {
        s = rest;
    } else if let Some(rest) = s.strip_prefix("library/") {
        s = rest;
    } else if let Some(rest) = s.strip_prefix("hf.co/") {
        s = rest;
    }
    // Convert to lowercase
    s = s.to_lowercase();
    // Strip quantization suffixes (case-insensitive, now all lowercase)
    if let Some(rest) = s.strip_suffix("-q4_0") {
        s = rest;
    } else if let Some(rest) = s.strip_suffix("-q4_k_m") {
        s = rest;
    } else if let Some(rest) = s.strip_suffix("-q4_k_s") {
        s = rest;
    } else if let Some(rest) = s.strip_suffix(":q4_0") {
        s = rest;
    } else if let Some(rest) = s.strip_suffix(":q4_k_m") {
        s = rest;
    } else if let Some(rest) = s.strip_suffix(":q4_k_s") {
        s = rest;
    }
    s
}