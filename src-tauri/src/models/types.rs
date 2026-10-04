// src-tauri/src/models/types.rs
// trace:implements FR-001
//! Core data transfer and domain models for Local LLM Hub.
//! Complies with ADR-100 (Safe Error Handling, Strict Result types).

use serde::{Deserialize, Serialize};

/// Result of probing an individual LLM inference backend or storage location.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProbeResult {
    /// Identifier of the backend: "ollama", "vllm", "hf", "gguf"
    pub backend: String,
    /// Status: "online", "offline", "error"
    pub status: String,
    /// Measured round-trip latency in milliseconds if reachable
    pub latency_ms: Option<u64>,
    /// Server software or library version reported by the backend
    pub version: Option<String>,
    /// Human-readable error message explaining failure reason
    pub error_message: Option<String>,
}

impl ProbeResult {
    /// Construct a successful online probe result
    pub fn online(backend: impl Into<String>, latency_ms: u64, version: Option<String>) -> Self {
        Self {
            backend: backend.into(),
            status: "online".to_string(),
            latency_ms: Some(latency_ms),
            version,
            error_message: None,
        }
    }

    /// Construct an offline probe result with a human-readable failure reason
    pub fn offline(backend: impl Into<String>, error_message: impl Into<String>) -> Self {
        Self {
            backend: backend.into(),
            status: "offline".to_string(),
            latency_ms: None,
            version: None,
            error_message: Some(error_message.into()),
        }
    }

    /// Construct an error probe result
    pub fn error(backend: impl Into<String>, error_message: impl Into<String>) -> Self {
        Self {
            backend: backend.into(),
            status: "error".to_string(),
            latency_ms: None,
            version: None,
            error_message: Some(error_message.into()),
        }
    }

    /// Check if backend is online
    pub fn is_online(&self) -> bool {
        self.status == "online"
    }
}

// trace:implements FR-002
// trace:implements FR-003
// trace:implements FR-006
/// Unified model representation aggregating across Ollama, vLLM, HF, and GGUF
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct UnifiedModel {
    pub id: String,
    pub name: String,
    pub canonical_name: String,
    pub backend: String,
    pub format: String,
    pub size_bytes: u64,
    pub quantization: Option<String>,
    pub is_active: bool,
    #[serde(default)]
    pub is_duplicate: bool,
    #[serde(default)]
    pub is_preferred: bool,
    #[serde(default)]
    pub duplicate_group: Option<String>,
    #[serde(default)]
    pub duplicate_backends: Vec<String>,
    #[serde(default)]
    pub stats: Option<ModelStats>,
    #[serde(default)]
    pub tags: Vec<String>,
}

impl UnifiedModel {
    pub fn new(
        id: impl Into<String>,
        name: impl Into<String>,
        canonical_name: impl Into<String>,
        backend: impl Into<String>,
        format: impl Into<String>,
        size_bytes: u64,
        quantization: Option<String>,
        is_active: bool,
    ) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
            canonical_name: canonical_name.into(),
            backend: backend.into(),
            format: format.into(),
            size_bytes,
            quantization,
            is_active,
            is_duplicate: false,
            is_preferred: false,
            duplicate_group: None,
            duplicate_backends: Vec::new(),
            stats: None,
            tags: Vec::new(),
        }
    }
}

// trace:implements FR-006
/// Execution, performance, and token usage statistics for a local model
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ModelStats {
    pub model_id: String,
    pub total_tasks: u64,
    pub successful_tasks: u64,
    pub failed_tasks: u64,
    pub total_prompt_tokens: u64,
    pub total_completion_tokens: u64,
    pub total_tokens: u64,
    pub total_duration_ms: u64,
    pub avg_tps: f64,
    pub last_used_timestamp: Option<u64>,
    pub last_error: Option<String>,
}

impl ModelStats {
    pub fn new(model_id: impl Into<String>) -> Self {
        Self {
            model_id: model_id.into(),
            total_tasks: 0,
            successful_tasks: 0,
            failed_tasks: 0,
            total_prompt_tokens: 0,
            total_completion_tokens: 0,
            total_tokens: 0,
            total_duration_ms: 0,
            avg_tps: 0.0,
            last_used_timestamp: None,
            last_error: None,
        }
    }

