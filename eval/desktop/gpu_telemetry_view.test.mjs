import test from 'node:test';
import assert from 'node:assert/strict';
import { gpuTelemetryView } from '../../src/js/gpu_telemetry_view.js';

// trace:verifies FR-006
test('missing GPU telemetry is explicitly unavailable', () => {
  const view = gpuTelemetryView(undefined);
  assert.equal(view.available, false);
  assert.equal(view.status, 'GPU monitoring unavailable');
  assert.equal(view.vramText, 'Unavailable');
  assert.equal(view.utilizationText, 'Unavailable');
  assert.equal(view.temperatureText, 'Unavailable');
});

// trace:verifies FR-006
test('reported zero utilization is preserved as a real reading', () => {
  const view = gpuTelemetryView({
    name: 'RTX 3060',
    vram_used_bytes: 0,
    vram_total_bytes: 12 * 1024 ** 3,
    utilization_pct: 0,
    temperature_c: 0
  });
  assert.equal(view.available, true);
  assert.equal(view.vramText, '0.0 / 12.0 GB');
  assert.equal(view.utilizationText, '0%');
  assert.equal(view.temperatureText, '0 °C');
});
