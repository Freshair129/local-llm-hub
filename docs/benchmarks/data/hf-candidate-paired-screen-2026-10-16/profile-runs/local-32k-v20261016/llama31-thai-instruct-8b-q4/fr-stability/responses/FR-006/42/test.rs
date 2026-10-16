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
    let columns: Vec<&str> = line.split(',').collect();
    if columns.len() < 5 {
        return Err("Fewer than 5 columns in CSV line".to_string());
    }

    let name = columns[0].to_string();
    let vram_used_mb = match columns[1].parse::<u64>() {
        Ok(vram_used_mb) => vram_used_mb,
        Err(_) => return Err("Failed to parse vram_used_mb".to_string()),
    };
    let vram_total_mb = match columns[2].parse::<u64>() {
        Ok(vram_total_mb) => vram_total_mb,
        Err(_) => return Err("Failed to parse vram_total_mb".to_string()),
    };
    let temp_c = match columns[3].parse::<u32>() {
        Ok(temp_c) => temp_c,
        Err(_) => return Err("Failed to parse temp_c".to_string()),
    };
    let util_pct = match columns[4].parse::<u32>() {
        Ok(util_pct) => util_pct,
        Err(_) => return Err("Failed to parse util_pct".to_string()),
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
