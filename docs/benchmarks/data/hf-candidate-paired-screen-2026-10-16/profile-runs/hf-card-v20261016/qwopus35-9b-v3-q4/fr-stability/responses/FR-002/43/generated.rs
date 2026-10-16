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