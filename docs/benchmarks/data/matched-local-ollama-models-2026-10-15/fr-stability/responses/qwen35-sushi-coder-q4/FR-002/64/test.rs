// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut name = raw.trim();
    
    // Strip registry prefixes - check each one in order of specificity
    let prefixes = [
        "registry.ollama.ai/library/",
        "library/",
        "hf.co/",
    ];
    
    for prefix in prefixes.iter() {
        if name.starts_with(prefix) {
            name = &name[prefix.len()..];
        }
    }
    
    // Strip quantization suffixes (case-insensitive)
    let suffixes = [
        "-q4_0", "-q4_k_m", "-q4_k_s",
        ":q4_0", ":q4_k_m", ":q4_k_s",
    ];
    
    let suffix_upper = name.to_uppercase();
    for suffix in suffixes.iter() {
        let suffix_upper = suffix.to_uppercase();
        if suffix_upper.len() <= name.len() && suffix_upper.len() <= name.len() {
            let upper_name = name.to_uppercase();
            if upper_name.ends_with(&suffix_upper) {
                name = &name[..name.len() - suffix_upper.len()];
                break;
            }
        }
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
