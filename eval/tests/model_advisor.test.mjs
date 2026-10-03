import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addComparisonGpu,
  compareRunConditions,
  filterBenchmarkRuns,
  recommendForVram,
  validateVramGiB
} from '../../src/js/model_advisor.js';

const baseRun = {
  benchmark: 'suite-a',
  stage: 'confirmation',
  gpu: { id: 'gpu-a' },
  model: { id: 'weights-1', label: 'Model A', alias: 'model-a:q4', quantization: 'Q4_K_M' },
  conditions: {
    taskSetSha256: 'task-hash',
    heldoutSha256: 'heldout-hash',
    options: { temperature: 0.6, num_ctx: 40960 },
    mode: 'native',
    thinking: true,
    runtime: { ollama: '0.35.1' },
    seeds: [45, 46, 47]
  },
  metrics: { gpuOnly: true, peakDeviceMiB: 8000 },
  evidence: { slots: [{ task: 'FR-002' }] }
};

test('VRAM input rejects invalid capacities and preserves binary GiB values', () => {
  assert.equal(validateVramGiB('16'), 16);
  assert.equal(validateVramGiB('0'), null);
  assert.equal(validateVramGiB('-1'), null);
  assert.equal(validateVramGiB('Infinity'), null);
  assert.equal(validateVramGiB('not-a-number'), null);
});

test('GPU comparison selection is unique and limited to six cards', () => {
  let selection = [];
  for (let i = 1; i <= 6; i += 1) {
    const result = addComparisonGpu(selection, `gpu-${i}`);
    assert.equal(result.added, true);
    selection = result.selectedIds;
  }
  assert.equal(selection.length, 6);
  assert.equal(addComparisonGpu(selection, 'gpu-7').added, false);
  assert.equal(addComparisonGpu(selection, 'gpu-6').added, false);
  assert.deepEqual(addComparisonGpu(selection, '').selectedIds, selection);
});

test('VRAM advice distinguishes measured, offloaded, reference-only and unknown', () => {
  assert.equal(recommendForVram(baseRun, 16 * 1024 ** 3, 'gpu-a'), 'measured_on_selected_gpu');
  assert.equal(recommendForVram(baseRun, 16 * 1024 ** 3), 'capacity_candidate_unverified');
  assert.equal(recommendForVram(baseRun, 4 * 1024 ** 3), 'below_observed_peak');
  assert.equal(recommendForVram(baseRun, null), 'target_vram_required');
  assert.equal(recommendForVram({ ...baseRun, metrics: { ...baseRun.metrics, gpuOnly: false } }, 32 * 1024 ** 3), 'offloaded_reference_only');
  assert.equal(recommendForVram({ ...baseRun, metrics: { ...baseRun.metrics, gpuOnly: null, peakDeviceMiB: null } }, 32 * 1024 ** 3), 'insufficient_memory_evidence');
});

test('GPU comparison rejects incompatible cohorts and permits the same profile', () => {
  assert.deepEqual(compareRunConditions(baseRun, structuredClone(baseRun)), []);
  const mismatches = [
    run => { run.model.id = 'different-weights'; },
    run => { run.benchmark = 'suite-b'; },
    run => { run.conditions.taskSetSha256 = 'different-task-hash'; },
    run => { run.conditions.heldoutSha256 = 'different-hidden-hash'; },
    run => { run.conditions.options.temperature = 0.2; },
    run => { run.conditions.options.num_ctx = 8192; },
    run => { run.conditions.options.num_predict = 2048; },
    run => { run.conditions.thinking = false; },
    run => { run.conditions.runtime.ollama = '0.36.0'; },
    run => { run.stage = 'calibration'; },
    run => { run.conditions.seeds = [42, 43, 44]; }
  ];
  for (const mutate of mismatches) {
    const changed = structuredClone(baseRun);
    mutate(changed);
    assert.ok(compareRunConditions(baseRun, changed).length > 0);
  }
});

test('filters distinguish model, benchmark, stage and task', () => {
  const other = structuredClone(baseRun);
  other.model.label = 'Different';
  other.stage = 'baseline';
  other.benchmark = 'suite-b';
  other.evidence.slots = [{ task: 'FR-006' }];
  assert.deepEqual(filterBenchmarkRuns([baseRun, other], { query: 'q4_k_m', stage: 'confirmation', benchmark: 'suite-a', task: 'FR-002' }), [baseRun]);
});
