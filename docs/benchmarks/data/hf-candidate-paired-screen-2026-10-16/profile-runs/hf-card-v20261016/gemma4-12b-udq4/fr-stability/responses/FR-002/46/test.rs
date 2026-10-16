// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut result = raw.to_string();

    // Strip registry prefixes
    if let Some(stripped) = result.strip_prefix("registry.ollama.ai/library/") {
        result = stripped.to_string();
    } else if let Some(stripped) = result.strip_prefix("library/") {
        result = stripped.to_string();
    } else if let Some(stripped) = result.strip_prefix("hf.co/") {
        result = stripped.to_string();
    }

    // Strip quantization suffixes (case-insensitive)
    let suffixes = [
        "-q4_0", "-q4_k_m", "-q4_k_s",
        ":q4_0", ":q4_k_m", ":q4_k_s",
    ];

    let current_lower = result.to_lowercase();
    for suffix in suffixes {
        if current_lower.ends_with(suffix) {
            let suffix_len = suffix.len();
            // Slicing is safe as suffixes are ASCII and ends_with guarantees length
            result = result[..result.len() - suffix_len].to_string();
            break;
        }
    }

    result.to_lowercase()
}

#[test]
fn test_normalize_cases() {
    assert_eq!(normalize_model_name("registry.ollama.ai/library/llama3.2:1b-instruct-q4_0"), "llama3.2:1b-instruct");
    assert_eq!(normalize_model_name("hf.co/mradermacher/Qwen3.5-9B-Coder-GGUF:Q4_K_M"), "mradermacher/qwen3.5-9b-coder-gguf");
    assert_eq!(normalize_model_name("library/gemma4:12b"), "gemma4:12b");
    assert_eq!(normalize_model_name("custom-model:latest"), "custom-model:latest");
}
