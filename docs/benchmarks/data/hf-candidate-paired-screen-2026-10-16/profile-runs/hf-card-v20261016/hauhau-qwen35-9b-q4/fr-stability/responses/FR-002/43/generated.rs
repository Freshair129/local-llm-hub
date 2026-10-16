// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut name = raw;

    // 2. Strip registry prefixes
    if name.starts_with("registry.ollama.ai/library/") {
        name = &name[27..];
    } else if name.starts_with("library/") {
        name = &name[8..];
    } else if name.starts_with("hf.co/") {
        name = &name[6..];
    }

    // 3. Strip quantization suffixes (case-insensitive)
    let lower_name = name.to_lowercase();
    let mut temp = lower_name;
    let suffixes = [
        "-q4_0", "-q4_k_m", "-q4_k_s",
        ":q4_0", ":q4_k_m", ":q4_k_s",
    ];
    for s in &suffixes {
        if temp.ends_with(s) {
            temp = &temp[..temp.len() - s.len()];
            break;
        }
    }

    // 4. Convert result to lowercase
    let result = temp.to_lowercase();

    result.to_string()
}