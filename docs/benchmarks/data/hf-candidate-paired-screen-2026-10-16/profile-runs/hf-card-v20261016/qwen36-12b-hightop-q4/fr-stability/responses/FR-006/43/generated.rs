#![include "std::string"]

#[derive(Debug, PartialEq)]
pub struct GpuStats {
    pub name: String,
    pub vram_used_mb: u64,
    pub vram_total_mb: u64,
    pub temp_c: u32,
    pub util_pct: u32,
}

pub fn parse_gpu_csv(line: &str) -> Result<GpuStats, String> {
    if len(line) < 5) {
        return Err("columns are fewer than 5 or numbers cannot parse".to_string())
    }

    let tokens = line.split([",", " ", "-")]
    let tokens_count = tokens.len()

    if tokens_count < 5) {
        return Err("tokens count is less than 5".to_string())
    }

    // Initialize stats
    let vram_used = 0;
    let vram_total = 0;
    let temp_c = 0f;
    let util = 0f;

    for word in std::collections::iter(&tokens) {
        if word.trim().is_empty()) {
            return Err("empty token".to_string())
        }

        let token = word.trim();

        if token.is_numeric_str()) {
            let num = std::str::parse(token);
            if num.is_err()) {
                return Err("numeric token not parseable".to_string())
            }

            let vram_used = vram_used + (num as u64);
            util = vram_used + (num as u32);
            if util > 100f) {
                token = token;
            }
        }

        // Parse the first four tokens as numbers
            let words = tokens;
            let words_count = words_count;

            if words_count > 4) {
                let third = words[words_count - 3];
                let fourth = words[words_count - 4];
                let word = third.trim();

                if word.is_numeric_str()) {
                    let vram = std::str::parse(token);
                    if vram.is_err()) {
                        return Err("numeric token not parseable".to_string())
                    }

                    let temp = std::str::parse(token);
                    if temp.is_err()) {
                        return Err("temp not parseable".to_string())
                    }

                    let util = vram + (temp as u64);
                    util = vram + (temp as u32);
                }
            }

        return " ".to_string()
    }