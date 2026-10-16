// trace:implements FR-006

/// Structure to represent GPU statistics
#[derive(Debug, PartialEq)]
pub struct GpuStats {
    /// Name of the GPU
    pub name: String,
    /// Total VRAM in MB
    pub vram_total_mb: u64,
    /// Total VRAM used in MB
    pub vram_used_mb: u64,
    /// Temperature in Celsius
    pub temp_c: u32,
    /// Utilization percentage
    pub util_pct: u32,
}

/// Function to parse a CSV line into GpuStats
pub fn parse_gpu_csv(line: &str) -> Result<GpuStats, String> {
    // Split the input string by comma
    let mut parts = line.split(',');

    // Check if there are at least 5 parts (name, total VRAM, used VRAM, temperature, utilization)
    if parts.len() < 5 {
        return Err(String::from("Insufficient number of columns in CSV"));
    }

    // Get the name
    let name = parts.next().unwrap().to_string();

    // Get the total and used VRAM
    let vram_total_mb: u64 = match parts.next().unwrap().parse() {
        Ok(num) => num,
        Err(_) => return Err(String::from("Failed to parse total VRAM")),
    };
    let vram_used_mb: u64 = match parts.next().unwrap().parse() {
        Ok(num) => num,
        Err(_) => return Err(String::from("Failed to parse used VRAM")),
    };

    // Get the temperature
    let temp_c: u32 = match parts.next().unwrap().parse() {
        Ok(num) => num,
        Err(_) => return Err(String::from("Failed to parse temperature")),
    };

    // Get the utilization percentage
    let util_pct: u32 = match parts.next().unwrap().parse() {
        Ok(num) => num,
        Err(_) => return Err(String::from("Failed to parse utilization percentage")),
    };

    // Return the parsed GpuStats
    Ok(GpuStats {
        name,
        vram_total_mb,
        vram_used_mb,
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
