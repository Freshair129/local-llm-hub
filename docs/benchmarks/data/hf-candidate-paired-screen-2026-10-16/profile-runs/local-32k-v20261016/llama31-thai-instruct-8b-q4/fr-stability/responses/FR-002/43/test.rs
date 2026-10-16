// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut result = raw.to_lowercase();

    // Strip registry prefixes
    result = result.replace("registry.ollama.ai/library/", "");
    result = result.replace("library/", "");
    result = result.replace("hf.co/", "");

    // Strip quantization suffixes
    result = result.replace("-q4_0", "");
    result = result.replace("-q4_k_m", "");
    result = result.replace("-q4_k_s", "");
    result = result.replace(":q4_0", "");
    result = result.replace(":q4_k_m", "");
    result = result.replace(":q4_k_s", "");

    result
}

#[test]
fn test_normalize_cases() {
    assert_eq!(normalize_model_name("registry.ollama.ai/library/llama3.2:1b-instruct-q4_0"), "llama3.2:1b-instruct");
    assert_eq!(normalize_model_name("hf.co/mradermacher/Qwen3.5-9B-Coder-GGUF:Q4_K_M"), "mradermacher/qwen3.5-9b-coder-gguf");
    assert_eq!(normalize_model_name("library/gemma4:12b"), "gemma4:12b");
    assert_eq!(normalize_model_name("custom-model:latest"), "custom-model:latest");
}
