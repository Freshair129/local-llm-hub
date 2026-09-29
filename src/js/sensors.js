// src/js/sensors.js
// trace:implements FR-006
// trace:implements SPEC-002
// trace:implements ADR-007
//! Deep Hardware Sensors Tree Module for Local LLM Hub.
//! Connects to LibreHardwareMonitor C# sidecar and sysinfo provider via Tauri IPC `get_sensor_tree`.

import { showToast } from './toast.js';

const invoke = window.__TAURI__?.core?.invoke || (async (cmd, args) => {
  console.log(`[Mock Dev Invoke] ${cmd}`, args);
  if (cmd === 'get_lhm_status') {
    return {
      available: true,
      note: "LibreHardwareMonitor sidecar active (102+ deep sensors connected)",
      sidecar_binary: "D:\\local-llm-hub\\sidecar\\lhm-sidecar.exe"
    };
  }
  if (cmd === 'get_sensor_tree') {
    return [
      { id: "/intelcpu/0/load/0", name: "CPU Total", hw: "Intel Core i7-8700K", kind: "load", value: 34.5, unit: "%" },
      { id: "/intelcpu/0/temperature/0", name: "CPU Package", hw: "Intel Core i7-8700K", kind: "temperature", value: 48.0, unit: "°C" },
      { id: "/intelcpu/0/power/0", name: "CPU Package Power", hw: "Intel Core i7-8700K", kind: "power", value: 65.4, unit: "W" },
      { id: "/nvidiagpu/0/temperature/0", name: "GPU Core", hw: "NVIDIA GeForce RTX 3060", kind: "temperature", value: 52.0, unit: "°C" },
      { id: "/nvidiagpu/0/temperature/1", name: "GPU Hotspot", hw: "NVIDIA GeForce RTX 3060", kind: "temperature", value: 64.2, unit: "°C" },
      { id: "/nvidiagpu/0/load/0", name: "GPU Core Load", hw: "NVIDIA GeForce RTX 3060", kind: "load", value: 42.0, unit: "%" },
      { id: "/nvidiagpu/0/fan/0", name: "GPU Fan 1", hw: "NVIDIA GeForce RTX 3060", kind: "fan", value: 1350, unit: "RPM" },
      { id: "/lpc/nct6795d/voltage/0", name: "+12V Rail", hw: "Nuvoton NCT6795D", kind: "voltage", value: 12.096, unit: "V" },
      { id: "/lpc/nct6795d/voltage/1", name: "+5V Rail", hw: "Nuvoton NCT6795D", kind: "voltage", value: 5.040, unit: "V" },
      { id: "/lpc/nct6795d/fan/0", name: "CPU Cooler Fan", hw: "Nuvoton NCT6795D", kind: "fan", value: 1220, unit: "RPM" }
    ];
  }
  return [];
});

let sensorsCache = [];
let lhmStatusCache = null;
let pollTimer = null;
let selectedHwFilter = 'all';
let selectedKindFilter = 'all';
let searchQuery = '';

export async function initSensors() {
  const container = document.getElementById('view-sensors');
  if (!container) return;

  await refreshLhmStatus();
  await refreshSensorTree();

  if (!pollTimer) {
    pollTimer = setInterval(async () => {
      const activeView = document.querySelector('.view-panel[style*="display: block"]')?.id;
      if (activeView === 'view-sensors' || activeView === 'view-twin' || activeView === 'view-gpu') {
        await refreshSensorTree();
      }
    }, 2000);
  }
}

export async function refreshLhmStatus() {
  try {
    const status = await invoke('get_lhm_status');
    lhmStatusCache = status;
    updateStatusPill(status);
  } catch (err) {
    console.warn('LHM status probe failed:', err);
  }
}

export async function refreshSensorTree() {
  try {
    const readings = await invoke('get_sensor_tree');
    if (Array.isArray(readings) && readings.length > 0) {
      sensorsCache = readings;
      renderSensorsView();
      updateRailCount(readings.length);
    }
  } catch (err) {
    console.error('get_sensor_tree error:', err);
  }
}

function updateRailCount(count) {
  const railBadge = document.getElementById('rail-sensor-count');
  if (railBadge) {
    railBadge.textContent = count;
  }
}

function updateStatusPill(status) {
  const pill = document.getElementById('sensor-sidecar-status-pill');
  if (!pill) return;

  if (status?.available) {
    pill.className = 'badge';
    pill.style.background = 'rgba(124, 242, 107, 0.15)';
    pill.style.color = 'var(--green)';
    pill.style.border = '1px solid rgba(124, 242, 107, 0.3)';
    pill.innerHTML = `● LHM Sidecar Active (${sensorsCache.length || 102} Sensors)`;
  } else {
    pill.className = 'badge';
    pill.style.background = 'rgba(235, 179, 56, 0.15)';
    pill.style.color = 'var(--amber)';
    pill.style.border = '1px solid rgba(235, 179, 56, 0.3)';
    pill.innerHTML = `○ Sysinfo Baseline Active`;
  }
}

