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
    let cols = line.split(',').map(|s| s.trim()).collect::<Vec<_>>();
    if cols.len() < 5 {
        return Err("invalid CSV: fewer than 5 columns".to_string());
    }
    match cols.as_slice() {
        [name, vram_used, vram_total, temp, util] => {
            Ok(GpuStats {
                name: name.clone(),
                vram_used_mb: u64::from_str(vram_used)
                    .map_err(|_| format!("column 2 failed to parse as u64: {}", vram_used)),
                vram_total_mb: u64::from_str(vram_total)
                    .map_err(|_| format!("column 3 failed to parse as u64: {}", vram_total)),
                temp_c: u32::from_str(temp)
                    .map_err(|_| format!("column 4 failed to parse as u32: {}", temp)),
                util_pct: u32::from_str(util)
                    .map_err(|_| format!("column 5 failed to parse as u32: {}", util)),
            })
        }
        _ => Err("invalid CSV: wrong number of fields".to_string()),
    }
}