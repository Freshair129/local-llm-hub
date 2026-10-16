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

#[test]
fn test_normalize_cases() {
    assert_eq!(normalize_model_name("registry.ollama.ai/library/llama3.2:1b-instruct-q4_0"), "llama3.2:1b-instruct");
    assert_eq!(normalize_model_name("hf.co/mradermacher/Qwen3.5-9B-Coder-GGUF:Q4_K_M"), "mradermacher/qwen3.5-9b-coder-gguf");
    assert_eq!(normalize_model_name("library/gemma4:12b"), "gemma4:12b");
    assert_eq!(normalize_model_name("custom-model:latest"), "custom-model:latest");
}
