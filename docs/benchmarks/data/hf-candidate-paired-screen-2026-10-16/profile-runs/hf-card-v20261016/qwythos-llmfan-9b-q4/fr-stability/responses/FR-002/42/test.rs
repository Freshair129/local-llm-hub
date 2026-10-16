// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut name = raw.trim().to_lowercase();

    // Strip registry prefixes
    if name.starts_with("registry.ollama.ai/library/") {
        if let Some(stripped) = name.strip_prefix("registry.ollama.ai/library/") {
            name = stripped.trim();
        }
    }
    if name.starts_with("library/") {
        if let Some(stripped) = name.strip_prefix("library/") {
            name = stripped.trim();
        }
    }
    if name.starts_with("hf.co/") {
        if let Some(stripped) = name.strip_prefix("hf.co/") {
            name = stripped.trim();
        }
    }

    // Strip quantization suffixes (case-insensitive, already lowercased)
    let mut suffixes = [
        "-q4_0", "-q4_k_m", "-q4_k_s",
        ":q4_0", ":q4_k_m", ":q4_k_s",
    ];

    for suffix in &suffixes {
        if name.ends_with(suffix) {
            if let Some(stripped) = name.strip_suffix(suffix) {
                name = stripped.trim();
                break; // Only strip the longest matching suffix (or first found, but order doesn't matter much here)
            }
        }
    }

    name
}

#[test]
fn test_normalize_cases() {
    assert_eq!(normalize_model_name("registry.ollama.ai/library/llama3.2:1b-instruct-q4_0"), "llama3.2:1b-instruct");
    assert_eq!(normalize_model_name("hf.co/mradermacher/Qwen3.5-9B-Coder-GGUF:Q4_K_M"), "mradermacher/qwen3.5-9b-coder-gguf");
    assert_eq!(normalize_model_name("library/gemma4:12b"), "gemma4:12b");
    assert_eq!(normalize_model_name("custom-model:latest"), "custom-model:latest");
}
