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
        return Err("Invalid number of columns".to_string());
    }

    match (
        columns[0].parse::<String>(),
        columns[1].parse::<u64>(),
        columns[2].parse::<u64>(),
        columns[3].parse::<u32>(),
        columns[4].parse::<u32>(),
    ) {
        (Ok(name), Ok(vram_used_mb), Ok(vram_total_mb), Ok(temp_c), Ok(util_pct)) => {
            Ok(GpuStats {
                name,
                vram_used_mb,
                vram_total_mb,
                temp_c,
                util_pct,
            })
        }
        _ => Err("Invalid number format".to_string()),
    }
}