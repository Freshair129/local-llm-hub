// src-tauri/src/commands/scanner.rs
// trace:implements FR-009
//! Direct GGUF Binary File Scanner & Metadata Extractor (GGUF v2/v3).
//! Compliant with ADR-100 (Safe Error Handling, Strict Result types, Zero Panics).

use crate::commands::models::{extract_quantization, normalize_model_name};
use crate::models::types::{GgufMetadata, UnifiedModel};
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

pub const FORBIDDEN_PREFIXES: &[&str] = &[
    "C:\\Windows",
    "C:\\Program Files",
    "C:\\Program Files (x86)",
    "C:\\System32",
    "/etc",
    "/usr",
    "/bin",
    "/sbin",
    "/System",
];

const MIN_FILE_SIZE_BYTES: u64 = 1024 * 1024; // 1 MB per AC 6
const MAX_SCAN_DEPTH: usize = 5; // Max 5 levels per AC 1

/// Checks if a given path falls within forbidden system directories (AC 5)
pub fn is_forbidden_path(path_str: &str) -> bool {
    let normalized = path_str.replace('/', "\\").to_lowercase();
    for prefix in FORBIDDEN_PREFIXES {
        let norm_prefix = prefix.replace('/', "\\").to_lowercase();
        if normalized.starts_with(&norm_prefix) {
            return true;
        }
    }
    false
}

/// Helper to read a little-endian u32
fn read_u32<R: Read>(reader: &mut R) -> Result<u32, String> {
    let mut bytes = [0u8; 4];
    reader.read_exact(&mut bytes).map_err(|e| e.to_string())?;
    Ok(u32::from_le_bytes(bytes))
}

/// Helper to read a little-endian u64
fn read_u64<R: Read>(reader: &mut R) -> Result<u64, String> {
    let mut bytes = [0u8; 8];
    reader.read_exact(&mut bytes).map_err(|e| e.to_string())?;
    Ok(u64::from_le_bytes(bytes))
}

/// Helper to read a GGUF string (u64 length followed by utf-8 bytes)
fn read_gguf_string<R: Read>(reader: &mut R) -> Result<String, String> {
    let len = read_u64(reader)? as usize;
    if len > 1024 * 1024 {
        return Err("String length unreasonably large".to_string());
    }
    let mut buf = vec![0u8; len];
    reader.read_exact(&mut buf).map_err(|e| e.to_string())?;
    String::from_utf8(buf).map_err(|e| e.to_string())
}

/// Safely skip over a GGUF value according to value type
fn skip_gguf_value<R: Read + Seek>(reader: &mut R, value_type: u32) -> Result<(), String> {
    match value_type {
        0 | 1 | 7 => { // UINT8, INT8, BOOL
            reader.seek(SeekFrom::Current(1)).map_err(|e| e.to_string())?;
        }
        2 | 3 => { // UINT16, INT16
            reader.seek(SeekFrom::Current(2)).map_err(|e| e.to_string())?;
        }
        4 | 5 | 6 => { // UINT32, INT32, FLOAT32
            reader.seek(SeekFrom::Current(4)).map_err(|e| e.to_string())?;
        }
        8 => { // STRING
            let len = read_u64(reader)? as i64;
            reader.seek(SeekFrom::Current(len)).map_err(|e| e.to_string())?;
        }
        10 | 11 | 12 => { // UINT64, INT64, FLOAT64
            reader.seek(SeekFrom::Current(8)).map_err(|e| e.to_string())?;
        }
        9 => { // ARRAY
            let item_type = read_u32(reader)?;
            let array_len = read_u64(reader)?;
            for _ in 0..array_len {
                skip_gguf_value(reader, item_type)?;
            }
        }
        _ => return Err(format!("Unknown GGUF value type: {}", value_type)),
    }
    Ok(())
}

