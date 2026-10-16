// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut current = raw.to_string();

    // Strip registry prefixes (exact matches)
    if let Some(stripped) = current.strip_prefix("registry.ollama.ai/library/") {
        current = stripped.to_string();
    } else if let Some(stripped) = current.strip_prefix("library/") {
        current = stripped.to_string();
    } else if let Some(stripped) = current.strip_prefix("hf.co/") {
        current = stripped.to_string();
    }

    // Convert to lowercase to handle case-insensitive suffix stripping
    let mut result = current.to_lowercase();

    // Strip quantization suffixes (case-insensitive)
    let suffixes = ["-q4_0", "-q4_k_m", "-q4_k_s", ":q4_0", ":q4_k_m", ":q4_k_s"];
    for suffix in suffixes {
        if result.ends_with(suffix) {
            // Safely truncate since suffix is ASCII and ends_with was confirmed
            let new_len = result.len() - suffix.len();
            result.truncate(new_len);
            break;
        }
    }

    result
}

#[test]
fn test_normalize_cases() {
    assert_eq!(normalize_model_name("registry.ollama.ai/library/llama3.2:1b-instruct-q4_0"), "llama3.2:1b-instruct");
    assert_eq!(normalize_model_name("hf.co/mradermacher/Qwen3.5-9B-Coder-GGUF:Q4_K_M"), "mradermacher/qwen3.5-9b-coder-gguf");
    assert_eq!(normalize_model_name("library/gemma4:12b"), "gemma4:12b");
    assert_eq!(normalize_model_name("custom-model:latest"), "custom-model:latest");
}
