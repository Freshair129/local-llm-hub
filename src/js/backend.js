// src/js/backend.js
// trace:implements FR-001

/**
 * Backend Probing Module for Local LLM Hub
 * Connects to Tauri IPC command 'probe_backends' and updates telemetry UI.
 */

const invoke = window.__TAURI__?.core?.invoke || (async (cmd, args) => {
  console.log(`[Mock Dev Invoke] Command: ${cmd}`, args);
  if (cmd === 'probe_backends') {
    return [
      { backend: 'ollama', status: 'online', latency_ms: 8, version: '0.6.1', error_message: null },
      { backend: 'vllm', status: 'offline', latency_ms: null, version: null, error_message: 'Connection refused at 127.0.0.1:8000' },
      { backend: 'hf', status: 'online', latency_ms: 1, version: '14 cached models', error_message: null },
      { backend: 'gguf', status: 'online', latency_ms: 2, version: '8 .gguf files', error_message: null },
    ];
  }
  return null;
});

/**
 * Probes all configured inference and storage backends
 * @param {Object} [config] Optional override configuration
 * @returns {Promise<Array<{backend: string, status: string, latency_ms: number|null, version: string|null, error_message: string|null}>>}
 */
export async function probeBackends(config = null) {
  try {
    const results = await invoke('probe_backends', { config });
    return results || [];
  } catch (err) {
    console.error('Failed to probe backends via Tauri IPC:', err);
    return [
      {
        backend: 'ollama',
        status: 'error',
        latency_ms: null,
        version: null,
        error_message: String(err)
      }
    ];
  }
}

/**
 * Updates UI telemetry elements with the probed backend results
 * @param {Array<Object>} results 
 */
export function updateBackendUI(results) {
  if (!Array.isArray(results)) return;

  const ollamaResult = results.find(r => r.backend === 'ollama');
  const ollamaIndicator = document.getElementById('ollama-status-indicator');
  const ollamaBadge = document.getElementById('ollama-status-badge');

  if (ollamaIndicator && ollamaResult) {
    const isOnline = ollamaResult.status === 'online';
    const dotClass = isOnline ? 'dot-online' : 'dot-offline';
    const latencyText = ollamaResult.latency_ms ? ` (${ollamaResult.latency_ms}ms)` : '';
    const statusText = isOnline 
      ? `Online ${ollamaResult.version ? `v${ollamaResult.version}` : ''}${latencyText}`
      : `Offline`;

    ollamaIndicator.innerHTML = `
      <span class="status-dot ${dotClass}"></span>
      <span id="ollama-status-text" title="${ollamaResult.error_message || 'Online'}">${statusText}</span>
    `;

    if (ollamaBadge) {
      ollamaBadge.title = isOnline 
        ? `Ollama reachable at ${latencyText.trim() || 'normal latency'}`
        : `Ollama offline: ${ollamaResult.error_message || 'Cannot connect'}`;
    }
  }
}

/**
 * Trigger backend probe and update the UI with loading animation
 */
export async function triggerProbe() {
  const ollamaIndicator = document.getElementById('ollama-status-indicator');
  const btnProbe = document.getElementById('btn-probe-backends');

  if (btnProbe) {
    btnProbe.classList.add('loading');
    btnProbe.disabled = true;
  }

  if (ollamaIndicator) {
    ollamaIndicator.innerHTML = `
      <span class="status-dot dot-probing"></span>
      <span id="ollama-status-text">Probing...</span>
    `;
  }

  try {
    const results = await probeBackends();
    updateBackendUI(results);
    return results;
  } finally {
    if (btnProbe) {
      btnProbe.classList.remove('loading');
      btnProbe.disabled = false;
    }
  }
}

// trace:implements FR-009
/**
 * Scans a local directory for GGUF binary models
 * @param {string} path 
 */
export async function scanGgufDirectory(path) {
  try {
    const models = await invoke('scan_directory_for_gguf', { path });
    return { success: true, models };
  } catch (err) {
    console.error('Failed to scan GGUF directory:', err);
    return { success: false, error: String(err) };
  }
}