    pub fn record_execution(
        &mut self,
        success: bool,
        prompt_tokens: u64,
        completion_tokens: u64,
        duration_ms: u64,
        error: Option<String>,
        timestamp: u64,
    ) {
        self.total_tasks += 1;
        if success {
            self.successful_tasks += 1;
        } else {
            self.failed_tasks += 1;
        }

        self.total_prompt_tokens += prompt_tokens;
        self.total_completion_tokens += completion_tokens;
        self.total_tokens += prompt_tokens + completion_tokens;
        self.total_duration_ms += duration_ms;
        self.last_used_timestamp = Some(timestamp);
        self.last_error = error;

        if self.total_duration_ms > 0 && self.total_completion_tokens > 0 {
            let duration_sec = self.total_duration_ms as f64 / 1000.0;
            self.avg_tps =
                (self.total_completion_tokens as f64 / duration_sec * 10.0).round() / 10.0;
        }
    }

    pub fn success_rate(&self) -> f64 {
        if self.total_tasks == 0 {
            0.0
        } else {
            ((self.successful_tasks as f64 / self.total_tasks as f64) * 100.0 * 10.0).round() / 10.0
        }
    }
}

// trace:implements FR-003
/// Represents a group of duplicate models sharing the same canonical name
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DedupGroup {
    pub canonical_name: String,
    pub preferred_backend: String,
    pub models: Vec<UnifiedModel>,
}

// trace:implements FR-003
/// Summary information for duplicate models across multiple backends
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DuplicateInfo {
    pub canonical_name: String,
    pub preferred_backend: String,
    pub instances: Vec<UnifiedModel>,
}

// trace:implements FR-009
/// Extracted metadata from GGUF binary header without loading model weights
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GgufMetadata {
    pub name: String,
    pub architecture: String,
    pub parameter_count: Option<u64>,
    pub context_length: Option<u64>,
    pub quantization: Option<String>,
}

// trace:implements FR-006
/// GPU information and VRAM utilization
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GpuInfo {
    pub index: u32,
    pub name: String,
    pub vram_used_bytes: u64,
    pub vram_total_bytes: u64,
    pub utilization_pct: u32,
    pub temperature_c: Option<u32>,
}

// trace:implements FR-006
/// System RAM, CPU, and GPU hardware telemetry
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct HardwareTelemetry {
    pub system_ram_used_bytes: u64,
    pub system_ram_total_bytes: u64,
    pub cpu_usage_pct: f32,
    pub gpus: Vec<GpuInfo>,
}

// trace:implements FR-006
/// Process execution and resource consumption metric (Task Manager ranker)
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessMetric {
    pub pid: String,
    pub name: String,
    pub cpu_usage: f32,
    pub memory_bytes: u64,
    pub virtual_memory_bytes: u64,
    pub disk_read_bytes: u64,
    pub disk_written_bytes: u64,
}

// trace:implements FR-007
/// Chat message for interactive playground
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

// trace:implements FR-007
/// Request payload to run chat inference against local models
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ChatRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    pub backend: Option<String>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
}

// trace:implements FR-007
/// Chat completion response with token usage and speed metrics
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ChatResponse {
    pub role: String,
    pub content: String,
    pub prompt_tokens: u64,
    pub completion_tokens: u64,
    pub duration_ms: u64,
    pub tps: f64,
}

// trace:implements FR-008
/// Status and configuration of the LiteLLM unified proxy sidecar
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProxyStatus {
    pub running: bool,
    pub port: u16,
    pub config_path: String,
    pub registered_models: Vec<String>,
    pub base_url: String,
}

use std::sync::atomic::{AtomicU64, Ordering};
static API_KEY_COUNTER: AtomicU64 = AtomicU64::new(1001);

// trace:implements FR-008
/// LiteLLM-compatible Virtual API Key Record with scoped permissions & budgets
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiKeyRecord {
    pub key_id: String,
    pub key_secret: String,
    pub name: String,
    pub role: String,
    pub allowed_models: Vec<String>,
    pub max_budget: Option<f64>,
    pub spend: f64,
    pub tpm_limit: Option<u64>,
    pub rpm_limit: Option<u64>,
    pub created_at: u64,
    pub expires_at: Option<u64>,
    pub active: bool,
}

