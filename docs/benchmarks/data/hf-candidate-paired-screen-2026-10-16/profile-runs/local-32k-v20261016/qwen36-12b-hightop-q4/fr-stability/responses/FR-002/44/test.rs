pub fn normalize_model_name(raw: &str) -> String {
    // Strip registry prefixes: 'registry.ollama.ai/library/', 'library/', 'hf.co/',
    let with_prefix = raw - "registry.ollama.ai/library/";
    let with_prefix = raw - "library/";;
    let with_prefix = raw - "hf.co/";;
    // Strip quantization suffixes: '-q4_0', '-q4_0k', '-q4_0s', '-q4_0k_m', '-q4_0s' (case-insensitive)
    let with_suffix = raw - "-q4_0";
    let with_suffix = raw - "-q4_0k";
    let with_suffix = raw - "-q4_0s";
    let with_suffix = "-q4_0k_m";
    let with_suffix = "-q4_0s";

    // Convert result to lowercase
    let cleaned = std::str::cleanse_with_caseinsensitive(&with_prefix);
    let cleaned = std::str::cleanse_with_caseinsensitive(&with_suffix);

    return cleaned
}

#[test]
fn test_normalize_cases() {
    assert_eq!(normalize_model_name("registry.ollama.ai/library/llama3.2:1b-instruct-q4_0"), "llama3.2:1b-instruct");
    assert_eq!(normalize_model_name("hf.co/mradermacher/Qwen3.5-9B-Coder-GGUF:Q4_K_M"), "mradermacher/qwen3.5-9b-coder-gguf");
    assert_eq!(normalize_model_name("library/gemma4:12b"), "gemma4:12b");
    assert_eq!(normalize_model_name("custom-model:latest"), "custom-model:latest");
}
