import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { SOURCE_RUNS } from './build_benchmark_catalog.mjs';

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const pick = (source, keys) => Object.fromEntries(keys.filter(key => source[key] !== undefined).map(key => [key, source[key]]));
const basename = value => String(value || '').split(/[\\/]/).pop();
const safePublicUrl = value => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash ? url.href : null;
  } catch {
    return null;
  }
};

function safeGpuOutput(value) {
  const match = String(value || '').match(/^([^,\r\n]+),\s*([^,\r\n]+),\s*(\d+\s*MiB)/i);
  if (!match) throw new Error('GPU identity line is missing from source manifest');
  return `${match[1].trim()}, ${match[2].trim()}, ${match[3].replace(/\s+/g, ' ').trim()}`;
}

function safeModelFile(file) {
  return pick({ ...file, file: basename(file.file || file.name) }, ['role', 'file', 'sha256', 'bytes']);
}

function safeCandidate(candidate) {
  const result = pick(candidate, ['alias', 'slug', 'label', 'options', 'mode', 'think']);
  if (Array.isArray(candidate.files)) result.files = candidate.files.map(safeModelFile);
  if (Array.isArray(candidate.weights)) result.weights = candidate.weights.map(safeModelFile);
  if (Array.isArray(candidate.sources)) result.sources = candidate.sources.map(source => ({ url: safePublicUrl(source.url) })).filter(source => source.url);
  if (candidate.source) {
    const source = {};
    const url = safePublicUrl(candidate.source.url);
    if (url) source.url = url;
    if (/^[\w.-]+\/[\w.-]+$/.test(candidate.source.repo || '')) source.repo = candidate.source.repo;
    if (/^[\w.-]+$/.test(candidate.source.revision || '')) source.revision = candidate.source.revision;
    if (Object.keys(source).length) result.source = source;
  }
  return result;
}

function safeManifest(manifest) {
  return {
    ...pick(manifest, ['benchmark', 'started_at', 'tasks_sha256', 'heldout_sha256', 'options', 'node']),
    ollama: manifest.ollama ? pick(manifest.ollama, ['version']) : null,
    machine: {
      ...pick(manifest.machine || {}, ['id', 'cpu', 'ram_bytes']),
      gpu: { stdout: safeGpuOutput(manifest.machine?.gpu?.stdout) }
    },
    candidates: (manifest.candidates || []).map(safeCandidate)
  };
}

const summaryFields = [
  'alias', 'slug', 'source_slug', 'name', 'quant', 'options', 'mode', 'think', 'planned', 'trials', 'slots', 'received',
  'functional', 'combined', 'pass', 'code_gate', 'compiled', 'rawFormat', 'raw_format', 'truncated', 'runtimeErrors',
  'errors', 'peakMiB', 'peak_vram_mib', 'warm_median_s', 'warmSec', 'warm_median_tps', 'warmTps', 'allGpuOnly'
];
const rowFields = ['task', 'seed', 'combined', 'pass', 'code_gate', 'functional', 'truncated', 'error', 'seconds', 'wall_s', 'tps', 'peakMiB', 'peak_vram_mib', 'peak', 'gpuOnly'];

function safeSummary(summary) {
  const result = pick(summary, summaryFields);
  if (Array.isArray(summary.rows)) result.rows = summary.rows.map(row => pick(row, rowFields));
  if (Array.isArray(summary.details)) result.details = summary.details.map(row => pick(row, rowFields));
  for (const rows of [result.rows, result.details]) {
    for (const row of rows || []) if (row.error !== undefined) row.error = Boolean(row.error);
  }
  return result;
}

function safeVerification(verification, sourceArtifactSha256) {
  const result = pick(verification, [
    'allRequestsMatchProfiles', 'requestAndSourceChecks', 'requests_and_source_hashes', 'six_requests_integrity',
    'requestsVerified', 'slots', 'plannedSlots', 'accountedSlots'
  ]);
  if (verification.checks?.six_requests_integrity === true) result.checks = { six_requests_integrity: true };
  if (typeof verification.selftests?.pilot === 'string') result.selftests = { pilot: verification.selftests.pilot };
  if (!Object.keys(result).length) result.status = 'unattested';
  result.sourceArtifactSha256 = sourceArtifactSha256;
  return result;
}

function safeDiagnostic(diagnostic) {
  return { rows: (diagnostic.rows || []).map(row => pick(row, ['slug', 'status'])) };
}

export function exportBenchmarkCatalogSources({ repoRoot = process.cwd(), sourceRuns = SOURCE_RUNS } = {}) {
  const exports = [];
  for (const relativePath of sourceRuns) {
    const rawDir = path.join(repoRoot, 'eval', 'reports', 'runs', relativePath);
    const outputDir = path.join(repoRoot, 'eval', 'catalog_sources', relativePath);
    const manifestBytes = fs.readFileSync(path.join(rawDir, 'manifest.json'));
    const summaryBytes = fs.readFileSync(path.join(rawDir, 'summary.json'));
    const verificationBytes = fs.readFileSync(path.join(rawDir, 'verification.json'));
    const manifest = safeManifest(JSON.parse(manifestBytes.toString('utf8')));
    const summaries = JSON.parse(summaryBytes.toString('utf8'));
    const safeSummaries = (Array.isArray(summaries) ? summaries : [summaries]).map(safeSummary);
    const verification = JSON.parse(verificationBytes.toString('utf8'));
    const sourceArtifactSha256 = {
      'manifest.json': sha256(manifestBytes),
      'summary.json': sha256(summaryBytes),
      'verification.json': sha256(verificationBytes)
    };
    const diagnosticPath = path.join(rawDir, 'diagnostic.json');
    let diagnostic;
    if (fs.existsSync(diagnosticPath)) {
      const diagnosticBytes = fs.readFileSync(diagnosticPath);
      diagnostic = safeDiagnostic(JSON.parse(diagnosticBytes.toString('utf8')));
      sourceArtifactSha256['diagnostic.json'] = sha256(diagnosticBytes);
    }
    exports.push({
      outputDir,
      manifest,
      summary: safeSummaries,
      verification: safeVerification(verification, sourceArtifactSha256),
      diagnostic
    });
  }

  for (const item of exports) {
    fs.mkdirSync(item.outputDir, { recursive: true });
    fs.writeFileSync(path.join(item.outputDir, 'manifest.json'), `${JSON.stringify(item.manifest, null, 2)}\n`);
    fs.writeFileSync(path.join(item.outputDir, 'summary.json'), `${JSON.stringify(item.summary, null, 2)}\n`);
    fs.writeFileSync(path.join(item.outputDir, 'verification.json'), `${JSON.stringify(item.verification, null, 2)}\n`);
    const diagnosticOutput = path.join(item.outputDir, 'diagnostic.json');
    if (item.diagnostic) fs.writeFileSync(diagnosticOutput, `${JSON.stringify(item.diagnostic, null, 2)}\n`);
    else fs.rmSync(diagnosticOutput, { force: true });
  }
  return exports.length;
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const count = exportBenchmarkCatalogSources({ repoRoot: process.cwd() });
  console.log(`Exported sanitized catalog metadata for ${count} benchmark source runs.`);
}
