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
        return Err("fewer than 5 columns".to_string());
    }

    let name = parts[0];
    let vram_used = u64::parse(parts[1])
        .map_err(|e| format!("vram_used parse error: {}", e));
    let vram_total = u64::parse(parts[2])
        .map_err(|e| format!("vram_total parse error: {}", e));
    let temp = u32::parse(parts[3])
        .map_err(|e| format!("temp parse error: {}", e));
    let util = u32::parse(parts[4])
        .map_err(|e| format!("util parse error: {}", e));

    Ok(GpuStats {
        name,
        vram_used,
        vram_total,
        temp,
        util,
    })
}