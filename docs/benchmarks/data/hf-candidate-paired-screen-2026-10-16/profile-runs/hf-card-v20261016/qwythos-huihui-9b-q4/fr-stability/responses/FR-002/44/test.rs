// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut name = raw.to_string();

    // Strip registry prefixes
    if name.startswith("registry.ollama.ai/library/") {
        name = &name[21..];
    } else if name.startswith("library/") {
        name = &name[8..];
    } else if name.startswith("hf.co/") {
        name = &name[6..];
    }

    // Convert to lowercase (case-insensitive suffix matching)
    name = name.to_lowercase();

    // Strip quantization suffixes (longest first, then shorter)
    if name.ends_with("-q4_k_m") || name.ends_with(":q4_k_m") {
        name = &name[..name.len() - 7];
    } else if name.ends_with("-q4_k_s") {
        name = &name[..name.len() - 7];
    } else if name.ends_with("-q4_0") {
        name = &name[..name.len() - 5];
    } else if name.ends_with(":q4_k_s") {
        name = &name[..name.len() - 7];
    } else if name.ends_with(":q4_0") {
        name = &name[..name.len() - 5];
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
