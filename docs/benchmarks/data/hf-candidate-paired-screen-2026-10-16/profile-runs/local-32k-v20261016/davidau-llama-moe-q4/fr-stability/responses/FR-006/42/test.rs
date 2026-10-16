// trace:implements FR-006

/// A struct representing GPU statistics.
#[derive(Debug, PartialEq)]
pub struct GpuStats {
    /// The name of the GPU.
    pub name: String,
    /// The amount of VRAM used in MB.
    pub vram_used_mb: u64,
    /// The total amount of VRAM in MB.
    pub vram_total_mb: u64,
    /// The temperature of the GPU in Celsius.
    pub temp_c: u32,
    /// The utilization percentage of the GPU.
    pub util_pct: u32,
}

/// Parse a CSV line into a GpuStats struct.
pub fn parse_gpu_csv(line: &str) -> Result<GpuStats, String> {
    // trace: robust error handling
    if line.len() < 5 {
        return Err("Invalid CSV line: columns are fewer than 5".to_string());
    }
    let columns: Vec<&str> = line.split(',').collect();
    if columns.len() != 5 {
        return Err("Invalid CSV line: expected 5 columns, got ".to_string() + &columns.len());
    }

    // trace: parsing columns
    let name = columns[0].to_string();
    let vram_used_mb: u64 = match columns[1].parse::<u64>() {
        Ok(val) => val,
        Err(_) => return Err("Invalid VRAM used value in CSV line".to_string()),
    };
    let vram_total_mb: u64 = match columns[2].parse::<u64>() {
        Ok(val) => val,
        Err(_) => return Err("Invalid VRAM total value in CSV line".to_string()),
    };
    let temp_c: u32 = match columns[3].parse::<u32>() {
        Ok(val) => val,
        Err(_) => return Err("Invalid temperature value in CSV line".to_string()),
    };
    let util_pct: u32 = match columns[4].parse::<u32>() {
        Ok(val) => val,
        Err(_) => return Err("Invalid utilization percentage value in CSV line".to_string()),
    };

    // trace: successful parsing
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
