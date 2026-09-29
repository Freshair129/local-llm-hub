// src-tauri/tests/test_lan_share.rs
// trace:verifies FR-010
//! Integration test for LAN Model & Directory Sharing service.
//! Tests HTTP 206 Partial Content Range parsing and path traversal security.

use tauri_app_lib::commands::share::{count_shared_files, parse_range_header, safe_resolve_path};

#[test]
fn test_lan_range_byte_parsing() {
    let size = 50_000_000; // 50 MB
    let parsed = parse_range_header("Range: bytes=0-1048575", size);
    assert_eq!(parsed, Some((0, 1048575)));

    let parsed_tail = parse_range_header("Range: bytes=1048576-", size);
    assert_eq!(parsed_tail, Some((1048576, 49_999_999)));
}

#[test]
fn test_lan_directory_traversal_rejection() {
    let temp_dir = std::env::temp_dir();
    let escape_attempt = safe_resolve_path(&temp_dir, "../../../../../etc/passwd");
    assert!(escape_attempt.is_err());
    assert!(escape_attempt.unwrap_err().contains("traversal"));
}

#[test]
fn test_lan_file_counter() {
    let temp_dir = std::env::temp_dir().join("test_lan_share_counter");
    let _ = std::fs::create_dir_all(&temp_dir);

    let gguf1 = temp_dir.join("model_a.gguf");
    let gguf2 = temp_dir.join("model_b.GGUF");
    let txt = temp_dir.join("readme.txt");

    let _ = std::fs::write(&gguf1, b"GGUF");
    let _ = std::fs::write(&gguf2, b"GGUF");
    let _ = std::fs::write(&txt, b"text");

    let count = count_shared_files(&temp_dir);
    assert_eq!(count, 2, "Should identify exactly 2 GGUF files");

    let _ = std::fs::remove_dir_all(temp_dir);
}
