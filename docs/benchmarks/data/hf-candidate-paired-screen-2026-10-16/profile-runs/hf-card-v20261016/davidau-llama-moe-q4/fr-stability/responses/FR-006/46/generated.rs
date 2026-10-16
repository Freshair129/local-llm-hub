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
    // trace:implements FR-006
    let mut parts = line.split(',');
    if parts.len() < 5 {
        return Err("Invalid number of columns in CSV line".to_string());
    }

    let name = parts.next().ok_or("Name column not found in CSV line")?.to_string();
    let vram_used_mb = parts
        .next()
        .ok_or("VRAM used column not found in CSV line")?
        .parse::<u64>()
        .map_err(|_| "Invalid VRAM used value in CSV line")?;
    let vram_total_mb = parts
        .next()
        .ok_or("VRAM total column not found in CSV line")?
        .parse::<u64>()
        .map_err(|_| "Invalid VRAM total value in CSV line")?;
    let temp_c = parts
        .next()
        .ok_or("Temperature column not found in CSV line")?
        .parse::<u32>()
        .map_err(|_| "Invalid temperature value in CSV line")?;
    let util_pct = parts
        .next()
        .ok_or("Utilization percentage column not found in CSV line")?
        .parse::<u32>()
        .map_err(|_| "Invalid utilization percentage value in CSV line")?;

    Ok(GpuStats {
        name,
        vram_used_mb,
        vram_total_mb,
        temp_c,
        util_pct,
    })
}