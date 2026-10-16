pub fn normalize_model_name(raw: &str) -> String {
    // trace:implements FR-002
    // 1. Remove registry prefixes
    let raw = raw.replace("registry.ollama.ai/library/", "");
    raw.replace("library/", "");

    // 2. Remove quantization suffixes
    let raw = raw.to_lowercase().replace("-q4_0", "").replace("-q4_k_m", "").replace("-q4_k_s", "")
                              .replace(":q4_0", "").replace(":q4_k_m", "").replace(":q4_k_s", "");

    // 3. Convert to lowercase
    raw.to_lowercase()
}