// trace:implements FR-009
/// Parses GGUF v2/v3 binary header directly from disk without loading model weights into RAM.
pub fn parse_gguf_header(path: &Path) -> Result<GgufMetadata, String> {
    let mut file = File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;

    // 1. Verify magic bytes: 'GGUF'
    let mut magic = [0u8; 4];
    file.read_exact(&mut magic).map_err(|e| format!("Failed to read magic: {}", e))?;
    if &magic != b"GGUF" {
        return Err("Not a valid GGUF file (magic header mismatch)".to_string());
    }

    // 2. Read version (u32, supports v2 and v3)
    let version = read_u32(&mut file)?;
    if version != 2 && version != 3 {
        return Err(format!("Unsupported GGUF version: {}", version));
    }

    // 3. Read tensor_count and kv_count
    let _tensor_count = read_u64(&mut file)?;
    let kv_count = read_u64(&mut file)?;

    let mut model_name: Option<String> = None;
    let mut architecture: Option<String> = None;
    let mut parameter_count: Option<u64> = None;
    let mut context_length: Option<u64> = None;

    // 4. Iterate over key-value metadata pairs
    for _ in 0..kv_count {
        let key = match read_gguf_string(&mut file) {
            Ok(k) => k,
            Err(_) => break,
        };

        let val_type = match read_u32(&mut file) {
            Ok(t) => t,
            Err(_) => break,
        };

        match key.as_str() {
            "general.name" => {
                if val_type == 8 {
                    model_name = read_gguf_string(&mut file).ok();
                } else {
                    let _ = skip_gguf_value(&mut file, val_type);
                }
            }
            "general.architecture" => {
                if val_type == 8 {
                    architecture = read_gguf_string(&mut file).ok();
                } else {
                    let _ = skip_gguf_value(&mut file, val_type);
                }
            }
            "general.parameter_count" => {
                if val_type == 10 { // UINT64
                    parameter_count = read_u64(&mut file).ok();
                } else if val_type == 4 { // UINT32
                    parameter_count = read_u32(&mut file).map(|v| v as u64).ok();
                } else {
                    let _ = skip_gguf_value(&mut file, val_type);
                }
            }
            k if k.ends_with(".context_length") => {
                if val_type == 10 { // UINT64
                    context_length = read_u64(&mut file).ok();
                } else if val_type == 4 { // UINT32
                    context_length = read_u32(&mut file).map(|v| v as u64).ok();
                } else {
                    let _ = skip_gguf_value(&mut file, val_type);
                }
            }
            _ => {
                if skip_gguf_value(&mut file, val_type).is_err() {
                    break;
                }
            }
        }
    }

    let filename = path.file_name().unwrap_or_default().to_string_lossy().to_string();
    let quant = extract_quantization(&filename);

    Ok(GgufMetadata {
        name: model_name.unwrap_or_else(|| filename.clone()),
        architecture: architecture.unwrap_or_else(|| "unknown".to_string()),
        parameter_count,
        context_length,
        quantization: quant,
    })
}

