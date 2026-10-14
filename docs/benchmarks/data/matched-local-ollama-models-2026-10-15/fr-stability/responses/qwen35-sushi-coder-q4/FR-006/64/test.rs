use std::str::FromStr;

// trace:implements FR-006
pub fn parse_gpu_csv(line: &str) -> Result<GpuStats, String> {
    // Split CSV line by comma
    let parts: Vec<&str> = line.trim().split(',').collect();
    
    // Guard rail: Check column count - return Err if fewer than 5 columns
    if parts.len() < 5 {
        return Err(format!("Expected 5 columns, found {}", parts.len()));
    }
    
    // Parse each field with proper error handling
    let name = parts[0].trim().to_string();
    
    let vram_used: u64 = match u64::from_str(parts[1].trim()) {
        Ok(val) => val,
        Err(_) => return Err(format!("Failed to parse vram_used as u64: {}", parts[1].trim())),
    };
    
    let vram_total: u64 = match u64::from_str(parts[2].trim()) {
        Ok(val) => val,
        Err(_) => return Err(format!("Failed to parse vram_total as u64: {}", parts[2].trim())),
    };
    
    let temp: u32 = match u32::from_str(parts[3].trim()) {
        Ok(val) => val,
        Err(_) => return Err(format!("Failed to parse temp as u32: {}", parts[3].trim())),
    };
    
    let util: u32 = match u32::from_str(parts[4].trim()) {
        Ok(val) => val,
        Err(_) => return Err(format!("Failed to parse util_pct as u32: {}", parts[4].trim())),
    };
    
    Ok(GpuStats {
        name,
        vram_used_mb: vram_used,
        vram_total_mb: vram_total,
        temp_c: temp,
        util_pct: util,
    })
}

#[derive(Debug, PartialEq)]
pub struct GpuStats {
    pub name: String,
    pub vram_used_mb: u64,
    pub vram_total_mb: u64,
    pub temp_c: u32,
    pub util_pct: u32,
}

// Example usage demonstrating the function works correctly
fn main() {
    let line = "NVIDIA GeForce RTX 3060, 5800, 12288, 35, 25";
    match parse_gpu_csv(line) {
        Ok(stats) => println!("{:?}", stats),
        Err(e) => println!("Error: {}", e),
    }
}

#[test]
fn test_parse_valid_csv() {
    let res = parse_gpu_csv("NVIDIA GeForce RTX 3060, 5800, 12288, 35, 25");
    assert!(res.is_ok());
    let stats = res.unwrap();
    assert_eq!(stats.name, "NVIDIA GeForce RTX 3060");
    assert_eq!(stats.vram_used_mb, 5800);
    assert_eq!(stats.vram_total_mb, 12288);
    assert_eq!(stats.temp_c, 35);
    assert_eq!(stats.util_pct, 25);
}

#[test]
fn test_parse_invalid_csv() {
    assert!(parse_gpu_csv("invalid,csv").is_err());
    assert!(parse_gpu_csv("GPU, not_a_number, 12288, 35, 25").is_err());
    assert!(parse_gpu_csv("").is_err());
}
