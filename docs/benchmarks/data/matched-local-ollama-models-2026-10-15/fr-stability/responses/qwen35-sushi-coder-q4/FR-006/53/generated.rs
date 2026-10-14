// trace:implements FR-006
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
    // Split CSV line by comma delimiter
    let fields: Vec<&str> = line.split(',').collect();
    
    // Guard rail: Check minimum column count without unwrap
    if fields.len() < 5 {
        return Err(format!("Expected 5 fields, got {}", fields.len()));
    }
    
    // Trim whitespace from each field
    let name = fields[0].trim().to_string();
    let vram_used_str = fields[1].trim();
    let vram_total_str = fields[2].trim();
    let temp_str = fields[3].trim();
    let util_str = fields[4].trim();
    
    // Parse VRAM used - guard rail: use parse_or_default pattern
    let vram_used_mb = vram_used_str
        .parse::<u64>()
        .map_err(|_| format!("Invalid vram_used value: {}", vram_used_str))?;
    
    // Parse VRAM total - guard rail: use parse_or_default pattern
    let vram_total_mb = vram_total_str
        .parse::<u64>()
        .map_err(|_| format!("Invalid vram_total value: {}", vram_total_str))?;
    
    // Parse temperature - guard rail: use parse_or_default pattern
    let temp_c = temp_str
        .parse::<u32>()
        .map_err(|_| format!("Invalid temp value: {}", temp_str))?;
    
    // Parse utilization - guard rail: use parse_or_default pattern
    let util_pct = util_str
        .parse::<u32>()
        .map_err(|_| format!("Invalid util value: {}", util_str))?;
    
    Ok(GpuStats {
        name,
        vram_used_mb,
        vram_total_mb,
        temp_c,
        util_pct,
    })
}