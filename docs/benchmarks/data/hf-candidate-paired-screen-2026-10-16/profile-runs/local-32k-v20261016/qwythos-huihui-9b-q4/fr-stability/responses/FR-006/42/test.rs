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
    let fields: Vec<&str> = line.split(',').map(|s| s.trim()).collect();

    if fields.len() < 5 {
        return Err(format!("Expected 5 columns, got {}", fields.len()));
    }

    let name = fields[0];
    let vram_used = fields[1].parse::<u64>()
        .map_err(|_| format!("Failed to parse VRAM used: {}", fields[1]));
    let vram_total = fields[2].parse::<u64>()
        .map_err(|_| format!("Failed to parse VRAM total: {}", fields[2]));
    let temp = fields[3].parse::<u32>()
        .map_err(|_| format!("Failed to parse temperature: {}", fields[3]));
    let util = fields[4].parse::<u32>()
        .map_err(|_| format!("Failed to parse utilization: {}", fields[4]));

    Ok(GpuStats {
        name: name.to_string(),
        vram_used_mb: vram_used?,
        vram_total_mb: vram_total?,
        temp_c: temp?,
        util_pct: util?,
    })
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
