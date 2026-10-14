pub fn normalize_model_name(raw: &str) -> Result<String, String> {
    // trace:implements FR-002

    // Step 1: Strip registry prefixes
    let after_prefix = raw
        .replace("registry.ollama.ai/library/", "")
        .replace("library/", "")
        .replace("hf.co/", "");

    // Step 2: Strip quantization suffixes (case-insensitive, both '-' and ':' prefixes)
    let after_suffixes = after_prefix
        .to_lowercase()  // Convert to lowercase for case-insensitive matching
        .replace("-q4_0", "")
        .replace("-q4_k_m", "")
        .replace("-q4_k_s", "")
        .replace(":q4_0", "")
        .replace(":q4_k_m", "")
        .replace(":q4_k_s", "");

    // Step 3: Convert to lowercase (already done via to_lowercase above, but explicit for clarity)
    let normalized = after_suffixes.to_lowercase();

    // Return result - no panic/unwrap/expect used
    Ok(normalized)
}