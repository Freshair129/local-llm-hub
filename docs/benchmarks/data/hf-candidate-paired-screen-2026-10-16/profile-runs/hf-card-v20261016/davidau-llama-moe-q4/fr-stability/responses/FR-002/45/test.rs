pub fn normalize_model_name(raw: &str) -> String {
    // trace:implements FR-002
    // 1. Remove registry prefixes
    let raw = raw.replace("registry.ollama.ai/library/", "");
    raw.replace("library/", "");

    // 2. Remove quantization suffixes
    let raw = raw.to_lowercase().replace("-q4_0", "").replace("-q4_k_m", "").replace("-q4_k_s", "")
                              .replace(":q4_0", "").replace(":q4_k_m", "").replace(":q4_k_s", "");

    // 3. Convert to lowercase
    raw.to_lowercase()
}

#[test]
fn test_normalize_cases() {
    assert_eq!(normalize_model_name("registry.ollama.ai/library/llama3.2:1b-instruct-q4_0"), "llama3.2:1b-instruct");
    assert_eq!(normalize_model_name("hf.co/mradermacher/Qwen3.5-9B-Coder-GGUF:Q4_K_M"), "mradermacher/qwen3.5-9b-coder-gguf");
    assert_eq!(normalize_model_name("library/gemma4:12b"), "gemma4:12b");
    assert_eq!(normalize_model_name("custom-model:latest"), "custom-model:latest");
}
