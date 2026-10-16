// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut name = raw.to_string();

    // Strip registry prefixes
    if name.startswith("registry.ollama.ai/library/") {
        name = &name[21..];
    } else if name.startswith("library/") {
        name = &name[8..];
    } else if name.startswith("hf.co/") {
        name = &name[6..];
    }

    // Convert to lowercase (case-insensitive suffix matching)
    name = name.to_lowercase();

    // Strip quantization suffixes (longest first, then shorter)
    if name.ends_with("-q4_k_m") || name.ends_with(":q4_k_m") {
        name = &name[..name.len() - 7];
    } else if name.ends_with("-q4_k_s") {
        name = &name[..name.len() - 7];
    } else if name.ends_with("-q4_0") {
        name = &name[..name.len() - 5];
    } else if name.ends_with(":q4_k_s") {
        name = &name[..name.len() - 7];
    } else if name.ends_with(":q4_0") {
        name = &name[..name.len() - 5];
    }

    name
}