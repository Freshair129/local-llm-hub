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
    let parts: Vec<&str> = line.split(',').collect();
    if parts.len() < 5 {
        return Err("Invalid number of fields".to_string());
    }
    
    let name = parts[0].to_string();
    let vram_used_mb = parts[1].trim().parse::<u64>().map_err(|e| e.to_string())?;
    let vram_total_mb = parts[2].trim().parse::<u64>().map_err(|e| e.to_string())?;
    let temp_c = parts[3].trim().parse::<u32>().map_err(|e| e.to_string())?;
    let util_pct = parts[4].trim().parse::<u32>().map_err(|e| e.to_string())?;
    
    Ok(GpuStats {
        name,
        vram_used_mb,
        vram_total_mb,
        temp_c,
        util_pct,
    })
}