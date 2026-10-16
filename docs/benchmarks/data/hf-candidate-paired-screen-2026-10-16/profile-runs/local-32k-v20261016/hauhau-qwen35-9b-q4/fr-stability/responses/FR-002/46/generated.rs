// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut name = raw.to_lowercase();

    // Strip registry prefixes
    if name.starts_with("registry.ollama.ai/library/") {
        name = name["registry.ollama.ai/library/".len()..].to_string();
    } else if name.starts_with("hf.co/") {
        name = name["hf.co/".len()..].to_string();
        if name.starts_with("library/") {
            name = name["library/".len()..].to_string();
        }
    } else if name.starts_with("library/") {
        name = name["library/".len()..].to_string();
    }

    // Strip quantization suffixes
    let suffixes = [
        "-q4_0", "-q4_k_m", "-q4_k_s",
        ":q4_0", ":q4_k_m", ":q4_k_s",
    ];
    for suffix in suffixes {
        if name.ends_with(suffix) {
            name = name[..name.len() - suffix.len()].to_string();
            break;
        }
    }

    name
}