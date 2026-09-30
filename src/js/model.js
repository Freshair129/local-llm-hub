import { openModelCard } from './card.js';
import { invoke } from './api.js';

if (typeof window !== 'undefined') {
  window.openModelCard = openModelCard;
  window.toggleModelLifecycle = async (backend, modelName, isCurrentlyActive) => {
    try {
      if (isCurrentlyActive) {
        await invoke('stop_model', { backend, modelName });
      } else {
        await invoke('start_model', { backend, modelName });
      }
      await syncAllModels();
    } catch (err) {
      alert(`Lifecycle error: ${err}`);
    }
  };
}

// trace:implements FR-002

/**
 * Unified Model Discovery & Presentation Module for Local LLM Hub
 * Connects to Tauri IPC command 'list_all_models' and renders the catalog.
 */

export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatTokens(tokens) {
  if (!tokens || tokens === 0) return '0 tokens';
  if (tokens >= 1000000) return (tokens / 1000000).toFixed(1) + 'M tokens';
  if (tokens >= 1000) return (tokens / 1000).toFixed(1) + 'k tokens';
  return tokens + ' tokens';
}

/**
 * Records execution statistics for a model task
 */
export async function recordModelTask(modelId, success, promptTokens, completionTokens, durationMs, error = null) {
  try {
    return await invoke('record_task_stat', {
      modelId,
      success,
      promptTokens,
      completionTokens,
      durationMs,
      error
    });
  } catch (err) {
    console.error('Failed to record model task:', err);
    return null;
  }
}

/**
 * Renders the list of unified models into the DOM
 * @param {Array<Object>} models 
 */
export function renderModels(models) {
  const grid = document.getElementById('model-grid');
  const countLabel = document.getElementById('model-count-label');
  const railCount = document.getElementById('rail-model-count');
  if (!grid) return;

  if (countLabel) {
    countLabel.textContent = `Loaded: ${models ? models.length : 0} models`;
  }
  if (railCount) {
    railCount.textContent = models ? models.length : 0;
  }

  if (!models || models.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="8" y1="12" x2="16" y2="12"></line>
        </svg>
        <p>No backends available or no models detected.</p>
        <p style="font-size: 12px; margin-top: 6px; color: var(--text-dim);">Verify that Ollama daemon is active on 127.0.0.1:11434 or GGUF models exist in models/gguf</p>
        <div style="margin-top:16px; display:flex; gap:10px; justify-content:center;">
          <button class="btn btn-ghost" id="btn-empty-retry" onclick="window.__retryBackendSync && window.__retryBackendSync()" style="padding:6px 16px; font-size:12px; border-color:var(--green); color:var(--green); cursor:pointer;">⚡ Reconnect / Refresh Backends</button>
        </div>
      </div>
    `;
    return;
  }

  grid.innerHTML = models.map(m => {
    const stats = m.stats;
    const taskRate = stats && stats.total_tasks > 0 
      ? ((stats.successful_tasks / stats.total_tasks) * 100).toFixed(0) 
      : 100;

    return `
    <div class="model-card ${m.is_duplicate ? 'is-duplicate' : ''}" data-id="${m.id}">
      <div class="card-top">
        <div class="model-title" title="${m.name}">${m.name}</div>
        <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
          ${m.is_duplicate ? `
            <span class="badge-duplicate" title="Duplicate model detected across multiple backends: ${m.duplicate_backends && m.duplicate_backends.length ? m.duplicate_backends.join(', ') : m.backend}">
              ⚠️ DUPLICATE
            </span>
          ` : ''}
          ${m.is_preferred ? `
            <span class="badge-preferred" title="Recommended preferred backend based on BR-001 priority matrix">
              ★ PREFERRED
            </span>
          ` : ''}
          <span class="backend-pill">${m.backend.toUpperCase()}</span>
        </div>
      </div>
      <div class="card-specs">
        <span class="spec-badge">📦 ${m.format ? m.format.toUpperCase() : 'GGUF'}</span>
        ${m.size_bytes ? `<span class="spec-badge">💾 ${formatBytes(m.size_bytes)}</span>` : ''}
        ${m.quantization ? `<span class="spec-badge">⚙️ ${m.quantization}</span>` : ''}
        ${m.is_active ? `<span class="spec-badge" style="color: var(--accent-emerald);">● ACTIVE</span>` : ''}
      </div>

      <!-- Real-time Task & Token Telemetry -->
      <div class="card-stats">
        <div class="stat-pill" title="${stats ? `${stats.successful_tasks} succeeded, ${stats.failed_tasks} failed` : 'No tasks run yet'}">
          <span class="stat-icon">🎯</span>
          <span class="stat-value">${stats ? `${stats.total_tasks} tasks (${taskRate}%)` : '0 tasks'}</span>
        </div>
        <div class="stat-pill" title="${stats ? `Prompt: ${stats.total_prompt_tokens} / Output: ${stats.total_completion_tokens}` : '0 tokens'}">
          <span class="stat-icon">⚡</span>
          <span class="stat-value">${stats ? formatTokens(stats.total_tokens) : '0 tokens'}</span>
        </div>
        ${stats && stats.avg_tps > 0 ? `
          <div class="stat-pill" title="Average speed: ${stats.avg_tps} t/s">
            <span class="stat-icon">🚀</span>
            <span class="stat-value">${stats.avg_tps} t/s</span>
          </div>
        ` : ''}
      </div>

      <div class="card-actions" style="display:flex; gap:8px; align-items:center;">
        <button class="btn btn-ghost" style="padding: 6px 10px; font-size: 12px;" onclick="window.openModelCard('${m.id}', '${m.backend}')" title="Read Model Card and README">📖 Card</button>
        <button class="btn btn-ghost" style="padding: 6px 10px; font-size: 12px; color:${m.is_active ? '#ef4444' : '#10b981'}; border-color:${m.is_active ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'};" onclick="window.toggleModelLifecycle('${m.backend}', '${m.name}', ${m.is_active})" title="${m.is_active ? 'Unload model from GPU memory' : 'Load and keep warm in GPU memory'}">${m.is_active ? '⏸️ Stop' : '⚡ Start'}</button>
        <button class="btn btn-primary" style="padding: 6px 12px; font-size: 12px;" onclick="document.getElementById('nav-chat')?.click()">Run Chat</button>
      </div>
    </div>
    `;
  }).join('');
}

/**
 * Fetches all models across backends via Tauri IPC and updates UI
 */
export async function syncAllModels() {
  const btnSync = document.getElementById('btn-refresh-models');
  if (btnSync) {
    btnSync.classList.add('loading');
    btnSync.disabled = true;
  }

  try {
    const models = await invoke('list_all_models');
    renderModels(models);
    return models;
  } catch (err) {
    console.error('Failed to sync models via list_all_models:', err);
    renderModels([]);
    return [];
  } finally {
    if (btnSync) {
      btnSync.classList.remove('loading');
      btnSync.disabled = false;
    }
  }
}
