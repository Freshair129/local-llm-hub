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

#[test]
fn test_normalize_cases() {
    assert_eq!(normalize_model_name("registry.ollama.ai/library/llama3.2:1b-instruct-q4_0"), "llama3.2:1b-instruct");
    assert_eq!(normalize_model_name("hf.co/mradermacher/Qwen3.5-9B-Coder-GGUF:Q4_K_M"), "mradermacher/qwen3.5-9b-coder-gguf");
    assert_eq!(normalize_model_name("library/gemma4:12b"), "gemma4:12b");
    assert_eq!(normalize_model_name("custom-model:latest"), "custom-model:latest");
}
