# 📋 Changelog — Local LLM Hub

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.2] — 2026-10-01 (Borderless & Titlebar Batch Release)

### 🎨 UI & Window Management
- **Frameless Borderless Window (`decorations: false`):**
  - Configured frameless window in [`src-tauri/tauri.conf.json`](file:///d:/local-llm-hub/src-tauri/tauri.conf.json).
  - Added dedicated Windows 11 Fluent titlebar with `data-tauri-drag-region` across the top for seamless native window dragging and double-click to maximize/restore.
  - Implemented custom native window controls:
    - **Minimize** (`#btn-win-minimize` ➔ `window_minimize`)
    - **Maximize / Restore** (`#btn-win-maximize` ➔ `window_maximize`)
    - **Close to Tray** (`#btn-win-close` ➔ `window_close` with red hover styling and silent tray minimization)
  - Added Rust IPC handlers in [`src-tauri/src/lib.rs`](file:///d:/local-llm-hub/src-tauri/src/lib.rs) and dev mocks in [`scripts/serve_ui.mjs`](file:///d:/local-llm-hub/scripts/serve_ui.mjs).
- **Relocated Version Badge from Sidebar:**
  - Removed the version tag from the bottom of the navigation sidebar ([`src/js/updater.js`](file:///d:/local-llm-hub/src/js/updater.js)), leaving the sidebar dedicated exclusively to navigation modules and AI agent avatar.
  - Relocated the version badge to a glassmorphic pill (`#app-version-badge`) in the top titlebar with live online status dot, hover effect, and instant click access to the System Version & Updates modal.
- **In-App Auto-Updater Connected to GitHub API:**
  - Configured endpoint to query `https://api.github.com/repos/Freshair129/local-llm-hub/releases/latest` with user agent header, displaying latest version, release notes, and download progress.

### 🚨 Hotfixes
- **Flashing CMD Windows on Polling:** Fixed an issue on Windows where background telemetry commands (`nvidia-smi` and child processes) caused a black console window (`cmd.exe`) to pop up and close every 1–2 seconds. Added Windows-specific flag `creation_flags(0x0800_0000)` (`CREATE_NO_WINDOW`) to all command spawns in [`src-tauri/src/commands/gpu.rs`](src-tauri/src/commands/gpu.rs) and [`src-tauri/src/lib.rs`](src-tauri/src/lib.rs). Subprocesses now execute silently with zero visual flicker.
- **Adaptive Sidebar Height & Collapse Hover Fix ("ย่อตาม menu"):**
  - Changed `.sidebar` height from fixed full-height (`calc(100vh - 100px)`) to content-aware dynamic height (`height: fit-content; min-height: 220px; max-height: calc(100vh - 100px)`), allowing the sidebar card to snugly fit its menu items without massive empty space.
  - Added dedicated Hamburger Toggle Button (`#btn-toggle-sidebar`) next to the brand in the topbar to easily collapse and expand the sidebar.
  - Fixed collapsed rail hover bug where text labels (`.s-lbl`), breadcrumbs (`.s-crumb`), headers (`.s-grp`), and count badges (`.ct`) were hidden under `display: none !important`. Now hovering over the 54px rail smoothly floats out a 260px card with all labels readable.
- **Backend Reconnection & Ollama Service Discovery:**
  - Resolved `OLLAMA_HOST` IP binding issue (`100.66.206.115:11434` ➔ `0.0.0.0:11434`), restoring Ollama daemon accessibility and live discovery of all 65 local models.
  - Added empty-state reconnection button (`⚡ Reconnect / Refresh Backends`) and automatic startup retry if Ollama is still initializing.

### 🔄 Build & Packaging
- Recompiled Windows Setup Installer (`.exe`), Windows MSI Package (`.msi`), and standalone portable executable (`tauri-app.exe`) with the hotfixes.
- Synchronized release assets on GitHub Release `v0.1.1` (clobbered with hotfixed binaries).

---

## [0.1.1] — 2026-09-30 (System Tray & Silent Background)

### ✨ Added
- **Native System Tray Integration:** Implemented Tauri v2 `TrayIconBuilder` in [`src-tauri/src/lib.rs`](src-tauri/src/lib.rs) with left-click toggle (Show/Hide) and custom context menu (`Open Dashboard`, `Hide to Tray (Silent)`, `Exit Local LLM Hub`).
- **Close-to-Tray Behavior:** Intercepted `WindowEvent::CloseRequested` to prevent accidental termination, silently minimizing to system tray to keep local proxy and gateway services alive.
- **Ultra-Lightweight Background Mode (0% Idle CPU):**
  - Added document visibility lifecycle detection in [`src/js/observability.js`](src/js/observability.js) and [`src/js/process_manager.js`](src/js/process_manager.js).
  - High-frequency telemetry loops (WMI process queries, GPU thermal polling, DOM/Canvas rendering) are completely suspended when minimized or hidden to tray.
  - Heartbeat status transitions to `SLEEP (TRAY)` / `SILENT 💤`.
  - Polling automatically resumes with an instant fresh reading when window is restored.
- **Quick Tray Button:** Added `#btn-minimize-tray` icon button in the header topbar with interactive toast notifications.
- **Engineering Standard STD-004:** Published [`docs/standards/STD-004-batch-release-workflow.md`](docs/standards/STD-004-batch-release-workflow.md) establishing mandatory batch-based development and milestone packaging procedures.

---

## [0.1.0] — 2026-09-30 (Initial MVP Release)

### ✨ Added
- **Zero-Mock Real Hardware Telemetry Engine:**
  - Removed all sinusoidal jitter, Math.sin waveforms, and fake process lists across all frontend modules.
  - Live GPU metrics polled directly from `nvidia-smi` on NVIDIA GeForce RTX 3060 12GB (VRAM used/total, core temp, hotspot temp, power draw, clock speeds).
  - Live CPU telemetry reading real Intel Core i7-8700K 12 logical cores and DDR4 RAM (32GB).
  - Live Windows Task Manager process ranker querying actual host processes via PerfProc / WMI.
- **Ollama 65-Model Fleet Discovery:**
  - Direct integration with local Ollama engine at `http://127.0.0.1:11434`.
  - Automatic model catalog aggregation, size calculations, and quantization detection.
- **Unified IPC & API Bridge:** Created [`src/js/api.js`](src/js/api.js) providing a single interface for both desktop Tauri webview (`window.__TAURI__.core.invoke`) and local development server (`/api/invoke`).
- **LiteLLM Gateway Management:** Real-time generation of `sidecar/config.yaml` with virtual API keys, budget caps, rate limiting, and role-based permissions.
- **Model Arena & Interactive Playground:** Side-by-side battle interface and chat playground measuring live tokens-per-second (TPS) and inference duration.
- **Packaging:** Automated release pipeline creating NSIS setup installer and MSI bundle.
