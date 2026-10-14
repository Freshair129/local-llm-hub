pub fn normalize_model_name(raw: &str) -> String {
    // trace:implements FR-002
    let mut result = raw.to_string();
    
    // Step 1: Strip registry prefixes (case-insensitive)
    let prefixes = ["registry.ollama.ai/library/", "library/", "hf.co/"];
    for prefix in &prefixes {
        if result.to_lowercase().starts_with(prefix) {
            result = result[prefix.len()..].to_string();
            break;
        }
    }
    
    // Step 2: Strip quantization suffixes (case-insensitive)
    let suffixes = ["-q4_0", "-q4_k_m", "-q4_k_s", ":q4_0", ":q4_k_m", ":q4_k_s"];
    for suffix in &suffixes {
        if result.to_lowercase().ends_with(suffix) {
            result = result[..result.len() - suffix.len()].to_string();
            break;
        }
    }
    
    // Step 3: Convert to lowercase
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