impl ApiKeyRecord {
    pub fn new(
        name: impl Into<String>,
        role: impl Into<String>,
        allowed_models: Vec<String>,
        max_budget: Option<f64>,
        tpm_limit: Option<u64>,
        rpm_limit: Option<u64>,
        duration_days: Option<u32>,
    ) -> Self {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        let seq = API_KEY_COUNTER.fetch_add(1, Ordering::Relaxed);
        let key_id = format!("key_{:x}{:04x}", (now & 0xffffff) as u32, seq % 0xffff);
        let key_secret = format!(
            "sk-litellm-{:08x}{:04x}{:04x}",
            (now & 0xffffffff) as u32,
            seq % 0xffff,
            ((now >> 16) ^ (seq as u64)) & 0xffff
        );

        let expires_at = duration_days.map(|days| now + (days as u64 * 86_400_000));

        Self {
            key_id,
            key_secret,
            name: name.into(),
            role: role.into(),
            allowed_models,
            max_budget,
            spend: 0.0,
            tpm_limit,
            rpm_limit,
            created_at: now,
            expires_at,
            active: true,
        }
    }

    pub fn is_expired(&self, now_ms: u64) -> bool {
        match self.expires_at {
            Some(exp) => now_ms > exp,
            None => false,
        }
    }

    pub fn can_access_model(&self, model: &str) -> bool {
        if !self.active {
            return false;
        }
        if self
            .allowed_models
            .iter()
            .any(|m| m == "*" || m.eq_ignore_ascii_case("all"))
        {
            return true;
        }
        self.allowed_models
            .iter()
            .any(|m| m.eq_ignore_ascii_case(model))
    }
}

// trace:implements FR-010
/// Configuration and status of the LAN Model/Directory Sharing HTTP service
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LanShareStatus {
    pub active: bool,
    pub share_path: String,
    pub port: u16,
    pub lan_ips: Vec<String>,
    pub download_urls: Vec<String>,
    pub total_files_shared: usize,
}

// trace:implements FR-014
/// Metadata describing the installed desktop application version
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AppVersionInfo {
    pub current_version: String,
    pub app_name: String,
    pub target_platform: String,
    pub release_channel: String,
    pub git_commit: String,
    pub build_date: String,
}

// trace:implements FR-014
/// Result of querying remote update server or manifest
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct UpdateCheckResult {
    pub has_update: bool,
    pub current_version: String,
    pub latest_version: String,
    pub release_notes: String,
    pub download_url: Option<String>,
    pub published_at: Option<String>,
    pub is_critical: bool,
}

// trace:implements FR-015
/// Detailed descriptor for a single Ollama model blob file
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BlobItem {
    pub hash: String,
    pub size_bytes: u64,
    pub is_symlink: bool,
    pub storage_location: String,
    pub symlink_status: String,
    pub associated_model: Option<String>,
}

// trace:implements FR-015
/// Storage health analysis and symlink offload summary
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SymlinkHealth {
    pub checked_at: String,
    pub blob_pointer_root: String,
    pub storage_root: String,
    pub total_blob_count: usize,
    pub symlink_count: usize,
    pub bad_symlink_count: usize,
    pub large_real_blob_count: usize,
    pub large_real_blob_bytes: u64,
    pub reclaimable_gb: f64,
    pub default_blobs_gb: f64,
    pub target_storage_gb: f64,
    pub issues: Vec<String>,
    pub blobs: Vec<BlobItem>,
}

// trace:implements FR-015
/// Result of atomic blob offloading to external storage
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct OffloadResult {
    pub blob_hash: String,
    pub source_path: String,
    pub destination_path: String,
    pub bytes_freed: u64,
    pub success: bool,
    pub message: String,
}

// trace:implements FEAT-023
/// Context threshold levels for prompt token warnings
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ContextThresholdLevel {
    Safe,    // < 70% of context window
    Warning, // 70% - 90% of context window
    Danger,  // > 90% of context window
}

// trace:implements FEAT-023
/// Request for pre-flight prompt token estimation
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TokenEstimateRequest {
    pub prompt: String,
    pub model_id: Option<String>,
    pub max_context_length: Option<usize>,
}

