// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut name = raw.to_lowercase();
    name.retain(|c| c != 'q' && c != 'k' && c != 'm' && c != 's');
    name.retain(|c| c != '_' && c != '4');
    name.retain(|c| c != '/' && c != ':');
    name.retain(|c| c != '.' && c != ' ');

    let registry_prefixes = ["registry.ollama.ai/library/", "library/", "hf.co/"];
    for prefix in registry_prefixes {
        if name.starts_with(prefix) {
            name = name.trim_start_matches(prefix).to_string();
        }
    }

    let quantization_suffixes = ["-q4_0", "-q4_k_m", "-q4_k_s", ":q4_0", ":q4_k_m", ":q4_k_s"];
    for suffix in quantization_suffixes {
        if name.ends_with(suffix) {
            name = name.trim_end_matches(suffix).to_string();
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
