// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    // copy input to mutable owned String (safe, no unwrap)
    let mut s = raw.to_string();

    // strip registry prefixes (order matters for overlapping prefixes)
    if s.startswith("registry.ollama.ai/library/") {
        s = s.trim_start_matches("registry.ollama.ai/library/").to_string();
    }
    if s.startswith("library/") {
        s = s.trim_start_matches("library/").to_string();
    }
    if s.startswith("hf.co/") {
        s = s.trim_start_matches("hf.co/").to_string();
    }

    // strip quantization suffixes (case-insensitive)
    let lower = s.to_lowercase(); // safe conversion, no unwrap needed
    if lower.ends_with("-q4_0") {
        s = lower[..(lower.len()-5)].to_string();
    } else if lower.ends_with("-q4_k_m") {
        s = lower[..(lower.len()-6)].to_string();
    } else if lower.ends_with("-q4_k_s") {
        s = lower[..(lower.len()-6)].to_string();
    } else if lower.ends_with(":q4_0") {
        s = lower[..(lower.len()-5)].to_string();
    } else if lower.ends_with(":q4_k_m") {
        s = lower[..(lower.len()-6)].to_string();
    } else if lower.ends_with(":q4_k_s") {
        s = lower[..(lower.len()-6)].to_string();
    }

    // `s` is now the suffix‑stripped, lowercase version
    s
}

#[test]
fn test_normalize_cases() {
    assert_eq!(normalize_model_name("registry.ollama.ai/library/llama3.2:1b-instruct-q4_0"), "llama3.2:1b-instruct");
    assert_eq!(normalize_model_name("hf.co/mradermacher/Qwen3.5-9B-Coder-GGUF:Q4_K_M"), "mradermacher/qwen3.5-9b-coder-gguf");
    assert_eq!(normalize_model_name("library/gemma4:12b"), "gemma4:12b");
    assert_eq!(normalize_model_name("custom-model:latest"), "custom-model:latest");
}
