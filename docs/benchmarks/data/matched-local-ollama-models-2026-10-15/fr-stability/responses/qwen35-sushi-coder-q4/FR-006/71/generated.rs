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
    // Split CSV line by comma delimiter
    let fields: Vec<&str> = line.split(',').collect();
    
    // Guard rail: validate field count
    if fields.len() < 5 {
        return Err(format!("Expected 5 fields, got {}", fields.len()));
    }
    
    // Parse each field with defensive error handling
    let name = fields[0].trim().to_string();
    
    let vram_used_mb = parse_u64(&fields[1])?;
    let vram_total_mb = parse_u64(&fields[2])?;
    let temp_c = parse_u32(&fields[3])?;
    let util_pct = parse_u32(&fields[4])?;
    
    Ok(GpuStats {
        name,
        vram_used_mb,
        vram_total_mb,
        temp_c,
        util_pct,
    })
}

// Helper function to parse u64 with error handling
fn parse_u64(s: &str) -> Result<u64, String> {
    s.trim().parse::<u64>()
        .map_err(|e| format!("Failed to parse u64 '{}': {}", s, e))
}

// Helper function to parse u32 with error handling
fn parse_u32(s: &str) -> Result<u32, String> {
    s.trim().parse::<u32>()
        .map_err(|e| format!("Failed to parse u32 '{}': {}", s, e))
}