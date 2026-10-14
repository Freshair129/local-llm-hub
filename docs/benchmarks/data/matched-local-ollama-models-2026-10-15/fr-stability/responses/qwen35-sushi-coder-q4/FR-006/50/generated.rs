#[derive(Debug, PartialEq)]
    pub struct GpuStats {
        pub name: String,
        pub vram_used_mb: u64,
        pub vram_total_mb: u64,
        pub temp_c: u32,
        pub util_pct: u32,
    }

    // trace:implements FR-006
    pub fn parse_gpu_csv(line: &str) -> Result<GpuStats, String> {
        // Implementation...
    }