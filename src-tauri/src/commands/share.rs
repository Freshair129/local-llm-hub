// src-tauri/src/commands/share.rs
// trace:implements FR-010
//! High-Performance LAN Model & Directory Sharing Server with HTTP 206 Partial Content support.
//! Enables streaming large GGUF weights across LAN/Wi-Fi to other devices and workstations.
//! Compliant with ADR-100 (Safe Error Handling, Zero Panics, Safe Path Traversal Guards).

use crate::models::types::{LanPinVerificationResult, LanSharePinSession, LanShareStatus};
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

static SHARING_ACTIVE: AtomicBool = AtomicBool::new(false);
static ACTIVE_PIN_SESSION: Mutex<Option<LanSharePinSession>> = Mutex::new(None);

// trace:implements FEAT-024
/// Generates an ephemeral 4-digit PIN session for LAN sharing
pub fn generate_ephemeral_pin(duration_secs: Option<u64>) -> LanSharePinSession {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(123456789);
    let pin_num = ((nanos ^ (nanos >> 16)) % 9000 + 1000) as u32;
    let pin_str = format!("{:04}", pin_num);
    let duration = duration_secs.unwrap_or(900); // 15 mins default
    let session = LanSharePinSession::new(pin_str, now, duration);

    if let Ok(mut lock) = ACTIVE_PIN_SESSION.lock() {
        *lock = Some(session.clone());
    }
    session
}

// trace:implements FEAT-024
/// Clears any active ephemeral PIN session
pub fn clear_ephemeral_pin() {
    if let Ok(mut lock) = ACTIVE_PIN_SESSION.lock() {
        *lock = None;
    }
}

// trace:implements FEAT-024
/// Retrieves active PIN session if set
pub fn get_active_pin_session() -> Option<LanSharePinSession> {
    if let Ok(lock) = ACTIVE_PIN_SESSION.lock() {
        lock.clone()
    } else {
        None
    }
}

