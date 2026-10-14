/// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut name = raw.to_string();
    
    // Strip prefixes (in order of specificity)
    if name.strip_prefix("registry.ollama.ai/library/").is_some() {
        name = name[23..].to_string();
    } else if name.strip_prefix("library/").is_some() {
        name = name[8..].to_string();
    } else if name.strip_prefix("hf.co/").is_some() {
        name = name[7..].to_string();
    }
    
    // Strip quantization suffixes (case-insensitive)
    // We check both dash-prefixed and colon-prefixed versions
    let lower_name = name.to_lowercase();
    
    let quant_suffixes = ["-q4_0", "-q4_k_m", "-q4_k_s", ":q4_0", ":q4_k_m", ":q4_k_s"];
    
    for suffix in &quant_suffixes {
        if lower_name.ends_with(suffix) {
            name = name[..name.len() - suffix.len()].to_string();
            break;
        }
    }
    
    // Convert to lowercase
    name = name.to_lowercase();
    
    // Trim whitespace (defensive)
    name = name.trim().to_string();
    
    name
}