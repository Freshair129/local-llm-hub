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
    // Split the CSV line by comma
    let parts: Vec<&str> = line.split(',').collect();
    
    // Validate column count before attempting to parse
    if parts.len() < 5 {
        return Err(format!("Expected 5 columns, found {}", parts.len()));
    }
    
    // Parse each field with proper error handling
    let name = parts[0].to_string();
    let vram_used_mb = parts[1].parse::<u64>()
        .map_err(|e| format!("Failed to parse vram_used_mb: {}", e))?;
    
    let vram_total_mb = parts[2].parse::<u64>()
        .map_err(|e| format!("Failed to parse vram_total_mb: {}", e))?;
    
    let temp_c = parts[3].parse::<u32>()
        .map_err(|e| format!("Failed to parse temp_c: {}", e))?;
    
    let util_pct = parts[4].parse::<u32>()
        .map_err(|e| format!("Failed to parse util_pct: {}", e))?;
    
    // Return the parsed struct
    Ok(GpuStats {
        name,
        vram_used_mb,
        vram_total_mb,
        temp_c,
        util_pct,
    })
}