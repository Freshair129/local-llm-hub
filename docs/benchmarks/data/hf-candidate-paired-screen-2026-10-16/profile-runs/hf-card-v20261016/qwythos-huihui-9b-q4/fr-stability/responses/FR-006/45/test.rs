#[derive(Debug, PartialEq)]
pub struct GpuStats {
    pub name: String,
    pub vram_used_mb: u64,
    pub vram_total_mb: u64,
    pub temp_c: u32,
    pub util_pct: u32,
}

// trace:implements FR-006
pub fn parse_gpu_csv(line: &str) -> Result<GpuStats, String> {
    let mut parts = line.split(',').map(|s| s.trim());
    let name = parts.next()
        .ok_or("Expected at least 5 columns (name missing)")?;
    let vram_used = parts.next()
        .ok_or("Expected at least 5 columns (vram_used missing)")?
        .parse::<u64>()
        .map_err(|e| format!("Failed to parse vram_used: {}", e))?;
    let vram_total = parts.next()
        .ok_or("Expected at least 5 columns (vram_total missing)")?
        .parse::<u64>()
        .map_err(|e| format!("Failed to parse vram_total: {}", e))?;
    let temp = parts.next()
        .ok_or("Expected at least 5 columns (temp missing)")?
        .parse::<u32>()
        .map_err(|e| format!("Failed to parse temp: {}", e))?;
    let util = parts.next()
        .ok_or("Expected at least 5 columns (util missing)")?
        .parse::<u32>()
        .map_err(|e| format!("Failed to parse util: {}", e))?;

    Ok(GpuStats {
        name: name.to_string(),
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
