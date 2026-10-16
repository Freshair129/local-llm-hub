// trace:implements FR-006
pub struct GpuStats {
    pub name: String,
    pub vram_used_mb: u64,
    pub vram_total_mb: u64,
    pub temp_c: u32,
    pub util_pct: u32,
}

pub fn parse_gpu_csv(line: &str) -> Result<GpuStats, String> {
    let parts: Vec<&str> = line.split(',').collect();
    
    if parts.len() < 5 {
        return Err(format!("CSV line has only {} columns, but 5 are required", parts.len()));
    }
    
    let name = parts[0].trim();
    let vram_used_str = parts[1].trim();
    let vram_total_str = parts[2].trim();
    let temp_str = parts[3].trim();
    let util_str = parts[4].trim();
    
    let vram_used = match vram_used_str.parse::<u64>() {
        Ok(val) => val,
        Err(_) => return Err("Failed to parse VRAM used as u64".to_string()),
    };
    
    let vram_total = match vram_total_str.parse::<u64>() {
        Ok(val) => val,
        Err(_) => return Err("Failed to parse VRAM total as u64".to_string()),
    };
    
    let temp = match temp_str.parse::<u32>() {
        Ok(val) => val,
        Err(_) => return Err("Failed to parse temperature as u32".to_string()),
    };
    
    let util = match util_str.parse::<u32>() {
        Ok(val) => val,
        Err(_) => return Err("Failed to parse utilization as u32".to_string()),
    };
    
    Ok(GpuStats {
        name: name.to_string(),
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
