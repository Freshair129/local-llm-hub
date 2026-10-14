// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut name = raw;

    // Strip registry prefixes
    if let Some(stripped) = name.strip_prefix("registry.ollama.ai/library/") {
        name = stripped;
    } else if let Some(stripped) = name.strip_prefix("library/") {
        name = stripped;
    } else if let Some(stripped) = name.strip_prefix("hf.co/") {
        name = stripped;
    }

    // Strip quantization suffixes (case-insensitive)
    let q_suffixes = ["-q4_0", "-q4_k_m", "-q4_k_s", ":q4_0", ":q4_k_m", ":q4_k_s"];
    for suffix in &q_suffixes {
        let lower_name = name.to_lowercase();
        let lower_suffix = suffix.to_lowercase();
        if lower_name.ends_with(&lower_suffix) {
            let end_index = lower_name.len() - lower_suffix.len();
            name = &lower_name[..end_index];
            break;
        }
    }

    // Convert result to lowercase
    name.to_lowercase()
}