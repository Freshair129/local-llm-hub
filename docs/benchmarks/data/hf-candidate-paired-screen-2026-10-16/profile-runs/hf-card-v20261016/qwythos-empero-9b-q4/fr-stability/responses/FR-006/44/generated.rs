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
    let parts: Vec<&str> = line.split(',').collect();
    
    if parts.len() < 5 {
        return Err(format!("Expected 5 CSV columns, got {}", parts.len()));
    }

    let name = parts[0].trim().to_string();
    
    let vram_used_mb = match u64::from_str(parts[1].trim()) {
        Ok(n) => n,
        Err(_) => return Err(format!("Failed to parse vram_used_mb: {}", parts[1])),
    };

    let vram_total_mb = match u64::from_str(parts[2].trim()) {
        Ok(n) => n,
        Err(_) => return Err(format!("Failed to parse vram_total_mb: {}", parts[2])),
    };

    let temp_c = match u32::from_str(parts[3].trim()) {
        Ok(n) => n,
        Err(_) => return Err(format!("Failed to parse temp_c: {}", parts[3])),
    };

    let util_pct = match u32::from_str(parts[4].trim()) {
        Ok(n) => n,
        Err(_) => return Err(format!("Failed to parse util_pct: {}", parts[4])),
    };

    Ok(GpuStats {
        name,
        vram_used_mb,
        vram_total_mb,
        temp_c,
        util_pct,
    })
}