// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut name = raw;
    
    // Strip registry prefixes
    if name.starts_with("registry.ollama.ai/library/") {
        name = &name[21..];
    } else if name.starts_with("library/") {
        name = &name[8..];
    } else if name.starts_with("hf.co/") {
        name = &name[6..];
    }
    
    // Handle empty string after prefix stripping
    if name.is_empty() {
        return name.to_lowercase();
    }
    
    let lower = name.to_lowercase();
    
    // Strip quantization suffixes (case-insensitive)
    if lower.ends_with(":q4_0") {
        if name.len() > 5 {
            name = &name[..name.len()-5];
        }
    } else if lower.ends_with(":q4_k_m") {
        if name.len() > 7 {
            name = &name[..name.len()-7];
        }
    } else if lower.ends_with(":q4_k_s") {
        if name.len() > 7 {
            name = &name[..name.len()-7];
        }
    } else if lower.ends_with("-q4_0") {
        if name.len() > 5 {
            name = &name[..name.len()-5];
        }
    } else if lower.ends_with("-q4_k_m") {
        if name.len() > 7 {
            name = &name[..name.len()-7];
        }
    } else if lower.ends_with("-q4_k_s") {
        if name.len() > 7 {
            name = &name[..name.len()-7];
        }
    }
    
    name.trim().to_lowercase()
}

#[test]
fn test_normalize_cases() {
    assert_eq!(normalize_model_name("registry.ollama.ai/library/llama3.2:1b-instruct-q4_0"), "llama3.2:1b-instruct");
    assert_eq!(normalize_model_name("hf.co/mradermacher/Qwen3.5-9B-Coder-GGUF:Q4_K_M"), "mradermacher/qwen3.5-9b-coder-gguf");
    assert_eq!(normalize_model_name("library/gemma4:12b"), "gemma4:12b");
    assert_eq!(normalize_model_name("custom-model:latest"), "custom-model:latest");
}