// trace:implements FEAT-023
/// Real-time token estimation result returned to UI
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TokenEstimateResult {
    pub estimated_tokens: usize,
    pub max_context_length: usize,
    pub usage_percentage: f32,
    pub threshold: ContextThresholdLevel,
    pub is_overflow_risk: bool,
}

impl TokenEstimateResult {
    pub fn new(estimated_tokens: usize, max_context_length: usize) -> Self {
        let max_ctx = if max_context_length == 0 {
            8192
        } else {
            max_context_length
        };
        let ratio = (estimated_tokens as f32 / max_ctx as f32).min(1.0);
        let threshold = if ratio > 0.90 {
            ContextThresholdLevel::Danger
        } else if ratio > 0.70 {
            ContextThresholdLevel::Warning
        } else {
            ContextThresholdLevel::Safe
        };
        Self {
            estimated_tokens,
            max_context_length: max_ctx,
            usage_percentage: (ratio * 100.0).round(),
            threshold,
            is_overflow_risk: ratio > 0.90,
        }
    }
}

// trace:implements FEAT-024
/// In-memory Ephemeral PIN session for LAN model sharing
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LanSharePinSession {
    pub pin: String,
    pub created_at: u64,
    pub expires_at: u64,
    pub failed_attempts: u32,
    pub max_failed_attempts: u32,
    pub is_locked: bool,
    pub lock_until: Option<u64>,
}

impl LanSharePinSession {
    pub fn new(pin: impl Into<String>, now: u64, duration_secs: u64) -> Self {
        Self {
            pin: pin.into(),
            created_at: now,
            expires_at: now + duration_secs,
            failed_attempts: 0,
            max_failed_attempts: 5,
            is_locked: false,
            lock_until: None,
        }
    }

    /// Constant-time comparison to prevent timing attacks
    pub fn is_valid(&self, candidate_pin: &str, now: u64) -> bool {
        if self.is_locked(now) || now > self.expires_at {
            return false;
        }
        let a = self.pin.as_bytes();
        let b = candidate_pin.as_bytes();
        if a.len() != b.len() {
            return false;
        }
        let mut diff = 0u8;
        for (x, y) in a.iter().zip(b.iter()) {
            diff |= x ^ y;
        }
        diff == 0
    }

    pub fn is_locked(&self, now: u64) -> bool {
        if let Some(until) = self.lock_until {
            now < until
        } else {
            false
        }
    }
}

// trace:implements FEAT-024
/// Result of LAN share PIN verification
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LanPinVerificationResult {
    pub is_valid: bool,
    pub message: String,
    pub remaining_attempts: Option<u32>,
}

// trace:implements FEAT-025
/// Standard 5-tier classification tags for local models
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ModelCategoryTag {
    Coding,
    Reasoning,
    Chat,
    Vision,
    Edge,
}

impl ModelCategoryTag {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Coding => "Coding",
            Self::Reasoning => "Reasoning",
            Self::Chat => "Chat",
            Self::Vision => "Vision",
            Self::Edge => "Edge",
        }
    }
}

// trace:implements FEAT-031
/// Configuration and health descriptor for a secondary Swarm worker node over LAN
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct WorkerNodeConfig {
    pub node_id: String,
    pub host: String,
    pub port: u16,
    pub status: String,
    pub vram_free_mb: u64,
    pub active_tasks: u32,
    pub last_seen_timestamp: u64,
}

// trace:implements FEAT-031
/// Swarm task offload payload sent to secondary node
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SwarmTaskPayload {
    pub task_id: String,
    pub model: String,
    pub prompt: String,
    pub max_tokens: Option<u32>,
}

#[cfg(test)]
mod tests {
    use super::*;

