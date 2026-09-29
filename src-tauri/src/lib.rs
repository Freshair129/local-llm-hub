// src-tauri/src/lib.rs
// trace:implements PRJ-002

pub mod commands;
pub mod models;
pub mod state;

use models::types::ProbeResult;
use state::{AppState, BackendConfig, SharedAppState};
use tauri::State;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn get_app_state(state: State<'_, SharedAppState>) -> Result<AppState, String> {
    let guard = state.lock().await;
    Ok(guard.clone())
}

// trace:implements FR-001
#[tauri::command]
async fn probe_backends(
    state: State<'_, SharedAppState>,
    config: Option<BackendConfig>,
) -> Result<Vec<ProbeResult>, String> {
    let cfg = match config {
        Some(c) => c,
        None => {
            let guard = state.lock().await;
            guard.backends.clone()
        }
    };
    let results = commands::backends::probe_all_backends(&cfg).await;
    Ok(results)
}

// trace:implements FR-002
#[tauri::command]
async fn list_all_models(
    state: State<'_, SharedAppState>,
) -> Result<Vec<crate::models::types::UnifiedModel>, String> {
    let cfg = {
        let guard = state.lock().await;
        guard.backends.clone()
    };
    let probes = commands::backends::probe_all_backends(&cfg).await;
    let models = commands::models::aggregate_models(&cfg, &probes).await;

    // Persist into central AppState and attach model stats
    let models_with_stats = {
        let mut guard = state.lock().await;
        let mut list = models;
        for m in &mut list {
            m.stats = guard.model_stats.get(&m.id).cloned();
        }
        guard.models = list.clone();
        list
    };

    Ok(models_with_stats)
}

// trace:implements FR-003
#[tauri::command]
async fn get_duplicate_groups(
    state: State<'_, SharedAppState>,
) -> Result<Vec<crate::models::types::DuplicateInfo>, String> {
    let models = {
        let guard = state.lock().await;
        guard.models.clone()
    };
    let (_, groups) = commands::models::dedup_models(&models);
    Ok(groups)
}

// trace:implements FR-009
#[tauri::command]
async fn scan_directory_for_gguf(
    state: State<'_, SharedAppState>,
    path: String,
) -> Result<Vec<crate::models::types::UnifiedModel>, String> {
    let new_models = commands::scanner::scan_directory_for_gguf(&path)?;

    // Merge into central AppState models and update dedup
    {
        let mut guard = state.lock().await;
        for m in &new_models {
            if !guard.models.iter().any(|existing| existing.id == m.id) {
                guard.models.push(m.clone());
            }
        }
        let (updated, _) = commands::models::dedup_models(&guard.models);
        guard.models = updated;
    }

    Ok(new_models)
}

// trace:implements FR-006
#[tauri::command]
async fn record_task_stat(
    state: State<'_, SharedAppState>,
    model_id: String,
    success: bool,
    prompt_tokens: u64,
    completion_tokens: u64,
    duration_ms: u64,
    error: Option<String>,
) -> Result<crate::models::types::ModelStats, String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);

    let mut guard = state.lock().await;
    let entry = guard.model_stats.entry(model_id.clone()).or_insert_with(|| crate::models::types::ModelStats::new(&model_id));
    entry.record_execution(success, prompt_tokens, completion_tokens, duration_ms, error, now);
    let updated_stat = entry.clone();

    // Update model inside guard.models if already cached
    for m in &mut guard.models {
        if m.id == model_id {
            m.stats = Some(updated_stat.clone());
        }
    }

    Ok(updated_stat)
}

// trace:implements FR-006
#[tauri::command]
async fn get_all_model_stats(
    state: State<'_, SharedAppState>,
) -> Result<std::collections::HashMap<String, crate::models::types::ModelStats>, String> {
    let guard = state.lock().await;
    Ok(guard.model_stats.clone())
}

// trace:implements FR-004
#[tauri::command]
async fn get_model_card(
    model_id: String,
    backend: String,
    local_path: Option<String>,
) -> Result<crate::commands::modelcard::ModelCardInfo, String> {
    crate::commands::modelcard::read_model_card(&model_id, &backend, local_path.as_deref()).await
}

// trace:implements FR-005
#[tauri::command]
async fn start_model(
    state: State<'_, SharedAppState>,
    backend: String,
    model_name: String,
) -> Result<String, String> {
    let (cfg, client) = {
        let guard = state.lock().await;
        (guard.backends.clone(), reqwest::Client::new())
    };
    commands::backends::start_model(&client, &cfg, &backend, &model_name).await
}

// trace:implements FR-005
#[tauri::command]
async fn stop_model(
    state: State<'_, SharedAppState>,
    backend: String,
    model_name: String,
) -> Result<String, String> {
    let (cfg, client) = {
        let guard = state.lock().await;
        (guard.backends.clone(), reqwest::Client::new())
    };
    commands::backends::stop_model(&client, &cfg, &backend, &model_name).await
}

// trace:implements FR-012
#[tauri::command]
async fn pull_model(
    state: State<'_, SharedAppState>,
    model_name: String,
) -> Result<String, String> {
    let (cfg, client) = {
        let guard = state.lock().await;
        (guard.backends.clone(), reqwest::Client::new())
    };
    commands::backends::pull_model(&client, &cfg, &model_name).await
}

// trace:implements FR-006
#[tauri::command]
async fn get_hardware_telemetry() -> Result<crate::models::types::HardwareTelemetry, String> {
    Ok(commands::gpu::poll_hardware_telemetry().await)
}

