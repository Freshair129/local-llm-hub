// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut normalized = raw.to_string();
    
    // Strip registry prefixes
    let prefixes = ["registry.ollama.ai/library/", "library/", "hf.co/"];
    for prefix in &prefixes {
        if normalized.starts_with(prefix) {
            normalized = normalized[prefix.len()..].to_string();
            break;
        }
    }
    
    // Strip quantization suffixes (case-insensitive)
    let quant_suffixes = [
        "-q4_0", "-q4_k_m", "-q4_k_s",
        ":q4_0", ":q4_k_m", ":q4_k_s"
    ];
    let lower_normalized = normalized.to_lowercase();
    for suffix in &quant_suffixes {
        if lower_normalized.ends_with(suffix) {
            normalized = normalized[..normalized.len() - suffix.len()].to_string();
            break;
        }
    }
    
    // Convert to lowercase
    normalized = normalized.to_lowercase();
    
    normalized
}