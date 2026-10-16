// trace:implements FR-002

pub fn normalize_model_name(raw: &str) -> String {
    // Strip registry prefixes
    let mut raw = raw.replace("registry.ollama.ai/library/", "");
    raw = raw.replace("library/", "");

    // Strip quantization suffixes
    raw = raw.replace("-q4_0", "").replace("-q4_k_m", "").replace("-q4_k_s", "").replace(":q4_0", "").replace(":q4_k_m", "").replace(":q4_k_s", "");
    raw = raw.to_lowercase();

    raw
}