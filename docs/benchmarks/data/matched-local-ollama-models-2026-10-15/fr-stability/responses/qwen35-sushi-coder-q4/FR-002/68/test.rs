// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    // Convert input to lowercase first to make suffix matching case-insensitive
    // This also handles the "convert result to lowercase" requirement
    let mut name = raw.to_lowercase();

    // Strip quantization suffixes: case-insensitive check
    // The spec says case-insensitive, so we check if the suffix appears anywhere
    let quant_suffixes = [
        "-q4_0", "-q4_k_m", "-q4_k_s",
        ":q4_0", ":q4_k_m", ":q4_k_s",
    ];

    // Check if any quantization suffix is present and remove it
    for suffix in quant_suffixes.iter() {
        if name.contains(suffix) {
            name = name.replace(suffix, "");
        }
    }

    // Strip registry prefixes
    let registry_prefixes = [
        "registry.ollama.ai/library/",
        "library/",
        "hf.co/",
    ];

    for prefix in registry_prefixes.iter() {
        if name.starts_with(prefix) {
            name = name.trim_start_matches(prefix);
        }
    }

    // Final trim in case any prefix was at the start without matching exactly
    name = name.trim().to_string();

    name
}

#[test]
fn test_normalize_cases() {
    assert_eq!(normalize_model_name("registry.ollama.ai/library/llama3.2:1b-instruct-q4_0"), "llama3.2:1b-instruct");
    assert_eq!(normalize_model_name("hf.co/mradermacher/Qwen3.5-9B-Coder-GGUF:Q4_K_M"), "mradermacher/qwen3.5-9b-coder-gguf");
    assert_eq!(normalize_model_name("library/gemma4:12b"), "gemma4:12b");
    assert_eq!(normalize_model_name("custom-model:latest"), "custom-model:latest");
}
