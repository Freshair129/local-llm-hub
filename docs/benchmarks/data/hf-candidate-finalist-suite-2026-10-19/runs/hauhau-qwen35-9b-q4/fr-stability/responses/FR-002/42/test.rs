// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut name = raw.to_lowercase();

    // Strip registry prefixes (Longest first to avoid partial matches)
    if name.len() >= 27 && name.starts_with("registry.ollama.ai/library/") {
        name = name[27..].to_string();
    } else if name.len() >= 8 && name.starts_with("library/") {
        name = name[8..].to_string();
    } else if name.len() >= 6 && name.starts_with("hf.co/") {
        name = name[6..].to_string();
    }

    // Strip quantization suffixes
    let suffixes = [
        "-q4_k_m", "-q4_k_s", "-q4_0",
        ":q4_k_m", ":q4_k_s", ":q4_0",
    ];

    for suffix in suffixes.iter() {
        if name.len() >= suffix.len() && name.ends_with(suffix) {
            name = name[..name.len() - suffix.len()].to_string();
            break;
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
