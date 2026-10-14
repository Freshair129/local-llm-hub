use std::str::FromStr;

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
    // Parse CSV line, handling whitespace around commas
    let fields: Vec<&str> = line.split(',').map(|s| s.trim()).collect();
    
    // Guard rail #1: Validate column count (strictly less than 5 columns is an error)
    if fields.len() < 5 {
        return Err(format!("Expected 5 CSV columns, found {}", fields.len()));
    }
    
    // Parse and validate vram_used_mb (u64)
    let vram_used_mb = u64::from_str(fields[1]).map_err(|e| format!("Failed to parse vram_used_mb '{}': {}", fields[1], e))?;
    
    // Parse and validate vram_total_mb (u64)
    let vram_total_mb = u64::from_str(fields[2]).map_err(|e| format!("Failed to parse vram_total_mb '{}': {}", fields[2], e))?;
    
    // Parse and validate temp_c (u32)
    let temp_c = u32::from_str(fields[3]).map_err(|e| format!("Failed to parse temp_c '{}': {}", fields[3], e))?;
    
    // Parse and validate util_pct (u32)
    let util_pct = u32::from_str(fields[4]).map_err(|e| format!("Failed to parse util_pct '{}': {}", fields[4], e))?;
    
    Ok(GpuStats {
        name: fields[0].to_string(),
        vram_used_mb,
        vram_total_mb,
        temp_c,
        util_pct,
    })
}