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
    // Split the CSV line into parts
    let mut parts: Vec<&str> = line.split(',').collect();
    
    // Validate column count (require at least 5 fields)
    if parts.len() < 5 {
        return Err(format!("CSV line has {} columns, expected at least 5", parts.len()));
    }
    
    // Extract and parse each field with error handling
    let name = parts[0].trim().to_string();
    
    let vram_used_mb: u64 = parts[1].trim().parse()
        .map_err(|e| format!("Failed to parse vram_used_mb value '{}': {}", parts[1], e))?;
    
    let vram_total_mb: u64 = parts[2].trim().parse()
        .map_err(|e| format!("Failed to parse vram_total_mb value '{}': {}", parts[2], e))?;
    
    let temp_c: u32 = parts[3].trim().parse()
        .map_err(|e| format!("Failed to parse temp_c value '{}': {}", parts[3], e))?;
    
    let util_pct: u32 = parts[4].trim().parse()
        .map_err(|e| format!("Failed to parse util_pct value '{}': {}", parts[4], e))?;
    
    Ok(GpuStats {
        name,
        vram_used_mb,
        vram_total_mb,
        temp_c,
        util_pct,
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
