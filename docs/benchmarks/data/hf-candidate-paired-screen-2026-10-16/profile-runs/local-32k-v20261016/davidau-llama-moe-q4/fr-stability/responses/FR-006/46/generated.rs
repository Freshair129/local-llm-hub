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
    // Split the line into columns
    let columns: Vec<&str> = line.split(',').collect();

    // Check if there are at least 5 columns
    if columns.len() < 5 {
        return Err("Insufficient columns in CSV line".to_string());
    }

    // Initialize the GpuStats struct
    let mut gpu_stats = GpuStats {
        name: String::new(),
        vram_used_mb: 0,
        vram_total_mb: 0,
        temp_c: 0,
        util_pct: 0,
    };

    // Parse each column
    for (i, column) in columns.iter().enumerate() {
        match i {
            0 => {
                // Name
                gpu_stats.name = column.to_string();
            }
            1 => {
                // VRAM used (MB)
                if let Ok(vram_used_mb) = column.parse::<u64>() {
                    gpu_stats.vram_used_mb = vram_used_mb;
                } else {
                    return Err("Failed to parse VRAM used (MB)".to_string());
                }
            }
            2 => {
                // VRAM total (MB)
                if let Ok(vram_total_mb) = column.parse::<u64>() {
                    gpu_stats.vram_total_mb = vram_total_mb;
                } else {
                    return Err("Failed to parse VRAM total (MB)".to_string());
                }
            }
            3 => {
                // Temperature (C)
                if let Ok(temp_c) = column.parse::<u32>() {
                    gpu_stats.temp_c = temp_c;
                } else {
                    return Err("Failed to parse temperature (C)".to_string());
                }
            }
            4 => {
                // Utilization (%)
                if let Ok(util_pct) = column.parse::<u32>() {
                    gpu_stats.util_pct = util_pct;
                } else {
                    return Err("Failed to parse utilization (%)".to_string());
                }
            }
            _ => {
                // Invalid column
                return Err("Invalid column in CSV line".to_string());
            }
        }
    }

    // Return the parsed GpuStats
    Ok(gpu_stats)
}