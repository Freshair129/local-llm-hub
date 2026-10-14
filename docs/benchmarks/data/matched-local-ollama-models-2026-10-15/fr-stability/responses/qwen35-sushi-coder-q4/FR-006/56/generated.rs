// trace:implements FR-006
pub struct GpuStats {
    pub name: String,
    pub vram_used_mb: u64,
    pub vram_total_mb: u64,
    pub temp_c: u32,
    pub util_pct: u32,
}

// trace:implements FR-006
pub fn parse_gpu_csv(line: &str) -> Result<GpuStats, String> {
    // Guard rail: never unwrap/expect/panic, use Result pattern
    
    // Step 1: Split CSV line by comma
    let parts: Vec<&str> = line.split(',').collect();
    
    // Guard rail: check column count before parsing
    if parts.len() < 5 {
        return Err(format!("Expected 5 columns, found {}", parts.len()));
    }
    
    // Step 2: Parse each field with proper error handling
    let name = parts[0].trim().to_string();
    
    let vram_used_mb = match parts[1].trim().parse::<u64>() {
        Ok(val) => val,
        Err(_) => return Err(format!("Failed to parse vram_used_mb: '{}'", parts[1])),
    };
    
    let vram_total_mb = match parts[2].trim().parse::<u64>() {
        Ok(val) => val,
        Err(_) => return Err(format!("Failed to parse vram_total_mb: '{}'", parts[2])),
    };
    
    let temp_c = match parts[3].trim().parse::<u32>() {
        Ok(val) => val,
        Err(_) => return Err(format!("Failed to parse temp_c: '{}'", parts[3])),
    };
    
    let util_pct = match parts[4].trim().parse::<u32>() {
        Ok(val) => val,
        Err(_) => return Err(format!("Failed to parse util_pct: '{}'", parts[4])),
    };
    
    // Return successfully parsed struct
    Ok(GpuStats {
        name,
        vram_used_mb,
        vram_total_mb,
        temp_c,
        util_pct,
    })
}