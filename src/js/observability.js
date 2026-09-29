// src/js/observability.js
// trace:implements FR-006
// Real-time Hardware Telemetry Polling (GPU VRAM, System RAM, CPU)

const invoke = window.__TAURI__?.core?.invoke || (async () => ({
  system_ram_used_bytes: 8589934592,
  system_ram_total_bytes: 34359738368,
  cpu_usage_pct: 14.5,
  gpus: [
    {
      index: 0,
      name: "NVIDIA GeForce RTX 3060",
      vram_used_bytes: 7570000000,
      vram_total_bytes: 12884901888,
      utilization_pct: 42,
      temperature_c: 54
    }
  ]
}));

let pollInterval = null;

function formatGb(bytes) {
  return (bytes / (1024 * 1024 * 1024)).toFixed(1);
}

export function updateTelemetryDOM(telemetry) {
  if (!telemetry) return;

  // 1. GPU VRAM pill
  const vramPill = document.getElementById('stat-gpu-vram');
  if (vramPill && telemetry.gpus && telemetry.gpus.length > 0) {
    const gpu = telemetry.gpus[0];
    const usedGb = formatGb(gpu.vram_used_bytes);
    const totalGb = formatGb(gpu.vram_total_bytes);
    const pct = Math.round((gpu.vram_used_bytes / (gpu.vram_total_bytes || 1)) * 100);
    const tempStr = gpu.temperature_c ? ` • ${gpu.temperature_c}°C` : '';
    vramPill.innerHTML = `
      <span style="color:#60a5fa; font-weight:600;">VRAM:</span> 
      <span>${usedGb}/${totalGb} GB (${pct}%)${tempStr}</span>
    `;
    vramPill.title = `${gpu.name} - GPU Load: ${gpu.utilization_pct}%`;
  }

  // 2. System RAM pill
  const ramPill = document.getElementById('stat-ram');
  if (ramPill) {
    const ramUsedGb = formatGb(telemetry.system_ram_used_bytes);
    const ramTotalGb = formatGb(telemetry.system_ram_total_bytes);
    const ramPct = Math.round((telemetry.system_ram_used_bytes / (telemetry.system_ram_total_bytes || 1)) * 100);
    ramPill.innerHTML = `
      <span style="color:#a78bfa; font-weight:600;">RAM:</span> 
      <span>${ramUsedGb}/${ramTotalGb} GB (${ramPct}%)</span>
    `;
    ramPill.title = `System RAM: ${ramPct}% utilized | CPU: ${Math.round(telemetry.cpu_usage_pct)}%`;
  }
}

export async function fetchHardwareTelemetry() {
  try {
    const data = await invoke('get_hardware_telemetry');
    updateTelemetryDOM(data);
    return data;
  } catch (err) {
    console.error('Failed to get hardware telemetry:', err);
    return null;
  }
}

export function startTelemetryPolling(intervalMs = 2000) {
  if (pollInterval) clearInterval(pollInterval);
  fetchHardwareTelemetry();
  pollInterval = setInterval(fetchHardwareTelemetry, intervalMs);
}

export function stopTelemetryPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}
