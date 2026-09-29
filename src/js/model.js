import { openModelCard } from './card.js';

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

const invoke = window.__TAURI__?.core?.invoke || (async (cmd, args) => {
  console.log(`[Mock Dev Invoke] Command: ${cmd}`, args);
  if (cmd === 'list_all_models') {
    return [
      {
        id: "ollama:mellum2-12b",
        name: "JetBrains Mellum2 12B MoE Instruct",
        canonical_name: "jetbrains mellum2 12b moe instruct",
        backend: "ollama",
        format: "gguf",
        size_bytes: 8080000000,
        quantization: "Q4_K_M",
        is_active: true,
        stats: {
          model_id: "ollama:mellum2-12b",
          total_tasks: 14,
          successful_tasks: 14,
          failed_tasks: 0,
          total_prompt_tokens: 3200,
          total_completion_tokens: 9650,
          total_tokens: 12850,
          total_duration_ms: 65400,
          avg_tps: 147.4,
          last_used_timestamp: Date.now() - 60000,
          last_error: null
        }
      },
      {
        id: "ollama:sushi-coder-9b",
        name: "Qwen3.5-9b-Sushi-Coder-RL",
        canonical_name: "qwen3.5 9b sushi coder rl",
        backend: "ollama",
        format: "gguf",
        size_bytes: 6550000000,
        quantization: "Q4_K_M",
        is_active: false,
        stats: {
          model_id: "ollama:sushi-coder-9b",
          total_tasks: 6,
          successful_tasks: 6,
          failed_tasks: 0,
          total_prompt_tokens: 1100,
          total_completion_tokens: 3220,
          total_tokens: 4320,
          total_duration_ms: 59000,
          avg_tps: 54.5,
          last_used_timestamp: Date.now() - 360000,
          last_error: null
        }
      },
      {
        id: "ollama:qwen-4b-thai-reasoning",
        name: "Qwen-4B-Thai-Reasoning:latest",
        canonical_name: "qwen 4b thai reasoning",
        backend: "ollama",
        format: "gguf",
        size_bytes: 2708805515,
        quantization: "Q4_K_M",
        is_active: false,
        is_duplicate: true,
        is_preferred: true,
        duplicate_group: "qwen 4b thai reasoning",
        duplicate_backends: ["ollama", "gguf"],
        stats: {
          model_id: "ollama:qwen-4b-thai-reasoning",
          total_tasks: 2,
          successful_tasks: 2,
          failed_tasks: 0,
          total_prompt_tokens: 350,
          total_completion_tokens: 850,
          total_tokens: 1200,
          total_duration_ms: 10000,
          avg_tps: 85.0,
          last_used_timestamp: Date.now() - 720000,
          last_error: null
        }
      },
      {
        id: "gguf:qwen-4b-thai-reasoning.gguf",
        name: "qwen-4b-thai-reasoning.gguf",
        canonical_name: "qwen 4b thai reasoning",
        backend: "gguf",
        format: "gguf",
        size_bytes: 2700000000,
        quantization: "Q4_K_M",
        is_active: false,
        is_duplicate: true,
        is_preferred: false,
        duplicate_group: "qwen 4b thai reasoning",
        duplicate_backends: ["ollama", "gguf"],
        stats: null
      }
    ];
  }
  return [];
});

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
  if (!grid) return;

  if (countLabel) {
    countLabel.textContent = `Loaded: ${models ? models.length : 0} models`;
  }

  if (!models || models.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="8" y1="12" x2="16" y2="12"></line>
        </svg>
        <p>No backends available or no models detected.</p>
        <p style="font-size: 12px; margin-top: 6px; color: var(--text-dim);">Verify that Ollama daemon is active or GGUF models exist in models/gguf</p>
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
