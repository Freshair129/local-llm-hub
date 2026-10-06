# Appendix D — Traceability Matrix

| Field | Value |
|-------|-------|
| **Version** | 1.0.0 |
| **Status** | Draft |
| **Author** | Boss |
| **Created** | 2026-09-28 |

---

## Requirements → Components Traceability

| Req ID | Requirement | Component | File(s) | Test |
|--------|-------------|-----------|---------|------|
| FR-001 | Backend Discovery | Rust: `probe_backends` | `src-tauri/src/commands/backends.rs` | `tests/test_backend_probe.rs` ✅ |
| FR-002 | Model Aggregation | Rust: `list_all_models` | `src-tauri/src/commands/models.rs` | `tests/test_model_aggregation.rs` ✅ |
| FR-003 | Duplicate Detection | Rust: `dedup_models` | `src-tauri/src/commands/models.rs` | `tests/test_dedup.rs` ✅ |
| FR-004 | Model Card | Rust: `read_model_card` | `src-tauri/src/commands/modelcard.rs` | `tests/test_modelcard.rs` ✅ |
| FR-005 | Start/Stop Model | Rust: `start_model`, `stop_model` | `src-tauri/src/commands/backends.rs` | `tests/test_model_control.rs` ✅ |
| FR-006 | GPU & Hardware Sensors Monitor | Rust: `get_hardware_telemetry`, `get_sensor_tree`, `get_lhm_status`, `set_fan_duty` | `src-tauri/src/sensors/`, `src/js/sensors.js` | `tests::test_sensor_hub_sysinfo_baseline` ✅ |
| FR-007 | Chat Interface | Rust: `execute_chat` + JS: `chat.js` | `src-tauri/src/commands/chat.rs` | `tests/test_chat.rs` ✅ |
| FR-008 | LiteLLM Proxy | Rust: `generate_litellm_config` | `src-tauri/src/commands/proxy.rs` | `tests/test_proxy.rs` ✅ |
| FR-009 | GGUF Scanner | Rust: `scan_directory_for_gguf` | `src-tauri/src/commands/scanner.rs` | `tests/test_scanner.rs` ✅ |
| FR-010 | LAN Folder Sharing | Rust: `start_lan_share`, `stop_lan_share` | `src-tauri/src/commands/share.rs` | `tests/test_lan_share.rs` ✅ |
| FR-011 | Multi-Model Arena | JS: `arena.js` + Rust: `execute_chat` | `src/js/arena.js` | Integration Verified ✅ |
| FR-012 | Model Downloader | JS: `downloader.js` + Rust: `pull_model` | `src/js/downloader.js` | Integration Verified ✅ |
| FR-013 | Prompt Presets | JS: `chat.js` + `presets.js` | `src/js/chat.js` | Integration Verified ✅ |
| FR-014 | Version & Auto-update | Rust: `get_app_version`, `check_for_updates` | `src-tauri/src/commands/updater.rs` | Unit Tests Verified ✅ |
| FR-015 | Storage & Symlink Offloader | Rust: `audit_blob_symlinks`, `execute_blob_offload` | `src-tauri/src/commands/storage.rs` | Unit Tests Verified ✅ |
| FR-016 | 3D Hardware Digital Twin | JS: `digital_twin_3d.js` + Three.js | `src/js/digital_twin_3d.js` | Browser Render Verified ✅ |
| FR-017 | HuggingFace Cache Offloader | Rust: `src-tauri/src/commands/storage.rs` | `docs/requirements/FR-017-huggingface-cache-offload.md` | Specification Verified ✅ |
| FR-024 | VRAM Model Advisor & GPU Benchmark Comparison | JS: `model_advisor.js`, sanitized evidence exporter, report catalog builder | `docs/requirements/FR-024-model-vram-advisor.md`; `docs/features/FEAT-GPU-MODEL-ADVISOR.md` | Local tests + browser verified; 1 observed GPU |

## User Stories → Requirements Traceability

| Story | Requirements |
|-------|-------------|
| US-001 Dashboard | FR-001, FR-002 |
| US-002 Dedup | FR-002, FR-003 |
| US-003 Model Card | FR-004 |
| US-004 Start/Stop | FR-005 |
| US-005 GPU Monitor | FR-006 |
| US-006 Chat | FR-007 |
| US-007 LiteLLM | FR-008 |
| US-008 LAN Share | FR-010 |

## Acceptance Criteria → Tests Traceability

| AC ID | Acceptance Criteria | Test Location | Status |
|-------|--------------------|----|:---:|
| AC-001 | Ollama shows Online within 5s | `tests/test_backend_probe.rs` | ✅ Passed |
| AC-002 | Duplicate badge shows correctly | `tests/test_dedup.rs` | ✅ Passed |
| AC-003 | Model card loads in 3s | `tests/test_modelcard.rs` | ✅ Passed |
| AC-004 | Chat streaming & error handling | `tests/test_chat.rs` | ✅ Passed |
| AC-005 | GPU gauge updates every 2s | `tests/test_gpu_monitor.rs` | ✅ Passed |
| AC-006 | LiteLLM YAML config generated | `tests/test_proxy.rs` | ✅ Passed |
| AC-007 | GGUF binary header parsed | `tests/test_scanner.rs` | ✅ Passed |
| AC-008 | LAN HTTP 206 Range stream & Path Traversal | `tests/test_lan_share.rs` | ✅ Passed |
| AC-009 | Full MVP End-to-End Suite | `tests/test_mvp_e2e.rs` | ✅ Passed |
