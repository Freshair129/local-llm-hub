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
    let columns: Vec<&str> = line.split(',').collect();

    if columns.len() < 5 {
        return Err("Not enough columns in the CSV line".to_string());
    }

    let name = columns[0].to_string();
    let vram_used_mb: u64 = columns[1].parse().map_err(|_| "Failed to parse VRAM used".to_string())?;
    let vram_total_mb: u64 = columns[2].parse().map_err(|_| "Failed to parse VRAM total".to_string())?;
    let temp_c: u32 = columns[3].parse().map_err(|_| "Failed to parse temperature".to_string())?;
    let util_pct: u32 = columns[4].parse().map_err(|_| "Failed to parse utilization".to_string())?;

    Ok(GpuStats { name, vram_used_mb, vram_total_mb, temp_c, util_pct })
}