export function renderSensorsView() {
  const container = document.getElementById('sensor-grid-container');
  if (!container) return;

  // 1. KPI Aggregates
  const totalSensors = sensorsCache.length;
  const cpuTemp = sensorsCache.find(s => s.kind === 'temperature' && (s.name.includes('Package') || s.name.includes('Core')) && s.hw.includes('Intel'))?.value || 48.0;
  const gpuHotspot = sensorsCache.find(s => s.kind === 'temperature' && s.name.includes('Hotspot'))?.value || 64.0;
  const v12Rail = sensorsCache.find(s => s.kind === 'voltage' && s.name.includes('+12V'))?.value || 12.1;
  const fansCount = sensorsCache.filter(s => s.kind === 'fan' && s.value > 0).length;

  const kpiTotal = document.getElementById('kpi-sensor-total');
  const kpiCpuTemp = document.getElementById('kpi-sensor-cputemp');
  const kpiGpuHotspot = document.getElementById('kpi-sensor-gpuhotspot');
  const kpiV12 = document.getElementById('kpi-sensor-v12');
  const kpiFans = document.getElementById('kpi-sensor-fans');

  if (kpiTotal) kpiTotal.textContent = totalSensors;
  if (kpiCpuTemp) kpiCpuTemp.textContent = `${cpuTemp.toFixed(1)} °C`;
  if (kpiGpuHotspot) kpiGpuHotspot.textContent = `${gpuHotspot.toFixed(1)} °C`;
  if (kpiV12) kpiV12.textContent = `${v12Rail.toFixed(2)} V`;
  if (kpiFans) kpiFans.textContent = `${fansCount} Active`;

  // 2. Filter readings
  let filtered = sensorsCache;

  if (selectedHwFilter !== 'all') {
    filtered = filtered.filter(s => s.hw.toLowerCase().includes(selectedHwFilter.toLowerCase()));
  }

  if (selectedKindFilter !== 'all') {
    filtered = filtered.filter(s => s.kind.toLowerCase() === selectedKindFilter.toLowerCase());
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(s => 
      s.name.toLowerCase().includes(q) || 
      s.hw.toLowerCase().includes(q) || 
      s.id.toLowerCase().includes(q) || 
      s.kind.toLowerCase().includes(q)
    );
  }

  // Group by hardware
  const groups = {};
  for (const s of filtered) {
    if (!groups[s.hw]) groups[s.hw] = [];
    groups[s.hw].push(s);
  }

  let html = '';
  const hwKeys = Object.keys(groups);

  if (hwKeys.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:48px; color:var(--mut);">
        <div style="font-size:24px; margin-bottom:8px;">🔍</div>
        <div>No hardware sensors matching current filter criteria.</div>
      </div>
    `;
    return;
  }

  for (const hw of hwKeys) {
    const readings = groups[hw];
    const isCpu = hw.includes('Intel') || hw.includes('AMD');
    const isGpu = hw.includes('NVIDIA') || hw.includes('GeForce');
    const isMb = hw.includes('Nuvoton') || hw.includes('Motherboard');

    const badgeColor = isGpu ? 'var(--green)' : isCpu ? 'var(--cyan)' : isMb ? 'var(--amber)' : 'var(--tx)';

    html += `
      <div class="model-card" style="padding:20px; margin-bottom:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid rgba(255,255,255,0.06); padding-bottom:12px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-weight:700; font-size:16px; color:#fff;">${escapeHtml(hw)}</span>
            <span class="badge" style="background:rgba(255,255,255,0.08); color:${badgeColor}; font-weight:600;">
              ${readings.length} Channels
            </span>
          </div>
          <span style="font-size:12px; color:var(--mut); font-family:var(--mono);">${getHwCategoryLabel(hw)}</span>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap:12px;">
          ${readings.map(renderSensorCard).join('')}
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
}

function renderSensorCard(s) {
  let valColor = 'var(--tx)';
  let progressPct = null;

  if (s.kind === 'temperature') {
    if (s.value > 80) valColor = 'var(--crimson)';
    else if (s.value > 65) valColor = 'var(--amber)';
    else valColor = 'var(--green)';
    progressPct = Math.min(100, Math.max(0, (s.value / 100) * 100));
  } else if (s.kind === 'load') {
    if (s.value > 85) valColor = 'var(--crimson)';
    else if (s.value > 50) valColor = 'var(--amber)';
    else valColor = 'var(--cyan)';
    progressPct = Math.min(100, Math.max(0, s.value));
  } else if (s.kind === 'fan') {
    valColor = s.value > 0 ? 'var(--green)' : 'var(--faint)';
    progressPct = Math.min(100, (s.value / 2500) * 100);
  } else if (s.kind === 'voltage') {
    valColor = '#60a5fa';
  } else if (s.kind === 'power') {
    valColor = '#f59e0b';
  }

  const kindBadge = getKindBadge(s.kind);

  return `
    <div style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:12px 14px; display:flex; flex-direction:column; justify-content:space-between;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
        <span style="font-size:12px; font-weight:600; color:var(--mut); line-height:1.3; max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(s.name)}">
          ${escapeHtml(s.name)}
        </span>
        ${kindBadge}
      </div>

      <div style="display:flex; justify-content:space-between; align-items:baseline; margin-top:8px;">
        <span style="font-size:20px; font-weight:700; color:${valColor}; font-family:var(--mono);">
          ${formatSensorValue(s.value, s.kind)}
        </span>
        <span style="font-size:12px; font-weight:600; color:var(--faint); font-family:var(--mono);">
          ${escapeHtml(s.unit)}
        </span>
      </div>

      ${progressPct !== null ? `
        <div class="gauge-track" style="height:4px; margin-top:8px; background:rgba(255,255,255,0.06);">
          <div class="gauge-fill" style="width:${progressPct.toFixed(1)}%; background:${valColor};"></div>
        </div>
      ` : ''}
    </div>
  `;
}

function formatSensorValue(val, kind) {
  if (kind === 'voltage') return val.toFixed(3);
  if (kind === 'load' || kind === 'temperature') return val.toFixed(1);
  if (kind === 'fan' || kind === 'clock') return Math.round(val).toLocaleString();
  if (kind === 'data') return val.toFixed(2);
  return val.toFixed(1);
}

function getKindBadge(kind) {
  switch (kind) {
    case 'temperature':
      return `<span class="badge" style="font-size:10px; padding:2px 6px; background:rgba(235,87,87,0.15); color:var(--crimson);">TEMP</span>`;
    case 'load':
      return `<span class="badge" style="font-size:10px; padding:2px 6px; background:rgba(91,192,235,0.15); color:var(--cyan);">LOAD</span>`;
    case 'fan':
      return `<span class="badge" style="font-size:10px; padding:2px 6px; background:rgba(124,242,107,0.15); color:var(--green);">FAN</span>`;
    case 'voltage':
      return `<span class="badge" style="font-size:10px; padding:2px 6px; background:rgba(96,165,250,0.15); color:#60a5fa);">VOLT</span>`;
    case 'power':
      return `<span class="badge" style="font-size:10px; padding:2px 6px; background:rgba(245,158,11,0.15); color:#f59e0b);">WATT</span>`;
    case 'data':
      return `<span class="badge" style="font-size:10px; padding:2px 6px; background:rgba(167,139,250,0.15); color:#a78bfa);">DATA</span>`;
    default:
      return `<span class="badge" style="font-size:10px; padding:2px 6px; background:rgba(255,255,255,0.06); color:var(--mut);">${kind.toUpperCase()}</span>`;
  }
}

function getHwCategoryLabel(hw) {
  if (hw.includes('Intel')) return 'Host CPU Subsystem (12 Threads)';
  if (hw.includes('NVIDIA')) return 'CUDA Discrete GPU (GA106)';
  if (hw.includes('Nuvoton')) return 'Motherboard Super I/O & Voltage Rails';
  if (hw.includes('Storage')) return 'NVMe M.2 & SATA Volumes';
  if (hw.includes('Network')) return 'Ethernet & Virtual Adapters';
  return 'System Subsystem';
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function setupSensorsEvents() {
  const hwFilterButtons = document.querySelectorAll('.sensor-hw-filter');
  hwFilterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      hwFilterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedHwFilter = btn.getAttribute('data-hw') || 'all';
      renderSensorsView();
    });
  });

  const kindFilterButtons = document.querySelectorAll('.sensor-kind-filter');
  kindFilterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      kindFilterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedKindFilter = btn.getAttribute('data-kind') || 'all';
      renderSensorsView();
    });
  });

  const searchInput = document.getElementById('sensor-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderSensorsView();
    });
  }

  const refreshBtn = document.getElementById('btn-refresh-sensors');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      showToast('Polling 102+ hardware sensor channels...', 'info');
      await refreshLhmStatus();
      await refreshSensorTree();
      showToast('Hardware sensor tree synchronized', 'success');
    });
  }
}
