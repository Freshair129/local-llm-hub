pub fn normalize_model_name(raw: &str) -> String {
    // trace:implements FR-002
    let mut name = raw.to_string();

    // Strip registry prefixes (order matters for overlaps)
    for prefix in ["registry.ollama.ai/library/", "library/", "hf.co/"] {
        if name.starts_with(prefix) {
            name.truncate(name.len() - prefix.len());
        }
    }

    // Strip quantization suffixes (case-insensitive)
    let suffixes = ["-q4_0", "-q4_k_m", "-q4_k_s", ":q4_0", ":q4_k_m", ":q4_k_s"];
    for suffix in suffixes {
        if name.ends_with(suffix) {
            // Compute the start index safely (no unwrap)
            let idx = name.len() - suffix.len();
            name.truncate(idx);
        }
    }

    name.to_lowercase()
}

#[test]
fn test_normalize_cases() {
    assert_eq!(normalize_model_name("registry.ollama.ai/library/llama3.2:1b-instruct-q4_0"), "llama3.2:1b-instruct");
    assert_eq!(normalize_model_name("hf.co/mradermacher/Qwen3.5-9B-Coder-GGUF:Q4_K_M"), "mradermacher/qwen3.5-9b-coder-gguf");
    assert_eq!(normalize_model_name("library/gemma4:12b"), "gemma4:12b");
    assert_eq!(normalize_model_name("custom-model:latest"), "custom-model:latest");
}
