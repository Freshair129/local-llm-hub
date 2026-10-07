// trace:implements BENCH-5060TI-GENERAL-006
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const profilePath = path.join(root, 'eval/config/qwen3-4b-general006.json');
const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const save = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
};
const run = (file, args, timeout = 30000) => {
  const result = spawnSync(file, args, { cwd: root, encoding: 'utf8', windowsHide: true, timeout, maxBuffer: 8 * 1024 * 1024 });
  return { command: [file, ...args], status: result.status, stdout: result.stdout || '', stderr: result.stderr || '', error: result.error?.message };
};
async function api(endpoint, body) {
  const response = await fetch('http://127.0.0.1:11434/api/' + endpoint, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) throw new Error(endpoint + ': HTTP ' + response.status + ': ' + await response.text());
  return response.json();
}
function requireOk(result, label) {
  if (result.status !== 0) throw new Error(label + ' failed: ' + (result.stderr || result.stdout || result.error));
}
function normalizeDigest(value) {
  const digest = String(value || '').replace(/^sha256:/i, '');
  if (!/^[a-f0-9]{64}$/i.test(digest)) throw new Error('Invalid SHA-256 digest representation: ' + value);
  return digest.toLowerCase();
}
function assertCleanWorktree() {
  const status = run('git', ['status', '--porcelain=v1', '--untracked-files=all']);
  requireOk(status, 'git status');
  if (status.stdout.trim()) throw new Error('Worktree is not clean:\n' + status.stdout);
  const head = run('git', ['rev-parse', 'HEAD']);
  requireOk(head, 'git rev-parse');
  const ancestor = run('git', ['merge-base', '--is-ancestor', profile.base_commit, 'HEAD']);
  requireOk(ancestor, 'benchmark base commit check');
  return head.stdout.trim();
}
function readGpu() {
  const result = run('nvidia-smi', ['--query-gpu=name,memory.total,memory.used,memory.free', '--format=csv,noheader,nounits']);
  requireOk(result, 'nvidia-smi');
  const [name, total, used, free] = result.stdout.trim().split(',').map(value => value.trim());
  const gpu = { name, total_mib: Number(total), used_mib: Number(used), free_mib: Number(free) };
  if (gpu.name !== profile.machine.gpu_name) throw new Error('Unexpected GPU: ' + gpu.name);
  if (!Number.isFinite(gpu.free_mib) || gpu.free_mib < profile.machine.minimum_free_vram_mib) {
    throw new Error('Free VRAM ' + gpu.free_mib + ' MiB is below ' + profile.machine.minimum_free_vram_mib + ' MiB.');
  }
  return gpu;
}
async function assertEmptyResidency() {
  const result = await api('ps');
  if (result.models?.length) throw new Error('Models are resident in Ollama; refusing to evict: ' + result.models.map(model => model.name).join(', '));
  return result;
}
function parseParameters(text) {
  return new Map(String(text || '').split(/\r?\n/).map(line => {
    const match = line.trim().match(/^([a-z][a-z0-9_]*)\s+(.+)$/i);
    return match ? [match[1], match[2].trim()] : null;
  }).filter(Boolean));
}
function verifyParameters(text) {
  const actual = parseParameters(text);
  for (const [name, expected] of Object.entries(profile.options)) {
    const value = actual.get(name);
    if (value === undefined || Number(value) !== expected) throw new Error('Alias parameter mismatch for ' + name + ': expected ' + expected + ', got ' + value);
  }
}

