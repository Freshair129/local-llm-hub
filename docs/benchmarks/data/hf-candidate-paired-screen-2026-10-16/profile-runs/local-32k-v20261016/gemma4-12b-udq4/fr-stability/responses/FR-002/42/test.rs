// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut current = raw;

    // 1. Strip registry prefixes
    if let Some(stripped) = current.strip_prefix("registry.ollama.ai/library/") {
        current = stripped;
    } else if let Some(stripped) = current.strip_prefix("library/") {
        current = stripped;
    } else if let Some(stripped) = current.strip_prefix("hf.co/") {
        current = stripped;
    }

    // 2. Strip quantization suffixes (case-insensitive)
    let suffixes = ["-q4_0", "-q4_k_m", "-q4_k_s", ":q4_0", ":q4_k_m", ":q4_k_s"];
    for suffix in suffixes {
        let suffix_lower = suffix.to_lowercase();
        if current.to_lowercase().ends_with(&suffix_lower) {
            let len = suffix_lower.len();
            current = &current[..current.len() - len];
            break;
        }
    }

    // 3. Convert result to lowercase
    current.to_lowercase()
}

#[test]
fn test_normalize_cases() {
    assert_eq!(normalize_model_name("registry.ollama.ai/library/llama3.2:1b-instruct-q4_0"), "llama3.2:1b-instruct");
    assert_eq!(normalize_model_name("hf.co/mradermacher/Qwen3.5-9B-Coder-GGUF:Q4_K_M"), "mradermacher/qwen3.5-9b-coder-gguf");
    assert_eq!(normalize_model_name("library/gemma4:12b"), "gemma4:12b");
    assert_eq!(normalize_model_name("custom-model:latest"), "custom-model:latest");
}
