// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut result = raw.to_lowercase();

    // Strip registry prefixes
    result = result.replace("registry.ollama.ai/library/", "");
    result = result.replace("library/", "");
    result = result.replace("hf.co/", "");

    // Strip quantization suffixes
    result = result.replace("-q4_0", "");
    result = result.replace("-q4_k_m", "");
    result = result.replace("-q4_k_s", "");
    result = result.replace(":q4_0", "");
    result = result.replace(":q4_k_m", "");
    result = result.replace(":q4_k_s", "");

    result
}