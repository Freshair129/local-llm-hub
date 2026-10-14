// trace:implements FR-006
#[derive(Debug, PartialEq)]
pub struct GpuStats {
    pub name: String,
    pub vram_used_mb: u64,
    pub vram_total_mb: u64,
    pub temp_c: u32,
    pub util_pct: u32,
}

pub fn parse_gpu_csv(line: &str) -> Result<GpuStats, String> {
    // 1. Check for null or empty input
    if line.is_empty() {
        return Err("Input line is empty".to_string());
    }

    // 2. Split the line by comma
    let mut parts: Vec<&str> = line.split(',').collect();

    // 3. Guard rail: Check column count (must be exactly 5)
    if parts.len() != 5 {
        return Err(format!(
            "Expected 5 columns, found {}. Input: {}",
            parts.len(),
            line
        ));
    }

    // 4. Parse integers with error handling (no unwrap/expect)
    let vram_used: u64 = parts[1].trim().parse().map_err(|e| format!("Failed to parse vram_used: {}", e))?;
    let vram_total: u64 = parts[2].trim().parse().map_err(|e| format!("Failed to parse vram_total: {}", e))?;
    let temp: u32 = parts[3].trim().parse().map_err(|e| format!("Failed to parse temp: {}", e))?;
    let util: u32 = parts[4].trim().parse().map_err(|e| format!("Failed to parse util: {}", e))?;

    // 5. Construct and return the struct
    Ok(GpuStats {
        name: parts[0].trim().to_string(),
        vram_used_mb: vram_used,
        vram_total_mb: vram_total,
        temp_c: temp,
        util_pct: util,
    })
}

#[test]
fn test_parse_valid_csv() {
    let res = parse_gpu_csv("NVIDIA GeForce RTX 3060, 5800, 12288, 35, 25");
    assert!(res.is_ok());
    let stats = res.unwrap();
    assert_eq!(stats.name, "NVIDIA GeForce RTX 3060");
    assert_eq!(stats.vram_used_mb, 5800);
    assert_eq!(stats.vram_total_mb, 12288);
    assert_eq!(stats.temp_c, 35);
    assert_eq!(stats.util_pct, 25);
}

#[test]
fn test_parse_invalid_csv() {
    assert!(parse_gpu_csv("invalid,csv").is_err());
    assert!(parse_gpu_csv("GPU, not_a_number, 12288, 35, 25").is_err());
    assert!(parse_gpu_csv("").is_err());
}
