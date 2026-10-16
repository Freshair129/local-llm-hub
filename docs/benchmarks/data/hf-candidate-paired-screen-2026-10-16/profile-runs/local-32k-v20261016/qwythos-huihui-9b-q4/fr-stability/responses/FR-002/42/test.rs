// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut model = raw.to_string();

    // Strip registry prefixes (repeat until none match)
    loop {
        if let Some(stripped) = model.strip_suffix("registry.ollama.ai/library/") {
            model = stripped;
        } else if let Some(stripped) = model.strip_suffix("library/") {
            model = stripped;
        } else if let Some(stripped) = model.strip_suffix("hf.co/") {
            model = stripped;
        } else {
            break;
        }
    }

    // Strip quantization suffixes (case-insensitive)
    for suffix in ["-q4_0", "-q4_k_m", "-q4_k_s", ":q4_0", ":q4_k_m", ":q4_k_s"] {
        if let Some(stripped) = model.strip_suffix(suffix) {
            model = stripped;
            break;
        }
    }

    model.to_lowercase()
}

#[test]
fn test_normalize_cases() {
    assert_eq!(normalize_model_name("registry.ollama.ai/library/llama3.2:1b-instruct-q4_0"), "llama3.2:1b-instruct");
    assert_eq!(normalize_model_name("hf.co/mradermacher/Qwen3.5-9B-Coder-GGUF:Q4_K_M"), "mradermacher/qwen3.5-9b-coder-gguf");
    assert_eq!(normalize_model_name("library/gemma4:12b"), "gemma4:12b");
    assert_eq!(normalize_model_name("custom-model:latest"), "custom-model:latest");
}
