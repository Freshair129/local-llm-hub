// trace:implements FR-002

pub fn normalize_model_name(raw: &str) -> String {
    // Strip registry prefixes
    let mut raw = raw.to_string();
    raw = raw.replace("registry.ollama.ai/library/", "").replace("library/", "");
    raw = raw.replace("hf.co/", "");

    // Strip quantization suffixes
    for suffix in vec!["-q4_0", "-q4_k_m", "-q4_k_s", ":q4_0", ":q4_k_m", ":q4_k_s"] {
        raw = raw.to_lowercase();
        raw = raw.replace(suffix, "");
    }

    // Convert result to lowercase
    raw = raw.to_lowercase();

    raw
}

#[test]
fn test_normalize_cases() {
    assert_eq!(normalize_model_name("registry.ollama.ai/library/llama3.2:1b-instruct-q4_0"), "llama3.2:1b-instruct");
    assert_eq!(normalize_model_name("hf.co/mradermacher/Qwen3.5-9B-Coder-GGUF:Q4_K_M"), "mradermacher/qwen3.5-9b-coder-gguf");
    assert_eq!(normalize_model_name("library/gemma4:12b"), "gemma4:12b");
    assert_eq!(normalize_model_name("custom-model:latest"), "custom-model:latest");
}
