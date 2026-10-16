pub fn normalize_model_name(raw: &str) -> String {
    // trace:implements FR-002
    let mut name = raw.trim();
    
    // Strip registry prefixes
    if name.starts_with("registry.ollama.ai/library/") {
        name = &name[23..];
    } else if name.starts_with("library/") {
        name = &name[8..];
    } else if name.starts_with("hf.co/") {
        name = &name[6..];
    }
    
    // Strip quantization suffixes (case-insensitive)
    let len = name.len();
    let lower_check = name.to_lowercase();
    
    // Check for suffixes with colon prefix (e.g., ":q4_0")
    if lower_check.ends_with(":q4_0") {
        name = &name[..len - 5];
    } else if lower_check.ends_with(":q4_k_m") {
        name = &name[..len - 8];
    } else if lower_check.ends_with(":q4_k_s") {
        name = &name[..len - 8];
    } else if lower_check.ends_with("-q4_0") {
        name = &name[..len - 5];
    } else if lower_check.ends_with("-q4_k_m") {
        name = &name[..len - 8];
    } else if lower_check.ends_with("-q4_k_s") {
        name = &name[..len - 8];
    }
    
    // Convert to lowercase
    name.to_lowercase()
}

#[test]
fn test_normalize_cases() {
    assert_eq!(normalize_model_name("registry.ollama.ai/library/llama3.2:1b-instruct-q4_0"), "llama3.2:1b-instruct");
    assert_eq!(normalize_model_name("hf.co/mradermacher/Qwen3.5-9B-Coder-GGUF:Q4_K_M"), "mradermacher/qwen3.5-9b-coder-gguf");
    assert_eq!(normalize_model_name("library/gemma4:12b"), "gemma4:12b");
    assert_eq!(normalize_model_name("custom-model:latest"), "custom-model:latest");
}
