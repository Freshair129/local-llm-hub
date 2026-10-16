pub fn normalize_model_name(raw: &str) -> String {
    // trace:implements FR-002
    let mut s = raw;

    // Strip registry prefixes
    s = s.trim_start_matches("registry.ollama.ai/library/");
    s = s.trim_start_matches("library/");
    s = s.trim_start_matches("hf.co/");

    // Convert to lowercase
    let mut s = s.to_lowercase();

    // Strip quantization suffixes repeatedly
    loop {
        let mut s = s.clone();
        if s.ends_with("-q4_0") {
            s = s.trim_end_matches("-q4_0");
        } else if s.ends_with("-q4_k_m") {
            s = s.trim_end_matches("-q4_k_m");
        } else if s.ends_with("-q4_k_s") {
            s = s.trim_end_matches("-q4_k_s");
        } else if s.ends_with(":q4_0") {
            s = s.trim_end_matches(":q4_0");
        } else if s.ends_with(":q4_k_m") {
            s = s.trim_end_matches(":q4_k_m");
        } else if s.ends_with(":q4_k_s") {
            s = s.trim_end_matches(":q4_k_s");
        } else {
            break;
        }
        s = s.to_lowercase();
    }

    s
}