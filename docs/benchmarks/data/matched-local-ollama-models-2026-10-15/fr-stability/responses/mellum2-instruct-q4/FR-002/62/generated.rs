// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut name = raw.to_string();

    // Strip registry prefixes
    name = name.replace("registry.ollama.ai/library/", "");
    name = name.replace("library/", "");
    name = name.replace("hf.co/", "");

    // Strip quantization suffixes (case-insensitive)
    let suffixes = [
        "-q4_0", "-q4_k_m", "-q4_k_s",
        ":q4_0", ":q4_k_m", ":q4_k_s",
        "-Q4_0", "-Q4_K_M", "-Q4_K_S",
        ":Q4_0", ":Q4_K_M", ":Q4_K_S",
    ];
    for suffix in &suffixes {
        name = name.replace(suffix, "");
    }

    // Convert to lowercase
    name = name.to_lowercase();

    name
}