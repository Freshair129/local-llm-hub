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
    // Split the CSV line into columns
    let columns: Vec<&str> = line.split(',').collect();

    // Check if there are at least 5 columns
    if columns.len() < 5 {
        return Err("Fewer than 5 columns".to_string());
    }

    // Parse the columns into fields
    let name = columns[0].trim().to_string();
    let vram_used_mb = columns[1].trim().parse().map_err(|_| "Failed to parse VRAM used".to_string())?;
    let vram_total_mb = columns[2].trim().parse().map_err(|_| "Failed to parse VRAM total".to_string())?;
    let temp_c = columns[3].trim().parse().map_err(|_| "Failed to parse temperature".to_string())?;
    let util_pct = columns[4].trim().parse().map_err(|_| "Failed to parse utilization".to_string())?;

    // Create and return a GpuStats instance
    Ok(GpuStats {
        name,
        vram_used_mb,
        vram_total_mb,
        temp_c,
        util_pct,
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
