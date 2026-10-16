// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut name = raw.to_string();

    // 2. Strip registry prefixes
    // Order matters to handle nested prefixes (e.g., "registry.../library/" contains "library/")
    name = name.replace("registry.ollama.ai/library/", "");
    name = name.replace("library/", "");
    name = name.replace("hf.co/", "");

    // 3. Strip quantization suffixes (case-insensitive)
    // Prepare a lowercase copy for consistent suffix matching
    let mut trimmed = name.to_lowercase();
    let suffixes = [
        "-q4_0", "-q4_k_m", "-q4_k_s",
        ":q4_0", ":q4_k_m", ":q4_k_s",
    ];

    for suffix in &suffixes {
        if trimmed.ends_with(suffix) {
            trimmed = trimmed[..trimmed.len() - suffix.len()].to_string();
        }
    }

    // 4. Convert result to lowercase
    // trimmed is already lowercase from the preparation step above
    trimmed
}