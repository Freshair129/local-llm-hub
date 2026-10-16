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
    let parts = line.split(',').collect::<Vec<_>>();
    if parts.len() < 5 {
        return Err("insufficient columns".into());
    }

    let name = parts[0].trim().to_string();
    let vram_used_mb = match parts[1].trim().parse::<u64>() {
        Ok(v) => v,
        Err(_) => return Err("failed to parse vram_used_mb".into()),
    };
    let vram_total_mb = match parts[2].trim().parse::<u64>() {
        Ok(v) => v,
        Err(_) => return Err("failed to parse vram_total_mb".into()),
    };
    let temp_c = match parts[3].trim().parse::<u32>() {
        Ok(t) => t,
        Err(_) => return Err("failed to parse temp_c".into()),
    };
    let util_pct = match parts[4].trim().parse::<u32>() {
        Ok(u) => u,
        Err(_) => return Err("failed to parse util_pct".into()),
    };

    Ok(GpuStats { name, vram_used_mb, vram_total_mb, temp_c, util_pct })
}