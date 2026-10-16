// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut s = raw;
    
    // Strip registry prefixes
    if s.starts_with("registry.ollama.ai/library/") {
        s = &s["registry.ollama.ai/library/".len()..];
    } else if s.starts_with("library/") {
        s = &s["library/".len()..];
    } else if s.starts_with("hf.co/") {
        s = &s["hf.co/".len()..];
    }
    
    // Strip quantization suffixes (case-insensitive)
    let s_lower = s.to_lowercase();
    let suffixes = ["-q4_0", "-q4_k_m", "-q4_k_s", ":q4_0", ":q4_k_m", ":q4_k_s"];
    
    // Remove suffixes from the end repeatedly until no more match
    for _ in 0..10 {
        let mut matched = false;
        for suffix in suffixes {
            let suffix_lower = suffix.to_lowercase();
            if s_lower.ends_with(&suffix_lower) {
                let suffix_len = suffix.len();
                s = &s[..s.len() - suffix_len];
                matched = true;
                break;
            }
        }
        if !matched {
            break;
        }
    }
    
    // Convert to lowercase
    s.to_lowercase()
}

#[test]
fn test_normalize_cases() {
    assert_eq!(normalize_model_name("registry.ollama.ai/library/llama3.2:1b-instruct-q4_0"), "llama3.2:1b-instruct");
    assert_eq!(normalize_model_name("hf.co/mradermacher/Qwen3.5-9B-Coder-GGUF:Q4_K_M"), "mradermacher/qwen3.5-9b-coder-gguf");
    assert_eq!(normalize_model_name("library/gemma4:12b"), "gemma4:12b");
    assert_eq!(normalize_model_name("custom-model:latest"), "custom-model:latest");
}
