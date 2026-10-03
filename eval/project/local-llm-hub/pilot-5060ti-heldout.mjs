// Contract-derived cases. These strings are never sent to a model.
export const heldout = {
  'FR-002': `
#[test] fn heldout_empty() { assert_eq!(normalize_model_name(""), ""); }
#[test] fn heldout_plain_case() { assert_eq!(normalize_model_name("MiXeD/Model:latest"), "mixed/model:latest"); }
#[test] fn heldout_all_suffixes() {
    for suffix in ["-Q4_0", "-q4_K_M", "-Q4_K_S", ":Q4_0", ":q4_K_m", ":Q4_K_S"] {
        assert_eq!(normalize_model_name(&format!("library/Example{}", suffix)), "example");
    }
}
#[test] fn heldout_prefixes() {
    for prefix in ["registry.ollama.ai/library/", "library/", "hf.co/"] {
        assert_eq!(normalize_model_name(&format!("{}Org/Model", prefix)), "org/model");
    }
}
#[test] fn heldout_embedded_prefix() {
    assert_eq!(normalize_model_name("owner/library/Model"), "owner/library/model");
    assert_eq!(normalize_model_name("owner/hf.co/Model"), "owner/hf.co/model");
}
#[test] fn heldout_internal_quant() {
    assert_eq!(normalize_model_name("Model-Q4_K_M-extra"), "model-q4_k_m-extra");
    assert_eq!(normalize_model_name("Model:q4_0-extra"), "model:q4_0-extra");
}
#[test] fn heldout_unicode() { assert_eq!(normalize_model_name("hf.co/ไทย/โมเดล:Q4_K_S"), "ไทย/โมเดล"); }
#[test] fn heldout_unknown_quant() { assert_eq!(normalize_model_name("Model:Q8_0"), "model:q8_0"); }
`,
  'FR-006': `
#[test] fn heldout_spaces() {
    let s = parse_gpu_csv("GPU Name, 1 , 2 , 3 , 4 ").unwrap();
    assert_eq!((s.name, s.vram_used_mb, s.vram_total_mb, s.temp_c, s.util_pct), ("GPU Name".into(), 1, 2, 3, 4));
}
#[test] fn heldout_every_numeric_column() {
    for i in 1..5 { let mut v = vec!["GPU", "1", "2", "3", "4"]; v[i] = "bad"; assert!(parse_gpu_csv(&v.join(",")).is_err()); }
}
#[test] fn heldout_short_rows() {
    for row in ["", "GPU", "GPU,1", "GPU,1,2", "GPU,1,2,3"] { assert!(parse_gpu_csv(row).is_err()); }
}
#[test] fn heldout_unsigned() {
    for row in ["GPU,-1,2,3,4", "GPU,1,-2,3,4", "GPU,1,2,-3,4", "GPU,1,2,3,-4"] { assert!(parse_gpu_csv(row).is_err()); }
}
#[test] fn heldout_overflow() {
    for row in ["GPU,18446744073709551616,2,3,4", "GPU,1,18446744073709551616,3,4", "GPU,1,2,4294967296,4", "GPU,1,2,3,4294967296"] { assert!(parse_gpu_csv(row).is_err()); }
}
#[test] fn heldout_missing_numbers() {
    for row in ["GPU,,2,3,4", "GPU,1,,3,4", "GPU,1,2,,4", "GPU,1,2,3,"] { assert!(parse_gpu_csv(row).is_err()); }
}
#[test] fn heldout_max_values() {
    let s = parse_gpu_csv("GPU,18446744073709551615,18446744073709551615,4294967295,4294967295").unwrap();
    assert_eq!((s.vram_used_mb, s.vram_total_mb, s.temp_c, s.util_pct), (u64::MAX, u64::MAX, u32::MAX, u32::MAX));
}
#[test] fn heldout_zero() { let s = parse_gpu_csv("GPU,0,0,0,0").unwrap(); assert_eq!((s.vram_used_mb,s.vram_total_mb,s.temp_c,s.util_pct), (0,0,0,0)); }
`
};
