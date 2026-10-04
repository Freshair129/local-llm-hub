// src-tauri/src/lib.rs
// trace:implements PRJ-002

pub mod commands;
pub mod models;
pub mod sensors;
pub mod state;

use models::types::ProbeResult;
use sensors::SensorProvider;
use state::{AppState, BackendConfig, SharedAppState};
use std::sync::Arc;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, State, WindowEvent,
};

pub struct SensorHub {
    pub sysinfo: sensors::sysinfo_provider::SysinfoProvider,
    pub lhm: sensors::lhm_provider::LhmProvider,
}

impl Default for SensorHub {
    fn default() -> Self {
        Self {
            sysinfo: sensors::sysinfo_provider::SysinfoProvider::new(),
            lhm: sensors::lhm_provider::LhmProvider::new(),
        }
    }
}

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
    let entry = guard
        .model_stats
        .entry(model_id.clone())
        .or_insert_with(|| crate::models::types::ModelStats::new(&model_id));
    entry.record_execution(
        success,
        prompt_tokens,
        completion_tokens,
        duration_ms,
        error,
        now,
    );
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

// trace:implements FR-006
#[tauri::command]
async fn get_process_telemetry(
    sort_by: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<crate::models::types::ProcessMetric>, String> {
    let sort_by_mem = sort_by.as_deref() == Some("memory");
    let max_limit = limit.unwrap_or(25);
    Ok(commands::gpu::poll_top_processes(sort_by_mem, max_limit).await)
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
    let res = match commands::hub::HubBridge::from_env()? {
        Some(hub) => hub.chat(&request).await?,
        None => commands::chat::execute_chat(&client, &cfg, &request).await?,
    };

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    {
        let mut guard = state.lock().await;
        let entry = guard
            .model_stats
            .entry(request.model.clone())
            .or_insert_with(|| crate::models::types::ModelStats::new(&request.model));
        entry.record_execution(
            true,
            res.prompt_tokens,
            res.completion_tokens,
            res.duration_ms,
            None,
            now,
        );
    }

    Ok(res)
}

// trace:implements FR-023
#[tauri::command]
async fn run_hub_agent(
    agent_id: String,
    input: String,
    session_id: Option<String>,
) -> Result<serde_json::Value, String> {
    let hub = commands::hub::HubBridge::from_env()?.ok_or("HUB_DISABLED")?;
    hub.run(&agent_id, &input, session_id.as_deref()).await
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
    commands::proxy::generate_litellm_config(
        &models,
        &cfg.ollama_url,
        &cfg.vllm_url,
        std::path::Path::new(&output_path),
    )
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

// trace:implements FR-008
#[tauri::command]
async fn create_api_key(
    state: State<'_, SharedAppState>,
    name: String,
    role: String,
    allowed_models: Vec<String>,
    max_budget: Option<f64>,
    tpm_limit: Option<u64>,
    rpm_limit: Option<u64>,
    duration_days: Option<u32>,
) -> Result<crate::models::types::ApiKeyRecord, String> {
    commands::proxy::create_api_key_entry(
        &state,
        name,
        role,
        allowed_models,
        max_budget,
        tpm_limit,
        rpm_limit,
        duration_days,
    )
    .await
}

// trace:implements FR-008
#[tauri::command]
async fn list_api_keys(
    state: State<'_, SharedAppState>,
) -> Result<Vec<crate::models::types::ApiKeyRecord>, String> {
    Ok(commands::proxy::list_api_keys_entries(&state).await)
}

// trace:implements FR-008
#[tauri::command]
async fn toggle_api_key(state: State<'_, SharedAppState>, key_id: String) -> Result<bool, String> {
    commands::proxy::toggle_api_key_status(&state, &key_id).await
}

// trace:implements FR-008
#[tauri::command]
async fn delete_api_key(state: State<'_, SharedAppState>, key_id: String) -> Result<bool, String> {
    commands::proxy::delete_api_key_entry(&state, &key_id).await
}

// trace:implements FR-008
#[tauri::command]
async fn open_litellm_console(url: Option<String>) -> Result<String, String> {
    let target = url.unwrap_or_else(|| "http://127.0.0.1:4000/ui".to_string());
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let mut cmd = std::process::Command::new("cmd");
        cmd.args(["/c", "start", &target]);
        cmd.creation_flags(0x0800_0000);
        let _ = cmd.spawn();
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = std::process::Command::new("xdg-open").arg(&target).spawn();
    }
    Ok(target)
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
fn get_lan_share_status(
    current_path: String,
    port: Option<u16>,
) -> Result<crate::models::types::LanShareStatus, String> {
    Ok(commands::share::get_lan_share_status(
        &current_path,
        port.unwrap_or(8080),
    ))
}

// trace:implements FEAT-024
#[tauri::command]
fn generate_lan_pin(
    duration_secs: Option<u64>,
) -> Result<crate::models::types::LanSharePinSession, String> {
    Ok(commands::share::generate_ephemeral_pin(duration_secs))
}

// trace:implements FEAT-024
#[tauri::command]
fn verify_lan_pin(
    candidate: String,
) -> Result<crate::models::types::LanPinVerificationResult, String> {
    Ok(commands::share::verify_ephemeral_pin(&candidate))
}

// trace:implements FEAT-024
#[tauri::command]
fn clear_lan_pin() -> Result<bool, String> {
    commands::share::clear_ephemeral_pin();
    Ok(true)
}

// trace:implements FEAT-024
#[tauri::command]
fn get_active_lan_pin() -> Result<Option<crate::models::types::LanSharePinSession>, String> {
    Ok(commands::share::get_active_pin_session())
}

// trace:implements FEAT-023
#[tauri::command]
fn estimate_chat_tokens(
    prompt: String,
    max_context_length: Option<usize>,
) -> Result<crate::models::types::TokenEstimateResult, String> {
    Ok(commands::chat::estimate_chat_tokens(
        &prompt,
        max_context_length,
    ))
}

// trace:implements FR-014
#[tauri::command]
fn get_app_version() -> Result<crate::models::types::AppVersionInfo, String> {
    Ok(commands::updater::get_app_version())
}

// trace:implements FR-014
#[tauri::command]
async fn check_for_updates(
    endpoint_override: Option<String>,
) -> Result<crate::models::types::UpdateCheckResult, String> {
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
    let s_root =
        storage_root.unwrap_or_else(|| known_storages.first().cloned().unwrap_or_default());
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
    let s_root =
        storage_root.unwrap_or_else(|| known_storages.first().cloned().unwrap_or_default());
    let b_root = blob_pointer_root.unwrap_or(default_blob);
    commands::storage::execute_blob_offload(&blob_hash, &b_root, &s_root)
}

// trace:implements FR-006
#[tauri::command]
fn get_sensor_tree(
    sensor_hub: State<'_, Arc<SensorHub>>,
) -> Result<Vec<sensors::SensorReading>, String> {
    let mut readings = Vec::new();
    readings.extend(sensor_hub.sysinfo.read_all());
    if sensor_hub.lhm.available() {
        readings.extend(sensor_hub.lhm.read_all());
    }
    Ok(readings)
}

// trace:implements FR-006
#[tauri::command]
fn get_lhm_status(sensor_hub: State<'_, Arc<SensorHub>>) -> Result<serde_json::Value, String> {
    let available = sensor_hub.lhm.available();
    let note = if available {
        "LibreHardwareMonitor sidecar active (102+ deep sensors connected)"
    } else {
        "LHM sidecar not active — baseline sysinfo active"
    };
    Ok(serde_json::json!({
        "available": available,
        "note": note,
        "sidecar_binary": sensors::lhm_provider::locate_sidecar().map(|p| p.to_string_lossy().to_string())
    }))
}

// trace:implements FR-006
#[tauri::command]
fn set_fan_duty(
    sensor_hub: State<'_, Arc<SensorHub>>,
    id: String,
    percent: f64,
) -> Result<String, String> {
    if !sensor_hub.lhm.available() {
        return Err("LHM sidecar unavailable".to_string());
    }
    if sensor_hub.lhm.set_fan(&id, percent) {
        Ok(format!("Fan {} set to {:.0}%", id, percent))
    } else {
        Err(format!("Fan control failed for {}", id))
    }
}

// trace:implements FR-008
#[tauri::command]
fn hide_to_tray(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn show_from_tray(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
    Ok(())
}

#[tauri::command]
fn is_tray_mode_active() -> bool {
    true
}

#[tauri::command]
fn window_minimize(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.minimize().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn window_maximize(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_maximized().unwrap_or(false) {
            window.unmaximize().map_err(|e| e.to_string())?;
        } else {
            window.maximize().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
fn window_close(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        // Silently minimize to tray on close
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn window_start_dragging(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.start_dragging().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let initial_state = state::create_shared_state();
    let sensor_hub = Arc::new(SensorHub::default());

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(initial_state)
        .manage(sensor_hub)
        .setup(|app| {
            // Build Tray Menu items
            let show_item = MenuItem::with_id(app, "show", "Open Dashboard", true, None::<&str>)?;
            let hide_item =
                MenuItem::with_id(app, "hide", "Hide to Tray (Silent)", true, None::<&str>)?;
            let quit_item =
                MenuItem::with_id(app, "quit", "Exit Local LLM Hub", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &hide_item, &quit_item])?;

            // Build Tray Icon
            let mut builder = TrayIconBuilder::new()
                .tooltip("Local LLM Hub (Silent Background)")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                    "hide" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.hide();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.unminimize();
                                let _ = window.set_focus();
                            }
                        }
                    }
                });

            if let Some(icon) = app.default_window_icon() {
                builder = builder.icon(icon.clone());
            }

            let _tray = builder.build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                // Minimize to tray silently instead of killing background processes
                api.prevent_close();
                let _ = window.hide();
            }
        })
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
            get_process_telemetry,
            get_sensor_tree,
            get_lhm_status,
            set_fan_duty,
            send_chat_message,
            run_hub_agent,
            generate_proxy_config,
            get_proxy_status,
            create_api_key,
            list_api_keys,
            toggle_api_key,
            delete_api_key,
            open_litellm_console,
            start_lan_share,
            stop_lan_share,
            get_lan_share_status,
            generate_lan_pin,
            verify_lan_pin,
            clear_lan_pin,
            get_active_lan_pin,
            estimate_chat_tokens,
            get_app_version,
            check_for_updates,
            apply_update,
            get_storage_health,
            offload_storage_blob,
            hide_to_tray,
            show_from_tray,
            is_tray_mode_active,
            window_minimize,
            window_maximize,
            window_close,
            window_start_dragging,
            commands::swarm::register_worker_node,
            commands::swarm::list_worker_nodes,
            commands::swarm::offload_swarm_task
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

    // trace:verifies FR-006
    #[test]
    fn test_sensor_hub_sysinfo_baseline() {
        use crate::sensors::SensorProvider;
        let hub = crate::SensorHub::default();
        assert!(hub.sysinfo.available());
        let readings = hub.sysinfo.read_all();
        assert!(
            !readings.is_empty(),
            "sysinfo should return baseline sensors"
        );
        assert!(readings.iter().any(|r| r.kind == "load"));
        assert!(readings.iter().any(|r| r.kind == "data"));
    }

    // trace:verifies FR-006
    #[test]
    fn test_sensor_reading_serialization() {
        let reading = crate::sensors::SensorReading {
            id: "/test/temp/0".to_string(),
            name: "CPU Package".to_string(),
            hw: "Intel Core i7-8700K".to_string(),
            kind: "temperature".to_string(),
            value: 45.5,
            unit: "°C".to_string(),
        };
        let json = serde_json::to_string(&reading).expect("serialize reading");
        let parsed: crate::sensors::SensorReading =
            serde_json::from_str(&json).expect("deserialize reading");
        assert_eq!(parsed, reading);
    }
}
