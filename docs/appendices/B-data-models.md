# Appendix B — Data Models & Schema Specification

| Field | Value |
|---|---|
| **Version** | 1.0.0 |
| **Status** | Active |
| **Author** | Boss |
| **Created** | 2026-09-29 |
| **Source of Truth** | [`src-tauri/src/models/types.rs`](file:///d:/local-llm-hub/src-tauri/src/models/types.rs) |
| **Parent Doc** | [PRD-SDD-v1.0.md](../PRD-SDD-v1.0.md) |

---

## B.1 Overview & Design Principles

All data models in Local LLM Hub adhere to:
1. **ADR-100**: Strict deserialization safety, zero panics, deterministic defaults (`#[serde(default)]`).
2. **STD-002 / ANN-001**: Every struct and field maps to functional requirements via trace comments (`// trace:implements`).
3. **Cross-Language Parity**: Rust structs serialize to camelCase/snake_case JSON consumed identically by Vanilla JS frontend (`src/js/`).

---

## B.2 Core Domain Models

### 1. `ProbeResult` (FR-001)
Represents health probe telemetry for an inference backend (`ollama`, `vllm`, `hf`, `gguf`).

```rust
// trace:implements FR-001
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProbeResult {
    pub backend: String,
    pub status: String, // "online" | "offline" | "error"
    pub latency_ms: Option<u64>,
    pub version: Option<String>,
    pub error_message: Option<String>,
}
```

### 2. `UnifiedModel` (FR-002, FR-003, FR-006)
The canonical entity representing an aggregated model across all backends.

```rust
// trace:implements FR-002
// trace:implements FR-003
// trace:implements FR-006
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
}
```

### 3. `ModelStats` (FR-006)
Performance telemetry recorded per model execution.

```rust
// trace:implements FR-006
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ModelStats {
    pub calls: u64,
    pub total_prompt_tokens: u64,
    pub total_completion_tokens: u64,
    pub avg_ttft_ms: f64,
    pub avg_tps: f64,
}
```

### 4. `DuplicateInfo` & `DedupGroup` (FR-003)
Deduplication metadata computed by `dedup_models` using the business priority matrix.

```rust
// trace:implements FR-003
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DuplicateInfo {
    pub is_duplicate: bool,
    pub is_preferred: bool,
    pub duplicate_group: Option<String>,
    pub available_backends: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DedupGroup {
    pub canonical_name: String,
    pub preferred_model_id: String,
    pub preferred_backend: String,
    pub member_model_ids: Vec<String>,
}
```

### 5. `GpuStats` (FR-006)
Real-time hardware telemetry collected from `nvidia-smi` or fallback monitors.

```rust
// trace:implements FR-006
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GpuStats {
    pub gpu_name: String,
    pub vram_used_bytes: u64,
    pub vram_total_bytes: u64,
    pub vram_percentage: f32,
    pub gpu_utilization_percentage: f32,
    pub temperature_celsius: Option<f32>,
    pub system_ram_used_bytes: u64,
    pub system_ram_total_bytes: u64,
    pub system_ram_percentage: f32,
}
```

### 6. `ModelCard` (FR-004)
Metadata extracted from Hugging Face Hub API or local repository README files.

```rust
// trace:implements FR-004
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ModelCard {
    pub model_id: String,
    pub author: Option<String>,
    pub license: Option<String>,
    pub context_length: Option<u64>,
    pub parameter_count: Option<String>,
    pub description: Option<String>,
    pub tags: Vec<String>,
    pub raw_content: String,
}
```

### 7. `GgufMetadata` (FR-009)
Binary metadata parsed directly from `.gguf` file headers.

```rust
// trace:implements FR-009
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GgufMetadata {
    pub path: String,
    pub architecture: Option<String>,
    pub context_length: Option<u64>,
    pub quantization: Option<String>,
    pub file_size_bytes: u64,
}
```

### 8. `BackendConfig` (FR-001)
Configuration endpoints for backend connections.

```rust
// trace:implements FR-001
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BackendConfig {
    pub ollama_url: String,
    pub vllm_url: String,
    pub hf_cache_path: String,
    pub gguf_folder_path: String,
}
```

### 9. `ChatMessage` & `ChatRequest` (FR-007)
Interactive playground schema conforming to OpenAI chat completion standards.

```rust
// trace:implements FR-007
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String, // "system" | "user" | "assistant"
    pub content: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ChatRequest {
    pub model_id: String,
    pub backend: String,
    pub messages: Vec<ChatMessage>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
}
```

### 10. `LanShareConfig` (FR-010)
Network distribution settings for HTTP file serving and streaming.

```rust
// trace:implements FR-010
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LanShareConfig {
    pub port: u16,
    pub enabled: bool,
    pub shared_paths: Vec<String>,
}
```

### 11. `AppVersionInfo` (FR-014)
Installed application version metadata.

```rust
// trace:implements FR-014
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AppVersionInfo {
    pub current_version: String,
    pub app_name: String,
    pub target_platform: String,
    pub release_channel: String,
    pub git_commit: String,
    pub build_date: String,
}
```

### 12. `UpdateCheckResult` (FR-014)
Remote update availability and release notes payload.

```rust
// trace:implements FR-014
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
```

---

## B.3 Schema Validation Matrix

| Model | Serialization Format | Required Fields | Optional / Defaulted Fields |
|---|---|---|---|
| `ProbeResult` | JSON | `backend`, `status` | `latency_ms`, `version`, `error_message` |
| `UnifiedModel` | JSON | `id`, `name`, `canonical_name`, `backend`, `format`, `size_bytes` | `quantization`, `is_duplicate`, `is_preferred`, `stats` |
| `GpuStats` | JSON | `gpu_name`, `vram_used_bytes`, `vram_total_bytes`, `system_ram_used_bytes` | `temperature_celsius` |
| `ModelCard` | JSON | `model_id`, `raw_content` | `author`, `license`, `context_length`, `description` |
| `GgufMetadata` | JSON | `path`, `file_size_bytes` | `architecture`, `context_length`, `quantization` |
