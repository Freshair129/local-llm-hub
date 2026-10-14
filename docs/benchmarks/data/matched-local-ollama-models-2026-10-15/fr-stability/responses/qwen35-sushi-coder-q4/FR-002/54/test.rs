pub fn normalize_model_name(raw: &str) -> String {
    // trace:implements FR-002

    // Helper to safely strip a prefix, returning None if not found
    fn strip_prefix(s: &str, prefix: &str) -> Option<&str> {
        if s.starts_with(prefix) {
            Some(&s[prefix.len()..])
        } else {
            None
        }
    }

    // Helper to safely strip a suffix (case-insensitive), returning None if not found
    fn strip_suffix_case_insensitive(s: &str, suffix: &str) -> Option<&str> {
        let suffix_lower = suffix.to_lowercase();
        let s_lower = s.to_lowercase();
        if s_lower.ends_with(&suffix_lower) {
            let suffix_len = suffix.len();
            let start = s.len() - suffix_len;
            Some(&s[start..])
        } else {
            None
        }
    }

    let mut current = raw;

    // Strip registry prefixes (order matters - longest first)
    current = strip_prefix(current, "registry.ollama.ai/library/")
        .or_else(|| strip_prefix(current, "library/"))
        .or_else(|| strip_prefix(current, "hf.co/"))
        .unwrap_or(current);

    // Strip quantization suffixes (case-insensitive, order doesn't matter)
    let quant_suffixes = [
        "-q4_0", "-q4_k_m", "-q4_k_s",
        ":q4_0", ":q4_k_m", ":q4_k_s",
    ];

    for suffix in quant_suffixes.iter() {
        current = strip_suffix_case_insensitive(current, suffix)
            .or(Some(current))
            .unwrap_or(current);
    }

    // Convert to lowercase
    current.to_lowercase()
}

#[test]
fn test_normalize_cases() {
    assert_eq!(normalize_model_name("registry.ollama.ai/library/llama3.2:1b-instruct-q4_0"), "llama3.2:1b-instruct");
    assert_eq!(normalize_model_name("hf.co/mradermacher/Qwen3.5-9B-Coder-GGUF:Q4_K_M"), "mradermacher/qwen3.5-9b-coder-gguf");
    assert_eq!(normalize_model_name("library/gemma4:12b"), "gemma4:12b");
    assert_eq!(normalize_model_name("custom-model:latest"), "custom-model:latest");
}
