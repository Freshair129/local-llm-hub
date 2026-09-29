//! LibreHardwareMonitor (LHM) sensor provider.
//!
//! Communicates with the C# sidecar (`lhm-sidecar.exe`) via newline-delimited JSON (NDJSON) over stdio.
//! Provides deep hardware sensors: CPU per-thread load/temperatures, GPU hotspot/fan RPMs,
//! motherboard voltages/fans, and storage thermals.
//!
//! Complies with ADR-100: Never panics, degrades cleanly when sidecar binary is unavailable.

use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::Mutex;

use serde::Deserialize;
use serde_json::json;

use super::{SensorProvider, SensorReading};

const SIDECAR_ENV_PRIMARY: &str = "LOCAL_LLM_LHM_SIDECAR";
const SIDECAR_ENV_FALLBACK: &str = "GHT_LHM_SIDECAR";
const SIDECAR_DEFAULT: &str = "lhm-sidecar.exe";

/// Locate the sidecar binary across standard runtime and workspace locations.
pub fn locate_sidecar() -> Option<PathBuf> {
    // 1. Explicit environment variable
    if let Ok(explicit) = std::env::var(SIDECAR_ENV_PRIMARY) {
        let p = PathBuf::from(explicit);
        if p.is_file() {
            return Some(p);
        }
    }
    if let Ok(explicit) = std::env::var(SIDECAR_ENV_FALLBACK) {
        let p = PathBuf::from(explicit);
        if p.is_file() {
            return Some(p);
        }
    }

    // 2. Next to running executable
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let candidate = dir.join(SIDECAR_DEFAULT);
            if candidate.is_file() {
                return Some(candidate);
            }
            let sub_candidate = dir.join("sidecar").join(SIDECAR_DEFAULT);
            if sub_candidate.is_file() {
                return Some(sub_candidate);
            }
        }
    }

    // 3. Local workspace candidate paths
    let workspace_candidates = [
        "sidecar/lhm-sidecar.exe",
        "../sidecar/lhm-sidecar.exe",
        "d:/local-llm-hub/sidecar/lhm-sidecar.exe",
        "D:\\local-llm-hub\\sidecar\\lhm-sidecar.exe",
        "G:\\.ollama_blobs_root\\apps\\ght\\sidecar-lhm\\bin\\Release\\publish\\lhm-sidecar.exe",
    ];

    for candidate in &workspace_candidates {
        let p = PathBuf::from(candidate);
        if p.is_file() {
            return Some(p);
        }
    }

    None
}

/// Active child process and stdio pipes.
struct SidecarConn {
    child: Child,
    stdin: ChildStdin,
    stdout: BufReader<ChildStdout>,
}

impl SidecarConn {
    fn spawn() -> Option<SidecarConn> {
        let path = locate_sidecar()?;
        let mut command = Command::new(&path);
        command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            command.creation_flags(CREATE_NO_WINDOW);
        }

        let mut child = command.spawn().ok()?;
        let stdin = child.stdin.take()?;
        let stdout = child.stdout.take()?;
        let mut conn = SidecarConn {
            child,
            stdin,
            stdout: BufReader::new(stdout),
        };

        // Handshake: ping must return pong
        match conn.request(&json!({ "cmd": "ping" })) {
            Some(reply) if reply.get("type").and_then(|t| t.as_str()) == Some("pong") => Some(conn),
            _ => {
                conn.kill();
                None
            }
        }
    }

    fn request(&mut self, payload: &serde_json::Value) -> Option<serde_json::Value> {
        let line = serde_json::to_string(payload).ok()?;
        self.stdin.write_all(line.as_bytes()).ok()?;
        self.stdin.write_all(b"\n").ok()?;
        self.stdin.flush().ok()?;

        let mut reply = String::new();
        let bytes = self.stdout.read_line(&mut reply).ok()?;
        if bytes == 0 {
            return None;
        }
        serde_json::from_str(reply.trim()).ok()
    }

    fn kill(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

#[derive(Deserialize)]
struct SidecarSensor {
    id: String,
    name: String,
    hw: String,
    #[serde(rename = "type")]
    kind: String,
    value: f64,
    unit: String,
}

#[derive(Deserialize)]
struct SidecarSnapshot {
    sensors: Vec<SidecarSensor>,
}

pub struct LhmProvider {
    conn: Mutex<Option<SidecarConn>>,
    available: std::sync::atomic::AtomicBool,
}

impl LhmProvider {
    pub fn new() -> Self {
        LhmProvider {
            conn: Mutex::new(None),
            available: std::sync::atomic::AtomicBool::new(false),
        }
    }

    fn set_available(&self, value: bool) {
        self.available
            .store(value, std::sync::atomic::Ordering::SeqCst);
    }

    fn with_conn<T>(&self, f: impl FnOnce(&mut SidecarConn) -> Option<T>) -> Option<T> {
        let mut guard = match self.conn.lock() {
            Ok(g) => g,
            Err(poisoned) => poisoned.into_inner(),
        };

        if guard.is_none() {
            match SidecarConn::spawn() {
                Some(conn) => {
                    *guard = Some(conn);
                    self.set_available(true);
                }
                None => {
                    self.set_available(false);
                    return None;
                }
            }
        }

        let conn = guard.as_mut()?;
        match f(conn) {
            Some(value) => {
                self.set_available(true);
                Some(value)
            }
            None => {
                if let Some(mut dead) = guard.take() {
                    dead.kill();
                }
                self.set_available(false);
                None
            }
        }
    }

    pub fn set_fan(&self, id: &str, percent: f64) -> bool {
        self.with_conn(|conn| {
            let reply = conn.request(&json!({
                "cmd": "set_fan",
                "id": id,
                "percent": percent
            }))?;
            let ok = reply.get("type").and_then(|t| t.as_str()) == Some("ack")
                && reply.get("ok").and_then(|o| o.as_bool()) == Some(true);
            Some(ok)
        })
        .unwrap_or(false)
    }
}

impl Default for LhmProvider {
    fn default() -> Self {
        Self::new()
    }
}

impl SensorProvider for LhmProvider {
    fn name(&self) -> &str {
        "lhm"
    }

    fn available(&self) -> bool {
        if self.available.load(std::sync::atomic::Ordering::SeqCst) {
            return true;
        }
        self.with_conn(|conn| {
            let reply = conn.request(&json!({ "cmd": "ping" }))?;
            if reply.get("type").and_then(|t| t.as_str()) == Some("pong") {
                Some(())
            } else {
                None
            }
        })
        .is_some()
    }

    fn read_all(&self) -> Vec<SensorReading> {
        self.with_conn(|conn| {
            let reply = conn.request(&json!({ "cmd": "snapshot" }))?;
            if reply.get("type").and_then(|t| t.as_str()) != Some("snapshot") {
                return None;
            }
            let snapshot: SidecarSnapshot = serde_json::from_value(reply).ok()?;
            let readings = snapshot
                .sensors
                .into_iter()
                .map(|s| SensorReading {
                    id: s.id,
                    name: s.name,
                    hw: s.hw,
                    kind: s.kind.to_lowercase(),
                    value: s.value,
                    unit: s.unit,
                })
                .collect();
            Some(readings)
        })
        .unwrap_or_default()
    }
}
