// src/js/gpu_tuning.js
// trace:implements FR-006
// trace:implements SPEC-002
//! GPU Telemetry & MSI Afterburner Control Center Module.
//! Displays deep GPU metrics (Core, Memory, Hotspot, Power) and provides
//! interactive clock offsets, power target %, and fan duty control.

import { showToast } from './toast.js';
import { invoke } from './api.js';

// Current Tuning State
let tuningState = {
  coreOffset: 0,       // MHz (-500 to +500)
  memOffset: 0,        // MHz (-1000 to +1500)
  powerTarget: 100,    // % (50 to 115)
  isAutoFan: true,     // Auto fan curve vs Manual Duty
  fanDuty: 45,         // % (0 to 100)
  appliedProfile: "Stock Default"
};

// Telemetry State
let gpuTelemetryState = {
  name: null,
  coreClock: null,
  memClock: null,
  coreTemp: null,
  hotspotTemp: null,
  powerDraw: null,
  fanRpm: null,
  cudaLoad: null
};

export async function initGpuTuning() {
  setupTuningControls();
  await refreshGpuTelemetry();
}

export async function refreshGpuTelemetry() {
  gpuTelemetryState = {
    name: null,
    coreClock: null,
    memClock: null,
    coreTemp: null,
    hotspotTemp: null,
    powerDraw: null,
    fanRpm: null,
    cudaLoad: null
  };
  try {
    const readings = await invoke('get_sensor_tree');
    if (Array.isArray(readings) && readings.length > 0) {
      for (const r of readings) {
        const id = String(r.id || '').toLowerCase();
        const name = String(r.name || '').toLowerCase();
        const hw = String(r.hw || '');
        if (id.includes('/nvidiagpu/0') || id.includes('/gpu/0') || id.includes('gpu') || hw.toLowerCase().includes('gpu')) {
          gpuTelemetryState.name = hw || gpuTelemetryState.name;
          if (name.includes('hotspot') && r.kind === 'temperature') gpuTelemetryState.hotspotTemp = r.value;
          else if (name.includes('core') && r.kind === 'temperature') gpuTelemetryState.coreTemp = r.value;
          if (name.includes('core') && r.kind === 'load') gpuTelemetryState.cudaLoad = r.value;
          if (r.kind === 'fan' || name.includes('fan')) gpuTelemetryState.fanRpm = r.value;
          if (r.kind === 'power') gpuTelemetryState.powerDraw = r.value;
          if (name.includes('core') && r.kind === 'clock') gpuTelemetryState.coreClock = r.value;
          if (name.includes('memory') && r.kind === 'clock') gpuTelemetryState.memClock = r.value;
        }
      }
    }
  } catch (err) {
    console.debug('GPU telemetry read note:', err);
  }

  renderGpuDashboard();
}

export function renderGpuDashboard() {
  // Update Live Telemetry Metrics
  const coreClockEl = document.getElementById('gpu-val-core-clock');
  const memClockEl = document.getElementById('gpu-val-mem-clock');
  const coreTempEl = document.getElementById('gpu-val-core-temp');
  const hotspotTempEl = document.getElementById('gpu-val-hotspot-temp');
  const powerDrawEl = document.getElementById('gpu-val-power-draw');
  const fanRpmEl = document.getElementById('gpu-val-fan-rpm');
  const cudaLoadEl = document.getElementById('gpu-val-cuda-load');

  const formatMetric = (value, digits, unit) => Number.isFinite(value)
    ? `${value.toFixed(digits)} ${unit}`
    : 'Unavailable';
  if (coreClockEl) coreClockEl.textContent = formatMetric(gpuTelemetryState.coreClock, 0, 'MHz');
  if (memClockEl) memClockEl.textContent = formatMetric(gpuTelemetryState.memClock, 0, 'MHz');
  if (coreTempEl) coreTempEl.textContent = formatMetric(gpuTelemetryState.coreTemp, 1, '°C');
  if (hotspotTempEl) hotspotTempEl.textContent = formatMetric(gpuTelemetryState.hotspotTemp, 1, '°C');
  if (powerDrawEl) powerDrawEl.textContent = formatMetric(gpuTelemetryState.powerDraw, 0, 'W');
  if (fanRpmEl) fanRpmEl.textContent = formatMetric(gpuTelemetryState.fanRpm, 0, 'RPM');
  if (cudaLoadEl) cudaLoadEl.textContent = formatMetric(gpuTelemetryState.cudaLoad, 1, '%');
  const titleEl = document.getElementById('gpu-tuning-title');
  if (titleEl) titleEl.textContent = gpuTelemetryState.name || 'GPU Live Telemetry';
}

