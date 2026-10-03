// trace:implements FEAT-GPU-MODEL-ADVISOR
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const SOURCE_RUNS = [
  'GENERAL-5060TI-2026-10-03',
  'HF-5060TI-2026-10-03',
  'HF-EXTRA-5060TI-2026-10-03',
  'PILOT-5060TI-2026-10-03',
  'TYPHOON-CHAT-5060TI-2026-10-03',
  'JACK-CODE-V4-5060TI-2026-10-03',
  'TUNING-5060TI-2026-10-04/budget',
  'TUNING-5060TI-2026-10-04/presence',
  'TUNING-5060TI-2026-10-04/calibration',
  'TUNING-5060TI-2026-10-04/confirmation'
];

export const SOURCE_ROOT = 'eval/catalog_sources';
const SUMMARY_FILES = ['summary.json'];
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const finite = value => Number.isFinite(value) && value >= 0 ? value : null;
const firstFinite = (...values) => values.find(value => Number.isFinite(value) && value >= 0) ?? null;
function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function median(values) {
  if (!values.length) return null;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}

function gpuFromManifest(manifest, gpuCatalog) {
  const hardware = manifest.machine?.gpu;
  const stdout = hardware?.stdout || '';
  const match = stdout.match(/^([^,]+),\s*[^,]+,\s*(\d+)\s*MiB/i);
  if (!match) throw new Error('GPU name and total device memory are missing from manifest');
  const name = match[1].trim();
  const memoryMiB = Number(match[2]);
  if (!Number.isSafeInteger(memoryMiB) || memoryMiB <= 0) throw new Error('Invalid GPU memory in manifest');
  const canonicalName = name.replace(/^NVIDIA\s+/i, '').replace(/^GeForce\s+/i, '').trim().toLowerCase();
  const gpu = gpuCatalog.variants.find(item => {
    const catalogName = item.name.replace(/^NVIDIA\s+/i, '').replace(/^GeForce\s+/i, '').trim().toLowerCase();
    return catalogName === canonicalName && Math.abs(Math.round(item.vramBytes / 1048576) - memoryMiB) <= 512;
  });
  if (gpu) return { id: gpu.id, name: gpu.name, variant: gpu.variant, vramBytes: gpu.vramBytes, nominalCapacity: true, observedMemoryMiB: memoryMiB };

  return {
    id: `reported-${canonicalName.replace(/[^a-z0-9]+/g, '-')}-${memoryMiB}mib`,
    name,
    variant: `Reported ${memoryMiB} MiB`,
    vramBytes: memoryMiB * 1048576,
    nominalCapacity: false,
    observedMemoryMiB: memoryMiB
  };
}

function normalizedRows(summary) {
  const rows = Array.isArray(summary.rows) ? summary.rows : Array.isArray(summary.details) ? summary.details : [];
  return rows.map(row => ({
    task: row.task || null,
    seed: row.seed ?? null,
    passed: row.combined ?? row.pass ?? row.code_gate ?? null,
    functional: row.functional ?? null,
    truncated: row.truncated ?? null,
    runtimeError: Boolean(row.error),
    seconds: firstFinite(row.seconds, row.wall_s, row.wall_s === 0 ? 0 : undefined),
    tokensPerSecond: firstFinite(row.tps),
    peakDeviceMiB: firstFinite(row.peakMiB, row.peak_vram_mib, row.peak),
    gpuOnly: typeof row.gpuOnly === 'boolean' ? row.gpuOnly : null
  }));
}

function stageFor(relativePath) {
  const parts = relativePath.split(/[\\/]/);
  if (parts[0] === 'TUNING-5060TI-2026-10-04') return parts[1];
  if (parts[0].startsWith('GENERAL-') || parts[0].startsWith('PILOT-')) return 'baseline';
  if (parts[0].startsWith('JACK-')) return 'profile-comparison';
  if (parts[0].startsWith('HF')) return 'profile-comparison';
  if (parts[0].startsWith('TYPHOON-')) return 'profile-comparison';
  return 'unknown';
}

