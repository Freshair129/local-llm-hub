// src-tauri/src/commands/share.rs
// trace:implements FR-010
//! High-Performance LAN Model & Directory Sharing Server with HTTP 206 Partial Content support.
//! Enables streaming large GGUF weights across LAN/Wi-Fi to other devices and workstations.
//! Compliant with ADR-100 (Safe Error Handling, Zero Panics, Safe Path Traversal Guards).

use crate::models::types::LanShareStatus;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

static SHARING_ACTIVE: AtomicBool = AtomicBool::new(false);

/// Discover available local area network IPv4 addresses
pub fn discover_lan_ips() -> Vec<String> {
    let mut ips = Vec::new();
    if let Ok(socket) = std::net::UdpSocket::bind("0.0.0.0:0") {
        // Dummy connect to detect default routing interface without sending packets
        if socket.connect("8.8.8.8:80").is_ok() {
            if let Ok(local_addr) = socket.local_addr() {
                ips.push(local_addr.ip().to_string());
            }
        }
    }
    if ips.is_empty() {
        ips.push("127.0.0.1".to_string());
    }
    ips
}

/// Validates that a requested subpath does not escape the designated share root (Path Traversal Guard)
pub fn safe_resolve_path(root: &Path, requested_rel_path: &str) -> Result<PathBuf, String> {
    let clean_rel = requested_rel_path.trim_start_matches('/').trim_start_matches('\\');
    let target = root.join(clean_rel);

    // Canonicalize both if exists
    if target.exists() {
        let canon_root = root.canonicalize().map_err(|e| e.to_string())?;
        let canon_target = target.canonicalize().map_err(|e| e.to_string())?;
        if canon_target.starts_with(&canon_root) {
            Ok(canon_target)
        } else {
            Err("Access Denied: Path traversal detected".to_string())
        }
    } else {
        // If file doesn't exist yet, check string prefix
        let normalized = target.to_string_lossy().to_string();
        if normalized.contains("..") {
            Err("Access Denied: Relative parent traversal detected".to_string())
        } else {
            Ok(target)
        }
    }
}

/// Parses HTTP 'Range: bytes=start-end' header into (start, optional_end)
pub fn parse_range_header(header_val: &str, total_size: u64) -> Option<(u64, u64)> {
    let prefix = "bytes=";
    let idx = header_val.find(prefix)?;
    let spec = &header_val[idx + prefix.len()..];
    let parts: Vec<&str> = spec.split('-').map(|s| s.trim()).collect();
    if parts.is_empty() {
        return None;
    }

    let start = parts[0].parse::<u64>().ok()?;
    let end = if parts.len() > 1 && !parts[1].is_empty() {
        parts[1].parse::<u64>().ok()?.min(total_size.saturating_sub(1))
    } else {
        total_size.saturating_sub(1)
    };

    if start <= end && start < total_size {
        Some((start, end))
    } else {
        None
    }
}

/// Counts total GGUF files in shared folder
pub fn count_shared_files(dir: &Path) -> usize {
    if !dir.exists() || !dir.is_dir() {
        return 0;
    }
    let mut count = 0;
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_file() {
                if let Some(ext) = p.extension() {
                    if ext.to_string_lossy().to_lowercase() == "gguf" {
                        count += 1;
                    }
                }
            }
        }
    }
    count
}

