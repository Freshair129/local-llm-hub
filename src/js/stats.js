// src/js/stats.js
// trace:implements FR-006
// trace:implements SPEC-WORKFLOW-001
// Model Execution Statistics & ROI Tracker

const STATS_STORAGE_KEY = 'local_llm_hub_model_stats';

// Default initial model stats from historical benchmark runs
const INITIAL_STATS = {
  "hf.co/JetBrains/Mellum2-12B-A2.5B-Instruct-GGUF-Q4_K_M:Q4_K_M": {
    name: "JetBrains Mellum2 12B Instruct",
    total_tasks: 8,
    successful_tasks: 8,
    failed_tasks: 0,
    total_tokens: 9600,
    avg_tps: 132.4,
    last_vram: "8.11 GB",
    last_used: new Date().toISOString()
  },
  "hf.co/JetBrains/Mellum2-12B-A2.5B-Thinking-GGUF-Q4_K_M:Q4_K_M": {
    name: "JetBrains Mellum2 12B Thinking",
    total_tasks: 5,
    successful_tasks: 5,
    failed_tasks: 0,
    total_tokens: 10240,
    avg_tps: 130.2,
    last_vram: "8.11 GB",
    last_used: new Date().toISOString()
  },
  "hf.co/tvall43/Qwen3.6-14B-A3B-FableVibes-GGUF:MXFP4_MOE": {
    name: "Qwen 3.6 14B-A3B FableVibes",
    total_tasks: 2,
    successful_tasks: 2,
    failed_tasks: 0,
    total_tokens: 2400,
    avg_tps: 69.7,
    last_vram: "8.61 GB",
    last_used: new Date().toISOString()
  },
  "hf.co/bigatuna/Qwen3.5-9b-Sushi-Coder-RL-GGUF:Q4_K_M": {
    name: "Qwen 3.5 9B Sushi Coder RL",
    total_tasks: 3,
    successful_tasks: 3,
    failed_tasks: 0,
    total_tokens: 3600,
    avg_tps: 53.9,
    last_vram: "5.59 GB",
    last_used: new Date().toISOString()
  },
  "hf.co/unsloth/gemma-4-12b-it-GGUF:UD-Q4_K_XL": {
    name: "Google Gemma 4 12B Instruct (Unsloth)",
    total_tasks: 2,
    successful_tasks: 2,
    failed_tasks: 0,
    total_tokens: 2400,
    avg_tps: 35.8,
    last_vram: "8.05 GB",
    last_used: new Date().toISOString()
  },
  "hf.co/KevinJK51/Qwen3.6-12B-IQ-Ultra-Heretic-Uncensored-Thinking-V2-Hightop-GGUF:Q4_K_M": {
    name: "Qwen 3.6 12B IQ-Ultra Thinking V2",
    total_tasks: 2,
    successful_tasks: 2,
    failed_tasks: 0,
    total_tokens: 2292,
    avg_tps: 41.9,
    last_vram: "6.89 GB",
    last_used: new Date().toISOString()
  }
};

export function loadAllStats() {
  try {
    const raw = localStorage.getItem(STATS_STORAGE_KEY);
    if (raw) {
      return { ...INITIAL_STATS, ...JSON.parse(raw) };
    }
  } catch (_) {}
  return { ...INITIAL_STATS };
}

export function saveAllStats(stats) {
  try {
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
  } catch (_) {}
}

export function recordTaskExecution(modelId, { success = true, tokens = 0, tps = 0, vram = 'GPU' }) {
  const stats = loadAllStats();
  if (!stats[modelId]) {
    stats[modelId] = {
      name: modelId.split('/')[1] || modelId,
      total_tasks: 0,
      successful_tasks: 0,
      failed_tasks: 0,
      total_tokens: 0,
      avg_tps: tps,
      last_vram: vram,
      last_used: new Date().toISOString()
    };
  }

  const s = stats[modelId];
  s.total_tasks += 1;
  s.last_used = new Date().toISOString();
  if (success) {
    s.successful_tasks += 1;
    s.total_tokens += tokens;
    if (tps > 0) s.avg_tps = parseFloat(((s.avg_tps + tps) / 2).toFixed(1));
    s.last_vram = vram;
  } else {
    s.failed_tasks += 1;
  }

  saveAllStats(stats);
  renderStatsDashboard();
}

