// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut s = raw;

    // Strip registry prefixes
    if s.starts_with("registry.ollama.ai/library/") {
        s = &s["registry.ollama.ai/library/".len()..];
    } else if s.starts_with("library/") {
        s = &s["library/".len()..];
    } else if s.starts_with("hf.co/") {
        s = &s["hf.co/".len()..];
    }

    // Strip quantization suffixes (case-insensitive)
    let suffixes = [
        "-q4_0",
        "-q4_k_m",
        "-q4_k_s",
        ":q4_0",
        ":q4_k_m",
        ":q4_k_s",
    ];

    for suffix in &suffixes {
        let lower_suffix = suffix.to_lowercase();
        let lower_s = s.to_lowercase();
        if lower_s.ends_with(&lower_suffix) {
            s = &s[..s.len() - suffix.len()];
            break;
        }
    }

    // Convert result to lowercase
    s.to_lowercase()
}

#[test]
fn test_normalize_cases() {
    assert_eq!(normalize_model_name("registry.ollama.ai/library/llama3.2:1b-instruct-q4_0"), "llama3.2:1b-instruct");
    assert_eq!(normalize_model_name("hf.co/mradermacher/Qwen3.5-9B-Coder-GGUF:Q4_K_M"), "mradermacher/qwen3.5-9b-coder-gguf");
    assert_eq!(normalize_model_name("library/gemma4:12b"), "gemma4:12b");
    assert_eq!(normalize_model_name("custom-model:latest"), "custom-model:latest");
}