// trace:implements FEAT-024
/// Verifies ephemeral PIN with constant-time comparison and rate limiting
pub fn verify_ephemeral_pin(candidate: &str) -> LanPinVerificationResult {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let mut lock = match ACTIVE_PIN_SESSION.lock() {
        Ok(l) => l,
        Err(_) => return LanPinVerificationResult {
            is_valid: false,
            message: "System lock error".to_string(),
            remaining_attempts: None,
        },
    };

    if let Some(session) = lock.as_mut() {
        if session.is_locked(now) {
            let wait_secs = session.lock_until.unwrap_or(now).saturating_sub(now);
            return LanPinVerificationResult {
                is_valid: false,
                message: format!("Session locked due to excessive failed attempts. Please retry in {}s.", wait_secs),
                remaining_attempts: Some(0),
            };
        }

        if now > session.expires_at {
            return LanPinVerificationResult {
                is_valid: false,
                message: "PIN session expired. Please generate a new PIN.".to_string(),
                remaining_attempts: None,
            };
        }

        if session.is_valid(candidate, now) {
            session.failed_attempts = 0;
            LanPinVerificationResult {
                is_valid: true,
                message: "Authentication successful".to_string(),
                remaining_attempts: Some(session.max_failed_attempts),
            }
        } else {
            session.failed_attempts += 1;
            if session.failed_attempts >= session.max_failed_attempts {
                session.is_locked = true;
                session.lock_until = Some(now + 60); // 60s lockout
                LanPinVerificationResult {
                    is_valid: false,
                    message: "Too many failed attempts. Locked for 60 seconds.".to_string(),
                    remaining_attempts: Some(0),
                }
            } else {
                let remaining = session.max_failed_attempts.saturating_sub(session.failed_attempts);
                LanPinVerificationResult {
                    is_valid: false,
                    message: format!("Invalid PIN. {} attempts remaining.", remaining),
                    remaining_attempts: Some(remaining),
                }
            }
        }
    } else {
        LanPinVerificationResult {
            is_valid: true,
            message: "No PIN authentication active for LAN share".to_string(),
            remaining_attempts: None,
        }
    }
}

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

                            // Extract Path and Query components
                            let mut uri_parts = uri.splitn(2, '?');
                            let clean_uri = uri_parts.next().unwrap_or("/");
                            let query_str = uri_parts.next().unwrap_or("");

                            // Authentication check if PIN session is active
                            let has_active_pin = {
                                if let Ok(lock) = ACTIVE_PIN_SESSION.lock() {
                                    lock.is_some()
                                } else {
                                    false
                                }
                            };

                            let mut authenticated = !has_active_pin;
                            if has_active_pin {
                                let pin_from_query = query_str.split('&').find_map(|pair| {
                                    let mut kv = pair.splitn(2, '=');
                                    let k = kv.next()?;
                                    let v = kv.next()?;
                                    if k.eq_ignore_ascii_case("pin") {
                                        Some(v.trim().to_string())
                                    } else {
                                        None
                                    }
                                });

                                let pin_from_header = req
                                    .lines()
                                    .find(|l| l.to_lowercase().starts_with("x-stream-pin:"))
                                    .and_then(|l| l.split(':').nth(1))
                                    .map(|v| v.trim().to_string());

                                if let Some(pin) = pin_from_query.or(pin_from_header) {
                                    let vres = verify_ephemeral_pin(&pin);
                                    if vres.is_valid {
                                        authenticated = true;
                                    }
                                }
                            }

                            if !authenticated {
                                let prompt_html = "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>LAN Share Locked</title><style>body{background:#0b0f19;color:#e2e8f0;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}form{background:#1e293b;padding:30px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.5);text-align:center;}input{font-size:24px;letter-spacing:6px;text-align:center;padding:10px;width:160px;margin-bottom:15px;background:#0f172a;border:1px solid #3b82f6;color:#fff;border-radius:8px;}button{background:#3b82f6;color:#fff;border:none;padding:10px 24px;border-radius:8px;font-size:16px;cursor:pointer;}</style></head><body><form method=\"GET\"><h2>🔒 Protected LAN Stream</h2><p style=\"color:#94a3b8;font-size:14px;\">Enter 4-digit PIN to access shared models</p><input type=\"password\" name=\"pin\" maxlength=\"4\" autofocus placeholder=\"••••\" required><br><button type=\"submit\">Unlock Stream</button></form></body></html>";
                                let resp = format!(
                                    "HTTP/1.1 401 Unauthorized\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                                    prompt_html.len(),
                                    prompt_html
                                );
                                let _ = socket.write_all(resp.as_bytes()).await;
                                return;
                            }

                            // Extract Range header if present
                            let range_header = req
                                .lines()
                                .find(|l| l.to_lowercase().starts_with("range:"))
                                .unwrap_or("");

                            // Serve index HTML or file
                            if clean_uri == "/" || clean_uri.is_empty() {
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
                                match safe_resolve_path(&root_clone, clean_uri) {
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

    // trace:verifies FEAT-024
    #[test]
    fn test_generate_and_verify_ephemeral_pin() {
        clear_ephemeral_pin();
        let session = generate_ephemeral_pin(Some(300));
        assert_eq!(session.pin.len(), 4);
        assert!(session.pin.chars().all(|c| c.is_ascii_digit()));

        let active = get_active_pin_session();
        assert!(active.is_some());
        assert_eq!(active.unwrap().pin, session.pin);

        // Verify correct PIN
        let ok_res = verify_ephemeral_pin(&session.pin);
        assert!(ok_res.is_valid);

        // Verify incorrect PIN
        let bad_res = verify_ephemeral_pin("0000");
        if session.pin != "0000" {
            assert!(!bad_res.is_valid);
        }

        clear_ephemeral_pin();
        let no_pin_res = verify_ephemeral_pin("1234");
        assert!(no_pin_res.is_valid); // No PIN required when cleared
    }

    // trace:verifies FEAT-024
    #[test]
    fn test_ephemeral_pin_lockout() {
        clear_ephemeral_pin();
        let session = generate_ephemeral_pin(Some(300));
        let bad_candidate = if session.pin == "9999" { "8888" } else { "9999" };

        for _ in 0..5 {
            let _ = verify_ephemeral_pin(bad_candidate);
        }

        let locked_res = verify_ephemeral_pin(bad_candidate);
        assert!(!locked_res.is_valid);
        assert!(locked_res.message.contains("locked") || locked_res.message.contains("Locked"));
        clear_ephemeral_pin();
    }
}

