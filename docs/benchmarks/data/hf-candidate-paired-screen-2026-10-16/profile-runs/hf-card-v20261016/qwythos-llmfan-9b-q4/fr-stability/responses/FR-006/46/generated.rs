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
    let fields = line.split(',').map(|f| f.trim()).collect::<Vec<_>>();
    if fields.len() < 5 {
        return Err("invalid number of columns".to_string());
    }

    // parse name (field 0)
    let name = fields[0].clone();

    // parse numeric fields with error handling
    let vram_used_mb = match fields[1].parse::<u64>() {
        Ok(v) => v,
        Err(_) => return Err("invalid VRAM used value".to_string()),
    };
    let vram_total_mb = match fields[2].parse::<u64>() {
        Ok(v) => v,
        Err(_) => return Err("invalid VRAM total value".to_string()),
    };
    let temp_c = match fields[3].parse::<u32>() {
        Ok(v) => v,
        Err(_) => return Err("invalid temperature value".to_string()),
    };
    let util_pct = match fields[4].parse::<u32>() {
        Ok(v) => v,
        Err(_) => return Err("invalid utilization value".to_string()),
    };

    Ok(GpuStats {
        name,
        vram_used_mb,
        vram_total_mb,
        temp_c,
        util_pct,
    })
}