pub fn normalize_model_name(raw: &str) -> String {
    // trace:implements FR-002
    let mut raw = raw;

    if raw.starts_with("registry.ollama.ai/library/") {
        raw = &raw[("registry.ollama.ai/library/").len()..];
    } else if raw.starts_with("library/") {
        raw = &raw[("library/").len()..];
    } else if raw.starts_with("hf.co/") {
        raw = &raw[("hf.co/").len()..];
    }

    let mut normalized = raw.to_lowercase();

    let suffixes = &["-q4_k_m", "-q4_k_s", ":q4_k_m", ":q4_k_s", "-q4_0", ":q4_0"];
    loop {
        let mut removed = false;
        for suffix in suffixes {
            if normalized.ends_with(*suffix) {
                normalized = normalized.trim_end_matches(*suffix);
                removed = true;
            }
        }
        if !removed {
            break;
        }
    }

    normalized
}

#[test]
fn test_normalize_cases() {
    assert_eq!(normalize_model_name("registry.ollama.ai/library/llama3.2:1b-instruct-q4_0"), "llama3.2:1b-instruct");
    assert_eq!(normalize_model_name("hf.co/mradermacher/Qwen3.5-9B-Coder-GGUF:Q4_K_M"), "mradermacher/qwen3.5-9b-coder-gguf");
    assert_eq!(normalize_model_name("library/gemma4:12b"), "gemma4:12b");
    assert_eq!(normalize_model_name("custom-model:latest"), "custom-model:latest");
}
