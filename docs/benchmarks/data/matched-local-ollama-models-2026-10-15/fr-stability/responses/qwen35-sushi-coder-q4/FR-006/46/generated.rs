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
    // Split by comma and trim whitespace from each field
    let fields: Vec<&str> = line.split(',').map(|s| s.trim()).collect();
    
    // Guard rail: Check column count without unwrap()
    if fields.len() < 5 {
        return Err(format!("Expected 5 columns, got {}", fields.len()));
    }
    
    // Parse each field with proper error handling
    let name = fields[0].to_string();
    let vram_used_mb = fields[1].parse::<u64>().map_err(|_| {
        format!("Failed to parse vram_used_mb: {}", fields[1])
    })?;
    
    let vram_total_mb = fields[2].parse::<u64>().map_err(|_| {
        format!("Failed to parse vram_total_mb: {}", fields[2])
    })?;
    
    let temp_c = fields[3].parse::<u32>().map_err(|_| {
        format!("Failed to parse temp_c: {}", fields[3])
    })?;
    
    let util_pct = fields[4].parse::<u32>().map_err(|_| {
        format!("Failed to parse util_pct: {}", fields[4])
    })?;
    
    // Return parsed struct
    Ok(GpuStats {
        name,
        vram_used_mb,
        vram_total_mb,
        temp_c,
        util_pct,
    })
}