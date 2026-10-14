use std::str::FromStr;

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
    // Handle empty or whitespace-only lines
    if line.trim().is_empty() {
        return Err("Empty CSV line".to_string());
    }

    // Split by comma and ensure we have exactly 5 fields
    let fields: Vec<&str> = line.split(',').collect();
    if fields.len() != 5 {
        return Err(format!("Expected 5 fields, got {}", fields.len()));
    }

    // Parse each field with individual error handling
    let name = fields[0].trim().to_string();
    let vram_used_mb = u64::from_str(fields[1].trim())
        .map_err(|e| format!("Failed to parse vram_used_mb: {}", e))?;
    let vram_total_mb = u64::from_str(fields[2].trim())
        .map_err(|e| format!("Failed to parse vram_total_mb: {}", e))?;
    let temp_c = u32::from_str(fields[3].trim())
        .map_err(|e| format!("Failed to parse temp_c: {}", e))?;
    let util_pct = u32::from_str(fields[4].trim())
        .map_err(|e| format!("Failed to parse util_pct: {}", e))?;

    Ok(GpuStats {
        name,
        vram_used_mb,
        vram_total_mb,
        temp_c,
        util_pct,
    })
}