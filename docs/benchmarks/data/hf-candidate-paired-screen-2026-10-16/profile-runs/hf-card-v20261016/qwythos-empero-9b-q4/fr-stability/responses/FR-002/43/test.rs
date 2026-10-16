// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let prefixes = ["registry.ollama.ai/library/", "library/", "hf.co/"];
    let suffixes = ["-q4_0", "-q4_k_m", "-q4_k_s", ":q4_0", ":q4_k_m", ":q4_k_s"];

    let mut s = raw.to_string();

    // Strip prefixes (case-sensitive)
    for prefix in &prefixes {
        if s.starts_with(prefix) {
            s.truncate(s.len() - prefix.len());
            break;
        }
    }

    // Convert to lowercase for suffix stripping and final output
    let mut normalized = s.to_lowercase();

    for suffix in &suffixes {
        let suffix_lc = suffix.to_lowercase();
        if normalized.ends_with(&suffix_lc) {
            normalized.truncate(normalized.len() - suffix_lc.len());
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
