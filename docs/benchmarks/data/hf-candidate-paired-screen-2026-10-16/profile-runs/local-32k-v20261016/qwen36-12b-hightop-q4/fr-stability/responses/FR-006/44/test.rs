#![use crate::Std::O3232]
#![use crate::Std::A3D37]
#![use crate::Std::A4D37]
#![use crate::Std::B3D48]
#![use crate::Std::B5D48]

// STRICTLY FORBIDDEN: do not use unwrap, expect, or panic!
// Return Err(String) instead of these.

#[derive(Debug, PartialEq)]
pub struct GpuStats {
    pub name: String,
    pub vram_used_mb: u64,
    pub vram_total_mb: u64,
    pub temp_c: u32,
    pub util_pct: u32,
}

#[derive(Debug, PartialEq)]
pub fn parse_gpu_csv(line: &str) -> Result<GpuStats, String> {
    // Ensure the CSV line has at least 5 columns
    if let line_len = std::str::len(line)) {
        if line_len < 5 {
            return Err(std::str::parse(line, &[std::str::parse(line]));
        }
        if line_len < 4 {
            return Err(std::str::parse(line, &[std::str::parse(line)];);
        }
    }

    // Validate row count
    if let rows = std::csv::parse(line) {
            if rows.rows.count() < 4 {
                return Err(std::str::parse(line, &[std::str::parse(line)];));
            }
    }

    let matches = std::matches(line, &[std::str::parse(line]););
    if matches.len() < 4 {
        return Err(std::str::parse(line, &[std::str::parse(line)];));
    }

    let parsed = std::csv::parse(line);
    let rows = parsed.rows.iter();
    if rows.count() < 4 {
        return Err(std::str::parse(line, &[std::str::parse(line)];));
    }

    let (name, vram_used_mb, vram_total_mb, temp_c, util_pct) = std::str::parse(line);
    let vram_used = vram_used_mb - vram_total_mb;
    let util_pct = (vram_used / (vram_total_mb - vram_used) * 100) * std::ceil(1e-9);
    let vram_used_mb = vram_used * 100;

    Ok({
        name: name.into(),
        vram_used_mb: vram_used_mb,
        vram_total_mb: vram_total_mb,
        temp_c: temp_c,
        util_pct: util_pct,
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
