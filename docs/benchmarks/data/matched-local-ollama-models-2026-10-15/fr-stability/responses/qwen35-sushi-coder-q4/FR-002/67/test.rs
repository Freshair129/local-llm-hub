// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    // Guard rail: NO unwrap(), NO expect(), NO panic!
    let mut name = raw.trim().to_lowercase();

    // Strip registry prefixes
    let prefixes = [
        "registry.ollama.ai/library/",
        "library/",
        "hf.co/",
    ];
    for prefix in prefixes.iter() {
        if name.starts_with(prefix) {
            name = name[prefix.len()..].to_string();
            break;
        }
    }

    // Strip quantization suffixes (case-insensitive already applied)
    let suffixes = [
        "-q4_0",
        "-q4_k_m",
        "-q4_k_s",
        ":q4_0",
        ":q4_k_m",
        ":q4_k_s",
    ];
    for suffix in suffixes.iter() {
        if name.ends_with(suffix) {
            name = name[..name.len() - suffix.len()].to_string();
            break;
        }
    }

    // Normalize to lowercase (already done, but explicit for clarity)
    name
}

#[test]
fn test_normalize_cases() {
    assert_eq!(normalize_model_name("registry.ollama.ai/library/llama3.2:1b-instruct-q4_0"), "llama3.2:1b-instruct");
    assert_eq!(normalize_model_name("hf.co/mradermacher/Qwen3.5-9B-Coder-GGUF:Q4_K_M"), "mradermacher/qwen3.5-9b-coder-gguf");
    assert_eq!(normalize_model_name("library/gemma4:12b"), "gemma4:12b");
    assert_eq!(normalize_model_name("custom-model:latest"), "custom-model:latest");
}
