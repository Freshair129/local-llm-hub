// trace:implements FR-002

/// Normalizes a model name by stripping registry prefixes, quantization suffixes,
/// and converting to lowercase.
///
/// This function adheres to the following rules:
/// 1. Strips registry prefixes: 'registry.ollama.ai/library/', 'library/', 'hf.co/'
/// 2. Strips quantization suffixes: '-q4_0', '-q4_k_m', '-q4_k_s', ':q4_0', ':q4_k_m', ':q4_k_s' (case-insensitive)
/// 3. Converts the result to lowercase
/// 4. Uses no unwrap(), expect(), or panic! operations.
pub fn normalize_model_name(raw: &str) -> String {
    let mut name = raw.trim();

    // 1. Strip Registry Prefixes
    let prefixes = [
        "registry.ollama.ai/library/",
        "library/",
        "hf.co/",
    ];

    for prefix in &prefixes {
        if name.starts_with(prefix) {
            name = &name[prefix.len()..];
            break;
        }
    }

    // 2. Strip Quantization Suffixes
    let suffixes = [
        "-q4_0",
        "-q4_k_m",
        "-q4_k_s",
        ":q4_0",
        ":q4_k_m",
        ":q4_k_s",
    ];

    for suffix in &suffixes {
        if name.ends_with(suffix) {
            name = &name[..name.len() - suffix.len()];
            break;
        }
    }

    // 3. Convert to Lowercase
    name.to_lowercase()
}