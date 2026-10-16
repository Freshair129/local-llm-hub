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
    // Split by comma and trim whitespace from each field
    let fields: Vec<&str> = line.split(',').map(|s| s.trim()).collect();
    
    // Check if we have at least 5 fields
    if fields.len() < 5 {
        return Err(format!("Expected at least 5 fields, got {}", fields.len()));
    }
    
    // Parse each field with proper error handling
    let name = fields[0].to_string();
    let vram_used_mb: u64 = fields[1].parse()
        .map_err(|_| format!("Failed to parse vram_used_mb: '{}' (got: {})", fields[1], fields[1]))?;
    let vram_total_mb: u64 = fields[2].parse()
        .map_err(|_| format!("Failed to parse vram_total_mb: '{}' (got: {})", fields[2], fields[2]))?;
    let temp_c: u32 = fields[3].parse()
        .map_err(|_| format!("Failed to parse temp_c: '{}' (got: {})", fields[3], fields[3]))?;
    let util_pct: u32 = fields[4].parse()
        .map_err(|_| format!("Failed to parse util_pct: '{}' (got: {})", fields[4], fields[4]))?;
    
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
