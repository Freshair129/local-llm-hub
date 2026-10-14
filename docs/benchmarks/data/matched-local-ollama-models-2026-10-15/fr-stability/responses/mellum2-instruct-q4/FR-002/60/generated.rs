// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut result = raw;

    // Strip registry prefixes
    let prefixes = [
        "registry.ollama.ai/library/",
        "library/",
        "hf.co/",
    ];
    for prefix in &prefixes {
        if result.starts_with(prefix) {
            result = &result[prefix.len()..];
            break;
        }
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
        let lower_suffix = suffix.to_lowercase();
        let lower_result = result.to_lowercase();
        if lower_result.ends_with(&lower_suffix) {
            result = &result[..result.len() - suffix.len()];
            break;
        }
    }

    // Convert to lowercase
    result.to_lowercase()
}