/// Starts LAN HTTP streaming server in the background
pub async fn start_lan_server(root_path: String, port: u16) -> Result<LanShareStatus, String> {
    let root = PathBuf::from(&root_path);
    if !root.exists() {
        return Err(format!("Shared directory does not exist: {}", root_path));
    }

    let bind_addr = format!("0.0.0.0:{}", port);
    let listener = TcpListener::bind(&bind_addr)
        .await
        .map_err(|e| format!("Failed to bind LAN server to {}: {}", bind_addr, e))?;

    SHARING_ACTIVE.store(true, Ordering::SeqCst);
    let lan_ips = discover_lan_ips();
    let download_urls = lan_ips.iter().map(|ip| format!("http://{}:{}/", ip, port)).collect();
    let total_files = count_shared_files(&root);

    let root_arc = Arc::new(root);

    // Spawn async background server loop
    tokio::spawn(async move {
        while SHARING_ACTIVE.load(Ordering::SeqCst) {
            match listener.accept().await {
                Ok((mut socket, _addr)) => {
                    let root_clone = Arc::clone(&root_arc);
                    tokio::spawn(async move {
                        let mut buf = [0u8; 4096];
                        if let Ok(n) = socket.read(&mut buf).await {
                            if n == 0 {
                                return;
                            }
                            let req = String::from_utf8_lossy(&buf[..n]);
                            let first_line = req.lines().next().unwrap_or("");
                            let mut parts = first_line.split_whitespace();
                            let method = parts.next().unwrap_or("GET");
                            let uri = parts.next().unwrap_or("/");

                            if method != "GET" && method != "HEAD" {
                                let _ = socket.write_all(b"HTTP/1.1 405 Method Not Allowed\r\n\r\n").await;
                                return;
                            }

                            // Extract Range header if present
                            let range_header = req
                                .lines()
                                .find(|l| l.to_lowercase().starts_with("range:"))
                                .unwrap_or("");

                            // Serve index HTML or file
                            if uri == "/" || uri.is_empty() {
                                let file_count = count_shared_files(&root_clone);
                                let html = format!(
                                    "<!DOCTYPE html><html><head><title>Local LLM Hub - LAN Share</title><style>body{{font-family:system-ui;background:#121824;color:#eee;padding:40px;}}a{{color:#60a5fa;}}</style></head><body><h1>📦 Local LLM Hub — LAN Share</h1><p>Sharing {} GGUF models across LAN.</p></body></html>",
                                    file_count
                                );
                                let resp = format!(
                                    "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                                    html.len(),
                                    html
                                );
                                let _ = socket.write_all(resp.as_bytes()).await;
                            } else {
                                match safe_resolve_path(&root_clone, uri) {
                                    Ok(file_path) if file_path.is_file() => {
                                        if let Ok(metadata) = std::fs::metadata(&file_path) {
                                            let file_len = metadata.len();
                                            if let Some((start, end)) = parse_range_header(range_header, file_len) {
                                                // HTTP 206 Partial Content
                                                let chunk_len = (end - start) + 1;
                                                let header = format!(
                                                    "HTTP/1.1 206 Partial Content\r\nContent-Type: application/octet-stream\r\nAccept-Ranges: bytes\r\nContent-Range: bytes {}-{}/{}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                                                    start, end, file_len, chunk_len
                                                );
                                                let _ = socket.write_all(header.as_bytes()).await;

                                                if method == "GET" {
                                                    if let Ok(mut f) = File::open(&file_path) {
                                                        let _ = f.seek(SeekFrom::Start(start));
                                                        let mut chunk = vec![0u8; 64 * 1024];
                                                        let mut remaining = chunk_len;
                                                        while remaining > 0 {
                                                            let to_read = remaining.min(chunk.len() as u64) as usize;
                                                            if let Ok(read_bytes) = f.read(&mut chunk[..to_read]) {
                                                                if read_bytes == 0 {
                                                                    break;
                                                                }
                                                                if socket.write_all(&chunk[..read_bytes]).await.is_err() {
                                                                    break;
                                                                }
                                                                remaining -= read_bytes as u64;
                                                            } else {
                                                                break;
                                                            }
                                                        }
                                                    }
                                                }
                                            } else {
                                                // Full HTTP 200 Content
                                                let header = format!(
                                                    "HTTP/1.1 200 OK\r\nContent-Type: application/octet-stream\r\nAccept-Ranges: bytes\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                                                    file_len
                                                );
                                                let _ = socket.write_all(header.as_bytes()).await;
                                                if method == "GET" {
                                                    if let Ok(mut f) = File::open(&file_path) {
                                                        let mut chunk = vec![0u8; 64 * 1024];
                                                        while let Ok(read_bytes) = f.read(&mut chunk) {
                                                            if read_bytes == 0 {
                                                                break;
                                                            }
                                                            if socket.write_all(&chunk[..read_bytes]).await.is_err() {
                                                                break;
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    _ => {
                                        let _ = socket.write_all(b"HTTP/1.1 404 Not Found\r\n\r\n").await;
                                    }
                                }
                            }
                        }
                    });
                }
                Err(_) => {
                    tokio::time::sleep(std::time::Duration::from_millis(50)).await;
                }
            }
        }
    });

    Ok(LanShareStatus {
        active: true,
        share_path: root_path,
        port,
        lan_ips,
        download_urls,
        total_files_shared: total_files,
    })
}

/// Stops LAN sharing server
pub fn stop_lan_server() {
    SHARING_ACTIVE.store(false, Ordering::SeqCst);
}

/// Gets current status of LAN server
pub fn get_lan_share_status(current_path: &str, port: u16) -> LanShareStatus {
    let active = SHARING_ACTIVE.load(Ordering::SeqCst);
    let lan_ips = discover_lan_ips();
    let download_urls = if active {
        lan_ips.iter().map(|ip| format!("http://{}:{}/", ip, port)).collect()
    } else {
        Vec::new()
    };
    let total_files = count_shared_files(Path::new(current_path));

    LanShareStatus {
        active,
        share_path: current_path.to_string(),
        port,
        lan_ips,
        download_urls,
        total_files_shared: total_files,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // trace:verifies FR-010
    #[test]
    fn test_parse_range_header() {
        let total = 1000;
        assert_eq!(parse_range_header("bytes=0-499", total), Some((0, 499)));
        assert_eq!(parse_range_header("bytes=500-", total), Some((500, 999)));
        assert_eq!(parse_range_header("bytes=999-999", total), Some((999, 999)));
        assert_eq!(parse_range_header("bytes=1500-2000", total), None); // Out of bounds
    }

    // trace:verifies FR-010
    #[test]
    fn test_safe_resolve_path_traversal_prevention() {
        let root = std::env::temp_dir();
        let res = safe_resolve_path(&root, "../../Windows/System32/cmd.exe");
        assert!(res.is_err());
        let err_msg = res.unwrap_err();
        assert!(err_msg.contains("Path traversal detected") || err_msg.contains("traversal"));
    }
}
