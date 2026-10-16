// trace:implements FR-002

pub fn normalize_model_name(raw: &str) -> String {
    // Strip registry prefixes
    let mut raw = raw.clone();
    if raw.starts_with("registry.ollama.ai/library/") {
        raw = &raw[15..].to_string();
    } else if raw.starts_with("library/") {
        raw = &raw[8..].to_string();
    }

    // Strip quantization suffixes
    let mut raw = raw.clone();
    for suffix in &["-q4_0", "-q4_k_m", "-q4_k_s", ":q4_0", ":q4_k_m", ":q4_k_s"] {
        while raw.ends_with(suffix) {
            raw = &raw[..raw.len() - suffix.len()].to_string();
        }
    }

    // Convert to lowercase
    let raw = raw.to_lowercase();

    raw
}

#[test]
fn test_normalize_cases() {
    assert_eq!(normalize_model_name("registry.ollama.ai/library/llama3.2:1b-instruct-q4_0"), "llama3.2:1b-instruct");
    assert_eq!(normalize_model_name("hf.co/mradermacher/Qwen3.5-9B-Coder-GGUF:Q4_K_M"), "mradermacher/qwen3.5-9b-coder-gguf");
    assert_eq!(normalize_model_name("library/gemma4:12b"), "gemma4:12b");
    assert_eq!(normalize_model_name("custom-model:latest"), "custom-model:latest");
}
