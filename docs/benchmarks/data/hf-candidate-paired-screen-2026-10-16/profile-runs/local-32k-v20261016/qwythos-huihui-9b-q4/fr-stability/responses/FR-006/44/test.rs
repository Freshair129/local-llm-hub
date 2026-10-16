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
    let mut parts = line.split(',').map(|s| s.trim());
    let name = parts.next().ok_or("Missing GPU name")?;
    let vram_used = parts.next().ok_or("Fewer than 5 columns")?;
    let vram_total = parts.next().ok_or("Fewer than 5 columns")?;
    let temp = parts.next().ok_or("Fewer than 5 columns")?;
    let util = parts.next().ok_or("Fewer than 5 columns")?;

    // Guard against extra columns (robustness)
    if parts.next().is_some() {
        return Err("Too many columns");
    }

    Ok(GpuStats {
        name: name.to_string(),
        vram_used_mb: vram_used.parse::<u64>().map_err(|e| e.to_string())?,
        vram_total_mb: vram_total.parse::<u64>().map_err(|e| e.to_string())?,
        temp_c: temp.parse::<u32>().map_err(|e| e.to_string())?,
        util_pct: util.parse::<u32>().map_err(|e| e.to_string())?,
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
