// trace:implements FR-006

pub struct GpuStats {
    pub name: String,
    pub vram_used_mb: u64,
    pub vram_total_mb: u64,
    pub temp_c: u32,
    pub util_pct: u32,
}

pub fn parse_gpu_csv(line: &str) -> Result<GpuStats, String> {
    // Guard rail: STRICTLY FORBIDDEN to use unwrap(), expect(), or panic!
    // We must return Err(String) for any failure.

    // 1. Parse the CSV: Split the line by ", " delimiter.
    // Note: The example "NVIDIA GeForce RTX 3060, 5800, 12288, 35, 25" implies space-separated values after commas.
    let parts: Vec<&str> = line.split(', ').collect();

    // 2. Check column count.
    if parts.len() != 5 {
        return Err(format!("Invalid CSV format: expected 5 columns, found {}", parts.len()));
    }

    // Helper to parse integers safely
    let parse_u64 = |s: &str| -> Result<u64, String> {
        s.trim().parse().map_err(|_| format!("Failed to parse number: {}", s))
    };
    let parse_u32 = |s: &str| -> Result<u32, String> {
        s.trim().parse().map_err(|_| format!("Failed to parse number: {}", s))
    };

    // 3. Parse fields individually
    let name = parts[0].to_string();
    let vram_used = parse_u64(parts[1])?;
    let vram_total = parse_u64(parts[2])?;
    let temp = parse_u32(parts[3])?;
    let util = parse_u32(parts[4])?;

    // Construct and return the struct
    Ok(GpuStats {
        name,
        vram_used_mb: vram_used,
        vram_total_mb: vram_total,
        temp_c: temp,
        util_pct: util,
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
