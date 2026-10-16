// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> String {
    let mut s = raw.to_lowercase();
    // Strip registry prefixes (case-insensitive for letters, but we already lowercased)
    for prefix in &['registry.ollama.ai/library/', 'library/', 'hf.co/'] {
        if let Some(stripped) = s.strip_prefix(prefix) {
            s = stripped;
        }
    }
    // Strip quantization suffixes (case-insensitive)
    let suffixes = [
        '-q4_0', '-q4_k_m', '-q4_k_s', ':q4_0', ':q4_k_m', ':q4_k_s'
    ];
    for suffix in &suffixes {
        if let Some(stripped) = s.strip_suffix(suffix) {
            s = stripped;
        }
    }
    s
}