    // trace:verifies FR-015
    #[test]
    fn test_symlink_health_serialization() {
        let health = SymlinkHealth {
            checked_at: "2026-09-29T22:30:00Z".to_string(),
            blob_pointer_root: "C:\\Users\\user\\.ollama\\models\\blobs".to_string(),
            storage_root: "G:\\.ollama_blobs_root".to_string(),
            total_blob_count: 25,
            symlink_count: 20,
            bad_symlink_count: 0,
            large_real_blob_count: 5,
            large_real_blob_bytes: 18_500_000_000,
            reclaimable_gb: 18.5,
            default_blobs_gb: 18.5,
            target_storage_gb: 120.0,
            issues: vec![],
            blobs: vec![BlobItem {
                hash: "sha256-mock123".to_string(),
                size_bytes: 4_000_000_000,
                is_symlink: true,
                storage_location: "G:\\.ollama_blobs_root".to_string(),
                symlink_status: "Active Symlink".to_string(),
                associated_model: Some("llama3:latest".to_string()),
            }],
        };

        let json = serde_json::to_string(&health).expect("serialize symlink health");
        let parsed: SymlinkHealth =
            serde_json::from_str(&json).expect("deserialize symlink health");
        assert_eq!(parsed, health);
        assert_eq!(parsed.reclaimable_gb, 18.5);
    }

    #[test]
    fn test_probe_result_online_serialization() {
        let res = ProbeResult::online("ollama", 12, Some("0.6.1".to_string()));
        assert!(res.is_online());
        assert_eq!(res.backend, "ollama");
        assert_eq!(res.status, "online");
        assert_eq!(res.latency_ms, Some(12));
        assert_eq!(res.version, Some("0.6.1".to_string()));
        assert_eq!(res.error_message, None);

        let json = serde_json::to_string(&res).map_err(|e| e.to_string());
        assert!(json.is_ok());
        if let Ok(serialized) = json {
            let deserialized: Result<ProbeResult, _> = serde_json::from_str(&serialized);
            assert!(deserialized.is_ok());
            if let Ok(parsed) = deserialized {
                assert_eq!(parsed, res);
            }
        }
    }

    // trace:verifies FR-001
    #[test]
    fn test_probe_result_offline_serialization() {
        let res = ProbeResult::offline("vllm", "Connection refused on port 8000");
        assert!(!res.is_online());
        assert_eq!(res.backend, "vllm");
        assert_eq!(res.status, "offline");
        assert_eq!(res.latency_ms, None);
        assert_eq!(res.version, None);
        assert_eq!(
            res.error_message,
            Some("Connection refused on port 8000".to_string())
        );

        let json = serde_json::to_string(&res).map_err(|e| e.to_string());
        assert!(json.is_ok());
        if let Ok(serialized) = json {
            let deserialized: Result<ProbeResult, _> = serde_json::from_str(&serialized);
            assert!(deserialized.is_ok());
            if let Ok(parsed) = deserialized {
                assert_eq!(parsed, res);
            }
        }
    }

    // trace:verifies FR-002
    #[test]
    fn test_unified_model_serialization() {
        let model = UnifiedModel::new(
            "ollama:mellum2-12b",
            "Mellum2-12B-Instruct.Q4_K_M.gguf",
            "mellum2 12b instruct",
            "ollama",
            "gguf",
            7500000000,
            Some("Q4_K_M".to_string()),
            true,
        );

        assert_eq!(model.canonical_name, "mellum2 12b instruct");
        assert!(!model.is_duplicate);
        assert!(!model.is_preferred);

        let json = serde_json::to_string(&model).map_err(|e| e.to_string());
        assert!(json.is_ok());
        if let Ok(serialized) = json {
            let parsed: Result<UnifiedModel, _> = serde_json::from_str(&serialized);
            assert!(parsed.is_ok());
            if let Ok(m) = parsed {
                assert_eq!(m, model);
            }
        }
    }

