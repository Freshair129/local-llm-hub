// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut name = raw.to_string();

    // Strip registry prefixes (case-insensitive matching for safety)
    let prefixes = [
        "registry.ollama.ai/library/",
        "library/",
        "hf.co/",
    ];

    for prefix in &prefixes {
        if name.to_lowercase().starts_with(prefix) {
            name = name[prefix.len()..].to_string();
            break;
        }
    }

    // Strip quantization suffixes (case-insensitive)
    let quant_suffixes = [
        "-q4_0", "-q4_k_m", "-q4_k_s",
        ":q4_0", ":q4_k_m", ":q4_k_s",
    ];

    for suffix in &quant_suffixes {
        if name.to_lowercase().ends_with(suffix) {
            name = name[..name.len() - suffix.len()].to_string();
            break;
        }
    }

    // Final lowercase conversion
    name.to_lowercase()
}