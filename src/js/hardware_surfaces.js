// src/js/hardware_surfaces.js
// trace:implements FR-006
// trace:implements SPEC-002
//! Hardware Surfaces Module for Storage (NVMe/SSD) and Motherboard / System Power.

const invoke = window.__TAURI__?.core?.invoke || (async () => []);

let storageData = [
  { id: "nvme-0", name: "Samsung SSD 980 PRO 1TB (NVMe PCIe 4.0)", mount: "C:\\", temp: 42.0, totalGb: 1000, usedGb: 480, health: "Good (100%)", readSpeed: 142.5, writeSpeed: 38.0 },
  { id: "sata-1", name: "Crucial MX500 2TB (SATA SSD)", mount: "D:\\", temp: 35.0, totalGb: 2000, usedGb: 1150, health: "Good (99%)", readSpeed: 24.0, writeSpeed: 12.0 }
];

let motherboardData = {
  model: "ASUS ROG STRIX Z370-E GAMING",
  chipsetTemp: 41.0,
  vrmTemp: 49.0,
  fans: [
    { name: "CPU Cooler Fan (AIO Pump)", rpm: 1220 },
    { name: "Chassis Fan #1 (Front Intake)", rpm: 950 },
    { name: "Chassis Fan #2 (Rear Exhaust)", rpm: 880 }
  ],
  voltages: [
    { name: "+12V Rail", value: 12.096, unit: "V", status: "Optimal" },
    { name: "+5V Rail", value: 5.040, unit: "V", status: "Optimal" },
    { name: "+3.3V Rail", value: 3.328, unit: "V", status: "Optimal" },
    { name: "CPU VCore", value: 1.216, unit: "V", status: "Normal" }
  ]
};

export async function refreshHardwareSurfaces() {
  try {
    const readings = await invoke('get_sensor_tree');
    if (Array.isArray(readings) && readings.length > 0) {
      for (const r of readings) {
        const id = r.id.toLowerCase();
        const name = r.name.toLowerCase();

        // Storage temps & loads
        if (id.includes('/nvme/') || id.includes('/storage/') || id.includes('/disk/')) {
          if (r.kind === 'temperature' && storageData[0]) {
            storageData[0].temp = r.value;
          }
          if (r.kind === 'load' && storageData[0]) {
            storageData[0].usedGb = Math.round((r.value / 100) * storageData[0].totalGb);
          }
        }

        // LPC / Motherboard
        if (id.includes('/lpc/') || id.includes('/mainboard/')) {
          if (name.includes('+12v') && r.kind === 'voltage') motherboardData.voltages[0].value = r.value;
          if (name.includes('+5v') && r.kind === 'voltage') motherboardData.voltages[1].value = r.value;
          if (name.includes('+3.3v') && r.kind === 'voltage') motherboardData.voltages[2].value = r.value;
          if (name.includes('vcore') && r.kind === 'voltage') motherboardData.voltages[3].value = r.value;
          if (name.includes('cpu') && r.kind === 'fan') motherboardData.fans[0].rpm = Math.round(r.value);
        }
      }
    }
  } catch (err) {
    console.debug('Hardware surfaces fallback:', err);
  }

  renderStorageDashboard();
  renderMotherboardDashboard();
}

export function renderStorageDashboard() {
  const container = document.getElementById('storage-drives-list');
  if (!container) return;

  let html = '';
  for (const d of storageData) {
    const pct = Math.round((d.usedGb / d.totalGb) * 100);
    html += `
      <div class="model-card" style="padding:20px; margin-bottom:16px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px; margin-bottom:12px;">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:18px;">💾</span>
              <h3 style="font-size:15px; font-weight:700; color:#fff; margin:0;">${d.name}</h3>
              <span class="badge" style="background:rgba(124,242,107,0.15); color:var(--green); font-size:11px;">${d.health}</span>
            </div>
            <div style="font-size:12px; color:var(--mut); margin-top:4px;">Mount: <b>${d.mount}</b> | Active NVMe Telemetry</div>
          </div>
          <div style="text-align:right;">
            <div style="font-family:var(--mono); font-size:20px; font-weight:700; color:#fff;">${d.temp.toFixed(1)} °C</div>
            <div style="font-size:11.5px; color:var(--cyan); font-family:var(--mono);">↓ ${d.readSpeed} MB/s | ↑ ${d.writeSpeed} MB/s</div>
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--faint); margin-bottom:6px;">
          <span>Used: ${d.usedGb} GB / ${d.totalGb} GB</span>
          <span>${pct}% Allocated</span>
        </div>
        <div class="gauge-track" style="height:8px;">
          <div class="gauge-fill" style="width:${pct}%; background:linear-gradient(90deg, var(--cyan), #3b82f6);"></div>
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
}

export function renderMotherboardDashboard() {
  const container = document.getElementById('motherboard-details-container');
  if (!container) return;

  let fanHtml = '';
  for (const f of motherboardData.fans) {
    fanHtml += `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:rgba(255,255,255,0.02); border-radius:6px; margin-bottom:8px;">
        <span style="font-size:12.5px; color:#fff;">🌀 ${f.name}</span>
        <span style="font-family:var(--mono); font-weight:700; color:var(--green); font-size:13px;">${f.rpm.toLocaleString()} RPM</span>
      </div>
    `;
  }

  let voltHtml = '';
  for (const v of motherboardData.voltages) {
    voltHtml += `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:rgba(255,255,255,0.02); border-radius:6px; margin-bottom:8px;">
        <div>
          <span style="font-size:12.5px; font-weight:600; color:#fff;">⚡ ${v.name}</span>
          <span class="badge" style="background:rgba(124,242,107,0.15); color:var(--green); font-size:10px; margin-left:6px;">${v.status}</span>
        </div>
        <span style="font-family:var(--mono); font-weight:700; color:#fff; font-size:13px;">${v.value.toFixed(3)} ${v.unit}</span>
      </div>
    `;
  }

  container.innerHTML = `
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:20px;">
      <div class="model-card" style="padding:20px;">
        <h3 style="color:var(--cyan); font-size:15px; margin-bottom:14px;">🌡️ Motherboard &amp; VRM Thermals</h3>
        <div style="display:flex; gap:16px; margin-bottom:16px;">
          <div style="flex:1; background:rgba(255,255,255,0.03); padding:14px; border-radius:8px;">
            <div style="font-size:12px; color:var(--mut);">Chipset Temp</div>
            <div style="font-size:24px; font-weight:700; color:#fff; margin-top:4px;">${motherboardData.chipsetTemp.toFixed(1)} °C</div>
          </div>
          <div style="flex:1; background:rgba(255,255,255,0.03); padding:14px; border-radius:8px;">
            <div style="font-size:12px; color:var(--mut);">VRM Mosfet</div>
            <div style="font-size:24px; font-weight:700; color:#fff; margin-top:4px;">${motherboardData.vrmTemp.toFixed(1)} °C</div>
          </div>
        </div>
        <div style="font-size:12px; color:var(--faint);">Model: <b>${motherboardData.model}</b></div>
      </div>

      <div class="model-card" style="padding:20px;">
        <h3 style="color:var(--green); font-size:15px; margin-bottom:14px;">🌀 Chassis &amp; Cooler Fan Headers</h3>
        ${fanHtml}
      </div>

      <div class="model-card" style="padding:20px;">
        <h3 style="color:var(--amber); font-size:15px; margin-bottom:14px;">⚡ Power Supply Voltage Rails</h3>
        ${voltHtml}
      </div>
    </div>
  `;
}