    // trace:verifies FR-003
    #[test]
    fn test_duplicate_info_and_dedup_group_serialization() {
        let m1 = UnifiedModel {
            id: "ollama:llama3".to_string(),
            name: "llama3:latest".to_string(),
            canonical_name: "llama3".to_string(),
            backend: "ollama".to_string(),
            format: "gguf".to_string(),
            size_bytes: 4500000000,
            quantization: Some("Q4_0".to_string()),
            is_active: true,
            is_duplicate: true,
            is_preferred: true,
            duplicate_group: Some("llama3".to_string()),
            duplicate_backends: vec!["ollama".to_string(), "gguf".to_string()],
            stats: None,
            tags: vec![],
        };

        let m2 = UnifiedModel {
            id: "gguf:llama3.gguf".to_string(),
            name: "llama3.gguf".to_string(),
            canonical_name: "llama3".to_string(),
            backend: "gguf".to_string(),
            format: "gguf".to_string(),
            size_bytes: 4500000000,
            quantization: Some("Q4_0".to_string()),
            is_active: false,
            is_duplicate: true,
            is_preferred: false,
            duplicate_group: Some("llama3".to_string()),
            duplicate_backends: vec!["ollama".to_string(), "gguf".to_string()],
            stats: None,
            tags: vec![],
        };

        let group = DedupGroup {
            canonical_name: "llama3".to_string(),
            preferred_backend: "ollama".to_string(),
            models: vec![m1.clone(), m2.clone()],
        };

        let info = DuplicateInfo {
            canonical_name: "llama3".to_string(),
            preferred_backend: "ollama".to_string(),
            instances: vec![m1, m2],
        };

        let group_json = serde_json::to_string(&group).expect("serialize group");
        let parsed_group: DedupGroup =
            serde_json::from_str(&group_json).expect("deserialize group");
        assert_eq!(parsed_group, group);

        let info_json = serde_json::to_string(&info).expect("serialize info");
        let parsed_info: DuplicateInfo =
            serde_json::from_str(&info_json).expect("deserialize info");
        assert_eq!(parsed_info, info);
    }

    // trace:verifies FR-009
    #[test]
    fn test_gguf_metadata_serialization() {
        let meta = GgufMetadata {
            name: "qwen-4b-thai-reasoning".to_string(),
            architecture: "qwen2".to_string(),
            parameter_count: Some(4000000000),
            context_length: Some(32768),
            quantization: Some("Q4_K_M".to_string()),
        };

        let json = serde_json::to_string(&meta).expect("serialize gguf metadata");
        let deserialized: GgufMetadata =
            serde_json::from_str(&json).expect("deserialize gguf metadata");
        assert_eq!(deserialized, meta);
        assert_eq!(deserialized.architecture, "qwen2");
        assert_eq!(deserialized.context_length, Some(32768));
    }

    // trace:verifies FR-006
    #[test]
    fn test_model_stats_calculation_and_serialization() {
        let mut stats = ModelStats::new("ollama:mellum2-12b");
        assert_eq!(stats.total_tasks, 0);
        assert_eq!(stats.success_rate(), 0.0);

        // Task 1: Success (250 tokens in 1700ms)
        stats.record_execution(true, 50, 250, 1700, None, 1700000000);
        assert_eq!(stats.total_tasks, 1);
        assert_eq!(stats.successful_tasks, 1);
        assert_eq!(stats.failed_tasks, 0);
        assert_eq!(stats.total_prompt_tokens, 50);
        assert_eq!(stats.total_completion_tokens, 250);
        assert_eq!(stats.total_tokens, 300);
        assert_eq!(stats.success_rate(), 100.0);
        assert_eq!(stats.avg_tps, 147.1);

        // Task 2: Failure
        stats.record_execution(
            false,
            30,
            0,
            500,
            Some("VRAM Out of Memory".to_string()),
            1700001000,
        );
        assert_eq!(stats.total_tasks, 2);
        assert_eq!(stats.successful_tasks, 1);
        assert_eq!(stats.failed_tasks, 1);
        assert_eq!(stats.success_rate(), 50.0);
        assert_eq!(stats.last_error, Some("VRAM Out of Memory".to_string()));

        // Serialization test
        let json = serde_json::to_string(&stats).expect("serialize stats");
        let parsed: ModelStats = serde_json::from_str(&json).expect("deserialize stats");
        assert_eq!(parsed, stats);
    }

    // trace:verifies FR-006
    #[test]
    fn test_process_metric_serialization() {
        let metric = ProcessMetric {
            pid: "12345".to_string(),
            name: "ollama.exe".to_string(),
            cpu_usage: 18.5,
            memory_bytes: 4 * 1024 * 1024 * 1024,
            virtual_memory_bytes: 8 * 1024 * 1024 * 1024,
            disk_read_bytes: 1024 * 1024 * 250,
            disk_written_bytes: 1024 * 1024 * 12,
        };
        let json = serde_json::to_string(&metric).expect("serialize ProcessMetric");
        let parsed: ProcessMetric = serde_json::from_str(&json).expect("deserialize ProcessMetric");
        assert_eq!(parsed, metric);
        assert_eq!(parsed.name, "ollama.exe");
    }

