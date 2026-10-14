pub fn normalize_model_name(raw: &str) -> String {
    // trace:implements FR-002
    let mut name = raw;

    // Strip registry prefixes (case-insensitive for safety)
    let prefixes = [
        "registry.ollama.ai/library/",
        "library/",
        "hf.co/",
    ];

    for prefix in prefixes.iter() {
        if let Some(stripped) = name.strip_prefix(prefix) {
            name = stripped;
            break;
        }
    }

    // Strip quantization suffixes (case-insensitive)
    let quant_suffixes = [
        "-q4_0", "-q4_k_m", "-q4_k_s",
        ":q4_0", ":q4_k_m", ":q4_k_s",
    ];

    for suffix in quant_suffixes.iter() {
        if let Some(stripped) = name.strip_suffix(suffix) {
            name = stripped;
            break;
        }
    }

    // Convert to lowercase
    name.to_lowercase()
}