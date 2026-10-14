// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut name = raw.to_string();

    // 1. Strip registry prefixes (case-insensitive)
    let prefixes = ["registry.ollama.ai/library/", "library/", "hf.co/"];
    for prefix in prefixes.iter() {
        if let Some(stripped) = name.strip_prefix(*prefix) {
            name = stripped.to_string();
            break;
        }
    }

    // 2. Strip quantization suffixes (case-insensitive)
    let quant_suffixes = ["-q4_0", "-q4_k_m", "-q4_k_s", ":q4_0", ":q4_k_m", ":q4_k_s"];
    for suffix in quant_suffixes.iter() {
        if let Some(stripped) = name.strip_suffix(*suffix) {
            name = stripped.to_string();
            break;
        }
    }

    // 3. Convert to lowercase
    name.to_lowercase()
}