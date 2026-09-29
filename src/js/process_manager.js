// src/js/process_manager.js
// trace:implements FR-006
//! Task Manager Process Resource Ranker & Telemetry Dashboard.
//! Ranks active host processes by CPU and Memory usage with live search and sorting.

import { showToast } from './toast.js';

const invoke = window.__TAURI__?.core?.invoke || (async (cmd, args) => {
  console.log(`[Mock Dev Invoke] ${cmd}`, args);
  if (cmd === 'get_process_telemetry') {
    return [
      { pid: "14820", name: "ollama.exe", cpuUsage: 28.4, memoryBytes: 5242880000, virtualMemoryBytes: 12884901888, diskReadBytes: 850000000, diskWrittenBytes: 12000000 },
      { pid: "9824", name: "python.exe", cpuUsage: 14.2, memoryBytes: 2147483648, virtualMemoryBytes: 4294967296, diskReadBytes: 120000000, diskWrittenBytes: 4500000 },
      { pid: "4112", name: "tauri-app.exe", cpuUsage: 3.5, memoryBytes: 280000000, virtualMemoryBytes: 850000000, diskReadBytes: 24000000, diskWrittenBytes: 2000000 },
      { pid: "1204", name: "chrome.exe", cpuUsage: 2.1, memoryBytes: 650000000, virtualMemoryBytes: 1500000000, diskReadBytes: 5000000, diskWrittenBytes: 1200000 },
      { pid: "840", name: "Code.exe", cpuUsage: 1.8, memoryBytes: 420000000, virtualMemoryBytes: 980000000, diskReadBytes: 15000000, diskWrittenBytes: 800000 },
      { pid: "112", name: "System", cpuUsage: 0.8, memoryBytes: 120000000, virtualMemoryBytes: 450000000, diskReadBytes: 90000000, diskWrittenBytes: 65000000 }
    ];
  }
  return [];
});

let currentSortBy = 'cpu'; // 'cpu' | 'memory'
let processSearchQuery = '';
let processTimer = null;
let currentRefreshRateMs = 2000;
let processListCache = [];

export async function initProcessManager() {
  setupProcessEvents();
  await refreshProcesses();
  startProcessPolling(currentRefreshRateMs);
}

export function setProcessRefreshRate(rateMs) {
  currentRefreshRateMs = rateMs;
  startProcessPolling(rateMs);
}

export function startProcessPolling(intervalMs) {
  if (processTimer) {
    clearInterval(processTimer);
    processTimer = null;
  }
  if (intervalMs <= 0) return; // 0 = Paused

  processTimer = setInterval(async () => {
    const activeView = document.querySelector('.view-panel[style*="display: block"]')?.id;
    if (activeView === 'view-gpu' || activeView === 'view-processes') {
      await refreshProcesses();
    }
  }, intervalMs);
}

export async function refreshProcesses() {
  try {
    const processes = await invoke('get_process_telemetry', {
      sortBy: currentSortBy,
      limit: 30
    });
    if (Array.isArray(processes)) {
      processListCache = processes;
      renderProcessTable();
    }
  } catch (err) {
    console.error('get_process_telemetry error:', err);
  }
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function renderProcessTable() {
  const tbody = document.getElementById('taskmanager-process-tbody');
  const countEl = document.getElementById('taskmanager-active-count');
  if (!tbody) return;

  let filtered = processListCache;
  if (processSearchQuery.trim()) {
    const q = processSearchQuery.toLowerCase().trim();
    filtered = filtered.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.pid.toLowerCase().includes(q)
    );
  }

  if (countEl) {
    countEl.textContent = `${filtered.length} Processes`;
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:32px; color:var(--mut);">
          No active processes found matching "${processSearchQuery}".
        </td>
      </tr>
    `;
    return;
  }

  let html = '';
  for (const p of filtered) {
    const isAiProcess = isLocalAiProcess(p.name);
    const cpuPct = Math.min(100, Math.max(0, p.cpuUsage));
    const memStr = formatBytes(p.memoryBytes);
    const diskRead = formatBytes(p.diskReadBytes);
    const diskWrite = formatBytes(p.diskWrittenBytes);

    let cpuColor = 'var(--tx)';
    if (cpuPct > 50) cpuColor = 'var(--crimson)';
    else if (cpuPct > 20) cpuColor = 'var(--amber)';
    else if (cpuPct > 5) cpuColor = 'var(--cyan)';

    const tagBadge = isAiProcess 
      ? `<span class="badge" style="background:rgba(124,242,107,0.15); color:var(--green); font-size:10px; margin-left:6px;">AI FLEET</span>`
      : '';

    html += `
      <tr style="border-bottom:1px solid rgba(255,255,255,0.04); transition:background 0.15s;">
        <td style="padding:10px 12px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-weight:600; color:${isAiProcess ? 'var(--green)' : '#fff'}; font-size:13px;">${escapeHtml(p.name)}</span>
            ${tagBadge}
          </div>
        </td>
        <td style="padding:10px 12px; font-family:var(--mono); color:var(--faint); font-size:12px;">
          ${escapeHtml(p.pid)}
        </td>
        <td style="padding:10px 12px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-family:var(--mono); font-weight:700; color:${cpuColor}; min-width:48px;">
              ${p.cpuUsage.toFixed(1)}%
            </span>
            <div class="gauge-track" style="width:60px; height:5px; background:rgba(255,255,255,0.06);">
              <div class="gauge-fill" style="width:${cpuPct}%; background:${cpuColor};"></div>
            </div>
          </div>
        </td>
        <td style="padding:10px 12px;">
          <div style="font-family:var(--mono); font-weight:600; color:#fff; font-size:12px;">
            ${memStr}
          </div>
        </td>
        <td style="padding:10px 12px; font-family:var(--mono); color:var(--mut); font-size:11.5px;">
          ↓ ${diskRead} / ↑ ${diskWrite}
        </td>
      </tr>
    `;
  }

  tbody.innerHTML = html;
}

function isLocalAiProcess(name) {
  const lower = name.toLowerCase();
  return lower.includes('ollama') || 
         lower.includes('vllm') || 
         lower.includes('llama') || 
         lower.includes('litellm') || 
         lower.includes('python') ||
         lower.includes('tauri');
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function setupProcessEvents() {
  const btnSortCpu = document.getElementById('btn-sort-proc-cpu');
  const btnSortMem = document.getElementById('btn-sort-proc-mem');
  const searchInput = document.getElementById('proc-search-input');
  const btnRefresh = document.getElementById('btn-refresh-proc');

  if (btnSortCpu && btnSortMem) {
    btnSortCpu.addEventListener('click', () => {
      btnSortCpu.classList.add('active');
      btnSortMem.classList.remove('active');
      currentSortBy = 'cpu';
      refreshProcesses();
    });

    btnSortMem.addEventListener('click', () => {
      btnSortMem.classList.add('active');
      btnSortCpu.classList.remove('active');
      currentSortBy = 'memory';
      refreshProcesses();
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      processSearchQuery = e.target.value;
      renderProcessTable();
    });
  }

  if (btnRefresh) {
    btnRefresh.addEventListener('click', async () => {
      showToast('Refreshing host process list...', 'info');
      await refreshProcesses();
      showToast('Process telemetry synchronized', 'success');
    });
  }
}
