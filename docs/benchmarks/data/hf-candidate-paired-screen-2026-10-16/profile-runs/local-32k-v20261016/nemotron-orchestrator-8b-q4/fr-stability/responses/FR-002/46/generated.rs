// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let registry_prefixes: &[&str] = &[
        "registry.ollama.ai/library/",
        "library/",
        "hf.co/",
    ];
    
    let quantization_patterns: &[&str] = &[
        "-q4_0", "-q4_k_m", "-q4_k_s",
        ":q4_0", ":q4_k_m", ":q4_k_s",
    ];
    
    let mut result = raw.to_string();
    
    // Remove registry prefixes
    for &prefix in registry_prefixes {
        if result.starts_with(prefix) {
            result = result[prefix.len()..].to_string();
            break;
        }
    }
    
    // Remove quantization patterns (case-insensitive)
    let mut result_lowercase = result.to_lowercase();
    for &pattern in quantization_patterns {
        if result_lowercase.ends_with(pattern) {
            result_lowercase = result_lowercase[..result_lowercase.len() - pattern.len()].to_string();
        }
    }
    
    result_lowercase
}