async function prepare() {
  const outputArg = process.argv.slice(2).find(value => !value.startsWith('--'));
  const outputDir = path.resolve(root, outputArg || profile.run_directory);
  const relativeOutput = path.relative(root, outputDir);
  if (relativeOutput.startsWith('..') || path.isAbsolute(relativeOutput) || !relativeOutput.startsWith('target' + path.sep)) {
    throw new Error('Run artifacts must stay under the ignored target directory.');
  }
  if (fs.existsSync(outputDir) && fs.readdirSync(outputDir).length) throw new Error('Run directory exists and is not empty; refusing to overwrite it.');

  const gitHead = assertCleanWorktree();
  const tasksFile = path.join(root, 'eval/project/local-llm-hub/pilot-5060ti-tasks.json');
  const heldoutFile = path.join(root, 'eval/project/local-llm-hub/pilot-5060ti-heldout.mjs');
  const tasksHash = sha(fs.readFileSync(tasksFile));
  const heldoutHash = sha(fs.readFileSync(heldoutFile));
  if (tasksHash !== profile.tasks_sha256) throw new Error('Task fixture hash changed: ' + tasksHash);
  if (heldoutHash !== profile.heldout_sha256) throw new Error('Heldout fixture hash changed: ' + heldoutHash);

  const gpu = readGpu();
  await assertEmptyResidency();
  const tags = await api('tags');
  const sourceTag = tags.models.find(model => model.name === profile.source.ollama_tag);
  if (!sourceTag || normalizeDigest(sourceTag.digest) !== normalizeDigest(profile.source.ollama_digest)) throw new Error('Source tag digest does not match the frozen profile.');
  if (tags.models.some(model => model.name === profile.candidate.alias)) throw new Error('Alias already exists; refusing overwrite: ' + profile.candidate.alias);
  const sourceShow = await api('show', { model: profile.source.ollama_tag });
  if (sourceShow.details?.format !== profile.source.format || sourceShow.details?.quantization_level !== profile.source.quantization || sourceShow.details?.parameter_size !== profile.source.parameter_size) {
    throw new Error('Source model details differ from the frozen profile.');
  }
  if (!sourceShow.capabilities?.includes('thinking')) throw new Error('Source model does not advertise thinking capability.');

  const candidate = { ...profile.candidate, options: profile.options };
  const modelfile = [
    'FROM ' + profile.source.ollama_tag,
    ...Object.entries(profile.options).map(([name, value]) => 'PARAMETER ' + name + ' ' + value),
    ''
  ].join('\n');
  fs.mkdirSync(outputDir, { recursive: true });
  const modelfilePath = path.join(outputDir, profile.candidate.slug + '.Modelfile');
  fs.writeFileSync(modelfilePath, modelfile, { flag: 'wx' });

  let created = false;
  try {
    const registration = run('ollama', ['create', profile.candidate.alias, '-f', modelfilePath], 300000);
    requireOk(registration, 'ollama create');
    created = true;

    const tagsAfter = await api('tags');
    const sourceAfter = tagsAfter.models.find(model => model.name === profile.source.ollama_tag);
    const aliasTag = tagsAfter.models.find(model => model.name === profile.candidate.alias);
    if (!sourceAfter || normalizeDigest(sourceAfter.digest) !== normalizeDigest(profile.source.ollama_digest)) throw new Error('Source model digest changed during alias creation.');
    if (!aliasTag) throw new Error('Ollama did not register the new alias.');
    const aliasShow = await api('show', { model: profile.candidate.alias });
    if (!aliasShow.capabilities?.includes('thinking')) throw new Error('Registered alias does not advertise thinking capability.');
    if (sha(aliasShow.template || '') !== sha(sourceShow.template || '')) throw new Error('Alias template differs from the installed source template.');
    if (aliasShow.details?.quantization_level !== profile.source.quantization) throw new Error('Alias quantization differs from the installed source.');
    verifyParameters(aliasShow.parameters);
    await assertEmptyResidency();

    const manifest = {
      benchmark: profile.id,
      profile_version: profile.version,
      started_at: new Date().toISOString(),
      git: { head: gitHead, clean_at_preparation: true, benchmark_base_commit: profile.base_commit },
      node: process.version,
      rustc: run('rustc', ['--version']),
      ollama: await api('version'),
      machine: { id: 'MACH-RTX5060TI-I714700KF', cpu: os.cpus()[0].model, ram_bytes: os.totalmem(), os: os.type() + ' ' + os.release(), gpu, minimum_free_vram_mib: profile.machine.minimum_free_vram_mib },
      source: { ...profile.source, digest_verified_before_and_after_registration: true, template_sha256: sha(sourceShow.template || ''), capabilities: sourceShow.capabilities, details: sourceShow.details },
      options: profile.options,
      seeds: profile.seeds,
      tasks_sha256: tasksHash,
      heldout_sha256: heldoutHash,
      profile_sha256: sha(fs.readFileSync(profilePath)),
      harness_sha256: sha(fs.readFileSync(path.join(root, 'scripts/benchmark_5060ti_pilot.mjs'))),
      preparation_sha256: sha(fs.readFileSync(fileURLToPath(import.meta.url))),
      candidates: [{
        ...candidate,
        ready: true,
        digest: aliasTag.digest,
        modelfile: path.relative(root, modelfilePath).replaceAll('\\', '/'),
        modelfile_sha256: sha(modelfile),
        show: { parameters: aliasShow.parameters, template_sha256: sha(aliasShow.template || ''), capabilities: aliasShow.capabilities, details: aliasShow.details }
      }]
    };
    save(path.join(outputDir, 'manifest.json'), manifest);
    console.log('READY ' + profile.candidate.alias + ' with HF sampling settings; no model is resident.');
    console.log('Run directory: ' + path.relative(root, outputDir));
  } catch (error) {
    if (created) save(path.join(outputDir, 'preparation-block.json'), {
      benchmark: profile.id,
      at: new Date().toISOString(),
      alias: profile.candidate.alias,
      source_digest: profile.source.ollama_digest,
      error: error.message,
      note: 'Alias creation succeeded, but a verification failed. No benchmark generation was started; inspect the local alias before reusing it.'
    });
    throw error;
  }
}

try {
  await prepare();
} catch (error) {
  console.error('BLOCKED: ' + error.message);
  process.exitCode = 1;
}
