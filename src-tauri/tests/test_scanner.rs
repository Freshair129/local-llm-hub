// src-tauri/tests/test_scanner.rs
// trace:verifies FR-009
// trace:verifies TC-FEAT-004-INTEG
//! Feature Integration Test: Direct GGUF Binary File Scanner & Metadata Extraction.

use tauri_app_lib::commands::scanner::{is_forbidden_path, parse_gguf_header, scan_directory_for_gguf};
use std::path::Path;
use std::time::Instant;

#[test]
fn test_tc_feat_004_scanner_integration() {
    let start = Instant::now();

    // 1. Forbidden path verification (AC 5)
    assert!(is_forbidden_path("C:\\Windows"));
    assert!(is_forbidden_path("C:\\Program Files"));
    assert!(is_forbidden_path("C:\\Program Files (x86)"));
    assert!(is_forbidden_path("C:\\System32"));
    let err_res = scan_directory_for_gguf("C:\\Windows");
    assert!(err_res.is_err(), "Must reject scanning C:\\Windows");
    assert!(err_res.unwrap_err().contains("protected system directory"));

    // 2. Non-existent path verification (AC 4)
    let non_existent_res = scan_directory_for_gguf("Z:\\non_existent_folder_xyz_123");
    assert!(non_existent_res.is_err());
    assert!(non_existent_res.unwrap_err().contains("Directory not found"));

    // 3. Scan local project GGUF directory: "models/gguf"
    let local_gguf_dir = "models/gguf";
    if Path::new(local_gguf_dir).exists() {
        let scan_res = scan_directory_for_gguf(local_gguf_dir);
        assert!(scan_res.is_ok(), "GGUF scan should succeed on models/gguf");
        let models = scan_res.unwrap();
        println!("Scanned {} GGUF models in '{}':", models.len(), local_gguf_dir);
        for m in &models {
            println!("  - [{}] {} ({} bytes, quant: {:?})", m.backend, m.name, m.size_bytes, m.quantization);
            assert_eq!(m.backend, "gguf");
            assert!(m.size_bytes >= 1024 * 1024, "Size must be at least 1MB");
            assert!(!m.canonical_name.is_empty());
        }

        // Test real binary header parsing on qwen-4b-thai-reasoning.gguf if present
        let test_file = Path::new("models/gguf/qwen-4b-thai-reasoning.gguf");
        if test_file.exists() {
            let meta_res = parse_gguf_header(test_file);
            assert!(meta_res.is_ok(), "Failed to parse real GGUF header");
            let meta = meta_res.unwrap();
            println!("Parsed GGUF Header for {}:", test_file.display());
            println!("  - Name: {}", meta.name);
            println!("  - Architecture: {}", meta.architecture);
            println!("  - Parameter Count: {:?}", meta.parameter_count);
            println!("  - Context Length: {:?}", meta.context_length);
            println!("  - Quantization: {:?}", meta.quantization);

            assert!(!meta.name.is_empty(), "Model name extracted from GGUF header must not be empty");
        }
    }

    println!("TC-FEAT-004-INTEG Passed in {:?}", start.elapsed());
}
