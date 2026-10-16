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
    // Split line by comma and trim whitespace from each field
    let fields: Vec<&str> = line.split(',').map(|s| s.trim()).collect();
    
    // Validate minimum column count
    if fields.len() < 5 {
        return Err(format!("Insufficient columns: expected 5, found {}", fields.len()));
    }
    
    // Parse individual fields with error handling
    let name = fields[0].to_string();
    let vram_used_mb = fields[1].parse::<u64>()
        .map_err(|e| format!("Invalid vram_used_mb value: {}", e))?;
    let vram_total_mb = fields[2].parse::<u64>()
        .map_err(|e| format!("Invalid vram_total_mb value: {}", e))?;
    let temp_c = fields[3].parse::<u32>()
        .map_err(|e| format!("Invalid temp_c value: {}", e))?;
    let util_pct = fields[4].parse::<u32>()
        .map_err(|e| format!("Invalid util_pct value: {}", e))?;
    
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
