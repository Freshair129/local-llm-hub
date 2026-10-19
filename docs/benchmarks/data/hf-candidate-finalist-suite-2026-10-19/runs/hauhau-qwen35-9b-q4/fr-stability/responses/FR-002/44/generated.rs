// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut name = raw.to_lowercase();

    // Strip registry prefixes
    if name.starts_with("registry.ollama.ai/library/") {
        let prefix_len = "registry.ollama.ai/library/".len();
        name = name[prefix_len..].to_string();
    }
    if name.starts_with("library/") {
        let prefix_len = "library/".len();
        name = name[prefix_len..].to_string();
    }
    if name.starts_with("hf.co/") {
        let prefix_len = "hf.co/".len();
        name = name[prefix_len..].to_string();
    }

    // Strip quantization suffixes (case-insensitive handled by initial to_lowercase)
    let suffixes = ["-q4_0", "-q4_k_m", "-q4_k_s", ":q4_0", ":q4_k_m", ":q4_k_s"];
    for suffix in suffixes {
        if name.ends_with(suffix) {
            let suffix_len = suffix.len();
            name = name[..name.len() - suffix_len].to_string();
            break;
        }
    }

    name
}