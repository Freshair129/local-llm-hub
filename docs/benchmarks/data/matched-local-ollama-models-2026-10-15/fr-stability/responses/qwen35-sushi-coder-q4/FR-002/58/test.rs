// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    if raw.is_empty() {
        return String::new();
    }

    let mut name = raw;

    // Strip quantization suffixes (case-insensitive)
    let quant_suffixes = [
        "-q4_0", "-q4_k_m", "-q4_k_s", ":q4_0", ":q4_k_m", ":q4_k_s",
    ];
    for &suffix in &quant_suffixes {
        if let Some(stripped) = name.strip_suffix(suffix) {
            name = stripped;
        } else if let Some(stripped) = name.strip_suffix(suffix.to_uppercase()) {
            name = stripped;
        }
    }

    // Strip registry prefixes
    let prefixes = [
        "registry.ollama.ai/library/",
        "library/",
        "hf.co/",
    ];
    for &prefix in &prefixes {
        if let Some(stripped) = name.strip_prefix(prefix) {
            name = stripped;
        }
    }

    // Convert to lowercase
    let mut result = String::with_capacity(name.len());
    for c in name.chars() {
        if c.is_ascii_lowercase() {
            result.push(c);
        } else if c.is_ascii_uppercase() {
            result.push(c.to_ascii_lowercase());
        } else {
            // Non-letter characters (e.g., ':', '/') are preserved as-is
            result.push(c);
        }
    }

    result
}

#[test]
fn test_normalize_cases() {
    assert_eq!(normalize_model_name("registry.ollama.ai/library/llama3.2:1b-instruct-q4_0"), "llama3.2:1b-instruct");
    assert_eq!(normalize_model_name("hf.co/mradermacher/Qwen3.5-9B-Coder-GGUF:Q4_K_M"), "mradermacher/qwen3.5-9b-coder-gguf");
    assert_eq!(normalize_model_name("library/gemma4:12b"), "gemma4:12b");
    assert_eq!(normalize_model_name("custom-model:latest"), "custom-model:latest");
}
