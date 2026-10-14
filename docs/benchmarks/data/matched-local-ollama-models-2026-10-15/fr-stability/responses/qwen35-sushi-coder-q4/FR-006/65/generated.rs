use std::str::FromStr;

// trace:implements FR-006
pub struct GpuStats {
    pub name: String,
    pub vram_used_mb: u64,
    pub vram_total_mb: u64,
    pub temp_c: u32,
    pub util_pct: u32,
}

// trace:implements FR-006
pub fn parse_gpu_csv(line: &str) -> Result<GpuStats, String> {
    // Handle empty lines
    if line.is_empty() {
        return Err("Empty CSV line".to_string());
    }

    // Split by comma
    let parts: Vec<&str> = line.split(',').collect();
    
    // Validate column count
    if parts.len() != 5 {
        return Err(format!("Expected 5 columns, got {}", parts.len()));
    }

    // Parse each field with proper error handling
    let name = parts[0].trim().to_string();
    
    let vram_used: Result<u64, _> = parts[1].trim().parse();
    let vram_total: Result<u64, _> = parts[2].trim().parse();
    let temp: Result<u32, _> = parts[3].trim().parse();
    let util: Result<u32, _> = parts[4].trim().parse();

    // Match on all parse results - NO unwrap()
    let vram_used = match vram_used {
        Ok(v) => v,
        Err(_) => return Err(format!("Failed to parse vram_used: {}", parts[1])),
    };

    let vram_total = match vram_total {
        Ok(v) => v,
        Err(_) => return Err(format!("Failed to parse vram_total: {}", parts[2])),
    };

    let temp = match temp {
        Ok(t) => t,
        Err(_) => return Err(format!("Failed to parse temp: {}", parts[3])),
    };

    let util = match util {
        Ok(u) => u,
        Err(_) => return Err(format!("Failed to parse util_pct: {}", parts[4])),
    };

    Ok(GpuStats {
        name,
        vram_used_mb: vram_used,
        vram_total_mb: vram_total,
        temp_c: temp,
        util_pct: util,
    })
}