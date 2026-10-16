// trace:implements FR-002

pub fn normalize_model_name(raw: &str) -> String {
    let raw = raw
        .strip_prefix("registry.ollama.ai/library/")
        .unwrap()
        .strip_prefix("library/")
        .unwrap()
        .strip_prefix("hf.co/")
        .unwrap();

    let raw = raw.to_lowercase()
        .replace("-q4_0", "")
        .replace("-q4_k_m", "")
        .replace("-q4_k_s", "")
        .replace(":q4_0", "")
        .replace(":q4_k_m", "")
        .replace(":q4_k_s", "");

    raw
}