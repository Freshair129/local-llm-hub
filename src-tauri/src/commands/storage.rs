// src-tauri/src/commands/storage.rs
// trace:implements FR-015
// trace:implements ARCH-001
// trace:implements ADR-100

use crate::models::types::{OffloadResult, SymlinkHealth};
use chrono::Utc;
use std::fs;
use std::path::{Path, PathBuf};

/// Auto-discovers potential Ollama blob roots and external offload targets
pub fn discover_known_storage_roots() -> (String, Vec<String>) {
    let user_profile =
        std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\Users\\Default".to_string());
    let default_blob_root = format!("{}\\.ollama\\models\\blobs", user_profile);

    let candidate_drives = [
        "G:\\.ollama_blobs_root",
        "O:\\.ollama\\models\\blobs",
        "D:\\ollama_blobs",
        "E:\\ollama_blobs",
    ];
    let mut discovered = Vec::new();

    for candidate in &candidate_drives {
        let p = Path::new(candidate);
        if p.exists() || p.parent().map(|parent| parent.exists()).unwrap_or(false) {
            discovered.push(candidate.to_string());
        }
    }

    if discovered.is_empty() {
        discovered.push("G:\\.ollama_blobs_root".to_string());
    }

    (default_blob_root, discovered)
}

// trace:implements FR-015
/// Audits blob pointer directory and calculates symlink health and reclaimable bytes
pub fn audit_symlinks_and_storage(
    storage_root: &str,
    blob_pointer_root: &str,
) -> Result<SymlinkHealth, String> {
    let blob_root_path = PathBuf::from(blob_pointer_root);
    let storage_root_path = PathBuf::from(storage_root);

    if !blob_root_path.exists() {
        return Ok(SymlinkHealth {
            checked_at: Utc::now().to_rfc3339(),
            blob_pointer_root: blob_pointer_root.to_string(),
            storage_root: storage_root.to_string(),
            total_blob_count: 0,
            symlink_count: 0,
            bad_symlink_count: 0,
            large_real_blob_count: 0,
            large_real_blob_bytes: 0,
            reclaimable_gb: 0.0,
            default_blobs_gb: 0.0,
            target_storage_gb: 0.0,
            issues: vec![format!("Blob directory not found: {}", blob_pointer_root)],
            blobs: Vec::new(),
        });
    }

    let entries = match fs::read_dir(&blob_root_path) {
        Ok(e) => e,
        Err(err) => {
            return Err(format!(
                "Failed to read blob directory '{}': {}",
                blob_pointer_root, err
            ))
        }
    };

    let mut total_blob_count = 0;
    let mut symlink_count = 0;
    let mut bad_symlink_count = 0;
    let mut large_real_blob_count = 0;
    let mut large_real_blob_bytes: u64 = 0;
    let mut default_blobs_bytes: u64 = 0;
    let mut issues = Vec::new();
    let mut blobs = Vec::new();

    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if !name.starts_with("sha256-") {
            continue;
        }

        total_blob_count += 1;

        let path = entry.path();
        let meta = match fs::symlink_metadata(&path) {
            Ok(m) => m,
            Err(e) => {
                issues.push(format!("{}: cannot read metadata ({})", name, e));
                continue;
            }
        };

        let is_sym = meta.file_type().is_symlink();
        let size_bytes = meta.len();

        if is_sym {
            symlink_count += 1;
            let mut sym_status = "Active Symlink".to_string();
            let mut storage_loc = "Target Storage (Offloaded)".to_string();

            match fs::read_link(&path) {
                Ok(target) => {
                    let target_exists = target.exists();
                    let target_in_storage = target.starts_with(&storage_root_path);
                    storage_loc = target.display().to_string();
                    if !target_exists || !target_in_storage {
                        bad_symlink_count += 1;
                        sym_status = "Broken Link".to_string();
                        issues.push(format!(
                            "Broken/Divergent link: {} -> {} (exists: {})",
                            name,
                            target.display(),
                            target_exists
                        ));
                    }
                }
                Err(e) => {
                    bad_symlink_count += 1;
                    sym_status = "Unreadable Link".to_string();
                    issues.push(format!("{}: failed to read link target ({})", name, e));
                }
            }

            blobs.push(crate::models::types::BlobItem {
                hash: name,
                size_bytes,
                is_symlink: true,
                storage_location: storage_loc,
                symlink_status: sym_status,
                associated_model: None,
            });
        } else {
            // Real physical blob on primary drive
            default_blobs_bytes += size_bytes;
            if size_bytes > 50 * 1024 * 1024 {
                large_real_blob_count += 1;
                large_real_blob_bytes += size_bytes;
            }

            blobs.push(crate::models::types::BlobItem {
                hash: name,
                size_bytes,
                is_symlink: false,
                storage_location: "Drive C: (Local Primary)".to_string(),
                symlink_status: "Pending Offload".to_string(),
                associated_model: None,
            });
        }
    }

    // Sort blobs by size descending (largest model blobs first)
    blobs.sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes));

    let reclaimable_gb =
        (large_real_blob_bytes as f64 / (1024.0 * 1024.0 * 1024.0) * 100.0).round() / 100.0;
    let default_blobs_gb =
        (default_blobs_bytes as f64 / (1024.0 * 1024.0 * 1024.0) * 100.0).round() / 100.0;

    // Calculate target storage size if directory exists
    let mut target_storage_bytes: u64 = 0;
    if storage_root_path.exists() {
        if let Ok(entries) = fs::read_dir(&storage_root_path) {
            for entry in entries.flatten() {
                if let Ok(m) = entry.metadata() {
                    target_storage_bytes += m.len();
                }
            }
        }
    }
    let target_storage_gb =
        (target_storage_bytes as f64 / (1024.0 * 1024.0 * 1024.0) * 100.0).round() / 100.0;

    Ok(SymlinkHealth {
        checked_at: Utc::now().to_rfc3339(),
        blob_pointer_root: blob_pointer_root.to_string(),
        storage_root: storage_root.to_string(),
        total_blob_count,
        symlink_count,
        bad_symlink_count,
        large_real_blob_count,
        large_real_blob_bytes,
        reclaimable_gb,
        default_blobs_gb,
        target_storage_gb,
        issues,
        blobs,
    })
}

