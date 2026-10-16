// trace:implements FR-006

/// Represents GPU statistics.
#[derive(Debug, PartialEq)]
pub struct GpuStats {
    pub name: String,
    pub vram_used_mb: u64,
    pub vram_total_mb: u64,
    pub temp_c: u32,
    pub util_pct: u32,
}

/// Parse a CSV line into `GpuStats`.
///
/// Returns `Ok(GpuStats)` if successful, `Err(String)` if columns are fewer than 5 or numbers fail to parse.
pub fn parse_gpu_csv(line: &str) -> Result<GpuStats, String> {
    // Split the CSV line into columns
    let mut parts: Vec<&str> = line.split(',').map(|s| s.trim()).collect();

    // Check if there are at least 5 columns
    if parts.len() < 5 {
        return Err("Insufficient columns in CSV line".to_string());
    }

    // Attempt to parse each column
    let name = match parts[0].parse::<String>() {
        Ok(s) => s,
        Err(_) => return Err("Failed to parse name column".to_string()),
    };

    let vram_used_mb = match parts[1].parse::<u64>() {
        Ok(n) => n,
        Err(_) => return Err("Failed to parse vram_used_mb column".to_string()),
    };

    let vram_total_mb = match parts[2].parse::<u64>() {
        Ok(n) => n,
        Err(_) => return Err("Failed to parse vram_total_mb column".to_string()),
    };

    let temp_c = match parts[3].parse::<u32>() {
        Ok(c) => c,
        Err(_) => return Err("Failed to parse temp_c column".to_string()),
    };

    let util_pct = match parts[4].parse::<u32>() {
        Ok(p) => p,
        Err(_) => return Err("Failed to parse util_pct column".to_string()),
    };

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
