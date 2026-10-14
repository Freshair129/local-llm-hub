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
    // Split the CSV line by comma delimiter
    let parts: Vec<&str> = line.split(',').collect();
    
    // Guard rail: Check for minimum 5 columns
    if parts.len() < 5 {
        return Err(format!("Expected 5 columns, found {} in: '{}'", parts.len(), line));
    }
    
    // Parse name (string - no trimming needed for CSV field)
    let name = parts[0].to_string();
    
    // Parse vram_used_mb
    let vram_used: Result<u64, _> = parts[1].trim().parse();
    let vram_used = vram_used.map_err(|_| format!("Failed to parse vram_used_mb from: '{}'", parts[1]))?;
    
    // Parse vram_total_mb
    let vram_total: Result<u64, _> = parts[2].trim().parse();
    let vram_total = vram_total.map_err(|_| format!("Failed to parse vram_total_mb from: '{}'", parts[2]))?;
    
    // Parse temp_c
    let temp: Result<u32, _> = parts[3].trim().parse();
    let temp = temp.map_err(|_| format!("Failed to parse temp_c from: '{}'", parts[3]))?;
    
    // Parse util_pct
    let util: Result<u32, _> = parts[4].trim().parse();
    let util = util.map_err(|_| format!("Failed to parse util_pct from: '{}'", parts[4]))?;
    
    Ok(GpuStats {
        name,
        vram_used_mb: vram_used,
        vram_total_mb: vram_total,
        temp_c: temp,
        util_pct: util,
    })
}