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
    // Split CSV line by comma delimiter
    let parts: Vec<&str> = line.split(',').collect();
    
    // Check column count - must be exactly 5 fields
    if parts.len() != 5 {
        return Err(format!(
            "Invalid CSV format: expected 5 columns, found {}",
            parts.len()
        ));
    }
    
    // Trim whitespace from each field
    let name = parts[0].trim().to_string();
    let vram_used_str = parts[1].trim();
    let vram_total_str = parts[2].trim();
    let temp_str = parts[3].trim();
    let util_str = parts[4].trim();
    
    // Parse numeric fields with proper error handling
    let vram_used_mb = u64::from_str(vram_used_str)
        .map_err(|_| format!("Failed to parse vram_used_mb: '{}'", vram_used_str))?;
    
    let vram_total_mb = u64::from_str(vram_total_str)
        .map_err(|_| format!("Failed to parse vram_total_mb: '{}'", vram_total_str))?;
    
    let temp_c = u32::from_str(temp_str)
        .map_err(|_| format!("Failed to parse temp_c: '{}'", temp_str))?;
    
    let util_pct = u32::from_str(util_str)
        .map_err(|_| format!("Failed to parse util_pct: '{}'", util_str))?;
    
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
