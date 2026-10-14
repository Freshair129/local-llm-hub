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
    // Guard rail: NO unwrap(), expect(), or panic! - returning Err instead
    
    // Step 1: Split CSV line by comma
    let parts: Vec<&str> = line.split(',').collect();
    
    // Step 2: Validate column count (need exactly 5 fields)
    if parts.len() < 5 {
        return Err(format!("Expected 5 columns, found {}", parts.len()));
    }
    
    // Step 3: Parse each field with error handling
    let name = parts[0].trim().to_string();
    
    let vram_used_mb = parts[1].trim().parse::<u64>()
        .map_err(|_| format!("Failed to parse vram_used_mb: {}", parts[1]))?;
    
    let vram_total_mb = parts[2].trim().parse::<u64>()
        .map_err(|_| format!("Failed to parse vram_total_mb: {}", parts[2]))?;
    
    let temp_c = parts[3].trim().parse::<u32>()
        .map_err(|_| format!("Failed to parse temp_c: {}", parts[3]))?;
    
    let util_pct = parts[4].trim().parse::<u32>()
        .map_err(|_| format!("Failed to parse util_pct: {}", parts[4]))?;
    
    // Step 4: Validate parsed values are reasonable
    if vram_used_mb > vram_total_mb {
        return Err(format!("VRAM used ({}) cannot exceed total ({})", 
                           vram_used_mb, vram_total_mb));
    }
    
    if temp_c > 100 || util_pct > 100 {
        return Err(format!("Invalid values: temp_c={}, util_pct={}", temp_c, util_pct));
    }
    
    // Step 5: Return successful result
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
