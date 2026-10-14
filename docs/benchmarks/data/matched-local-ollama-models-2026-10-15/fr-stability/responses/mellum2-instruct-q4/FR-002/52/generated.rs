// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut result = raw.to_string();

    // Strip registry prefixes
    if result.starts_with("registry.ollama.ai/library/") {
        result = result["registry.ollama.ai/library/".len()..].to_string();
    } else if result.starts_with("library/") {
        result = result["library/".len()..].to_string();
    } else if result.starts_with("hf.co/") {
        result = result["hf.co/".len()..].to_string();
    }

    // Strip quantization suffixes (case-insensitive)
    let suffixes = [
        "-q4_0",
        "-q4_k_m",
        "-q4_k_s",
        ":q4_0",
        ":q4_k_m",
        ":q4_k_s",
    ];

    for suffix in &suffixes {
        let lower_result = result.to_lowercase();
        let lower_suffix = suffix.to_lowercase();
        if lower_result.ends_with(&lower_suffix) {
            result = lower_result[..lower_result.len() - lower_suffix.len()].to_string();
            break;
        }
    }

    // Convert result to lowercase
    result.to_lowercase()
}