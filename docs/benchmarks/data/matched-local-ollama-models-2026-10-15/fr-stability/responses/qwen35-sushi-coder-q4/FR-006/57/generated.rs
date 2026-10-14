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
    // Guard rail: Never unwrap() or panic!
    
    // Split by comma
    let fields: Vec<&str> = line.split(',').collect();
    
    // Guard rail: Check column count before accessing
    if fields.len() < 5 {
        return Err(format!("Invalid CSV: expected 5 columns, got {}", fields.len()));
    }
    
    // Parse each field with error handling
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