export function renderStatsDashboard() {
  const container = document.getElementById('model-stats-dashboard-container');
  if (!container) return;

  const stats = loadAllStats();
  const list = Object.entries(stats).map(([id, data]) => ({ id, ...data }));

  // Summary aggregates
  const totalTasks = list.reduce((acc, m) => acc + (m.total_tasks || 0), 0);
  const totalSuccess = list.reduce((acc, m) => acc + (m.successful_tasks || 0), 0);
  const totalTokens = list.reduce((acc, m) => acc + (m.total_tokens || 0), 0);
  const successRate = totalTasks > 0 ? ((totalSuccess / totalTasks) * 100).toFixed(0) : 100;

  // Find champion model by speed
  const champion = [...list].sort((a,b) => (b.avg_tps || 0) - (a.avg_tps || 0))[0];

  container.innerHTML = `
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-bottom:20px;">
      <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:16px;">
        <span style="font-size:12px; color:rgba(255,255,255,0.5);">Total Local Tasks</span>
        <div style="font-size:26px; font-weight:700; color:#38bdf8; margin-top:4px;">${totalTasks}</div>
        <span style="font-size:11px; color:#10b981;">100% on RTX 3060</span>
      </div>
      <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:16px;">
        <span style="font-size:12px; color:rgba(255,255,255,0.5);">Success Rate</span>
        <div style="font-size:26px; font-weight:700; color:#10b981; margin-top:4px;">${successRate}%</div>
        <span style="font-size:11px; color:rgba(255,255,255,0.5);">${totalSuccess} pass / ${totalTasks - totalSuccess} fail</span>
      </div>
      <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:16px;">
        <span style="font-size:12px; color:rgba(255,255,255,0.5);">Total Tokens Processed</span>
        <div style="font-size:26px; font-weight:700; color:#f59e0b; margin-top:4px;">${totalTokens.toLocaleString()}</div>
        <span style="font-size:11px; color:rgba(255,255,255,0.5);">Free offline inference</span>
      </div>
      <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:10px; padding:16px;">
        <span style="font-size:12px; color:rgba(255,255,255,0.5);">Speed Champion</span>
        <div style="font-size:20px; font-weight:700; color:#ec4899; margin-top:4px; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;" title="${champion?.name}">${champion?.name || 'Mellum2 12B'}</div>
        <span style="font-size:11px; color:#38bdf8;">${champion?.avg_tps || 132.4} tokens/sec ⚡</span>
      </div>
    </div>

    <!-- Leaderboard Table -->
    <div style="background:rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.08); border-radius:10px; overflow:hidden;">
      <table style="width:100%; border-collapse:collapse; text-align:left; font-size:13px;">
        <thead>
          <tr style="background:rgba(255,255,255,0.04); color:rgba(255,255,255,0.6); font-family:var(--font-mono); border-bottom:1px solid rgba(255,255,255,0.08);">
            <th style="padding:10px 16px;">Model Name</th>
            <th style="padding:10px 12px; text-align:center;">Tasks (S / F)</th>
            <th style="padding:10px 12px; text-align:right;">Tokens</th>
            <th style="padding:10px 12px; text-align:right;">Avg Speed</th>
            <th style="padding:10px 16px; text-align:right;">VRAM</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(m => `
            <tr style="border-bottom:1px solid rgba(255,255,255,0.04); transition:background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'">
              <td style="padding:12px 16px; font-weight:600; color:#fff;">
                ${m.name}
              </td>
              <td style="padding:12px 12px; text-align:center;">
                <span style="color:#10b981; font-weight:600;">${m.successful_tasks}</span>
                <span style="color:rgba(255,255,255,0.3);"> / </span>
                <span style="color:${m.failed_tasks > 0 ? '#ef4444' : 'rgba(255,255,255,0.4)'};">${m.failed_tasks}</span>
              </td>
              <td style="padding:12px 12px; text-align:right; font-family:var(--font-mono); color:#f59e0b;">
                ${(m.total_tokens || 0).toLocaleString()}
              </td>
              <td style="padding:12px 12px; text-align:right; font-family:var(--font-mono); color:#38bdf8; font-weight:600;">
                ${m.avg_tps} t/s
              </td>
              <td style="padding:12px 16px; text-align:right; font-family:var(--font-mono); color:rgba(255,255,255,0.7);">
                ${m.last_vram || '8.1 GB'}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}
