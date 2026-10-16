// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    // Step 1: Strip registry prefixes
    let raw_without_registry_prefix = raw.replace("registry.ollama.ai/library/", "")
        .replace("library/", "").replace("hf.co/", "");

    // Step 2: Strip quantization suffixes
    let raw_without_quantization_suffix = raw_without_registry_prefix
        .replace("-q4_0", "").replace("-q4_k_m", "").replace("-q4_k_s", "")
        .replace(":q4_0", "").replace(":q4_k_m", "").replace(":q4_k_s", "");

    // Step 3: Convert result to lowercase
    let raw_with_lowercase = raw_without_quantization_suffix.to_lowercase();

    raw_with_lowercase
}

#[test]
fn test_normalize_cases() {
    assert_eq!(normalize_model_name("registry.ollama.ai/library/llama3.2:1b-instruct-q4_0"), "llama3.2:1b-instruct");
    assert_eq!(normalize_model_name("hf.co/mradermacher/Qwen3.5-9B-Coder-GGUF:Q4_K_M"), "mradermacher/qwen3.5-9b-coder-gguf");
    assert_eq!(normalize_model_name("library/gemma4:12b"), "gemma4:12b");
    assert_eq!(normalize_model_name("custom-model:latest"), "custom-model:latest");
}
