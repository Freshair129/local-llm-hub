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