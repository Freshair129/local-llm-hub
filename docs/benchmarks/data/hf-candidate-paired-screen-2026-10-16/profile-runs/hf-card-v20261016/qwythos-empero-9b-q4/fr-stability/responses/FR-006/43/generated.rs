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
    let fields: Vec<&str> = line.split(',').collect();
    if fields.len() < 5 {
        return Err("Not enough columns".to_string());
    }
    let name = fields[0].trim().to_string();
    let vram_used_mb = fields[1].trim().parse::<u64>()
        .map_err(|_| "Failed to parse vram_used_mb")?;
    let vram_total_mb = fields[2].trim().parse::<u64>()
        .map_err(|_| "Failed to parse vram_total_mb")?;
    let temp_c = fields[3].trim().parse::<u32>()
        .map_err(|_| "Failed to parse temp_c")?;
    let util_pct = fields[4].trim().parse::<u32>()
        .map_err(|_| "Failed to parse util_pct")?;
    Ok(GpuStats { name, vram_used_mb, vram_total_mb, temp_c, util_pct })
}