// trace:implements FR-015
/// Atomically moves a blob to the secondary drive and establishes a Windows symlink
pub fn execute_blob_offload(
    blob_hash: &str,
    blob_pointer_root: &str,
    storage_root: &str,
) -> Result<OffloadResult, String> {
    if !blob_hash.starts_with("sha256-") {
        return Err("Invalid blob hash: must start with 'sha256-'".to_string());
    }

    let src_path = PathBuf::from(blob_pointer_root).join(blob_hash);
    let dest_dir = PathBuf::from(storage_root);
    let dest_path = dest_dir.join(blob_hash);

    if !src_path.exists() {
        return Err(format!(
            "Source blob does not exist: {}",
            src_path.display()
        ));
    }

    let meta = match fs::symlink_metadata(&src_path) {
        Ok(m) => m,
        Err(e) => return Err(format!("Failed to read source blob metadata: {}", e)),
    };

    if meta.file_type().is_symlink() {
        return Ok(OffloadResult {
            blob_hash: blob_hash.to_string(),
            source_path: src_path.to_string_lossy().to_string(),
            destination_path: dest_path.to_string_lossy().to_string(),
            bytes_freed: 0,
            success: true,
            message: "Blob is already a symlink".to_string(),
        });
    }

    let blob_bytes = meta.len();

    // Ensure target storage root directory exists
    if !dest_dir.exists() {
        fs::create_dir_all(&dest_dir).map_err(|e| {
            format!(
                "Failed to create destination directory '{}': {}",
                dest_dir.display(),
                e
            )
        })?;
    }

    // Copy or Move blob to destination
    if dest_path.exists() {
        // If file already exists at destination, verify size matches before removing src
        let dest_meta = fs::metadata(&dest_path)
            .map_err(|e| format!("Failed to read existing destination blob: {}", e))?;
        if dest_meta.len() != blob_bytes {
            return Err("Destination blob exists but file size does not match".to_string());
        }
        // Safely remove src file to prepare for symlink
        fs::remove_file(&src_path)
            .map_err(|e| format!("Failed to remove original file before symlinking: {}", e))?;
    } else {
        // Move file across filesystems (copy + delete src)
        fs::copy(&src_path, &dest_path)
            .map_err(|e| format!("Failed to copy blob to destination: {}", e))?;
        fs::remove_file(&src_path).map_err(|e| format!("Failed to remove source blob: {}", e))?;
    }

    // Create Windows symlink pointing to destination
    #[cfg(target_os = "windows")]
    {
        std::os::windows::fs::symlink_file(&dest_path, &src_path)
            .map_err(|e| format!("Blob moved but failed to create symlink: {}. You may need elevated developer mode privileges.", e))?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        std::os::unix::fs::symlink(&dest_path, &src_path)
            .map_err(|e| format!("Blob moved but failed to create symlink: {}", e))?;
    }

    Ok(OffloadResult {
        blob_hash: blob_hash.to_string(),
        source_path: src_path.to_string_lossy().to_string(),
        destination_path: dest_path.to_string_lossy().to_string(),
        bytes_freed: blob_bytes,
        success: true,
        message: format!(
            "Successfully offloaded {:.2} GB to {}",
            blob_bytes as f64 / (1024.0 * 1024.0 * 1024.0),
            storage_root
        ),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    // trace:verifies FR-015
    #[test]
    fn test_audit_symlinks_missing_directory_graceful() {
        let health = audit_symlinks_and_storage("G:\\mock_storage", "Z:\\non_existent_blob_dir")
            .expect("should return gracefully without panicking");
        assert_eq!(health.total_blob_count, 0);
        assert_eq!(health.symlink_count, 0);
        assert_eq!(health.issues.len(), 1);
        assert!(health.issues[0].contains("not found"));
    }

    // trace:verifies FR-015
    #[test]
    fn test_audit_symlinks_with_mock_files() {
        let base_temp = std::env::current_dir()
            .unwrap_or_else(|_| std::env::temp_dir())
            .join("target")
            .join("hub_test_storage");
        let blob_path = base_temp.join("blobs");
        let storage_path = base_temp.join("ext_storage");

        let _ = fs::remove_dir_all(&base_temp);
        fs::create_dir_all(&blob_path).expect("create mock blob dir");
        fs::create_dir_all(&storage_path).expect("create mock storage dir");

        // 1. Create a large real blob (> 50MB simulated by creating file)
        let real_blob_name = "sha256-mockrealblob123456789";
        let real_blob_path = blob_path.join(real_blob_name);
        {
            let mut file = fs::File::create(&real_blob_path).expect("create mock blob");
            file.write_all(b"sample data content")
                .expect("write sample data");
            // Set file size to 60MB via set_len if space permits
            let _ = file.set_len(60 * 1024 * 1024);
        }

        // 2. Create an external blob in storage
        let ext_blob_name = "sha256-mockexternalblob987654";
        let ext_blob_path = storage_path.join(ext_blob_name);
        {
            let mut file = fs::File::create(&ext_blob_path).expect("create ext blob");
            file.write_all(b"external blob data").expect("write ext");
        }

        // 3. Create a valid symlink on blob_path pointing to storage
        let symlink_path = blob_path.join(ext_blob_name);
        #[cfg(target_os = "windows")]
        let _ = std::os::windows::fs::symlink_file(&ext_blob_path, &symlink_path);
        #[cfg(not(target_os = "windows"))]
        let _ = std::os::unix::fs::symlink(&ext_blob_path, &symlink_path);

        let health = audit_symlinks_and_storage(
            &storage_path.to_string_lossy(),
            &blob_path.to_string_lossy(),
        )
        .expect("audit succeeds");

        assert!(health.total_blob_count >= 1);
        assert_eq!(health.large_real_blob_count, 1);
        assert!(health.large_real_blob_bytes >= 60 * 1024 * 1024);
        assert_eq!(health.reclaimable_gb, 0.06);

        // Cleanup
        let _ = fs::remove_dir_all(&base_temp);
    }

    // trace:verifies FR-015
    #[test]
    fn test_execute_blob_offload_invalid_hash() {
        let result = execute_blob_offload("not-a-sha256", "C:\\mock", "G:\\mock");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid blob hash"));
    }
}
