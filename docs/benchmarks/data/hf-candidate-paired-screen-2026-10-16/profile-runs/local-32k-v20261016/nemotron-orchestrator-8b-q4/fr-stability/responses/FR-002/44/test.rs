// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    // Step 1: Strip registry prefixes
    let mut result = raw.to_string();
    
    // Check for 'registry.ollama.ai/library/'
    if result.starts_with("registry.ollama.ai/library/") {
        result = result["registry.ollama.ai/library:".len()..].to_string();
    }
    // Check for 'library/'
    else if result.starts_with("library/") {
        result = result["library:".len()..].to_string();
    }
    // Check for 'hf.co/'
    else if result.starts_with("hf.co/") {
        result = result["hf.co:".len()..].to_string();
    }
    
    // Step 2: Strip quantization suffixes (case-insensitive)
    let lower_result = result.to_lowercase();
    
    let mut normalized = String::new();
    let mut has_suffix = false;
    
    // Check for suffixes ending in '/'.q4_0
    if lower_result.ends_with("-q4_0") {
        normalized = lower_result[..lower_result.len() - 6].to_string();
        has_suffix = true;
    }
    // Check for suffixes ending in '/'.q4_k_m
    else if lower_result.ends_with("-q4_k_m") {
        normalized = lower_result[..lower_result.len() - 8].to_string();
        has_suffix = true;
    }
    // Check for suffixes ending in '/'.q4_k_s
    else if lower_result.ends_with("-q4_k_s") {
        normalized = lower_result[..lower_result.len() - 8].to_string();
        has_suffix = true;
    }
    // Check for suffixes starting with ':q4_0'
    else if lower_result.ends_with(":q4_0") {
        normalized = lower_result[..lower_result.len() - 6].to_string();
        has_suffix = true;
    }
    // Check for suffixes starting with ':q4_k_m'
    else if lower_result.ends_with(":q4_k_m") {
        normalized = lower_result[..lower_result.len() - 8].to_string();
        has_suffix = true;
    }
    // Check for suffixes starting with ':q4_k_s'
    else if lower_result.ends_with(":q4_k_s") {
        normalized = lower_result[..lower_result.len() - 8].to_string();
        has_suffix = true;
    }
    // If no specific suffix found, use the lowercased result
    else {
        normalized = lower_result;
    }
    
    normalized
}

#[test]
fn test_normalize_cases() {
    assert_eq!(normalize_model_name("registry.ollama.ai/library/llama3.2:1b-instruct-q4_0"), "llama3.2:1b-instruct");
    assert_eq!(normalize_model_name("hf.co/mradermacher/Qwen3.5-9B-Coder-GGUF:Q4_K_M"), "mradermacher/qwen3.5-9b-coder-gguf");
    assert_eq!(normalize_model_name("library/gemma4:12b"), "gemma4:12b");
    assert_eq!(normalize_model_name("custom-model:latest"), "custom-model:latest");
}
