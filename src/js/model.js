import { openModelCard } from './card.js';
import { invoke } from './api.js';

// Current view mode: 'grid' | 'list'
let currentViewMode = 'grid';
let activeTagFilter = 'all';

try {
  const savedMode = localStorage.getItem('local-llm-hub-models-view-mode');
  if (savedMode === 'list' || savedMode === 'grid') {
    currentViewMode = savedMode;
  }
} catch (e) {}

// Global exposed methods
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

  window.toggleModelViewMode = (mode) => {
    currentViewMode = mode;
    try {
      localStorage.setItem('local-llm-hub-models-view-mode', mode);
    } catch (e) {}
    
    const btnGrid = document.getElementById('btn-mode-grid');
    const btnList = document.getElementById('btn-mode-list');
    const grid = document.getElementById('model-grid');

    if (btnGrid) btnGrid.classList.toggle('active', mode === 'grid');
    if (btnList) btnList.classList.toggle('active', mode === 'list');
    if (grid) grid.classList.toggle('list-view', mode === 'list');

    // Re-render current models
    import('./state.js').then(({ store }) => {
      renderModels(store.state.models || []);
    });
  };

  window.toggleCardCompact = (modelId) => {
    const cardEl = document.querySelector(`.model-card-unified[data-id="${modelId}"]`);
    if (cardEl) {
      const isCompact = cardEl.classList.toggle('is-compact');
      const btnCompact = cardEl.querySelector('.btn-card-compact');
      if (btnCompact) {
        btnCompact.innerHTML = isCompact 
          ? '<i class="ph ph-arrows-out"></i> Expand' 
          : '<i class="ph ph-arrows-in"></i> Compact';
      }
    }
  };
}

// trace:implements FR-002
// trace:implements FR-004
// trace:implements FEAT-025

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
 * Updates dynamic counts inside tag filter pill buttons
 */
function updateTagPillCounts(allModels) {
  const filterBar = document.getElementById('model-tag-filter-bar');
  if (!filterBar) return;

  const counts = {
    all: allModels.length,
    Coding: 0,
    Reasoning: 0,
    Chat: 0,
    Vision: 0,
    Edge: 0
  };

  allModels.forEach(m => {
    if (Array.isArray(m.tags)) {
      m.tags.forEach(t => {
        if (counts[t] !== undefined) counts[t]++;
      });
    }
  });

  const labels = {
    all: `All Models (${counts.all})`,
    Coding: `🏷️ Coding (${counts.Coding})`,
    Reasoning: `🧠 Reasoning (${counts.Reasoning})`,
    Chat: `💬 Chat (${counts.Chat})`,
    Vision: `👁️ Vision (${counts.Vision})`,
    Edge: `📐 Edge (${counts.Edge})`
  };

  const pills = filterBar.querySelectorAll('.tag-filter-pill');
  pills.forEach(pill => {
    const tag = pill.getAttribute('data-tag');
    if (labels[tag]) {
      pill.textContent = labels[tag];
    }
  });
}

/**
 * Setup Tag Filter Bar Buttons
 */
function setupTagFilterButtons() {
  const filterBar = document.getElementById('model-tag-filter-bar');
  if (!filterBar) return;

  const pills = filterBar.querySelectorAll('.tag-filter-pill');
  pills.forEach(pill => {
    pill.onclick = () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      activeTagFilter = pill.getAttribute('data-tag') || 'all';

      import('./state.js').then(({ store }) => {
        renderModels(store.state.models || []);
      });
    };
  });
}

/**
 * Setup View Mode buttons listener
 */
function setupViewModeButtons() {
  const btnGrid = document.getElementById('btn-mode-grid');
  const btnList = document.getElementById('btn-mode-list');
  const grid = document.getElementById('model-grid');

  if (btnGrid) {
    btnGrid.classList.toggle('active', currentViewMode === 'grid');
    btnGrid.onclick = () => window.toggleModelViewMode('grid');
  }
  if (btnList) {
    btnList.classList.toggle('active', currentViewMode === 'list');
    btnList.onclick = () => window.toggleModelViewMode('list');
  }
  if (grid) {
    grid.classList.toggle('list-view', currentViewMode === 'list');
  }
}

/**
 * Renders the unified model cards into the DOM
 * @param {Array<Object>} allModels 
 */
