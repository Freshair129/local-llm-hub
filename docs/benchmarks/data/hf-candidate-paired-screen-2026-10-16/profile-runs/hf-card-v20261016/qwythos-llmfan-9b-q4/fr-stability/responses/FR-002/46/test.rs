// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut name = raw;

    // strip registry prefixes (loop to handle multiple or nested prefixes)
    while name.starts_with("registry.ollama.ai/library/") ||
            name.starts_with("library/") ||
            name.starts_with("hf.co/") {
        if name.starts_with("registry.ollama.ai/library/") {
            name = &name[28..];
        } else if name.starts_with("library/") {
            name = &name[8..];
        } else if name.starts_with("hf.co/") {
            name = &name[6..];
        }
    }

    // strip quantization suffixes (case-insensitive)
    let mut lower_name = name.to_lowercase();
    while lower_name.ends_with("-q4_0") ||
            lower_name.ends_with("-q4_k_m") ||
            lower_name.ends_with("-q4_k_s") ||
            lower_name.ends_with(":q4_0") ||
            lower_name.ends_with(":q4_k_m") ||
            lower_name.ends_with(":q4_k_s") {
        if lower_name.ends_with("-q4_0") {
            name = &name[..(name.len() - 5)];
            lower_name = &lower_name[..(lower_name.len() - 5)];
        } else if lower_name.ends_with("-q4_k_m") {
            name = &name[..(name.len() - 7)];
            lower_name = &lower_name[..(lower_name.len() - 7)];
        } else if lower_name.ends_with("-q4_k_s") {
            name = &name[..(name.len() - 7)];
            lower_name = &lower_name[..(lower_name.len() - 7)];
        } else if lower_name.ends_with(":q4_0") {
            name = &name[..(name.len() - 5)];
            lower_name = &lower_name[..(lower_name.len() - 5)];
        } else if lower_name.ends_with(":q4_k_m") {
            name = &name[..(name.len() - 7)];
            lower_name = &lower_name[..(lower_name.len() - 7)];
        } else if lower_name.ends_with(":q4_k_s") {
            name = &name[..(name.len() - 7)];
            lower_name = &lower_name[..(lower_name.len() - 7)];
        }
    }

    // final lowercase conversion
    name.to_lowercase()
}

#[test]
fn test_normalize_cases() {
    assert_eq!(normalize_model_name("registry.ollama.ai/library/llama3.2:1b-instruct-q4_0"), "llama3.2:1b-instruct");
    assert_eq!(normalize_model_name("hf.co/mradermacher/Qwen3.5-9B-Coder-GGUF:Q4_K_M"), "mradermacher/qwen3.5-9b-coder-gguf");
    assert_eq!(normalize_model_name("library/gemma4:12b"), "gemma4:12b");
    assert_eq!(normalize_model_name("custom-model:latest"), "custom-model:latest");
}
