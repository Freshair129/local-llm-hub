// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut name = raw.to_string();

    // 1. Strip registry prefixes
    let prefixes = [
        "registry.ollama.ai/library/",
        "hf.co/",
        "library/",
    ];
    for prefix in prefixes {
        if name.starts_with(prefix) {
            name = name[prefix.len()..].to_string();
        }
    }

    // 2. Strip quantization suffixes (case-insensitive)
    let lower_name = name.to_lowercase();
    let suffixes = [
        "-q4_0",
        "-q4_k_m",
        "-q4_k_s",
        ":q4_0",
        ":q4_k_m",
        ":q4_k_s",
    ];
    for suffix in suffixes {
        if lower_name.len() > suffix.len() && lower_name.ends_with(suffix) {
            name = lower_name[..lower_name.len() - suffix.len()].to_string();
        }
    }

    // 3. Convert result to lowercase
    name = name.to_lowercase();

    name
}