export function renderModels(allModels) {
  setupViewModeButtons();
  setupTagFilterButtons();
  const grid = document.getElementById('model-grid');
  const countLabel = document.getElementById('model-count-label');
  const railCount = document.getElementById('rail-model-count');
  if (!grid) return;

  // Filter models by active taxonomy tag
  updateTagPillCounts(allModels || []);

  const models = (!allModels || activeTagFilter === 'all')
    ? (allModels || [])
    : allModels.filter(m => Array.isArray(m.tags) && m.tags.includes(activeTagFilter));

  if (countLabel) {
    countLabel.textContent = `Showing: ${models.length} of ${allModels ? allModels.length : 0} models`;
  }
  if (railCount) {
    railCount.textContent = allModels ? allModels.length : 0;
  }

  if (!models || models.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; padding: 48px 24px; text-align: center;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width: 48px; height: 48px; margin: 0 auto 16px; color: var(--faint);">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="8" y1="12" x2="16" y2="12"></line>
        </svg>
        <p style="font-size: 16px; font-weight: 600; color: var(--tx);">No models matched the selected filter (${activeTagFilter}).</p>
        <p style="font-size: 12.5px; margin-top: 6px; color: var(--text-dim);">Try selecting 'All Models' or verify backends are active.</p>
        <div style="margin-top:18px; display:flex; gap:10px; justify-content:center;">
          <button class="btn btn-ghost" onclick="document.querySelector('.tag-filter-pill[data-tag=all]')?.click()" style="padding:8px 20px; font-size:12.5px; border-color:var(--green); color:var(--green); cursor:pointer;">Show All Models</button>
        </div>
      </div>
    `;
    return;
  }

  // ══════════════════════════════════════════════════════════════
  // LIST VIEW RENDERING
  // ══════════════════════════════════════════════════════════════
  if (currentViewMode === 'list') {
    grid.innerHTML = models.map(m => {
      const stats = m.stats;
      const hasStats = stats && stats.total_tasks > 0;
      const taskRate = hasStats ? ((stats.successful_tasks / stats.total_tasks) * 100).toFixed(0) : 100;
      
      const isCoder = /code|coder|deepseek|qwen/i.test(m.name);
      const isVision = /vision|llava|vl|moondream/i.test(m.name);
      const isReasoning = /r1|reason|thinking|deepseek-r1/i.test(m.name);
      const isEmbed = /bge|embed|bert|nomic/i.test(m.name);

      const formatName = (m.format || 'GGUF').toUpperCase();
      const quantName = m.quantization || (m.backend === 'ollama' ? 'Standard' : '—');
      const sizeText = m.size_bytes && m.size_bytes > 0 ? formatBytes(m.size_bytes) : '—';
      const engineTitle = `${m.backend ? m.backend.toUpperCase() : 'OLLAMA'} Engine`;
      const contextK = /llama3|qwen|deepseek|gemini/i.test(m.name) ? '128k' : /mistral|gemma/i.test(m.name) ? '32k' : '8k';
      const tagsListHtml = (m.tags && m.tags.length > 0)
        ? m.tags.map(t => `<span class="tag-badge-pill">🏷️ ${t}</span>`).join(' ')
        : '';

      return `
      <div class="model-row-item ${m.is_duplicate ? 'is-duplicate' : ''}" data-id="${m.id}">
        <!-- Left Column: Avatar + Title + Engine -->
        <div class="model-row-left">
          <div class="card-avatar-box" style="width:40px; height:40px; font-size:20px; flex-shrink:0;">
            ${isEmbed ? '📐' : isVision ? '👁️' : isCoder ? '⚡' : '🤖'}
            <span class="card-avatar-dot ${m.is_active ? 'active' : ''}"></span>
          </div>
          <div class="model-row-info">
            <div class="model-row-title" title="${m.name}">
              ${m.name}
              <span class="card-status-pill ${m.is_active ? 'active' : ''}" style="padding: 2px 8px; font-size: 10px;">
                <span class="dot" style="width:5px; height:5px;"></span>
                ${m.is_active ? 'ACTIVE' : 'READY'}
              </span>
            </div>
            <div class="model-row-subtitle">${engineTitle}</div>
          </div>
        </div>

        <!-- Specs Column -->
        <div class="model-row-specs">
          <span class="card-spec-tag"><i class="ph ph-package"></i> ${formatName}</span>
          <span class="card-spec-tag"><i class="ph ph-cpu"></i> ${quantName}</span>
          <span class="card-spec-tag"><i class="ph ph-hard-drive"></i> ${sizeText}</span>
          ${tagsListHtml}
        </div>

        <!-- Stats & Quota Column -->
        <div class="model-row-stats">
          <div style="display:flex; justify-content:space-between; font-size:11px; font-family:var(--mono);">
            <span style="color:var(--tx);">${hasStats ? `${stats.total_tasks} tasks (${taskRate}%)` : 'Ready • 0 runs'}</span>
            <span style="color:var(--green); font-weight:700;">${hasStats && stats.avg_tps > 0 ? `${stats.avg_tps} t/s` : 'Nominal'}</span>
          </div>
          <div class="card-quota-track" style="height:4px; margin:0;">
            <div class="card-quota-fill" style="width: ${hasStats ? Math.min(100, Math.max(10, (stats.total_tokens / 131072) * 100)) : 0}%;"></div>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:9.5px; font-family:var(--mono); color:rgba(255,255,255,0.4);">
            <span>${hasStats ? formatTokens(stats.total_tokens) : '0 tokens'}</span>
            <span>${contextK} Window</span>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="model-row-actions">
          <button class="btn-card-runchat" onclick="document.getElementById('nav-chat')?.click()" title="Open in Chat Playground">
            <i class="ph ph-play-fill"></i> Run Chat
          </button>
          <button class="btn-card-config" onclick="window.openModelCard('${m.id}', '${m.backend}')" title="Configure model parameters and prompt">
            <i class="ph ph-gear"></i> Config
          </button>
          <button class="btn btn-ghost" style="padding:6px 10px; font-size:11.5px; color:${m.is_active ? '#ef4444' : '#10b981'}; border-color:${m.is_active ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'};" onclick="window.toggleModelLifecycle('${m.backend}', '${m.name}', ${m.is_active})" title="${m.is_active ? 'Unload model' : 'Load model'}">
            <i class="ph ${m.is_active ? 'ph-stop' : 'ph-play'}"></i>
          </button>
        </div>
      </div>
      `;
    }).join('');
    return;
  }

  // ══════════════════════════════════════════════════════════════
  // GRID VIEW (RICH UNIFIED CARD MATCHING SCREENSHOT 1:1)
  // ══════════════════════════════════════════════════════════════
  grid.innerHTML = models.map(m => {
    const stats = m.stats;
    const hasStats = stats && stats.total_tasks > 0;
    const taskRate = hasStats ? ((stats.successful_tasks / stats.total_tasks) * 100).toFixed(0) : 100;

    const isCoder = /code|coder|deepseek|qwen/i.test(m.name);
    const isVision = /vision|llava|vl|moondream/i.test(m.name);
    const isReasoning = /r1|reason|thinking|deepseek-r1/i.test(m.name);
    const isEmbed = /bge|embed|bert|nomic/i.test(m.name);
    const hasTools = /hermes|mistral|command|llama3|qwen2.5|qwen3/i.test(m.name);

    const formatName = (m.format || 'GGUF').toLowerCase();
    const quantName = m.quantization || (m.backend === 'ollama' ? 'Standard' : '—');
    const sizeText = m.size_bytes && m.size_bytes > 0 ? formatBytes(m.size_bytes) : '—';
    const engineTitle = `${m.backend ? m.backend.toUpperCase() : 'OLLAMA'} Autonomous Engine`;
    const contextK = /llama3|qwen|deepseek|gemini/i.test(m.name) ? '128k' : /mistral|gemma/i.test(m.name) ? '32k' : '8k';
    const quotaPct = hasStats ? Math.min(100, Math.max(10, (stats.total_tokens / 131072) * 100)).toFixed(0) : 0;
    const tagsListHtml = (m.tags && m.tags.length > 0)
      ? m.tags.map(t => `<span class="tag-badge-pill">🏷️ ${t}</span>`).join(' ')
      : '';

    return `
    <div class="model-card-unified ${m.is_duplicate ? 'is-duplicate' : ''}" data-id="${m.id}">
      
      <!-- ════ LEFT SECTION: AVATAR, TITLE, ENGINE & SPECS ════ -->
      <div class="card-left-section">
        <div>
          <!-- Avatar + Active Status Pill -->
          <div class="card-avatar-row">
            <div class="card-avatar-box" title="${m.name}">
              ${isEmbed ? '📐' : isVision ? '👁️' : isCoder ? '⚡' : '🤖'}
              <span class="card-avatar-dot ${m.is_active ? 'active' : ''}"></span>
            </div>

            <div class="card-status-pill ${m.is_active ? 'active' : ''}">
              <span class="dot"></span>
              <span>${m.is_active ? 'ACTIVE' : 'READY'}</span>
            </div>
          </div>

          <!-- Model Name & Subtitle -->
          <h2 class="card-title" title="${m.name}">${m.name}</h2>
          <p class="card-subtitle">${engineTitle}</p>
        </div>

        <!-- Spec Badges Row (📁 format, ⚙️ quant, 💾 size, tags) -->
        <div class="card-spec-badges">
          <span class="card-spec-tag">
            <i class="ph ph-folder"></i> ${formatName}
          </span>
          <span class="card-spec-tag">
            <i class="ph ph-gear"></i> ${quantName}
          </span>
          <span class="card-spec-tag">
            <i class="ph ph-hard-drive"></i> ${sizeText}
          </span>
          ${m.is_preferred ? `
            <span class="card-spec-tag" style="border-color: rgba(255, 138, 30, 0.4); color: var(--amber);">
              <i class="ph-fill ph-star"></i> Preferred
            </span>
          ` : ''}
          ${tagsListHtml}
        </div>
      </div>

      <!-- ════ RIGHT SECTION: STATS, QUOTA BAR, CAPABILITIES, ACTIONS ════ -->
      <div class="card-right-section">
        <!-- 2 Stat Boxes: TASKS RUN & ACCURACY/SPEED -->
        <div class="card-stats-grid">
          <div class="card-stat-box">
            <div class="card-stat-lbl">Tasks Run</div>
            <div class="card-stat-val">${hasStats ? stats.total_tasks : 0}</div>
          </div>
          <div class="card-stat-box">
            <div class="card-stat-lbl">${hasStats && stats.avg_tps > 0 ? 'Speed (t/s)' : 'Status'}</div>
            <div class="card-stat-val highlight">${hasStats && stats.avg_tps > 0 ? `${stats.avg_tps} t/s` : hasStats ? `${taskRate}%` : 'Ready'}</div>
          </div>
        </div>

        <!-- Context / Quota Limit Bar with Countdown -->
        <div class="card-quota-container">
          <div class="card-quota-header">
            <span>Context / Quota Limit</span>
            <span class="card-quota-timer" style="color:${hasStats ? '#ff6363' : 'var(--green)'};">
              <i class="ph ${hasStats ? 'ph-hourglass' : 'ph-check-circle'}"></i> ${hasStats ? '14:59' : '100% Available'}
            </span>
          </div>
          <div class="card-quota-track">
            <div class="card-quota-fill" style="width: ${quotaPct}%; background:${quotaPct > 0 ? 'linear-gradient(90deg, #ff6363 0%, #ff8a1e 100%)' : 'rgba(255,255,255,0.1)'};"></div>
          </div>
          <div class="card-quota-sub">
            <span>${hasStats ? formatTokens(stats.total_tokens) : '0 tokens used'}</span>
            <span>${contextK} Context Window</span>
          </div>
        </div>

        <!-- Capabilities Tags -->
        <div class="card-capabilities-row">
          <span class="card-cap-pill ${isCoder ? 'active-feat' : ''}">
            <i class="ph ph-lightning"></i> Code
          </span>
          <span class="card-cap-pill ${!isEmbed ? 'active-feat' : ''}">
            <i class="ph ph-chat-circle-dots"></i> Chat
          </span>
          <span class="card-cap-pill ${isReasoning ? 'active-feat' : ''}">
            <i class="ph ph-brain"></i> Reasoning
          </span>
          <span class="card-cap-pill ${isVision ? 'active-feat' : ''}">
            <i class="ph ph-eye"></i> Vision
          </span>
          <span class="card-cap-pill ${hasTools ? 'active-feat' : ''}">
            <i class="ph ph-globe"></i> Tools
          </span>
        </div>

        <!-- Footer Actions (Compact Toggle, Run Chat, Config) -->
        <div class="card-actions-footer">
          <button class="btn-card-compact" onclick="window.toggleCardCompact('${m.id}')" title="Toggle Compact / Expanded Aspect">
            <i class="ph ph-arrows-in"></i> Compact
          </button>

          <button class="btn-card-runchat" onclick="document.getElementById('nav-chat')?.click()" title="Start Playground Chat with ${m.name}">
            <i class="ph ph-play-fill"></i> Run Chat
          </button>

          <button class="btn-card-config" onclick="window.openModelCard('${m.id}', '${m.backend}')" title="Open Interactive 3D Model Card & Configuration">
            <i class="ph ph-gear"></i> Config
          </button>
        </div>
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

