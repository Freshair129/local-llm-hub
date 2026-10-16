// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut normalized = String::new();

    for c in raw.chars() {
        match c {
            'a'..='z' | 'A'..='Z' | '0'..='9' | '-' | '.' | '/' => normalized.push(c),
            _ => continue,
        }
    }

    let mut stripped_registry_prefixes = vec![
        "registry.ollama.ai/library/",
        "library/",
        "hf.co/",
    ];

    for prefix in stripped_registry_prefixes.iter() {
        if normalized.starts_with(prefix) {
            normalized = normalized.trim_start_matches(prefix).to_string();
        }
    }

    let mut stripped_quantization_suffixes = vec![
        "-q4_0",
        "-q4_k_m",
        "-q4_k_s",
        ":q4_0",
        ":q4_k_m",
        ":q4_k_s",
    ];

    for suffix in stripped_quantization_suffixes.iter() {
        if normalized.to_lowercase().ends_with(suffix) {
            normalized = normalized.trim_end_matches(suffix).to_string();
        }
    }

    normalized.to_lowercase()
}

#[test]
fn test_normalize_cases() {
    assert_eq!(normalize_model_name("registry.ollama.ai/library/llama3.2:1b-instruct-q4_0"), "llama3.2:1b-instruct");
    assert_eq!(normalize_model_name("hf.co/mradermacher/Qwen3.5-9B-Coder-GGUF:Q4_K_M"), "mradermacher/qwen3.5-9b-coder-gguf");
    assert_eq!(normalize_model_name("library/gemma4:12b"), "gemma4:12b");
    assert_eq!(normalize_model_name("custom-model:latest"), "custom-model:latest");
}