// trace:implements FR-007
#[tauri::command]
async fn send_chat_message(
    state: State<'_, SharedAppState>,
    request: crate::models::types::ChatRequest,
) -> Result<crate::models::types::ChatResponse, String> {
    let (cfg, client) = {
        let guard = state.lock().await;
        (guard.backends.clone(), reqwest::Client::new())
    };
    let res = commands::chat::execute_chat(&client, &cfg, &request).await?;

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    {
        let mut guard = state.lock().await;
        let entry = guard.model_stats.entry(request.model.clone()).or_insert_with(|| crate::models::types::ModelStats::new(&request.model));
        entry.record_execution(true, res.prompt_tokens, res.completion_tokens, res.duration_ms, None, now);
    }

    Ok(res)
}

// trace:implements FR-008
#[tauri::command]
async fn generate_proxy_config(
    state: State<'_, SharedAppState>,
    output_path: String,
) -> Result<String, String> {
    let (cfg, models) = {
        let guard = state.lock().await;
        (guard.backends.clone(), guard.models.clone())
    };
    commands::proxy::generate_litellm_config(&models, &cfg.ollama_url, &cfg.vllm_url, std::path::Path::new(&output_path))
}

// trace:implements FR-008
#[tauri::command]
async fn get_proxy_status(
    state: State<'_, SharedAppState>,
    config_path: String,
) -> Result<crate::models::types::ProxyStatus, String> {
    let models = {
        let guard = state.lock().await;
        guard.models.clone()
    };
    Ok(commands::proxy::check_proxy_status(4000, &config_path, &models).await)
}

// trace:implements FR-010
#[tauri::command]
async fn start_lan_share(
    root_path: String,
    port: Option<u16>,
) -> Result<crate::models::types::LanShareStatus, String> {
    commands::share::start_lan_server(root_path, port.unwrap_or(8080)).await
}

// trace:implements FR-010
#[tauri::command]
fn stop_lan_share() -> Result<String, String> {
    commands::share::stop_lan_server();
    Ok("LAN share server stopped".to_string())
}

// trace:implements FR-010
#[tauri::command]
fn get_lan_share_status(current_path: String, port: Option<u16>) -> Result<crate::models::types::LanShareStatus, String> {
    Ok(commands::share::get_lan_share_status(&current_path, port.unwrap_or(8080)))
}

// trace:implements FR-014
#[tauri::command]
fn get_app_version() -> Result<crate::models::types::AppVersionInfo, String> {
    Ok(commands::updater::get_app_version())
}

// trace:implements FR-014
#[tauri::command]
async fn check_for_updates(endpoint_override: Option<String>) -> Result<crate::models::types::UpdateCheckResult, String> {
    let client = reqwest::Client::new();
    commands::updater::check_for_updates(&client, endpoint_override.as_deref()).await
}

// trace:implements FR-014
#[tauri::command]
async fn apply_update(download_url: String) -> Result<String, String> {
    commands::updater::apply_update_package(&download_url).await
}

// trace:implements FR-015
#[tauri::command]
fn get_storage_health(
    storage_root: Option<String>,
    blob_pointer_root: Option<String>,
) -> Result<crate::models::types::SymlinkHealth, String> {
    let (default_blob, known_storages) = commands::storage::discover_known_storage_roots();
    let s_root = storage_root.unwrap_or_else(|| known_storages.first().cloned().unwrap_or_default());
    let b_root = blob_pointer_root.unwrap_or(default_blob);
    commands::storage::audit_symlinks_and_storage(&s_root, &b_root)
}

// trace:implements FR-015
#[tauri::command]
fn offload_storage_blob(
    blob_hash: String,
    blob_pointer_root: Option<String>,
    storage_root: Option<String>,
) -> Result<crate::models::types::OffloadResult, String> {
    let (default_blob, known_storages) = commands::storage::discover_known_storage_roots();
    let s_root = storage_root.unwrap_or_else(|| known_storages.first().cloned().unwrap_or_default());
    let b_root = blob_pointer_root.unwrap_or(default_blob);
    commands::storage::execute_blob_offload(&blob_hash, &b_root, &s_root)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let initial_state = state::create_shared_state();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(initial_state)
        .invoke_handler(tauri::generate_handler![
            greet,
            get_app_state,
            probe_backends,
            list_all_models,
            get_duplicate_groups,
            scan_directory_for_gguf,
            record_task_stat,
            get_all_model_stats,
            get_model_card,
            start_model,
            stop_model,
            pull_model,
            get_hardware_telemetry,
            send_chat_message,
            generate_proxy_config,
            get_proxy_status,
            start_lan_share,
            stop_lan_share,
            get_lan_share_status,
            get_app_version,
            check_for_updates,
            apply_update,
            get_storage_health,
            offload_storage_blob
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use crate::commands::backends::probe_all_backends;
    use crate::models::types::ProbeResult;
    use crate::state::BackendConfig;

    // trace:verifies FR-002
    #[tokio::test]
    async fn test_list_all_models_handler() {
        let cfg = BackendConfig::default();
        let probes = vec![
            ProbeResult::offline("ollama", "Offline"),
            ProbeResult::offline("vllm", "Offline"),
            ProbeResult::offline("gguf", "Offline"),
        ];
        let models = crate::commands::models::aggregate_models(&cfg, &probes).await;
        assert!(models.is_empty());
    }

    // trace:verifies FR-001
    #[tokio::test]
    async fn test_probe_backends_handler() {
        let cfg = BackendConfig::default();
        let results = probe_all_backends(&cfg).await;
        assert_eq!(results.len(), 4);
        assert_eq!(results[0].backend, "ollama");
        assert_eq!(results[1].backend, "vllm");
        assert_eq!(results[2].backend, "hf");
        assert_eq!(results[3].backend, "gguf");
    }
}


