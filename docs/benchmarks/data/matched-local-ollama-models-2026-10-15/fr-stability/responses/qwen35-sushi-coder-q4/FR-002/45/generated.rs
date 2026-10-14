// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut name = raw.to_lowercase();

    // Strip registry prefixes
    for prefix in ["registry.ollama.ai/library/", "library/", "hf.co/"] {
        if name.starts_with(prefix) {
            name = name[prefix.len()..].to_string();
            break;
        }
    }

    // Strip quantization suffixes (case-insensitive)
    for suffix in ["-q4_0", "-q4_k_m", "-q4_k_s", ":q4_0", ":q4_k_m", ":q4_k_s"] {
        if name.ends_with(suffix) {
            name = name[..name.len() - suffix.len()].to_string();
            break;
        }
    }

    name
}