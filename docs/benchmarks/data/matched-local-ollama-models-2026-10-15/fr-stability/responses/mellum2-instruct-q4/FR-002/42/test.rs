// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut name = raw;

    // Strip registry prefixes
    if name.starts_with("registry.ollama.ai/library/") {
        name = &name["registry.ollama.ai/library/".len()..];
    } else if name.starts_with("library/") {
        name = &name["library/".len()..];
    } else if name.starts_with("hf.co/") {
        name = &name["hf.co/".len()..];
    }

    // Strip quantization suffixes (case-insensitive)
    let suffixes = ["-q4_0", "-q4_k_m", "-q4_k_s", ":q4_0", ":q4_k_m", ":q4_k_s"];
    for suffix in &suffixes {
        let lower_name = name.to_lowercase();
        let lower_suffix = suffix.to_lowercase();
        if lower_name.ends_with(&lower_suffix) {
            name = &name[..name.len() - lower_suffix.len()];
            break;
        }
    }

    // Convert result to lowercase
    name.to_lowercase()
}

#[test]
fn test_normalize_cases() {
    assert_eq!(normalize_model_name("registry.ollama.ai/library/llama3.2:1b-instruct-q4_0"), "llama3.2:1b-instruct");
    assert_eq!(normalize_model_name("hf.co/mradermacher/Qwen3.5-9B-Coder-GGUF:Q4_K_M"), "mradermacher/qwen3.5-9b-coder-gguf");
    assert_eq!(normalize_model_name("library/gemma4:12b"), "gemma4:12b");
    assert_eq!(normalize_model_name("custom-model:latest"), "custom-model:latest");
}
