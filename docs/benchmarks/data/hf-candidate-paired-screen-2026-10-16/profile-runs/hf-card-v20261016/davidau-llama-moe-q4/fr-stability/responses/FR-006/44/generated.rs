// trace:implements FR-006
pub fn parse_gpu_csv(line: &str) -> Result<GpuStats, String> {
    // trace:parse_gpu_csv
    // 1. Define struct:
    #[derive(Debug, PartialEq)]
    pub struct GpuStats {
        pub name: String,
        pub vram_used_mb: u64,
        pub vram_total_mb: u64,
        pub temp_c: u32,
        pub util_pct: u32,
    }

    // 2. Given a CSV line like "NVIDIA GeForce RTX 3060, 5800, 12288, 35, 25", parse it into GpuStats.
    let mut fields = line.split(',');
    if fields.len() < 5 {
        return Err("Invalid number of fields".to_string());
    }
    let name = fields[0].to_string();
    let vram_used_mb = match fields[1].parse::<u64>() {
        Ok(num) => num,
        Err(_) => return Err("Failed to parse vram_used_mb".to_string()),
    };
    let vram_total_mb = match fields[2].parse::<u64>() {
        Ok(num) => num,
        Err(_) => return Err("Failed to parse vram_total_mb".to_string()),
    };
    let temp_c = match fields[3].parse::<u32>() {
        Ok(num) => num,
        Err(_) => return Err("Failed to parse temp_c".to_string()),
    };
    let util_pct = match fields[4].parse::<u32>() {
        Ok(num) => num,
        Err(_) => return Err("Failed to parse util_pct".to_string()),
    };

    // 3. Return GpuStats
    Ok(GpuStats {
        name,
        vram_used_mb,
        vram_total_mb,
        temp_c,
        util_pct,
    })
}