function setupTuningControls() {
  const coreSlider = document.getElementById('tune-core-slider');
  const coreVal = document.getElementById('tune-core-val');
  const memSlider = document.getElementById('tune-mem-slider');
  const memVal = document.getElementById('tune-mem-val');
  const powerSlider = document.getElementById('tune-power-slider');
  const powerVal = document.getElementById('tune-power-val');
  const fanSlider = document.getElementById('tune-fan-slider');
  const fanVal = document.getElementById('tune-fan-val');
  const fanAutoBtn = document.getElementById('btn-fan-mode-auto');
  const fanManualBtn = document.getElementById('btn-fan-mode-manual');

  if (coreSlider && coreVal) {
    coreSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      tuningState.coreOffset = val;
      coreVal.textContent = `${val >= 0 ? '+' : ''}${val} MHz`;
      renderGpuDashboard();
    });
  }

  if (memSlider && memVal) {
    memSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      tuningState.memOffset = val;
      memVal.textContent = `${val >= 0 ? '+' : ''}${val} MHz`;
      renderGpuDashboard();
    });
  }

  if (powerSlider && powerVal) {
    powerSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      tuningState.powerTarget = val;
      powerVal.textContent = `${val}%`;
    });
  }

  if (fanSlider && fanVal) {
    fanSlider.addEventListener('input', async (e) => {
      const val = parseInt(e.target.value, 10);
      tuningState.fanDuty = val;
      fanVal.textContent = `${val}%`;
      renderGpuDashboard();
    });
  }

  // Fan Mode Toggle
  if (fanAutoBtn && fanManualBtn) {
    fanAutoBtn.addEventListener('click', () => {
      tuningState.isAutoFan = true;
      fanAutoBtn.classList.add('active');
      fanManualBtn.classList.remove('active');
      if (fanSlider) fanSlider.disabled = true;
      showToast('Automatic fan mode selected locally. Hub cannot apply an automatic fan curve.', 'info');
    });

    fanManualBtn.addEventListener('click', () => {
      tuningState.isAutoFan = false;
      fanManualBtn.classList.add('active');
      fanAutoBtn.classList.remove('active');
      if (fanSlider) fanSlider.disabled = false;
      showToast('Manual fan mode selected. Apply only sends a fan command when LHM supports this controller.', 'info');
    });
  }

  // Presets
  const presetAi = document.getElementById('btn-preset-ai');
  const presetQuiet = document.getElementById('btn-preset-quiet');
  const presetOc = document.getElementById('btn-preset-oc');
  const presetStock = document.getElementById('btn-preset-stock');

  if (presetAi) {
    presetAi.addEventListener('click', () => {
      applyPreset({ core: 150, mem: 600, power: 100, fan: 70, name: "AI Inference Boost" });
    });
  }
  if (presetQuiet) {
    presetQuiet.addEventListener('click', () => {
      applyPreset({ core: -100, mem: -200, power: 80, fan: 40, name: "Quiet / Low Temp" });
    });
  }
  if (presetOc) {
    presetOc.addEventListener('click', () => {
      applyPreset({ core: 220, mem: 1000, power: 110, fan: 85, name: "Max Overclock" });
    });
  }
  if (presetStock) {
    presetStock.addEventListener('click', () => {
      applyPreset({ core: 0, mem: 0, power: 100, fan: 45, name: "Stock Default" });
    });
  }

  // Action Buttons
  const btnApply = document.getElementById('btn-afterburner-apply');
  const btnReset = document.getElementById('btn-afterburner-reset');
  const btnSave = document.getElementById('btn-afterburner-save');

  if (btnApply) {
    btnApply.addEventListener('click', async () => {
      try {
        if (!tuningState.isAutoFan) {
          await invoke('set_fan_duty', {
            id: '/nvidiagpu/0/control/0',
            percent: tuningState.fanDuty
          });
        }
        const fanMessage = tuningState.isAutoFan
          ? 'No hardware command was sent because automatic fan mode is selected.'
          : `Fan duty set to ${tuningState.fanDuty}% through LHM.`;
        showToast(`${fanMessage} Core and memory offsets and power target remain unapplied.`, tuningState.isAutoFan ? 'info' : 'success');
      } catch (err) {
        showToast(`Hardware fan control failed: ${err.message || err}`, 'error');
      }
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      applyPreset({ core: 0, mem: 0, power: 100, fan: 45, name: "Stock Default" });
      showToast('Local tuning values reset. Hub did not change GPU hardware settings.', 'info');
    });
  }

  if (btnSave) {
    btnSave.addEventListener('click', () => {
      showToast('Saving tuning profiles is not available yet.', 'info');
    });
  }
}

function applyPreset({ core, mem, power, fan, name }) {
  tuningState.coreOffset = core;
  tuningState.memOffset = mem;
  tuningState.powerTarget = power;
  tuningState.fanDuty = fan;
  tuningState.appliedProfile = name;

  const coreSlider = document.getElementById('tune-core-slider');
  const coreVal = document.getElementById('tune-core-val');
  const memSlider = document.getElementById('tune-mem-slider');
  const memVal = document.getElementById('tune-mem-val');
  const powerSlider = document.getElementById('tune-power-slider');
  const powerVal = document.getElementById('tune-power-val');
  const fanSlider = document.getElementById('tune-fan-slider');
  const fanVal = document.getElementById('tune-fan-val');

  if (coreSlider) coreSlider.value = core;
  if (coreVal) coreVal.textContent = `${core >= 0 ? '+' : ''}${core} MHz`;
  if (memSlider) memSlider.value = mem;
  if (memVal) memVal.textContent = `${mem >= 0 ? '+' : ''}${mem} MHz`;
  if (powerSlider) powerSlider.value = power;
  if (powerVal) powerVal.textContent = `${power}%`;
  if (fanSlider) fanSlider.value = fan;
  if (fanVal) fanVal.textContent = `${fan}%`;

  renderGpuDashboard();
  showToast(`Selected local tuning values: ${name}. Hardware settings were not changed.`, 'info');
}
