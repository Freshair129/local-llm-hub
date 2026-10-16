// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut name = raw.to_lowercase();

    // Strip registry prefixes
    if name.starts_with("registry.ollama.ai/library/") {
        let prefix_len = "registry.ollama.ai/library/".len();
        name = name[prefix_len..].to_string();
    }
    if name.starts_with("library/") {
        let prefix_len = "library/".len();
        name = name[prefix_len..].to_string();
    }
    if name.starts_with("hf.co/") {
        let prefix_len = "hf.co/".len();
        name = name[prefix_len..].to_string();
    }

    // Strip quantization suffixes (case-insensitive handled by initial to_lowercase)
    let suffixes = ["-q4_0", "-q4_k_m", "-q4_k_s", ":q4_0", ":q4_k_m", ":q4_k_s"];
    for suffix in suffixes {
        if name.ends_with(suffix) {
            let suffix_len = suffix.len();
            name = name[..name.len() - suffix_len].to_string();
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
