// trace:implements FR-006
use std::str::FromStr;

#[derive(Debug, PartialEq)]
pub struct GpuStats {
    pub name: String,
    pub vram_used_mb: u64,
    pub vram_total_mb: u64,
    pub temp_c: u32,
    pub util_pct: u32,
}

pub fn parse_gpu_csv(line: &str) -> Result<GpuStats, String> {
    // Split line by comma
    let fields: Vec<&str> = line.split(',').collect();
    
    // Check we have exactly 5 fields
    if fields.len() != 5 {
        return Err(format!("Expected 5 CSV fields, got {}: {}", fields.len(), line));
    }
    
    // Parse each field with error handling
    let name = fields[0].trim().to_string();
    
    let vram_used_mb = u64::from_str(fields[1].trim())
        .map_err(|_| format!("Invalid vram_used_mb value: {}", fields[1]))?;
    
    let vram_total_mb = u64::from_str(fields[2].trim())
        .map_err(|_| format!("Invalid vram_total_mb value: {}", fields[2]))?;
    
    let temp_c = u32::from_str(fields[3].trim())
        .map_err(|_| format!("Invalid temp_c value: {}", fields[3]))?;
    
    let util_pct = u32::from_str(fields[4].trim())
        .map_err(|_| format!("Invalid util_pct value: {}", fields[4]))?;
    
    Ok(GpuStats {
        name,
        vram_used_mb,
        vram_total_mb,
        temp_c,
        util_pct,
    })
}