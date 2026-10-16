// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut name = raw.to_string();

    // Strip registry prefixes (case-sensitive)
    for prefix in &["registry.ollama.ai/library/", "library/", "hf.co/"] {
        if name.starts_with(prefix) {
            name = name.trim_start_matches(prefix);
        }
    }

    // Convert to lowercase
    name = name.to_lowercase();

    // Strip quantization suffixes (case-insensitive, already lowercased)
    let suffixes_lower = [
        "-q4_0", "-q4_k_m", "-q4_k_s", ":q4_0", ":q4_k_m", ":q4_k_s"
    ];
    for suffix in &suffixes_lower {
        if name.ends_with(suffix) {
            name = name.trim_end_matches(suffix);
        }
    }

    name
}