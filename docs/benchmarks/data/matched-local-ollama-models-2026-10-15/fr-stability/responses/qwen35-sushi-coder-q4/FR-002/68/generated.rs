// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    // Convert input to lowercase first to make suffix matching case-insensitive
    // This also handles the "convert result to lowercase" requirement
    let mut name = raw.to_lowercase();

    // Strip quantization suffixes: case-insensitive check
    // The spec says case-insensitive, so we check if the suffix appears anywhere
    let quant_suffixes = [
        "-q4_0", "-q4_k_m", "-q4_k_s",
        ":q4_0", ":q4_k_m", ":q4_k_s",
    ];

    // Check if any quantization suffix is present and remove it
    for suffix in quant_suffixes.iter() {
        if name.contains(suffix) {
            name = name.replace(suffix, "");
        }
    }

    // Strip registry prefixes
    let registry_prefixes = [
        "registry.ollama.ai/library/",
        "library/",
        "hf.co/",
    ];

    for prefix in registry_prefixes.iter() {
        if name.starts_with(prefix) {
            name = name.trim_start_matches(prefix);
        }
    }

    // Final trim in case any prefix was at the start without matching exactly
    name = name.trim().to_string();

    name
}