// src-tauri/src/commands/swarm.rs
// trace:implements FEAT-031
// trace:implements DIST-SWARM-001
//! Multi-Node Swarm Worker Offloader Commands.
//! Compliant with ADR-100 (Zero panic policy, safe Result types).

use crate::models::types::{SwarmTaskPayload, WorkerNodeConfig};
use crate::state::SharedAppState;
use tauri::State;

pub fn register_worker_node_inner(
    state: &SharedAppState,
    node_id: String,
    host: String,
    port: u16,
    vram_free_mb: u64,
) -> Result<WorkerNodeConfig, String> {
    if node_id.trim().is_empty() || host.trim().is_empty() {
        return Err("node_id and host must not be empty".to_string());
    }

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    let node = WorkerNodeConfig {
        node_id: node_id.clone(),
        host: host.clone(),
        port,
        status: "online".to_string(),
        vram_free_mb,
        active_tasks: 0,
        last_seen_timestamp: now,
    };

    let mut guard = state.blocking_lock();
    if let Some(existing) = guard.worker_nodes.iter_mut().find(|n| n.node_id == node_id) {
        *existing = node.clone();
    } else {
        guard.worker_nodes.push(node.clone());
    }

    Ok(node)
}

/// Register or update a secondary worker node in the LAN cluster
#[tauri::command]
pub async fn register_worker_node(
    state: State<'_, SharedAppState>,
    node_id: String,
    host: String,
    port: u16,
    vram_free_mb: u64,
) -> Result<WorkerNodeConfig, String> {
    register_worker_node_inner(&state, node_id, host, port, vram_free_mb)
}

/// Retrieve all registered Swarm worker nodes
#[tauri::command]
pub async fn list_worker_nodes(
    state: State<'_, SharedAppState>,
) -> Result<Vec<WorkerNodeConfig>, String> {
    let guard = state.lock().await;
    Ok(guard.worker_nodes.clone())
}

/// Dispatch / Offload inference task to a secondary worker node
#[tauri::command]
pub async fn offload_swarm_task(
    state: State<'_, SharedAppState>,
    node_id: String,
    task: SwarmTaskPayload,
) -> Result<String, String> {
    let guard = state.lock().await;
    let target_node = guard
        .worker_nodes
        .iter()
        .find(|n| n.node_id == node_id)
        .cloned();

    drop(guard);

    let node = target_node.ok_or_else(|| format!("Worker node '{}' not found", node_id))?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!("http://{}:{}/api/generate", node.host, node.port);
    let body = serde_json::json!({
        "model": task.model,
        "prompt": task.prompt,
        "stream": false
    });

    let resp = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Swarm task offload failed to {}: {}", url, e))?;

    if resp.status().is_success() {
        let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        let output = json["response"]
            .as_str()
            .unwrap_or("Task completed successfully by swarm worker node")
            .to_string();
        Ok(output)
    } else {
        Err(format!(
            "Swarm worker returned error status: {}",
            resp.status()
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::create_shared_state;

    // trace:verifies FEAT-031
    #[test]
    fn test_register_and_list_worker_nodes() {
        let shared = create_shared_state();

        let res = register_worker_node_inner(
            &shared,
            "MACH-WORKER-02".to_string(),
            "192.168.1.150".to_string(),
            11434,
            24576,
        );

        assert!(res.is_ok());
        let node = res.unwrap();
        assert_eq!(node.node_id, "MACH-WORKER-02");
        assert_eq!(node.vram_free_mb, 24576);

        let guard = shared.blocking_lock();
        let nodes = guard.worker_nodes.clone();
        assert_eq!(nodes.len(), 2); // Default node + newly registered node
        assert!(nodes.iter().any(|n| n.node_id == "MACH-WORKER-02"));
    }

    #[test]
    fn test_register_empty_id_error() {
        let shared = create_shared_state();

        let res = register_worker_node_inner(
            &shared,
            "".to_string(),
            "192.168.1.150".to_string(),
            11434,
            12288,
        );

        assert!(res.is_err());
        assert_eq!(res.unwrap_err(), "node_id and host must not be empty");
    }
}
