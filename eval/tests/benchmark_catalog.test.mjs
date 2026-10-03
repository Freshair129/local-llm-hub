import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildBenchmarkCatalog, SOURCE_ROOT } from '../../scripts/build_benchmark_catalog.mjs';
import { exportBenchmarkCatalogSources } from '../../scripts/export_benchmark_catalog_sources.mjs';

test('catalog includes only attested profiles and preserves key tuning outcomes', () => {
  const catalog = buildBenchmarkCatalog({ repoRoot: process.cwd() });
  assert.equal(catalog.schemaVersion, 1);
  assert.equal(catalog.runs.length, 45);
  assert.deepEqual(catalog.excludedSources, []);
  assert.equal(catalog.observedGpus.length, 1);
  assert.equal(catalog.observedGpus[0].id, 'geforce-rtx-5060-ti-16gb');
  assert.equal(catalog.gpus.filter(gpu => gpu.tested).length, 1);
  assert.equal(catalog.gpus.length, 8);

  const qwen = catalog.runs.find(run => run.model.alias === 'llh-tune-qwen35:presence15' && run.stage === 'confirmation');
  assert.ok(qwen);
  assert.equal(qwen.metrics.combinedPasses, 5);
  assert.equal(qwen.metrics.planned, 6);
  assert.equal(qwen.metrics.budgetStops, 0);
  assert.deepEqual(qwen.metrics.edgeDiagnostic, { passed: 2, failed: 0, notExecutable: 1 });
  assert.equal(qwen.decision, undefined);
  assert.ok(qwen.cohortKey);
  assert.ok(qwen.evidence.sha256);

  const ornith = catalog.runs.find(run => run.model.alias === 'llh-tune-ornith:budget32k' && run.stage === 'confirmation');
  assert.equal(ornith.metrics.combinedPasses, 5);
  assert.equal(ornith.metrics.budgetStops, 1);
  assert.equal(ornith.metrics.gpuOnly, true);

  const text = JSON.stringify(catalog);
  assert.equal(text.includes('F:/Models'), false);
  assert.equal(text.includes('thinkingChars'), false);
});

test('catalog generation is deterministic and excludes reports without attestation', () => {
  const first = buildBenchmarkCatalog({ repoRoot: process.cwd() });
  const second = buildBenchmarkCatalog({ repoRoot: process.cwd() });
  assert.deepEqual(second, first);

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'llh-advisor-catalog-'));
  try {
    fs.mkdirSync(path.join(tempRoot, 'src', 'data'), { recursive: true });
    fs.writeFileSync(path.join(tempRoot, 'src', 'data', 'gpu_catalog.json'), JSON.stringify({ variants: [] }));
    const runDir = path.join(tempRoot, SOURCE_ROOT, 'fixture');
    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(path.join(runDir, 'manifest.json'), JSON.stringify({ benchmark: 'fixture', machine: { gpu: { stdout: 'GPU Fixture, 1, 8192 MiB' } }, candidates: [] }));
    fs.writeFileSync(path.join(runDir, 'summary.json'), JSON.stringify([]));
    fs.writeFileSync(path.join(runDir, 'verification.json'), JSON.stringify({ status: 'incomplete' }));
    const rejected = buildBenchmarkCatalog({ repoRoot: tempRoot, sourceRuns: ['fixture'] });
    assert.equal(rejected.runs.length, 0);
    assert.equal(rejected.excludedSources.length, 1);
    assert.match(rejected.excludedSources[0].reason, /attestation/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('source export keeps metrics and provenance while removing raw answers and local paths', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'llh-advisor-export-'));
  try {
    const rawDir = path.join(tempRoot, 'eval', 'reports', 'runs', 'fixture');
    fs.mkdirSync(rawDir, { recursive: true });
    fs.writeFileSync(path.join(rawDir, 'manifest.json'), JSON.stringify({
      benchmark: 'fixture',
      machine: { gpu: { stdout: 'GPU Fixture, Driver 1, 8192 MiB' } },
      candidates: [{ alias: 'fixture-q4', slug: 'fixture', label: 'Fixture Q4', files: [{ role: 'model', file: 'F:\\Models\\fixture.gguf', sha256: 'abc', bytes: 12 }] }]
    }));
    fs.writeFileSync(path.join(rawDir, 'summary.json'), JSON.stringify([{ alias: 'fixture-q4', planned: 1, combined: 1, finalAnswers: ['RAW ANSWER SENTINEL'], rows: [{ task: 't1', combined: true, error: 'F:\\Models\\raw-error.ts' }] }]));
    fs.writeFileSync(path.join(rawDir, 'verification.json'), JSON.stringify({ allRequestsMatchProfiles: true }));

    assert.equal(exportBenchmarkCatalogSources({ repoRoot: tempRoot, sourceRuns: ['fixture'] }), 1);
    const outputDir = path.join(tempRoot, SOURCE_ROOT, 'fixture');
    const manifest = JSON.parse(fs.readFileSync(path.join(outputDir, 'manifest.json'), 'utf8'));
    const summary = JSON.parse(fs.readFileSync(path.join(outputDir, 'summary.json'), 'utf8'));
    const verification = JSON.parse(fs.readFileSync(path.join(outputDir, 'verification.json'), 'utf8'));
    const serialized = JSON.stringify({ manifest, summary, verification });

    assert.equal(manifest.candidates[0].files[0].file, 'fixture.gguf');
    assert.equal(summary[0].planned, 1);
    assert.equal(summary[0].rows[0].error, true);
    assert.ok(verification.sourceArtifactSha256['summary.json']);
    assert.doesNotMatch(serialized, /RAW ANSWER SENTINEL|finalAnswers|[A-Z]:[\\/]/);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
