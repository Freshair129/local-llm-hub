// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    // Strip prefixes (case-sensitive)
    let mut model = raw;
    if model.starts_with("registry.ollama.ai/library/") {
        model = &model["registry.ollama.ai/library/".len()..];
    } else if model.starts_with("library/") {
        model = &model["library/".len()..];
    } else if model.starts_with("hf.co/") {
        model = &model["hf.co/".len()..];
    }
    
    // Strip suffixes (case-insensitive)
    let lower_model = model.to_lowercase();
    let suffixes = [
        "-q4_0", "-q4_k_m", "-q4_k_s",
        ":q4_0", ":q4_k_m", ":q4_k_s"
    ];
    
    for suffix in &suffixes {
        if lower_model.ends_with(suffix) {
            model = &lower_model[..lower_model.len() - suffix.len()];
            break;
        }
    }
    
    // Convert to lowercase
    model.to_string()
}

#[test]
fn test_normalize_cases() {
    assert_eq!(normalize_model_name("registry.ollama.ai/library/llama3.2:1b-instruct-q4_0"), "llama3.2:1b-instruct");
    assert_eq!(normalize_model_name("hf.co/mradermacher/Qwen3.5-9B-Coder-GGUF:Q4_K_M"), "mradermacher/qwen3.5-9b-coder-gguf");
    assert_eq!(normalize_model_name("library/gemma4:12b"), "gemma4:12b");
    assert_eq!(normalize_model_name("custom-model:latest"), "custom-model:latest");
}
