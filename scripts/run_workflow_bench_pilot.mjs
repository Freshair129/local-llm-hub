// trace:implements WORKFLOW-BENCH
//! Executes the preregistered, one-task local Mellum workflow pilot.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runWorkflowBenchTask, sha256 } from '../eval/workflow-bench/runner.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.resolve(SCRIPT_DIR, '..');
const OLLAMA = 'http://127.0.0.1:11434';
const SECONDARY_OLLAMA = 'http://127.0.0.1:11435';
const MODEL_NAME = 'mellum:latest';
const configPath = path.join(REPO_DIR, 'eval/workflow-bench/configs/mellum21-six-role-pilot.json');
const taskPath = path.join(REPO_DIR, 'eval/workflow-bench/tasks/pilot-001.json');
const artifactsRoot = path.join(REPO_DIR, 'eval/workflow-bench/results');

function run(executable, args, cwd = REPO_DIR) {
  const result = spawnSync(executable, args, { cwd, encoding: 'utf8', windowsHide: true, maxBuffer: 2 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error(`${executable} ${args.join(' ')} failed: ${result.error?.message || result.stderr || result.status}`);
  return result.stdout.trim();
}

function safeCommand(spec) {
  return { ...spec, executable: spec.executable === '__NODE__' ? process.execPath : spec.executable };
}

function runBaselineVisible(task) {
  const result = spawnSync(process.execPath, task.visibleCommand.args, {
    cwd: REPO_DIR,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60_000,
    maxBuffer: 1024 * 1024
  });
  if (result.error) throw new Error(`baseline visible suite could not run: ${result.error.message}`);
  if (result.status === null) throw new Error('baseline visible suite did not finish');
  if (result.status === 0) throw new Error('pilot fixture is invalid: visible tests already pass before inference');
  return {
    state: 'FAIL_EXPECTED',
    exit_code: result.status,
    stdout_sha256: sha256(result.stdout || ''),
    stderr_sha256: sha256(result.stderr || '')
  };
}

async function requestJson(url, body, timeoutMs = 10_000) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs)
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}: ${payload.error || 'unknown error'}`);
  return payload;
}

async function readResidentModels(baseUrl) {
  const response = await fetch(`${baseUrl}/api/ps`, { signal: AbortSignal.timeout(3_000) });
  if (!response.ok) throw new Error(`${baseUrl}/api/ps returned HTTP ${response.status}`);
  const payload = await response.json();
  return payload.models || [];
}

async function releaseAllResidentModels(baseUrl) {
  let models;
  try {
    models = await readResidentModels(baseUrl);
  } catch (error) {
    if (baseUrl === SECONDARY_OLLAMA && (error.cause?.code === 'ECONNREFUSED' || error.message.includes('fetch failed'))) return { endpoint: baseUrl, available: false, unloaded: [] };
    throw error;
  }
  const unloaded = [];
  for (const item of models) {
    const model = item.name || item.model;
    if (!model) throw new Error(`resident model had no name on ${baseUrl}`);
    await requestJson(`${baseUrl}/api/generate`, { model, prompt: '', stream: false, keep_alive: 0 }, 30_000);
    unloaded.push(model);
  }
  const remaining = await readResidentModels(baseUrl);
  if (remaining.length) throw new Error(`models remain resident on ${baseUrl}: ${remaining.map(item => item.name || item.model).join(', ')}`);
  return { endpoint: baseUrl, available: true, unloaded };
}

async function collectGpuState() {
  try {
    return run('nvidia-smi', ['--query-gpu=name,utilization.gpu,memory.used,memory.total,power.draw', '--format=csv,noheader']);
  } catch (error) {
    return `unavailable: ${error.message}`;
  }
}

async function main() {
  const status = run('git', ['status', '--porcelain=v1']);
  if (status) throw new Error('working tree must be clean before running the reproducible pilot');
  const baseCommit = run('git', ['rev-parse', 'HEAD']);
  const ollamaVersion = run('ollama', ['--version']);
  const modelList = run('ollama', ['list']);
  const installedTags = modelList.split(/\r?\n/).slice(1).map(line => line.trim().split(/\s+/)[0]);
  if (!installedTags.includes(MODEL_NAME)) {
    throw new Error(`${MODEL_NAME} is not installed; refusing to substitute another tag`);
  }

  const tagResponse = await fetch(`${OLLAMA}/api/tags`, { signal: AbortSignal.timeout(5_000) });
  if (!tagResponse.ok) throw new Error(`Ollama tag inventory returned HTTP ${tagResponse.status}`);
  const tagInventory = await tagResponse.json();
  const modelInfo = (tagInventory.models || []).find(item => item.name === MODEL_NAME);
  if (!modelInfo) throw new Error(`${MODEL_NAME} is absent from the configured Ollama endpoint`);

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (config.modelDigest !== modelInfo.digest) throw new Error(`${MODEL_NAME} digest changed; review and update the frozen config before running`);
  const task = JSON.parse(fs.readFileSync(taskPath, 'utf8'));
  const privateHiddenRoot = path.join(os.homedir(), '.ollama', 'benchmarks', 'workflow-bench', 'pilot-001');
  if (!fs.existsSync(path.join(privateHiddenRoot, 'hidden.test.mjs'))) {
    throw new Error('private held-out suite is missing from the local benchmark store');
  }
  task.privateHiddenRoot = privateHiddenRoot;
  for (const key of ['compileCommand', 'visibleCommand', 'securityCommand', 'hiddenCommand']) task[key] = safeCommand(task[key]);
  const baselineVisible = runBaselineVisible(task);
  const apiRelease = await releaseAllResidentModels(OLLAMA);
  const secondaryRelease = await releaseAllResidentModels(SECONDARY_OLLAMA);
  const psBefore = await readResidentModels(OLLAMA);
  if (psBefore.length) throw new Error('Ollama still has resident models after preflight cleanup');

  const startedAt = new Date().toISOString();
  const runId = `pilot001-mellum21-6-v3-${startedAt.replace(/[^0-9TZ]/g, '').slice(0, 15)}`;
  const artifactDir = path.join(artifactsRoot, runId);
  fs.mkdirSync(artifactDir, { recursive: true });
  const environment = {
    schema_version: 1,
    run_id: runId,
    base_commit: baseCommit,
    task_file_sha256: sha256(fs.readFileSync(taskPath)),
    workflow_config_file_sha256: sha256(fs.readFileSync(configPath)),
    ollama_version: ollamaVersion,
    model: {
      name: modelInfo.name,
      digest: modelInfo.digest,
      size_bytes: modelInfo.size,
      family: modelInfo.details?.family,
      quantization: modelInfo.details?.quantization_level
    },
    runtime: process.version,
    os: `${process.platform}-${process.arch}`,
    ollama_endpoint: OLLAMA,
    secondary_endpoint: secondaryRelease,
    released_before_run: [apiRelease, secondaryRelease],
    baseline_visible_suite: baselineVisible,
    gpu_before: await collectGpuState(),
    started_at: startedAt
  };
  fs.writeFileSync(path.join(artifactDir, 'environment.json'), JSON.stringify(environment, null, 2), 'utf8');

  let result;
  let runError = null;
  try {
    result = await runWorkflowBenchTask({
      repoDir: REPO_DIR,
      task,
      config,
      baseCommit,
      runId,
      artifactRoot: artifactsRoot,
      agentCall: async ({ role, prompt, model, settings, seed }) => {
        const messages = [
          { role: 'system', content: `You are the ${role} role in a controlled repository coding workflow. Return only the JSON object requested. Be concise. Do not provide private reasoning or claim that tests ran.` },
          { role: 'user', content: prompt }
        ];
        const options = { ...settings, seed };
        const exactRequest = { model, messages, format: 'json', stream: false, think: config.think, keep_alive: config.keepAlive, options };
        const promptSha256 = sha256(JSON.stringify(exactRequest));
        const callStart = Date.now();
        const response = await requestJson(`${OLLAMA}/api/chat`, exactRequest, 600_000);
        const outputText = response.message?.content || '';
        const evalDurationSeconds = (response.eval_duration || 0) / 1e9;
        return {
          text: outputText,
          provider: 'ollama',
          model: response.model || model,
          modelDigest: modelInfo.digest,
          finishReason: response.done_reason || response.message?.done_reason || null,
          durationMs: Date.now() - callStart,
          promptSha256,
          usage: {
            prompt_tokens: response.prompt_eval_count || 0,
            completion_tokens: response.eval_count || 0,
            total_tokens: (response.prompt_eval_count || 0) + (response.eval_count || 0),
            tokens_per_second: evalDurationSeconds > 0 ? Number(((response.eval_count || 0) / evalDurationSeconds).toFixed(2)) : null
          }
        };
      }
    });
  } catch (error) {
    runError = error.message || String(error);
  } finally {
    const releasedAfter = await releaseAllResidentModels(OLLAMA);
    const psAfter = await readResidentModels(OLLAMA);
    const completedEnvironment = {
      ...environment,
      finished_at: new Date().toISOString(),
      gpu_after: await collectGpuState(),
      released_after_run: releasedAfter,
      ollama_ps_after: psAfter,
      runner_error: runError
    };
    fs.writeFileSync(path.join(artifactDir, 'environment.json'), JSON.stringify(completedEnvironment, null, 2), 'utf8');
    if (psAfter.length) throw new Error(`Ollama models remain resident after the pilot: ${psAfter.map(item => item.name || item.model).join(', ')}`);
  }

  if (runError) throw new Error(`workflow pilot failed before producing a result: ${runError}`);
  console.log(JSON.stringify({
    run_id: result.run_id,
    outcome: result.outcome,
    gates: result.gates,
    role_calls: result.role_events.length,
    usage: result.usage,
    artifacts: artifactDir
  }, null, 2));
  if (result.outcome !== 'VERIFIED_SUCCESS') process.exitCode = 2;
}

main().catch(error => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