// trace:implements FR-009
/// Recursively scans a directory up to 5 levels deep for valid `.gguf` files (AC 1-6).
pub fn scan_directory_for_gguf(dir_path: &str) -> Result<Vec<UnifiedModel>, String> {
    if dir_path.trim().is_empty() {
        return Ok(Vec::new());
    }

    // AC 5: Reject system directories
    if is_forbidden_path(dir_path) {
        return Err(format!("Access denied: '{}' is a protected system directory.", dir_path));
    }

    let root = PathBuf::from(dir_path);
    if !root.exists() {
        return Err(format!("Directory not found: '{}'", dir_path));
    }
    if !root.is_dir() {
        return Err(format!("Path is not a directory: '{}'", dir_path));
    }

    let mut results = Vec::new();
    let mut dirs_to_visit = vec![(root, 0usize)];

    while let Some((current_dir, depth)) = dirs_to_visit.pop() {
        if depth > MAX_SCAN_DEPTH {
            continue;
        }

        let entries = match std::fs::read_dir(&current_dir) {
            Ok(e) => e,
            Err(_) => continue,
        };

        for entry in entries.filter_map(|e| e.ok()) {
            let p = entry.path();
            if p.is_dir() {
                if depth < MAX_SCAN_DEPTH {
                    dirs_to_visit.push((p, depth + 1));
                }
            } else if p.is_file() {
                if let Some(ext) = p.extension() {
                    if ext.eq_ignore_ascii_case("gguf") {
                        let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                        // AC 6: Skip files < 1 MB
                        if size < MIN_FILE_SIZE_BYTES {
                            continue;
                        }

                        let filename = p.file_name().unwrap_or_default().to_string_lossy().to_string();
                        let canonical = normalize_model_name(&filename);
                        let quant = extract_quantization(&filename);

                        // Try extracting GGUF metadata
                        let model_name = match parse_gguf_header(&p) {
                            Ok(meta) => meta.name,
                            Err(_) => filename.clone(),
                        };

                        results.push(UnifiedModel::new(
                            format!("gguf:{}", filename),
                            model_name,
                            canonical,
                            "gguf",
                            "gguf",
                            size,
                            quant,
                            false,
                        ));
                    }
                }
            }
        }
    }

    // Sort alphabetically by canonical name A→Z
    results.sort_by(|a, b| a.canonical_name.cmp(&b.canonical_name));
    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    // trace:verifies FR-009
    #[test]
    fn test_forbidden_paths() {
        assert!(is_forbidden_path("C:\\Windows"));
        assert!(is_forbidden_path("C:\\Windows\\System32"));
        assert!(is_forbidden_path("C:/Program Files/MyModel"));
        assert!(!is_forbidden_path("D:\\local-llm-hub\\models"));
        assert!(!is_forbidden_path("O:\\.ollama\\models"));
    }

    // trace:verifies FR-009
    #[test]
    fn test_scan_directory_forbidden_error() {
        let res = scan_directory_for_gguf("C:\\Windows");
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("protected system directory"));
    }

    // trace:verifies FR-009
    #[test]
    fn test_parse_gguf_header_mock_valid() {
        let temp_dir = std::env::temp_dir();
        let mock_file_path = temp_dir.join("test_model_mock.gguf");

        {
            let mut f = File::create(&mock_file_path).expect("create mock");
            // Magic 'GGUF'
            f.write_all(b"GGUF").expect("magic");
            // Version 3
            f.write_all(&3u32.to_le_bytes()).expect("version");
            // Tensor count: 10
            f.write_all(&10u64.to_le_bytes()).expect("tensors");
            // KV count: 2
            f.write_all(&2u64.to_le_bytes()).expect("kv count");

            // KV 1: "general.name" = "MockModel"
            let key1 = "general.name";
            f.write_all(&(key1.len() as u64).to_le_bytes()).expect("k1 len");
            f.write_all(key1.as_bytes()).expect("k1 bytes");
            f.write_all(&8u32.to_le_bytes()).expect("val type string");
            let val1 = "MockModel";
            f.write_all(&(val1.len() as u64).to_le_bytes()).expect("v1 len");
            f.write_all(val1.as_bytes()).expect("v1 bytes");

            // KV 2: "general.architecture" = "llama"
            let key2 = "general.architecture";
            f.write_all(&(key2.len() as u64).to_le_bytes()).expect("k2 len");
            f.write_all(key2.as_bytes()).expect("k2 bytes");
            f.write_all(&8u32.to_le_bytes()).expect("val type string");
            let val2 = "llama";
            f.write_all(&(val2.len() as u64).to_le_bytes()).expect("v2 len");
            f.write_all(val2.as_bytes()).expect("v2 bytes");
        }

        let meta = parse_gguf_header(&mock_file_path).expect("parse header");
        assert_eq!(meta.name, "MockModel");
        assert_eq!(meta.architecture, "llama");

        let _ = std::fs::remove_file(mock_file_path);
    }
}
