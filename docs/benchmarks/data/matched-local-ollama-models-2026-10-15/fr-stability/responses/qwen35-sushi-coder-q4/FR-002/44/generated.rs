// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut name = raw.to_string();
    
    // Step 1: Strip registry prefixes
    let prefixes = [
        "registry.ollama.ai/library/",
        "library/",
        "hf.co/",
    ];
    
    for prefix in prefixes.iter() {
        if name.starts_with(prefix) {
            name = name[prefix.len()..].to_string();
            break;
        }
    }
    
    // Step 2: Strip quantization suffixes (case-insensitive)
    let quant_suffixes = [
        "-q4_0", "-q4_k_m", "-q4_k_s",
        ":q4_0", ":q4_k_m", ":q4_k_s",
    ];
    
    for suffix in quant_suffixes.iter() {
        let suffix_upper = suffix.to_uppercase();
        if name.ends_with(suffix_upper.as_str()) {
            name = name[..name.len() - suffix.len()].to_string();
            break;
        }
    }
    
    // Step 3: Convert to lowercase
    name = name.to_lowercase();
    
    name
}