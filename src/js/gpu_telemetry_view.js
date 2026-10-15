// trace:implements FR-006
const GIB = 1024 ** 3;

export function gpuTelemetryView(gpu) {
  const vramUsedGb = Number.isFinite(gpu?.vram_used_bytes) ? gpu.vram_used_bytes / GIB : null;
  const vramTotalGb = Number.isFinite(gpu?.vram_total_bytes) && gpu.vram_total_bytes > 0
    ? gpu.vram_total_bytes / GIB
    : null;
  const utilizationPct = Number.isFinite(gpu?.utilization_pct) ? gpu.utilization_pct : null;
  const temperatureC = Number.isFinite(gpu?.temperature_c) ? gpu.temperature_c : null;
  const available = vramUsedGb !== null || vramTotalGb !== null
    || utilizationPct !== null || temperatureC !== null;

  if (!available) {
    return {
      available: false,
      status: 'GPU monitoring unavailable',
      name: gpu?.name || 'GPU monitoring unavailable',
      vramUsedGb,
      vramTotalGb,
      utilizationPct,
      temperatureC,
      vramText: 'Unavailable',
      utilizationText: 'Unavailable',
      temperatureText: 'Unavailable'
    };
  }

  return {
    available,
    status: gpu.name || 'GPU telemetry available',
    name: gpu.name || 'GPU',
    vramUsedGb,
    vramTotalGb,
    utilizationPct,
    temperatureC,
    vramText: vramUsedGb === null || vramTotalGb === null
      ? 'Unavailable'
      : `${vramUsedGb.toFixed(1)} / ${vramTotalGb.toFixed(1)} GB`,
    utilizationText: utilizationPct === null ? 'Unavailable' : `${utilizationPct}%`,
    temperatureText: temperatureC === null ? 'Unavailable' : `${temperatureC} °C`
  };
}
