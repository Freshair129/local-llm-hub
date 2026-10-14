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
    // Split by comma and filter empty strings
    let fields: Vec<&str> = line.split(',').filter(|s| !s.trim().is_empty()).collect();
    
    // Guard rail: check column count before attempting parse
    if fields.len() < 5 {
        return Err(format!("Expected 5 columns, found {}", fields.len()));
    }
    
    // Parse each field with individual error handling
    let name = fields[0].trim().to_string();
    let vram_used = fields[1].trim().parse::<u64>()
        .map_err(|e| format!("Failed to parse vram_used: {}", e))?;
    let vram_total = fields[2].trim().parse::<u64>()
        .map_err(|e| format!("Failed to parse vram_total: {}", e))?;
    let temp = fields[3].trim().parse::<u32>()
        .map_err(|e| format!("Failed to parse temp: {}", e))?;
    let util = fields[4].trim().parse::<u32>()
        .map_err(|e| format!("Failed to parse util_pct: {}", e))?;
    
    Ok(GpuStats {
        name,
        vram_used_mb: vram_used,
        vram_total_mb: vram_total,
        temp_c: temp,
        util_pct: util,
    })
}