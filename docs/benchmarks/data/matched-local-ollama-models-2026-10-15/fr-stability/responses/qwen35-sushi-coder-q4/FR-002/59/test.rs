pub fn normalize_model_name(raw: &str) -> String {
    // trace:implements FR-002

    let mut result = raw.to_string();
    
    // Strip registry prefixes (case-sensitive as per spec)
    let prefixes = ["registry.ollama.ai/library/", "library/", "hf.co/"];
    for prefix in prefixes.iter() {
        if result.starts_with(prefix) {
            result = result[prefix.len()..].to_string();
        }
    }
    
    // Strip quantization suffixes (case-insensitive)
    let suffixes_lower = ["-q4_0", "-q4_k_m", "-q4_k_s", 
                          ":q4_0", ":q4_k_m", ":q4_k_s"];
    let suffixes_upper = ["-Q4_0", "-Q4_K_M", "-Q4_K_S", 
                          ":Q4_0", ":Q4_K_M", ":Q4_K_S"];
    
    for suffix in suffixes_lower.iter().chain(suffixes_upper.iter()) {
        if result.ends_with(suffix) {
            result = result[..result.len() - suffix.len()].to_string();
        }
    }
    
    // Convert to lowercase
    result = result.to_lowercase();
    
    result
}

#[test]
fn test_normalize_cases() {
    assert_eq!(normalize_model_name("registry.ollama.ai/library/llama3.2:1b-instruct-q4_0"), "llama3.2:1b-instruct");
    assert_eq!(normalize_model_name("hf.co/mradermacher/Qwen3.5-9B-Coder-GGUF:Q4_K_M"), "mradermacher/qwen3.5-9b-coder-gguf");
    assert_eq!(normalize_model_name("library/gemma4:12b"), "gemma4:12b");
    assert_eq!(normalize_model_name("custom-model:latest"), "custom-model:latest");
}
