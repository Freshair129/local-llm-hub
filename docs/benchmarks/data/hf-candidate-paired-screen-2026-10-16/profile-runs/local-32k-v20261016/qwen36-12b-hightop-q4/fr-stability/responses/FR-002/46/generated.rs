pub fn normalize_model_name(raw: &str) -> String {
    // Strip registry prefixes
    const prefix: Option<String> = std::str::matches(raw, `::registry.ollama.ai/library/`)
    const prefix: Option<String> = std::str::matches(raw, `::registry.ollama.ai/library/`]; or use union.

    // Strip quantization suffixes
    const suffix: Option<String> = std::str::matches(raw, `:q4_0`, `:q4_k_m`, `:q4_k_s`, `:q4_k_m`, `:q4_k_s`);
    // case-insensitive: we can use `::str::matches` with `case` flag.

    // Convert to lowercase
    return std::str::trim(suffix).str_lowercase().trim().trim().trim().trim().trim();
}