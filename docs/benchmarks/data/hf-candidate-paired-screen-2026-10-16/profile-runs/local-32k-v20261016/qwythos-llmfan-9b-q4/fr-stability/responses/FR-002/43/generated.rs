// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut name = raw;
    // Strip registry prefixes
    if name.starts_with("registry.ollama.ai/library/") {
        name = &name["registry.ollama.ai/library/".len()..];
    }
    if name.starts_with("library/") {
        name = &name["library/".len()..];
    }
    if name.starts_with("hf.co/") {
        name = &name["hf.co/".len()..];
    }
    // Strip quantization suffixes (case-insensitive)
    let suffixes = ["-q4_0", "-q4_k_m", "-q4_k_s", ":q4_0", ":q4_k_m", ":q4_k_s"];
    for suffix in suffixes {
        if name.to_lowercase().ends_with(&suffix.to_lowercase()) {
            let suffix_len = suffix.len();
            name = &name[..name.len() - suffix_len];
        }
    }
    // Convert to lowercase
    name = name.to_lowercase();
    name.into()
}