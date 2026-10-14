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
