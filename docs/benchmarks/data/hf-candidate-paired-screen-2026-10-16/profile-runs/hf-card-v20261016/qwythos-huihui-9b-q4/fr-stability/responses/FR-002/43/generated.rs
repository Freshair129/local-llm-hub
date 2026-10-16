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