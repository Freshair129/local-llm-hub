// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut name = raw.to_string();

    // Strip registry prefixes
    name = name.replace("registry.ollama.ai/library/", "");
    name = name.replace("library/", "");
    name = name.replace("hf.co/", "");

    // Strip quantization suffixes (case-insensitive)
    let suffixes = [
        "-q4_0", "-q4_k_m", "-q4_k_s",
        ":q4_0", ":q4_k_m", ":q4_k_s",
        "-Q4_0", "-Q4_K_M", "-Q4_K_S",
        ":Q4_0", ":Q4_K_M", ":Q4_K_S",
    ];
    for suffix in &suffixes {
        name = name.replace(suffix, "");
    }

    // Convert to lowercase
    name = name.to_lowercase();

    name
}

#[test]
fn test_normalize_cases() {
    assert_eq!(normalize_model_name("registry.ollama.ai/library/llama3.2:1b-instruct-q4_0"), "llama3.2:1b-instruct");
    assert_eq!(normalize_model_name("hf.co/mradermacher/Qwen3.5-9B-Coder-GGUF:Q4_K_M"), "mradermacher/qwen3.5-9b-coder-gguf");
    assert_eq!(normalize_model_name("library/gemma4:12b"), "gemma4:12b");
    assert_eq!(normalize_model_name("custom-model:latest"), "custom-model:latest");
}
