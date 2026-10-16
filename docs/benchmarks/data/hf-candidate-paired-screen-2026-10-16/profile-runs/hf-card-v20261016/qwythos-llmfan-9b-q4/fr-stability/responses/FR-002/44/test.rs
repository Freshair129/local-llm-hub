// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut s = raw.to_lowercase();
    // Strip registry prefixes (case-insensitive for letters, but we already lowercased)
    for prefix in &['registry.ollama.ai/library/', 'library/', 'hf.co/'] {
        if let Some(stripped) = s.strip_prefix(prefix) {
            s = stripped;
        }
    }
    // Strip quantization suffixes (case-insensitive)
    let suffixes = [
        '-q4_0', '-q4_k_m', '-q4_k_s', ':q4_0', ':q4_k_m', ':q4_k_s'
    ];
    for suffix in &suffixes {
        if let Some(stripped) = s.strip_suffix(suffix) {
            s = stripped;
        }
    }
    s
}

#[test]
fn test_normalize_cases() {
    assert_eq!(normalize_model_name("registry.ollama.ai/library/llama3.2:1b-instruct-q4_0"), "llama3.2:1b-instruct");
    assert_eq!(normalize_model_name("hf.co/mradermacher/Qwen3.5-9B-Coder-GGUF:Q4_K_M"), "mradermacher/qwen3.5-9b-coder-gguf");
    assert_eq!(normalize_model_name("library/gemma4:12b"), "gemma4:12b");
    assert_eq!(normalize_model_name("custom-model:latest"), "custom-model:latest");
}
