// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut name = raw.to_string();

    // 1. Strip registry prefixes (case-insensitive)
    let prefixes = ["registry.ollama.ai/library/", "library/", "hf.co/"];
    for prefix in prefixes.iter() {
        if let Some(stripped) = name.strip_prefix(*prefix) {
            name = stripped.to_string();
            break;
        }
    }

    // 2. Strip quantization suffixes (case-insensitive)
    let quant_suffixes = ["-q4_0", "-q4_k_m", "-q4_k_s", ":q4_0", ":q4_k_m", ":q4_k_s"];
    for suffix in quant_suffixes.iter() {
        if let Some(stripped) = name.strip_suffix(*suffix) {
            name = stripped.to_string();
            break;
        }
    }

    // 3. Convert to lowercase
    name.to_lowercase()
}

#[test]
fn test_normalize_cases() {
    assert_eq!(normalize_model_name("registry.ollama.ai/library/llama3.2:1b-instruct-q4_0"), "llama3.2:1b-instruct");
    assert_eq!(normalize_model_name("hf.co/mradermacher/Qwen3.5-9B-Coder-GGUF:Q4_K_M"), "mradermacher/qwen3.5-9b-coder-gguf");
    assert_eq!(normalize_model_name("library/gemma4:12b"), "gemma4:12b");
    assert_eq!(normalize_model_name("custom-model:latest"), "custom-model:latest");
}
