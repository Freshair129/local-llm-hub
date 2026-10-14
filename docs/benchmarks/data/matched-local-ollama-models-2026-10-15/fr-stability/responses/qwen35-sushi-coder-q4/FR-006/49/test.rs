use std::str::Split;

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
    // Split the line by comma
    let fields: Vec<&str> = line.split(',').collect();
    
    // Guard rail: Ensure exactly 5 columns exist
    if fields.len() != 5 {
        return Err(format!("Expected 5 columns, found {}", fields.len()));
    }
    
    // Parse each field with error handling
    let name = fields[0].to_string();
    let vram_used_mb = fields[1].parse::<u64>()
        .map_err(|e| format!("Failed to parse vram_used_mb: {}", e))?;
    let vram_total_mb = fields[2].parse::<u64>()
        .map_err(|e| format!("Failed to parse vram_total_mb: {}", e))?;
    let temp_c = fields[3].parse::<u32>()
        .map_err(|e| format!("Failed to parse temp_c: {}", e))?;
    let util_pct = fields[4].parse::<u32>()
        .map_err(|e| format!("Failed to parse util_pct: {}", e))?;
    
    Ok(GpuStats {
        name,
        vram_used_mb,
        vram_total_mb,
        temp_c,
        util_pct,
    })
}

// --- Example usage / tests ---
fn main() {
    let good_line = "NVIDIA GeForce RTX 3060, 5800, 12288, 35, 25";
    match parse_gpu_csv(good_line) {
        Ok(stats) => println!("{:?}", stats),
        Err(e) => println!("Error: {}", e),
    }

    let bad_line = "NVIDIA GeForce RTX 3060, 5800, 12288, 35"; // Missing column
    match parse_gpu_csv(bad_line) {
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
