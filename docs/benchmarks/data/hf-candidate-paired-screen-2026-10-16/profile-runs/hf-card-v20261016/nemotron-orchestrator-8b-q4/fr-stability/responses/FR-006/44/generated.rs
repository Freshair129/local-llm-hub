// trace:implements FR-006
pub struct GpuStats {
    pub name: String,
    pub vram_used_mb: u64,
    pub vram_total_mb: u64,
    pub temp_c: u32,
    pub util_pct: u32,
}

pub fn parse_gpu_csv(line: &str) -> Result<GpuStats, String> {
    // Split the line into components
    let parts: Vec<&str> = line.split(',').collect();
    
    // Validate there are exactly 5 columns
    if parts.len() < 5 {
        return Err(format!("Expected 5 columns, found {}", parts.len()));
    }
    
    // Parse each field with strict error handling
    let name = parts[0].trim();
    
    let vram_used_mb = parts[1]
        .trim()
        .parse::<u64>()
        .map_err(|_| "Invalid VRAM used format".to_string())?;
    
    let vram_total_mb = parts[2]
        .trim()
        .parse::<u64>()
        .map_err(|_| "Invalid VRAM total format".to_string())?;
    
    let temp_c = parts[3]
        .trim()
        .parse::<u32>()
        .map_err(|_| "Invalid temperature format".to_string())?;
    
    let util_pct = parts[4]
        .trim()
        .parse::<u32>()
        .map_err(|_| "Invalid utilization format".to_string())?;
    
    Ok(GpuStats {
        name: name.to_string(),
        vram_used_mb,
        vram_total_mb,
        temp_c,
        util_pct,
    })
}