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