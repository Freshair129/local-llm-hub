// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    // Strip registry prefixes (case-sensitive)
    let mut name = raw.to_string();
    for prefix in ["registry.ollama.ai/library/", "library/", "hf.co/"] {
        if let Some(stripped) = name.strip_prefix(prefix) {
            name = stripped;
        }
    }

    // Strip quantization suffixes (case-insensitive)
    let mut name_lower = name.to_lowercase();
    for suffix in ["-q4_0", "-q4_k_m", "-q4_k_s", ":q4_0", ":q4_k_m", ":q4_k_s"] {
        // suffixes are already lowercase, replace all occurrences
        name_lower = name_lower.replace(suffix, "");
    }

    name_lower
}

#[test]
fn test_normalize_cases() {
    assert_eq!(normalize_model_name("registry.ollama.ai/library/llama3.2:1b-instruct-q4_0"), "llama3.2:1b-instruct");
    assert_eq!(normalize_model_name("hf.co/mradermacher/Qwen3.5-9B-Coder-GGUF:Q4_K_M"), "mradermacher/qwen3.5-9b-coder-gguf");
    assert_eq!(normalize_model_name("library/gemma4:12b"), "gemma4:12b");
    assert_eq!(normalize_model_name("custom-model:latest"), "custom-model:latest");
}
