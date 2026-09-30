// src/js/api.js
// trace:implements ARCH-001
// trace:implements PRJ-003
//! Unified API & IPC Bridge for Local LLM Hub.
//! Connects to Tauri IPC when running inside desktop webview,
//! or seamlessly calls the local backend API server (/api/invoke) when running in browser mode.
//! ZERO MOCK DATA — Strictly reads from live host hardware and Ollama endpoints.

export async function invoke(cmd, args = {}) {
  // 1. If running inside Tauri Native Desktop App:
  if (typeof window !== 'undefined' && window.__TAURI__?.core?.invoke) {
    try {
      return await window.__TAURI__.core.invoke(cmd, args);
    } catch (err) {
      console.warn(`[Tauri Native Invoke] ${cmd} error:`, err);
      throw err;
    }
  }

  // 2. If running inside Browser (Dev / Web Server mode on port 3000):
  try {
    const res = await fetch('/api/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cmd, args })
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const payload = await res.json();
    if (payload.error) {
      throw new Error(payload.error);
    }
    return payload.result;
  } catch (err) {
    console.error(`[API Bridge] Real-time command '${cmd}' failed:`, err);
    throw err;
  }
}
