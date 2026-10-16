// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut s = raw;
    
    // Strip registry prefixes (loop to handle multiple prefixes)
    loop {
        if s.starts_with("registry.ollama.ai/library/") {
            s = &s[22..];
        } else if s.starts_with("library/") {
            s = &s[8..];
        } else if s.starts_with("hf.co/") {
            s = &s[6..];
        } else {
            break;
        }
    }
    
    // Strip quantization suffixes (case-insensitive)
    loop {
        let lower_s = s.to_lowercase();
        let suffixes = ["-q4_0", "-q4_k_m", "-q4_k_s", ":q4_0", ":q4_k_m", ":q4_k_s"];
        
        let mut matched = false;
        for suffix in &suffixes {
            if lower_s.ends_with(*suffix) {
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