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
    // Split CSV line by commas
    let parts: Vec<&str> = line.split(',').collect();
    
    // Guard rail: Validate column count
    if parts.len() < 5 {
        return Err(format!("Insufficient columns: expected 5, found {}", parts.len()));
    }
    
    // Parse name (first field)
    let name = parts[0].trim().to_string();
    
    // Parse numeric fields with error handling
    let vram_used_mb: u64 = parts[1].trim().parse()
        .map_err(|e| format!("Failed to parse VRAM used: {}", e))?;
    
    let vram_total_mb: u64 = parts[2].trim().parse()
        .map_err(|e| format!("Failed to parse VRAM total: {}", e))?;
    
    let temp_c: u32 = parts[3].trim().parse()
        .map_err(|e| format!("Failed to parse temperature: {}", e))?;
    
    let util_pct: u32 = parts[4].trim().parse()
        .map_err(|e| format!("Failed to parse utilization: {}", e))?;
    
    // Return constructed GpuStats
    Ok(GpuStats {
        name,
        vram_used_mb,
        vram_total_mb,
        temp_c,
        util_pct,
    })
}

// Example usage demonstrating the function
fn main() -> Result<(), String> {
    let sample_line = "NVIDIA GeForce RTX 3060, 5800, 12288, 35, 25";
    
    match parse_gpu_csv(sample_line) {
        Ok(stats) => {
            println!("Parsed GPU: {:?}", stats);
            println!("  Name: {}", stats.name);
            println!("  VRAM Used: {} MB", stats.vram_used_mb);
            println!("  VRAM Total: {} MB", stats.vram_total_mb);
            println!("  Temperature: {}°C", stats.temp_c);
            println!("  Utilization: {}%", stats.util_pct);
        }
        Err(e) => {
            println!("Parse error: {}", e);
        }
    }
    
    // Test error handling with invalid input
    let invalid_line = "NVIDIA RTX 4090, 16000";
    match parse_gpu_csv(invalid_line) {
        Ok(_) => println!("Unexpected success"),
        Err(e) => println!("Expected error: {}", e),
    }
    
    Ok(())
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
