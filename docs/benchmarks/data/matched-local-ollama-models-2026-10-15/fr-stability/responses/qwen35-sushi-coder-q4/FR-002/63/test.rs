// trace:implements FR-002
pub fn normalize_model_name(raw: &str) -> Option<String> {
    // Strip quantization suffixes first (case-insensitive)
    let suffixes = ["-q4_0", "-q4_k_m", "-q4_k_s", ":q4_0", ":q4_k_m", ":q4_k_s"];
    let mut normalized = raw;
    
    for suffix in &suffixes {
        if normalized.ends_ignore_case(suffix) {
            normalized = &normalized[..normalized.len() - suffix.len()];
        }
    }
    
    // Strip registry prefixes
    let prefixes = ["registry.ollama.ai/library/", "library/", "hf.co/"];
    for prefix in &prefixes {
        if normalized.starts_with(prefix) {
            normalized = &normalized[prefix.len()..];
        }
    }
    
    // Trim whitespace (defensive)
    normalized = normalized.trim();
    
    // Convert to lowercase
    let result = normalized.to_lowercase();
    
    // Validate: model name must not be empty
    if result.is_empty() {
        return None;
    }
    
    Some(result)
}

// Helper method for case-insensitive end matching (no unwrap/panic)
trait EndsIgnoreCase {
    fn ends_ignore_case(&self, suffix: &str) -> bool;
}

impl EndsIgnoreCase for str {
    fn ends_ignore_case(&self, suffix: &str) -> bool {
        if self.len() < suffix.len() {
            return false;
        }
        let slice = &self[self.len() - suffix.len()..];
        slice.eq_ignore_ascii_case(suffix)
    }
}

#[test]
fn test_normalize_cases() {
    assert_eq!(normalize_model_name("registry.ollama.ai/library/llama3.2:1b-instruct-q4_0"), "llama3.2:1b-instruct");
    assert_eq!(normalize_model_name("hf.co/mradermacher/Qwen3.5-9B-Coder-GGUF:Q4_K_M"), "mradermacher/qwen3.5-9b-coder-gguf");
    assert_eq!(normalize_model_name("library/gemma4:12b"), "gemma4:12b");
    assert_eq!(normalize_model_name("custom-model:latest"), "custom-model:latest");
}
