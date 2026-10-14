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
    // Split CSV line by comma
    let parts: Vec<&str> = line.split(',').collect();
    
    // Guard rail: Return Err if fewer than 5 columns
    if parts.len() < 5 {
        return Err(format!("Invalid CSV format: expected 5 fields, got {}", parts.len()));
    }
    
    // Parse name (field 0)
    let name = parts[0].trim().to_string();
    
    // Parse vram_used_mb (field 1)
    let vram_used: u64 = parts[1].trim().parse()
        .map_err(|_| format!("Failed to parse vram_used: {}", parts[1]))?;
    
    // Parse vram_total_mb (field 2)
    let vram_total: u64 = parts[2].trim().parse()
        .map_err(|_| format!("Failed to parse vram_total: {}", parts[2]))?;
    
    // Parse temp_c (field 3)
    let temp: u32 = parts[3].trim().parse()
        .map_err(|_| format!("Failed to parse temp_c: {}", parts[3]))?;
    
    // Parse util_pct (field 4)
    let util: u32 = parts[4].trim().parse()
        .map_err(|_| format!("Failed to parse util_pct: {}", parts[4]))?;
    
    // Return the parsed struct
    Ok(GpuStats {
        name,
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
