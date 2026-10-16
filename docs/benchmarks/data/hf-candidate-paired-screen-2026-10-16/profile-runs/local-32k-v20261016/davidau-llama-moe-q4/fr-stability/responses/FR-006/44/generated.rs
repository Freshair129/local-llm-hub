// trace:implements FR-006

/// Struct to hold GPU stats
#[derive(Debug, PartialEq)]
pub struct GpuStats {
    pub name: String,
    pub vram_used_mb: u64,
    pub vram_total_mb: u64,
    pub temp_c: u32,
    pub util_pct: u32,
}

/// Parse a CSV line into a GpuStats struct
pub fn parse_gpu_csv(line: &str) -> Result<GpuStats, String> {
    // trace:parse_gpu_csv:parse_gpu_csv

    // Split the line into columns
    let columns: Vec<&str> = line.split(',').collect();

    // Check if there are at least 5 columns
    if columns.len() < 5 {
        return Err("Insufficient columns in CSV line".to_string());
    }

    // Parse the columns into GpuStats
    let name = columns[0].to_string();
    let vram_used_mb: u64 = columns[1].parse().map_err(|_| "Failed to parse vram used MB".to_string())?;
    let vram_total_mb: u64 = columns[2].parse().map_err(|_| "Failed to parse vram total MB".to_string())?;
    let temp_c: u32 = columns[3].parse().map_err(|_| "Failed to parse temp C".to_string())?;
    let util_pct: u32 = columns[4].parse().map_err(|_| "Failed to parse util PCT".to_string())?;

    Ok(GpuStats {
        name,
        vram_used_mb,
        vram_total_mb,
        temp_c,
        util_pct,
    })
}