function runProfile({ relativePath, repoRoot, gpuCatalog }) {
  const runDir = path.join(repoRoot, ...SOURCE_ROOT.split('/'), ...relativePath.split(/[\\/]/));
  const manifestPath = path.join(runDir, 'manifest.json');
  const verificationPath = path.join(runDir, 'verification.json');
  const verification = readJson(verificationPath);
  const attested = verification.allRequestsMatchProfiles === true || verification.requestAndSourceChecks === true || verification.requests_and_source_hashes > 0 || verification.six_requests_integrity === true || verification.six_requests_integrity === undefined && verification.checks?.six_requests_integrity === true || verification.requestsVerified > 0 || verification.selftests?.pilot === 'PASS including real correct/wrong fixture compilation and CLI/trace regression tests' || verification.slots > 0 || (verification.plannedSlots > 0 && verification.accountedSlots === verification.plannedSlots);
  if (!attested) throw new Error('Verification report has no recognized completed-run attestation');
  const manifest = readJson(manifestPath);
  const summaryPath = path.join(runDir, SUMMARY_FILES[0]);
  const summaryFile = fs.readFileSync(summaryPath);
  const summaryData = JSON.parse(summaryFile.toString('utf8'));
  const summaries = Array.isArray(summaryData) ? summaryData : [summaryData];
  const gpu = gpuFromManifest(manifest, gpuCatalog);
  const runs = [];

  for (const summary of summaries) {
    const candidate = manifest.candidates?.find(item => item.alias === summary.alias || item.slug === summary.slug || item.slug === summary.source_slug);
    if (!candidate) throw new Error(`No manifest candidate matches profile ${summary.alias || summary.slug}`);
    const rows = normalizedRows(summary);
    const planned = firstFinite(summary.planned, summary.trials, summary.slots, rows.length);
    const weightFiles = (Array.isArray(candidate.files) ? candidate.files : Array.isArray(candidate.weights) ? candidate.weights : [])
      .filter(file => !/mmproj|projector/i.test(`${file.role || ''} ${file.file || file.name || ''}`))
      .map(file => ({ sha256: file.sha256 || null, bytes: firstFinite(file.bytes), fileName: path.basename(file.file || file.name || '') }))
      .filter(file => file.sha256 || file.bytes !== null);
    const weightIdentity = weightFiles.map(file => file.sha256).filter(Boolean).sort();
    const runId = `${manifest.benchmark}:${relativePath.replace(/[\\/]/g, ':')}:${summary.alias || summary.slug}`;
    const options = summary.options || candidate.options || manifest.options || null;
    const seeds = rows.map(row => row.seed).filter(seed => seed !== null).sort((a, b) => a - b);
    const testedTimes = rows.map(row => row.seconds).filter(Number.isFinite).sort((a, b) => a - b);
    const testedSpeeds = rows.map(row => row.tokensPerSecond).filter(Number.isFinite).sort((a, b) => a - b);
    const peakDeviceMiB = firstFinite(summary.peakMiB, summary.peak_vram_mib, ...rows.map(row => row.peakDeviceMiB));
    const diagnosticPath = path.join(runDir, 'diagnostic.json');
    const diagnostic = fs.existsSync(diagnosticPath) ? readJson(diagnosticPath) : null;
    const profileDiagnostic = diagnostic?.rows?.filter(row => row.slug === (summary.slug || summary.source_slug)) || [];
    const modelLabel = candidate.label || summary.name || summary.slug || candidate.slug || summary.alias;
    const quantization = summary.quant || (modelLabel.match(/(?:^|[._:-])(Q[0-9]+_[A-Z0-9_]+|IQ[0-9]+_[A-Z0-9_]+|UD-Q[0-9]+_[A-Z0-9_]+)/i)?.[1] || null);
    const keyFields = {
      benchmark: manifest.benchmark,
      tasksSha256: manifest.tasks_sha256 || null,
      heldoutSha256: manifest.heldout_sha256 || null,
      weightIdentity,
      modelId: weightIdentity.length ? weightIdentity.join('+') : `${candidate.slug || summary.slug || summary.alias}`,
      options,
      mode: summary.mode || candidate.mode || null,
      thinking: summary.think ?? candidate.think ?? null,
      ollamaVersion: manifest.ollama?.version || null,
      nodeVersion: manifest.node || null,
      stage: stageFor(relativePath),
      seeds
    };
    const diagnosticBytes = fs.existsSync(diagnosticPath) ? fs.readFileSync(diagnosticPath) : Buffer.alloc(0);
    const hash = sha256(Buffer.concat([summaryFile, Buffer.from('\n'), fs.readFileSync(manifestPath), Buffer.from('\n'), fs.readFileSync(verificationPath), Buffer.from('\n'), diagnosticBytes]));
    const sourceUrls = [...new Set([...(candidate.sources || []).map(source => source.url), candidate.source?.url, candidate.source?.repo && candidate.source?.revision ? `https://huggingface.co/${candidate.source.repo}/tree/${candidate.source.revision}` : null].filter(url => typeof url === 'string' && /^https:\/\//.test(url)))];

    runs.push({
      id: runId,
      benchmark: manifest.benchmark,
      stage: keyFields.stage,
      date: manifest.started_at || null,
      gpu,
      model: {
        id: weightIdentity.length ? weightIdentity.join('+') : `${candidate.slug || summary.slug || summary.alias}`,
        label: modelLabel,
        quantization,
        alias: summary.alias || candidate.alias || null,
        weightFiles,
        sources: sourceUrls
      },
      conditions: {
        options,
        mode: summary.mode || candidate.mode || null,
        thinking: summary.think ?? candidate.think ?? null,
        seeds,
        taskSetSha256: manifest.tasks_sha256 || null,
        heldoutSha256: manifest.heldout_sha256 || null,
        runtime: { ollama: manifest.ollama?.version || null, node: manifest.node || null },
        driver: (manifest.machine?.gpu?.stdout || '').match(/^[^,]+,\s*([^,]+)/)?.[1]?.trim() || null,
        cpu: manifest.machine?.cpu || null,
        systemRamBytes: finite(manifest.machine?.ram_bytes),
        machineId: manifest.machine?.id || null
      },
      metrics: {
        planned: planned ?? rows.length,
        received: firstFinite(summary.received, rows.length),
        functionalPasses: firstFinite(summary.functional),
        combinedPasses: firstFinite(summary.combined, summary.pass, summary.code_gate),
        codeGatePasses: firstFinite(summary.compiled, summary.code_gate),
        rawFormatPasses: firstFinite(summary.rawFormat, summary.raw_format),
        budgetStops: firstFinite(summary.truncated, rows.filter(row => row.truncated === true).length),
        runtimeErrors: firstFinite(summary.runtimeErrors, rows.filter(row => row.runtimeError).length),
        medianSeconds: testedTimes.length ? median(testedTimes) : firstFinite(summary.warm_median_s, summary.warmSec),
        medianTokensPerSecond: testedSpeeds.length ? median(testedSpeeds) : firstFinite(summary.warm_median_tps, summary.warmTps),
        speedSampleCount: testedSpeeds.length,
        peakDeviceMiB,
        gpuOnly: typeof summary.allGpuOnly === 'boolean' ? summary.allGpuOnly : rows.length && rows.every(row => row.gpuOnly === true) ? true : rows.some(row => row.gpuOnly === false) ? false : null,
        residencyEvidence: rows.length ? rows.some(row => Number.isFinite(row.peakDeviceMiB)) : Number.isFinite(peakDeviceMiB) ? 'profile-summary' : null,
        edgeDiagnostic: profileDiagnostic.length ? {
          passed: profileDiagnostic.filter(row => row.status === 'PASS').length,
          failed: profileDiagnostic.filter(row => row.status === 'FAIL').length,
          notExecutable: profileDiagnostic.filter(row => !['PASS', 'FAIL'].includes(row.status)).length
        } : null
      },
      cohortKey: sha256(Buffer.from(stableJson(keyFields))),
      evidence: { path: path.posix.join(SOURCE_ROOT, ...relativePath.split(/[\\/]/), 'summary.json'), sha256: hash, verification: true, slots: rows }
    });
  }

  return { runs, gpu };
}

export function buildBenchmarkCatalog({ repoRoot = process.cwd(), sourceRuns = SOURCE_RUNS, gpuCatalogPath = 'src/data/gpu_catalog.json' } = {}) {
  const gpuCatalog = readJson(path.resolve(repoRoot, gpuCatalogPath));
  const decisionsPath = path.resolve(repoRoot, 'eval/config/tuning-5060ti-results.json');
  const decisionProfiles = fs.existsSync(decisionsPath) ? readJson(decisionsPath).profiles || [] : [];
  const decisions = decisionProfiles.flatMap(profile => [
    { alias: profile.alias, status: profile.confirmed_bounded_gain ? 'confirmed_bounded_gain' : 'do_not_promote' },
    { alias: profile.baseline_alias, status: 'baseline_control' }
  ]).filter(item => item.alias);
  const runs = [];
  const excludedSources = [];
  const observedGpus = new Map();

  for (const relativePath of sourceRuns) {
    const runDir = path.join(repoRoot, ...SOURCE_ROOT.split('/'), ...relativePath.split(/[\\/]/));
    try {
      for (const file of ['manifest.json', 'summary.json', 'verification.json']) {
        if (!fs.existsSync(path.join(runDir, file))) throw new Error(`Missing ${file}`);
      }
      const verified = runProfile({ relativePath, repoRoot, gpuCatalog });
      for (const run of verified.runs) runs.push(run);
      observedGpus.set(verified.gpu.id, verified.gpu);
    } catch (error) {
      excludedSources.push({ path: relativePath.replace(/\\/g, '/'), reason: String(error.message || error) });
    }
  }

  for (const run of runs) {
    const gpu = gpuCatalog.variants.find(item => item.id === run.gpu.id);
    if (gpu) gpu.tested = true;
  }

  return {
    schemaVersion: 1,
    generatedAt: 'deterministic',
    decisions,
    gpus: gpuCatalog.variants.map(gpu => ({ ...gpu, tested: runs.some(run => run.gpu.id === gpu.id) })),
    observedGpus: [...observedGpus.values()],
    runs,
    excludedSources
  };
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const catalog = buildBenchmarkCatalog({ repoRoot: process.cwd() });
  const outputPath = path.join(process.cwd(), 'src', 'data', 'benchmark_catalog.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(catalog, null, 2) + '\n');
  console.log(`Built ${catalog.runs.length} benchmark profiles across ${catalog.observedGpus.length} observed GPU variants; excluded ${catalog.excludedSources.length} source run(s).`);
}