    // trace:verifies FR-008
    #[test]
    fn test_api_key_record_serialization_and_permissions() {
        let key = ApiKeyRecord::new(
            "frontend-agent",
            "developer",
            vec!["mellum2".to_string(), "qwen2.5".to_string()],
            Some(10.0),
            Some(60000),
            Some(60),
            Some(7), // 7 days
        );

        assert_eq!(key.name, "frontend-agent");
        assert_eq!(key.role, "developer");
        assert!(key.key_secret.starts_with("sk-litellm-"));
        assert!(key.can_access_model("mellum2"));
        assert!(key.can_access_model("qwen2.5"));
        assert!(!key.can_access_model("deepseek-r1"));
        assert!(!key.is_expired(key.created_at + 1000));
        assert!(key.is_expired(key.created_at + (8 * 86_400_000)));

        let json = serde_json::to_string(&key).expect("serialize ApiKeyRecord");
        let deserialized: ApiKeyRecord =
            serde_json::from_str(&json).expect("deserialize ApiKeyRecord");
        assert_eq!(deserialized, key);
    }

    // trace:verifies FEAT-023
    #[test]
    fn test_token_estimate_result_serde() {
        let safe = TokenEstimateResult::new(2000, 8192);
        assert_eq!(safe.threshold, ContextThresholdLevel::Safe);
        assert!(!safe.is_overflow_risk);
        assert_eq!(safe.usage_percentage, 24.0);

        let warn = TokenEstimateResult::new(6500, 8192);
        assert_eq!(warn.threshold, ContextThresholdLevel::Warning);
        assert!(!warn.is_overflow_risk);
        assert_eq!(warn.usage_percentage, 79.0);

        let danger = TokenEstimateResult::new(7800, 8192);
        assert_eq!(danger.threshold, ContextThresholdLevel::Danger);
        assert!(danger.is_overflow_risk);
        assert_eq!(danger.usage_percentage, 95.0);

        let json = serde_json::to_string(&safe).expect("serialize TokenEstimateResult");
        let deserialized: TokenEstimateResult =
            serde_json::from_str(&json).expect("deserialize TokenEstimateResult");
        assert_eq!(deserialized, safe);
    }

    // trace:verifies FEAT-024
    #[test]
    fn test_lan_pin_session_expiration_and_constant_time() {
        let session = LanSharePinSession::new("4829", 1000, 1800); // 30 min duration
        assert_eq!(session.pin, "4829");
        assert_eq!(session.expires_at, 2800);
        assert!(!session.is_locked(1500));

        // Valid pin within time window
        assert!(session.is_valid("4829", 1500));

        // Invalid pin
        assert!(!session.is_valid("0000", 1500));
        assert!(!session.is_valid("482", 1500));

        // Expired pin
        assert!(!session.is_valid("4829", 3000));

        let json = serde_json::to_string(&session).expect("serialize LanSharePinSession");
        let deserialized: LanSharePinSession =
            serde_json::from_str(&json).expect("deserialize LanSharePinSession");
        assert_eq!(deserialized, session);
    }

    // trace:verifies FEAT-025
    #[test]
    fn test_model_category_tags_serialization() {
        let tag = ModelCategoryTag::Coding;
        assert_eq!(tag.as_str(), "Coding");
        let json = serde_json::to_string(&tag).expect("serialize ModelCategoryTag");
        let deserialized: ModelCategoryTag =
            serde_json::from_str(&json).expect("deserialize ModelCategoryTag");
        assert_eq!(deserialized, tag);

        let mut model = UnifiedModel::new(
            "ollama:qwen3.5-coder",
            "qwen3.5:9b-coder",
            "qwen3.5 coder",
            "ollama",
            "gguf",
            6000000000,
            Some("Q4_K_M".to_string()),
            true,
        );
        model.tags = vec!["Coding".to_string(), "Reasoning".to_string()];

        let model_json = serde_json::to_string(&model).expect("serialize UnifiedModel with tags");
        let deserialized_model: UnifiedModel =
            serde_json::from_str(&model_json).expect("deserialize UnifiedModel with tags");
        assert_eq!(deserialized_model.tags, vec!["Coding", "Reasoning"]);
    }
}
