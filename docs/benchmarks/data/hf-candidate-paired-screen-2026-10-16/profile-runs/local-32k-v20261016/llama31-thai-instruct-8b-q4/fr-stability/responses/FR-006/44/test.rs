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
        return Err("Invalid number of columns".to_string());
    }

    match (
        columns[0].parse::<String>(),
        columns[1].parse::<u64>(),
        columns[2].parse::<u64>(),
        columns[3].parse::<u32>(),
        columns[4].parse::<u32>(),
    ) {
        (Ok(name), Ok(vram_used_mb), Ok(vram_total_mb), Ok(temp_c), Ok(util_pct)) => {
            Ok(GpuStats {
                name,
                vram_used_mb,
                vram_total_mb,
                temp_c,
                util_pct,
            })
        }
        _ => Err("Invalid number format".to_string()),
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
