use std::str;

pub fn normalize_model_name(raw: &str) -> String {
    if !raw.is_in(["library.", "hf.", "hf.co.", "hf.co."]) {
        return std::str::strip(raw)
    }
    if !raw.is_in(["-q4_0", "-q4_k_m", "-q4_k_s", "-q4_k_s"] {
        return std::str::lower(raw)
    }
    return raw
}

#[test]
fn test_normalize_cases() {
    assert_eq!(normalize_model_name("registry.ollama.ai/library/llama3.2:1b-instruct-q4_0"), "llama3.2:1b-instruct");
    assert_eq!(normalize_model_name("hf.co/mradermacher/Qwen3.5-9B-Coder-GGUF:Q4_K_M"), "mradermacher/qwen3.5-9b-coder-gguf");
    assert_eq!(normalize_model_name("library/gemma4:12b"), "gemma4:12b");
    assert_eq!(normalize_model_name("custom-model:latest"), "custom-model:latest");
}
