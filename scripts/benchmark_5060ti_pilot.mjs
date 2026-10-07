// trace:implements BENCH-5060TI-PILOT-001
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { heldout } from '../eval/project/local-llm-hub/pilot-5060ti-heldout.mjs';

const exec = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const api = 'http://127.0.0.1:11434/api';
const tasksPath = path.join(root, 'eval/project/local-llm-hub/pilot-5060ti-tasks.json');
const tasks = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));
const options = { num_ctx: 8192, num_predict: 4096, temperature: 0.6, top_p: 0.95, top_k: 20, min_p: 0, repeat_penalty: 1 };
const candidates = [
  ['mellum2-12b-a2.5b-instruct-q4_k_m', 'llh-bench-mellum-instruct:q4', false],
  ['omnicoder-9b-q4_k_m', 'llh-bench-omnicoder:q4', true],
  ['coding-monkey-gemma-q4_k_m', 'llh-bench-coding-monkey:q4', false],
  ['mellum2-12b-a2.5b-thinking-q4_k_m', 'llh-bench-mellum-thinking:q4', true],
  ['mellum2-12b-a2.5b-thinking-q6_k', 'llh-bench-mellum-thinking:q6', true]
];
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const save = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n'); };
const command = (file, args, cwd = root, timeout = 30000) => {
  const r = spawnSync(file, args, { cwd, timeout, encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  return { command: [file, ...args], status: r.status, signal: r.signal, error: r.error?.message, stdout: r.stdout || '', stderr: r.stderr || '' };
};
async function request(endpoint, body) {
  const r = await fetch(`${api}/${endpoint}`, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`${endpoint}: HTTP ${r.status}: ${await r.text()}`);
  return r.json();
}
async function hashFile(file) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
async function assertResidency(alias) {
  const ps = await request('ps');
  const unrelated = ps.models.filter(m => m.name !== alias && m.model !== alias);
  if (unrelated.length) throw new Error(`Unrelated models loaded; refusing eviction: ${unrelated.map(m => m.name).join(', ')}`);
  return ps;
}
async function unload(alias) {
  const ps = await assertResidency(alias);
  if (!ps.models.some(model => model.name === alias || model.model === alias)) return ps;
  await request('generate', { model: alias, keep_alive: 0 });
  for (let i = 0; i < 20; i++) {
    if (!(await request('ps')).models.length) return;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`Unload not confirmed: ${alias}`);
}

async function prepare(dir) {
  if (fs.existsSync(path.join(dir, 'manifest.json'))) throw new Error('Manifest already exists; use a new output directory.');
  await assertResidency(null);
  const existing = (await request('tags')).models;
  const manifest = {
    benchmark: 'BENCH-5060TI-PILOT-001', started_at: new Date().toISOString(),
    git: command('git', ['rev-parse', 'HEAD']).stdout.trim(), node: process.version,
    rustc: command('rustc', ['--version']), ollama: await request('version'),
    machine: { id: 'MACH-RTX5060TI-I714700KF', cpu: os.cpus()[0].model, ram_bytes: os.totalmem(), os: `${os.type()} ${os.release()}`, gpu: command('nvidia-smi', ['--query-gpu=name,driver_version,memory.total,memory.used', '--format=csv,noheader']) },
    options, seeds: [42, 43, 44], tasks_sha256: sha(fs.readFileSync(tasksPath)),
    heldout_sha256: sha(fs.readFileSync(path.join(root, 'eval/project/local-llm-hub/pilot-5060ti-heldout.mjs'))),
    harness_sha256: sha(fs.readFileSync(fileURLToPath(import.meta.url))), candidates: []
  };
  for (const [slug, alias, thinking] of candidates) {
    console.log(`Preparing ${alias}`);
    const candidate = { slug, alias, requested_thinking: thinking };
    manifest.candidates.push(candidate);
    try {
      if (existing.some(m => m.name === alias)) throw new Error('Alias already exists; refusing overwrite.');
      const folder = path.join('F:/Models', slug);
      const metadata = JSON.parse(fs.readFileSync(path.join(folder, 'model.json'), 'utf8'));
      const weight = metadata.files.find(f => f.role === 'model');
      const file = path.join(folder, weight.file);
      candidate.weights = { path: file, bytes: fs.statSync(file).size, sha256: await hashFile(file), expected_sha256: weight.sha256 };
      if (candidate.weights.sha256 !== weight.sha256 || candidate.weights.bytes !== weight.bytes) throw new Error('Weight integrity mismatch.');
      const original = fs.readFileSync(path.join(folder, 'Modelfile'), 'utf8');
      candidate.modelfile_sha256 = sha(original);
      candidate.template_body_sha256 = sha(original.replace(/^FROM[^\r\n]+\r?\n/, ''));
      const modelfile = path.join(root, 'target/benchmark-5060ti/import', `${slug}.Modelfile`);
      fs.mkdirSync(path.dirname(modelfile), { recursive: true });
      fs.writeFileSync(modelfile, original.replace(/^FROM[^\r\n]+/, `FROM "${file.replaceAll('\\', '/')}"`));
      candidate.import = command('ollama', ['create', alias, '-f', modelfile], root, 300000);
      if (candidate.import.status !== 0) throw new Error(`Import failed: ${candidate.import.stderr.slice(-1500)}`);
      candidate.show = await request('show', { model: alias });
      candidate.digest = (await request('tags')).models.find(m => m.name === alias)?.digest;
      candidate.think = thinking && candidate.show.capabilities?.includes('thinking') ? true : undefined;
      candidate.mode = candidate.think ? 'think=true' : 'native-template';
      candidate.ready = true;
      console.log(`Ready ${alias}, ${candidate.mode}`);
    } catch (e) { candidate.error = e.message; console.log(`BLOCKED ${alias}: ${e.message}`); }
    save(path.join(dir, 'manifest.json'), manifest);
  }
}

async function prepareHf(dir) {
  if (fs.existsSync(path.join(dir, 'manifest.json'))) throw new Error('Manifest already exists; refusing overwrite.');
  const configPath = path.join(root, 'eval/config/hf-5060ti-profiles.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const sourceDir = path.join(root, config.source_directory);
  for (const snapshot of config.snapshots) {
    if (sha(fs.readFileSync(path.join(sourceDir, snapshot.file))) !== snapshot.sha256) throw new Error(`Source snapshot changed: ${snapshot.file}`);
  }
  const previousPath = path.join(root, 'eval/reports/runs/PILOT-5060TI-2026-10-03/manifest.json');
  const previous = JSON.parse(fs.readFileSync(previousPath, 'utf8'));
  const manifest = {
    ...previous, benchmark: config.benchmark, started_at: new Date().toISOString(),
    previous_manifest: previousPath, profile_sha256: sha(fs.readFileSync(configPath)),
    harness_sha256: sha(fs.readFileSync(fileURLToPath(import.meta.url))),
    node: process.version, rustc: command('rustc', ['--version']), ollama: await request('version'),
    machine: { ...previous.machine, ram_bytes: os.totalmem(), gpu: command('nvidia-smi', ['--query-gpu=name,driver_version,memory.total,memory.used', '--format=csv,noheader']) },
    options: null, seeds: config.seeds, candidates: []
  };
  await assertResidency(null);
  const existing = (await request('tags')).models;
  for (const profile of config.profiles) {
    console.log(`Preparing HF profile ${profile.alias}`);
    const old = previous.candidates.find(c => c.slug === profile.slug);
    const c = { ...profile, weights: old.weights, ready: false };
    manifest.candidates.push(c);
    try {
      if (existing.some(m => m.name === c.alias)) throw new Error('Alias already exists; refusing overwrite.');
      const hf = JSON.parse(fs.readFileSync(path.join(sourceDir, profile.weights_metadata), 'utf8'));
      const match = hf.files.find(f => f.lfs?.sha256 === old.weights.sha256);
      if (!match || match.size !== fs.statSync(c.weights.path).size || await hashFile(c.weights.path) !== match.lfs.sha256) throw new Error('Local weights do not match pinned HF LFS metadata.');
      c.hf_weights = match;
      const modelfile = path.join(root, 'target/benchmark-5060ti/import', `${profile.slug}.HF.Modelfile`);
      const text = `FROM "${c.weights.path.replaceAll('\\', '/')}"\n`;
      fs.mkdirSync(path.dirname(modelfile), { recursive: true }); fs.writeFileSync(modelfile, text);
      c.modelfile_sha256 = sha(text);
      c.import = command('ollama', ['create', c.alias, '-f', modelfile], root, 300000);
      if (c.import.status !== 0) throw new Error(`Import failed: ${c.import.stderr.slice(-1500)}`);
      c.show = await request('show', { model: c.alias });
      c.template_sha256 = sha(c.show.template || '');
      c.previous_template_sha256 = sha(old.show.template || '');
      c.digest = (await request('tags')).models.find(m => m.name === c.alias)?.digest;
      if (c.think === true && !c.show.capabilities?.includes('thinking')) throw new Error('HF thinking mode is not supported by the imported runtime template.');
      if (c.think === null || !c.show.capabilities?.includes('thinking')) delete c.think;
      c.mode = c.think === undefined ? 'native-template' : `think=${c.think}`;
      c.ready = true;
      console.log(`Ready ${c.alias}, ${c.mode}, ctx=${c.options.num_ctx}, budget=${c.options.num_predict}`);
    } catch (e) { c.error = e.message; console.log(`BLOCKED ${c.alias}: ${e.message}`); }
    save(path.join(dir, 'manifest.json'), manifest);
  }
}

export function extractCode(answer) {
  const cleaned = answer.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const blocks = [...cleaned.matchAll(/```rust\s*\n([\s\S]*?)```/gi)];
  if (blocks.length) return blocks.map(m => m[1].trim()).join('\n\n');
  return cleaned;
}
export function inspectRawFormat(answer) {
  const text = String(answer || '').trim();
  const fenceCount = (text.match(/\x60\x60\x60/g) || []).length;
  const match = text.match(/^\x60\x60\x60rust[ \t]*\r?\n([\s\S]*?)\r?\n?\x60\x60\x60$/i);
  return { pass: fenceCount === 2 && !!match && !!match[1].trim(), fence_count: fenceCount, code: match?.[1].trim() || '' };
}
export function inspectCode(code, taskId) {
  const functionName = { 'FR-002': 'normalize_model_name', 'FR-006': 'parse_gpu_csv' }[taskId];
  return {
    nonempty: !!code.trim(),
    guard_pass: !!code.trim() && !/\.\s*(unwrap|expect)\s*\(|\bpanic\s*!\s*[(\[{]/.test(code),
    trace_pass: !!functionName && new RegExp(`^\\s*//[ \\t]*trace:implements[ \\t]+${taskId}[ \\t]*\\r?\\n[ \\t]*pub[ \\t]+fn[ \\t]+${functionName}\\s*\\(`, 'm').test(code),
    execution_review_flags: code.match(/\b(?:unsafe|extern|include|include_str|include_bytes|asm|global_asm)\b|std\s*::\s*(?:fs|net|process|env|thread)|#\s*\[\s*(?:link|path)/g) || []
  };
}
export function compileTests(code, task, cwd) {
  fs.mkdirSync(cwd, { recursive: true });
  const source = path.join(cwd, 'answer.rs');
  fs.writeFileSync(source, `${code}\n${task.testHarness}\n${heldout[task.id]}`);
  const executable = path.join(cwd, 'answer.exe');
  const compile = command('rustc', ['--edition=2021', '--test', source, '-o', executable], cwd, 30000);
  const visible = compile.status === 0 ? command(executable, ['--skip', 'heldout_', '--test-threads=1'], cwd, 10000) : null;
  const hidden = compile.status === 0 ? command(executable, ['heldout_', '--test-threads=1'], cwd, 10000) : null;
  return { compile, visible, hidden, compiled: compile.status === 0, visible_pass: visible?.status === 0, hidden_pass: hidden?.status === 0 };
}

export function buildRequest(candidate, task, seed) {
  const body = { model: candidate.alias, messages: [{ role: 'user', content: task.prompt }], stream: true, keep_alive: '10m', options: { ...(candidate.options ?? options), seed } };
  if (candidate.think !== undefined) body.think = candidate.think;
  return body;
}

async function trial(candidate, task, seed, cold, dir) {
  const id = `${candidate.slug}/${task.id}-${seed}`;
  const dest = path.join(dir, id);
  if (fs.existsSync(path.join(dest, 'response.json'))) { console.log(`Recorded already: ${id}`); return; }
  const requestBody = buildRequest(candidate, task, seed);
  const record = { id, model: candidate.alias, task: task.id, seed, cold, started_at: new Date().toISOString(), request: requestBody, samples: [], telemetry_errors: [] };
  save(path.join(dest, 'request.json'), requestBody);
  let sampling = false;
  let pendingSample = Promise.resolve();
  const start = performance.now();
  const sample = () => {
    if (sampling) return pendingSample;
    sampling = true;
    pendingSample = exec('nvidia-smi', ['--query-gpu=memory.used,utilization.gpu,temperature.gpu', '--format=csv,noheader,nounits'], { windowsHide: true, timeout: 5000 })
      .then(r => { const [vram_mib, utilization_pct, temp_c] = r.stdout.trim().split(',').map(Number); record.samples.push({ elapsed_ms: Math.round(performance.now() - start), vram_mib, utilization_pct, temp_c }); })
      .catch(e => record.telemetry_errors.push(e.message)).finally(() => { sampling = false; });
    return pendingSample;
  };
  await sample();
  const timer = setInterval(sample, 500);
  let content = '', thinking = '', buffer = '';
  try {
    await assertResidency(candidate.alias);
    const response = await fetch(`${api}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody), signal: AbortSignal.timeout(candidate.timeout_ms ?? 240000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    const decoder = new TextDecoder();
    const consume = line => {
      if (!line.trim()) return;
      const data = JSON.parse(line);
      if (data.error) throw new Error(data.error);
      if (data.message?.content || data.message?.thinking) record.first_output_ms ??= performance.now() - start;
      if (data.message?.content) { record.first_answer_ms ??= performance.now() - start; content += data.message.content; }
      thinking += data.message?.thinking || '';
      if (data.done) record.final = data;
    };
    for await (const chunk of response.body) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n'); buffer = lines.pop(); lines.forEach(consume);
    }
    buffer += decoder.decode(); if (buffer.trim()) consume(buffer);
    if (!record.final) throw new Error('Stream ended without final done event.');
  } catch (e) { record.error = e.message; }
  finally { clearInterval(timer); await pendingSample; }
  record.wall_ms = performance.now() - start;
  record.content = content; record.thinking = thinking;
  record.truncated = record.final?.done_reason === 'length';
  record.sampled_peak_vram_mib = record.samples.length ? Math.max(...record.samples.map(s => s.vram_mib)) : null;
  record.tps = record.final?.eval_duration ? record.final.eval_count / (record.final.eval_duration / 1e9) : null;
  try { record.residency = await request('ps'); } catch (e) { record.residency_error = e.message; }
  save(path.join(dest, 'response.json'), record);
  const code = extractCode(content);
  fs.writeFileSync(path.join(dest, 'answer.rs'), code);
  save(path.join(dest, 'inspection.json'), inspectCode(code, task.id));
  console.log(`${id}: ${record.error || (record.truncated ? 'TRUNCATED' : 'received')} ${Math.round(record.wall_ms / 1000)}s, ${record.tps?.toFixed(1)} t/s, answer ${content.length} chars`);
  if (record.error) throw new Error(`Stopping after runtime failure; evidence saved for ${id}: ${record.error}`);
}
async function generate(dir) {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  for (const candidate of manifest.candidates.filter(c => c.ready)) {
    await assertResidency(null);
    console.log(`START ${candidate.alias}`);
    try {
      for (const task of tasks) {
        await unload(candidate.alias);
        for (const seed of manifest.seeds) await trial(candidate, task, seed, seed === 42, dir);
      }
    } catch (e) {
      if (!['BENCH-5060TI-HF-002', 'BENCH-5060TI-HF-003', 'BENCH-5060TI-GENERAL-005', 'BENCH-5060TI-GENERAL-006'].includes(manifest.benchmark)) throw e;
      save(path.join(dir, candidate.slug, 'runtime-block.json'), { error: e.message, at: new Date().toISOString(), remaining_slots: 'NOT_RUN; no context or budget fallback applied' });
      console.log(`BLOCKED remaining requests for ${candidate.alias}: ${e.message}`);
    } finally { await unload(candidate.alias); }
  }
}
function validate(dir) {
  if (!process.argv.includes('--allow-code-exec')) throw new Error('Inspect generated sources, then pass --allow-code-exec.');
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  for (const c of manifest.candidates) for (const task of tasks) for (const seed of manifest.seeds) {
    const dest = path.join(dir, c.slug, `${task.id}-${seed}`);
    if (!fs.existsSync(path.join(dest, 'response.json'))) continue;
    const response = JSON.parse(fs.readFileSync(path.join(dest, 'response.json'), 'utf8'));
    const code = fs.readFileSync(path.join(dest, 'answer.rs'), 'utf8');
    const inspection = inspectCode(code, task.id);
    const rawFormat = inspectRawFormat(response.content);
    const result = { inspection, raw_format: rawFormat, source_sha256: sha(code), validator_sha256: sha(fs.readFileSync(fileURLToPath(import.meta.url))) };
    if (response.error || response.truncated || !inspection.nonempty || inspection.execution_review_flags.length) {
      result.skipped = 'infrastructure error, truncated/empty output, or execution review flag';
      result.pass = false;
    } else {
      Object.assign(result, compileTests(code, task, path.join(root, 'target/benchmark-5060ti/tests', path.basename(dir), c.slug, `${task.id}-${seed}`)));
      result.pass = result.compiled && result.visible_pass && result.hidden_pass && inspection.guard_pass && inspection.trace_pass;
    }
    result.functional_pass = !!(result.compiled && result.visible_pass && result.hidden_pass);
    result.code_gate_pass = !!(!response.error && !response.truncated && inspection.nonempty && rawFormat.pass && inspection.guard_pass && inspection.trace_pass && !inspection.execution_review_flags.length);
    result.combined_pass = !!(!response.error && !response.truncated && result.functional_pass && result.code_gate_pass);
    result.pass = result.combined_pass;
    save(path.join(dest, 'validation.json'), result);
    console.log(`${c.alias} ${task.id} seed ${seed}: ${result.pass ? 'PASS' : 'FAIL'} compile=${result.compiled} visible=${result.visible_pass} hidden=${result.hidden_pass} guard=${inspection.guard_pass} trace=${inspection.trace_pass}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, ...args] = process.argv.slice(2);
  const suppliedDir = args.find(arg => !arg.startsWith('--'));
  const dir = path.resolve(suppliedDir || path.join(root, `eval/reports/runs/${mode === 'prepare-hf' ? 'HF-5060TI-2026-10-03' : 'PILOT-5060TI-2026-10-03'}`));
  const action = { prepare, 'prepare-hf': prepareHf, generate, validate }[mode];
  if (!action) throw new Error('Usage: node scripts/benchmark_5060ti_pilot.mjs prepare|prepare-hf|generate|validate [report-directory] [--allow-code-exec]');
  await action(dir);
}
