// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut normalized = String::new();

    for c in raw.chars() {
        match c {
            'a'..='z' | 'A'..='Z' | '0'..='9' | '-' | '.' | '/' => normalized.push(c),
            _ => continue,
        }
    }

    let mut stripped_registry_prefixes = vec![
        "registry.ollama.ai/library/",
        "library/",
        "hf.co/",
    ];

    for prefix in stripped_registry_prefixes.iter() {
        if normalized.starts_with(prefix) {
            normalized = normalized.trim_start_matches(prefix).to_string();
        }
    }

    let mut stripped_quantization_suffixes = vec![
        "-q4_0",
        "-q4_k_m",
        "-q4_k_s",
        ":q4_0",
        ":q4_k_m",
        ":q4_k_s",
    ];

    for suffix in stripped_quantization_suffixes.iter() {
        if normalized.to_lowercase().ends_with(suffix) {
            normalized = normalized.trim_end_matches(suffix).to_string();
        }
    }

    normalized.to_lowercase()
}