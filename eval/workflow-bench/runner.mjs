// trace:implements WORKFLOW-BENCH Section 8
//! Isolated, fail-closed runner for one task/configuration/seed cell.

import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REQUIRED_ROLES = ['planner', 'executor', 'reviewer', 'verifier', 'tester', 'repairer'];
const ROLE_SYSTEM = {
  planner: 'Make a short implementation plan. Return JSON: {"plan":["..."]}. Do not write code.',
  executor: 'Implement the request. Return JSON: {"files":[{"path":"...","content":"complete file content"}]}. Only replace allowed files.',
  reviewer: 'Review the candidate independently against the request and constraints. Return JSON: {"blocking_findings":["..."],"warnings":["..."]}. Do not rely on another role verdict.',
  verifier: 'Check each acceptance criterion against the candidate. Return JSON: {"blocking_findings":["..."],"ac_results":{"AC-ID":true}}. Do not rely on another role verdict.',
  tester: 'Suggest supplemental visible test cases only. Return JSON: {"test_ideas":["..."]}. Do not claim tests ran.',
  repairer: 'Repair the candidate using only the supplied visible feedback. Return JSON: {"files":[{"path":"...","content":"complete file content"}]}. Hidden tests and outcomes are unavailable.'
};
const ROLE_ORDER = Object.fromEntries(REQUIRED_ROLES.map((role, index) => [role, index]));
const MAX_OUTPUT_BYTES = 128 * 1024;

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  }
  return value;
}

export function stableHash(value) {
  return sha256(JSON.stringify(stable(value)));
}

function git(repoDir, args) {
  const result = spawnSync('git', ['-C', repoDir, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024
  });
  if (result.error || result.status !== 0) {
    throw new Error(`git ${args[0]} failed: ${result.error?.message || result.stderr || result.status}`);
  }
  return result.stdout;
}

function assertSafeRelativePath(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be a non-empty relative path`);
  const normalized = value.replaceAll('\\', '/');
  if (normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized) || normalized.split('/').some(part => part === '..' || part === '.')) {
    throw new Error(`${label} must not be absolute or traverse directories: ${value}`);
  }
  return normalized;
}

function pathAllowed(relativePath, allowedPaths) {
  const candidate = assertSafeRelativePath(relativePath, 'candidate path');
  return allowedPaths.some(allowedValue => {
    const allowed = assertSafeRelativePath(allowedValue, 'allowedPaths item').replace(/\/$/, '');
    return candidate === allowed || candidate.startsWith(`${allowed}/`);
  });
}

function assertTask(task) {
  if (!task || typeof task !== 'object') throw new Error('task must be an object');
  for (const key of ['taskId', 'family', 'request']) {
    if (typeof task[key] !== 'string' || !task[key]) throw new Error(`task.${key} is required`);
  }
  if (!Number.isInteger(task.seed)) throw new Error('task.seed must be an integer');
  if (!Array.isArray(task.acceptanceCriteria) || task.acceptanceCriteria.length === 0) throw new Error('task.acceptanceCriteria is required');
  if (!Array.isArray(task.allowedPaths) || task.allowedPaths.length === 0) throw new Error('task.allowedPaths is required');
  if (!Array.isArray(task.publicFiles) || task.publicFiles.length === 0) throw new Error('task.publicFiles is required');
  if (!Array.isArray(task.hiddenFiles) || task.hiddenFiles.length === 0) throw new Error('task.hiddenFiles is required for leakage audit');
  if (task.privateHiddenRoot !== undefined && (typeof task.privateHiddenRoot !== 'string' || !path.isAbsolute(task.privateHiddenRoot))) {
    throw new Error('task.privateHiddenRoot must be an absolute path when provided');
  }
  for (const key of ['compileCommand', 'visibleCommand', 'securityCommand', 'hiddenCommand']) assertCommand(task[key], `task.${key}`);
  const allowed = new Set(task.allowedPaths.map(p => assertSafeRelativePath(p, 'allowedPaths item')));
  for (const file of task.publicFiles) {
    const safeFile = assertSafeRelativePath(file, 'publicFiles item');
    if (!allowed.has(safeFile)) throw new Error(`public file must be in allowedPaths: ${safeFile}`);
  }
  for (const file of task.hiddenFiles) assertSafeRelativePath(file, 'hiddenFiles item');
  for (const criterion of task.acceptanceCriteria) {
    if (!criterion || typeof criterion.id !== 'string' || !criterion.id || typeof criterion.description !== 'string') {
      throw new Error('each acceptance criterion needs id and description');
    }
  }
}

function assertCommand(command, label) {
  if (!command || typeof command !== 'object' || typeof command.executable !== 'string' || !command.executable ||
      !Array.isArray(command.args) || command.args.some(arg => typeof arg !== 'string')) {
    throw new Error(`${label} must define executable and string args; shell command strings are not allowed`);
  }
}

function assertConfig(config) {
  if (!config || typeof config !== 'object') throw new Error('config must be an object');
  for (const key of ['id', 'version', 'provider', 'model']) {
    if (typeof config[key] !== 'string' || !config[key]) throw new Error(`config.${key} is required`);
  }
  if (!config.settings || typeof config.settings !== 'object') throw new Error('config.settings is required');
  if (!Number.isInteger(config.repairLimit) || config.repairLimit < 0 || config.repairLimit > 3) {
    throw new Error('config.repairLimit must be an integer from 0 to 3');
  }
  if (!config.budget || !Number.isInteger(config.budget.maxRoleCalls) || config.budget.maxRoleCalls < 1 ||
      !Number.isInteger(config.budget.maxTotalTokens) || config.budget.maxTotalTokens < 1 ||
      !Number.isInteger(config.budget.maxWallTimeMs) || config.budget.maxWallTimeMs < 1) {
    throw new Error('config.budget must define positive maxRoleCalls, maxTotalTokens, and maxWallTimeMs');
  }
  if (config.roles?.length !== REQUIRED_ROLES.length || REQUIRED_ROLES.some(role => !config.roles.includes(role))) {
    throw new Error(`config.roles must contain exactly: ${REQUIRED_ROLES.join(', ')}`);
  }
}

function resolveWithin(root, relativePath) {
  const safeRelative = assertSafeRelativePath(relativePath, 'file path');
  const fullPath = path.resolve(root, safeRelative);
  const relative = path.relative(root, fullPath);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`path escapes sandbox: ${relativePath}`);
  }
  let cursor = root;
  for (const segment of safeRelative.split('/')) {
    cursor = path.join(cursor, segment);
    if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) {
      throw new Error(`symlink paths are not allowed: ${relativePath}`);
    }
  }
  return fullPath;
}

function runProcess(executable, args, cwd, timeoutMs) {
  return new Promise(resolve => {
    const startedAt = new Date().toISOString();
    const start = Date.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let spawnError = null;
    const child = spawn(executable, args, {
      cwd,
      windowsHide: true,
      shell: false,
      env: {
        PATH: process.env.PATH || '',
        SystemRoot: process.env.SystemRoot || '',
        WINDIR: process.env.WINDIR || '',
        TEMP: process.env.TEMP || os.tmpdir(),
        TMP: process.env.TMP || os.tmpdir(),
        LANG: process.env.LANG || 'C.UTF-8'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const capture = (current, chunk) => (current + chunk.toString()).slice(-MAX_OUTPUT_BYTES);
    child.stdout.on('data', chunk => { stdout = capture(stdout, chunk); });
    child.stderr.on('data', chunk => { stderr = capture(stderr, chunk); });
    child.on('error', error => { spawnError = error.message; });
    const timer = setTimeout(() => {
      timedOut = true;
      if (process.platform === 'win32' && child.pid) {
        const killer = spawn('taskkill', ['/pid', String(child.pid), '/f', '/t'], { windowsHide: true, stdio: 'ignore' });
        killer.on('error', () => child.kill('SIGKILL'));
      } else {
        child.kill('SIGKILL');
      }
    }, timeoutMs);
    child.on('close', code => {
      clearTimeout(timer);
      resolve({
        startedAt,
        durationMs: Date.now() - start,
        exitCode: code,
        timedOut,
        spawnError,
        stdout,
        stderr,
        stdoutSha256: sha256(stdout),
        stderrSha256: sha256(stderr)
      });
    });
  });
}

function parseOutput(text, role) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${role} output was not valid JSON`);
  }
}

function parseReplacement(value, allowedPaths, role) {
  if (!value || !Array.isArray(value.files) || value.files.length === 0) throw new Error(`${role} must return files[]`);
  const seen = new Set();
  return value.files.map(file => {
    const relativePath = assertSafeRelativePath(file?.path, `${role} file path`);
    if (!pathAllowed(relativePath, allowedPaths)) throw new Error(`${role} attempted an out-of-scope path: ${relativePath}`);
    if (seen.has(relativePath)) throw new Error(`${role} returned duplicate path: ${relativePath}`);
    seen.add(relativePath);
    if (typeof file.content !== 'string' || file.content.length === 0) throw new Error(`${role} replacement content is empty`);
    return { path: relativePath, content: file.content };
  });
}

function getStatusEntries(repoDir) {
  return git(repoDir, ['status', '--porcelain=v1', '--untracked-files=all'])
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => ({ state: line.slice(0, 2).trim(), file: line.slice(3).replaceAll('\\', '/') }));
}

function getChangedPaths(repoDir) {
  return getStatusEntries(repoDir).map(entry => entry.file);
}

function getDiff(repoDir) {
  for (const entry of getStatusEntries(repoDir)) {
    if (entry.state === '??') git(repoDir, ['add', '-N', '--', entry.file]);
  }
  return git(repoDir, ['diff', '--binary', '--no-ext-diff', '--no-color', '--']);
}

function writeReplacements(worktreePath, files, allowedPaths) {
  for (const file of files) {
    const target = resolveWithin(worktreePath, file.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, file.content, 'utf8');
  }
  const changed = getChangedPaths(worktreePath);
  const outOfScope = changed.filter(file => !pathAllowed(file, allowedPaths));
  if (outOfScope.length) throw new Error(`sandbox has out-of-scope changes: ${outOfScope.join(', ')}`);
  return changed;
}

function makeRoleInput(role, task, files, extra = {}) {
  const common = {
    task_id: task.taskId,
    request: task.request,
    acceptance_criteria: task.acceptanceCriteria,
    allowed_paths: task.allowedPaths,
    source_files: files
  };
  if (role === 'planner') return common;
  if (role === 'executor') return { ...common, plan: extra.plan };
  if (role === 'reviewer' || role === 'verifier') return { ...common, candidate_diff: extra.diff, current_candidate: extra.candidate };
  if (role === 'tester') return { ...common, candidate_diff: extra.diff, current_candidate: extra.candidate };
  if (role === 'repairer') {
    return {
      ...common,
      current_candidate: extra.candidate,
      visible_feedback: extra.visibleFeedback,
      reviewer_findings: extra.reviewerFindings,
      verifier_findings: extra.verifierFindings
    };
  }
  throw new Error(`unknown workflow role: ${role}`);
}

function validateRoleResult(role, parsed, task) {
  if (role === 'planner' && (!Array.isArray(parsed.plan) || !parsed.plan.every(item => typeof item === 'string'))) {
    throw new Error('planner must return a string plan[]');
  }
  if (role === 'reviewer' && (!Array.isArray(parsed.blocking_findings) || !Array.isArray(parsed.warnings))) {
    throw new Error('reviewer must return blocking_findings[] and warnings[]');
  }
  if (role === 'verifier') {
    if (!Array.isArray(parsed.blocking_findings) || !parsed.ac_results || typeof parsed.ac_results !== 'object') {
      throw new Error('verifier must return blocking_findings[] and ac_results object');
    }
    for (const criterion of task.acceptanceCriteria) {
      if (typeof parsed.ac_results[criterion.id] !== 'boolean') {
        throw new Error(`verifier omitted boolean result for ${criterion.id}`);
      }
      if (!parsed.ac_results[criterion.id]) parsed.blocking_findings.push(`Acceptance criterion ${criterion.id} was not verified`);
    }
  }
  if (role === 'tester' && (!Array.isArray(parsed.test_ideas) || !parsed.test_ideas.every(item => typeof item === 'string'))) {
    throw new Error('tester must return string test_ideas[]');
  }
}

async function readPublicFiles(worktreePath, task) {
  const files = {};
  for (const relativePath of task.publicFiles) {
    const target = resolveWithin(worktreePath, relativePath);
    files[relativePath] = fs.readFileSync(target, 'utf8');
  }
  return files;
}

async function captureHiddenHashes(repoDir, task) {
  const hashes = {};
  const hiddenRoot = task.privateHiddenRoot ? fs.realpathSync(task.privateHiddenRoot) : repoDir;
  if (task.privateHiddenRoot) {
    const relativeRoot = path.relative(repoDir, hiddenRoot);
    if (!relativeRoot || (!relativeRoot.startsWith('..') && !path.isAbsolute(relativeRoot))) {
      throw new Error('private hidden suite root must be outside the repository checkout');
    }
  }
  for (const [index, relativePath] of task.hiddenFiles.entries()) {
    const target = resolveWithin(hiddenRoot, relativePath);
    hashes[`suite_${index + 1}`] = sha256(fs.readFileSync(target));
  }
  return hashes;
}

function resolveCommand(command, worktreePath, hiddenRoot) {
  return {
    executable: command.executable,
    args: command.args.map(arg => arg
      .replaceAll('{{WORKTREE}}', worktreePath)
      .replaceAll('{{HIDDEN_ROOT}}', hiddenRoot))
  };
}

async function runGate(command, worktreePath, timeoutMs, { retainOutput = false } = {}) {
  const execution = await runProcess(command.executable, command.args, worktreePath, timeoutMs);
  const state = execution.timedOut ? 'NOT_RUN' : (execution.spawnError ? 'NOT_RUN' : (execution.exitCode === 0 ? 'PASS' : 'FAIL'));
  return {
    state,
    exitCode: execution.exitCode,
    timedOut: execution.timedOut,
    spawnError: execution.spawnError,
    durationMs: execution.durationMs,
    stdoutSha256: execution.stdoutSha256,
    stderrSha256: execution.stderrSha256,
    ...(retainOutput ? { visibleFeedback: `${execution.stdout}\n${execution.stderr}`.slice(-12_000) } : {})
  };
}

function makeRunId(task, config) {
  return `${task.taskId}-${config.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`.replace(/[^A-Za-z0-9_.-]/g, '_');
}

export async function runWorkflowBenchTask({ repoDir, task, config, agentCall, artifactRoot, baseCommit, runId = null }) {
  assertTask(task);
  assertConfig(config);
  if (typeof agentCall !== 'function') throw new Error('agentCall function is required');
  if (!artifactRoot) throw new Error('artifactRoot is required');

  const repo = fs.realpathSync(repoDir);
  const resolvedCommit = git(repo, ['rev-parse', '--verify', `${baseCommit || task.baseCommit || 'HEAD'}^{commit}`]).trim();
  const id = runId || makeRunId(task, config);
  const outputDir = path.resolve(artifactRoot, id);
  fs.mkdirSync(outputDir, { recursive: true });
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-bench-'));
  const worktreePath = path.join(tempRoot, 'checkout');
  const roles = [];
  const startedAt = new Date().toISOString();
  const runStartedMs = Date.now();
  const configHash = stableHash(config);
  const usageTotals = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  const hiddenTestHashes = await captureHiddenHashes(repo, task);
  const hiddenRoot = task.privateHiddenRoot ? fs.realpathSync(task.privateHiddenRoot) : repo;
  const timeoutMs = Number.isInteger(task.timeoutMs) ? task.timeoutMs : 120_000;
  task.allowedPaths.forEach(p => assertSafeRelativePath(p, 'allowedPaths item'));
  const gateStates = {
    patch_valid: 'NOT_RUN',
    scope: 'NOT_RUN',
    compile: 'NOT_RUN',
    visible_tests: 'NOT_RUN',
    security: 'NOT_RUN',
    held_out_tests: 'NOT_RUN'
  };
  let outcome = 'QUALITY_FAIL';
  let candidateApplied = false;
  let finalDiff = '';
  let finalDiffSha256 = null;
  let lastVisibleFeedback = '';
  let lastReviewerFindings = [];
  let lastVerifierFindings = [];
  let repairCalls = 0;
  let failureReason = null;
  let hiddenGate = null;

  const invoke = async (role, input) => {
    if (roles.length >= config.budget.maxRoleCalls) {
      throw Object.assign(new Error('workflow exceeded maxRoleCalls'), { resourceLimit: true });
    }
    if (Date.now() - runStartedMs >= config.budget.maxWallTimeMs) {
      throw Object.assign(new Error('workflow exceeded maxWallTimeMs'), { resourceLimit: true });
    }
    const prompt = `${ROLE_SYSTEM[role]}\n\nInput JSON:\n${JSON.stringify(input)}`;
    const callStartedAt = new Date().toISOString();
    const callStart = Date.now();
    const seed = task.seed + ROLE_ORDER[role] + roles.filter(item => item.role === role).length * 1000;
    let response;
    try {
      response = await agentCall({
        role,
        prompt,
        model: config.model,
        provider: config.provider,
        settings: config.settings,
        seed,
        configHash
      });
    } catch (error) {
      roles.push({ role, startedAt: callStartedAt, durationMs: Date.now() - callStart, promptSha256: sha256(prompt), error: error.message || String(error), outcome: 'INFRA_FAILURE' });
      throw Object.assign(new Error(`${role} call failed: ${error.message || String(error)}`), { infraFailure: true });
    }
    const text = typeof response?.text === 'string' ? response.text : '';
    const event = {
      role,
      provider: response.provider || config.provider,
      model: response.model || config.model,
      modelDigest: response.modelDigest || config.modelDigest || null,
      startedAt: response.startedAt || callStartedAt,
      finishedAt: response.finishedAt || new Date().toISOString(),
      durationMs: response.durationMs ?? (Date.now() - callStart),
      promptSha256: response.promptSha256 || sha256(prompt),
      responseSha256: sha256(text),
      usage: response.usage || null,
      seed
    };
    roles.push(event);
    const promptTokens = Number(response.usage?.prompt_tokens) || 0;
    const completionTokens = Number(response.usage?.completion_tokens) || 0;
    usageTotals.prompt_tokens += promptTokens;
    usageTotals.completion_tokens += completionTokens;
    usageTotals.total_tokens += promptTokens + completionTokens;
    if (usageTotals.total_tokens > config.budget.maxTotalTokens) {
      throw Object.assign(new Error('workflow exceeded maxTotalTokens'), { resourceLimit: true });
    }
    const parsed = parseOutput(text, role);
    validateRoleResult(role, parsed, task);
    return parsed;
  };

  let worktreeCreated = false;
  try {
    git(repo, ['worktree', 'add', '--detach', worktreePath, resolvedCommit]);
    worktreeCreated = true;
    const initialChanges = getChangedPaths(worktreePath);
    if (initialChanges.length) throw new Error(`new worktree was not clean: ${initialChanges.join(', ')}`);

    const originalFiles = await readPublicFiles(worktreePath, task);
    const planner = await invoke('planner', makeRoleInput('planner', task, originalFiles));
    const executor = await invoke('executor', makeRoleInput('executor', task, originalFiles, { plan: planner.plan }));
    let replacements;
    try {
      replacements = parseReplacement(executor, task.allowedPaths, 'executor');
    } catch (error) {
      gateStates.patch_valid = 'FAIL';
      gateStates.scope = 'FAIL';
      throw error;
    }
    let changed = writeReplacements(worktreePath, replacements, task.allowedPaths);
    candidateApplied = changed.length > 0;
    gateStates.patch_valid = candidateApplied ? 'PASS' : 'FAIL';
    gateStates.scope = changed.every(file => pathAllowed(file, task.allowedPaths)) ? 'PASS' : 'FAIL';
    if (!candidateApplied) throw new Error('executor patch made no repository changes');
    if (gateStates.scope !== 'PASS') throw new Error('executor patch changed files outside allowedPaths');

    let attempt = 0;
    while (true) {
      finalDiff = getDiff(worktreePath);
      finalDiffSha256 = sha256(finalDiff);
      fs.writeFileSync(path.join(outputDir, `candidate-${attempt}.diff`), finalDiff, 'utf8');
      const currentFiles = await readPublicFiles(worktreePath, task);
      const reviewInput = makeRoleInput('reviewer', task, currentFiles, { diff: finalDiff, candidate: currentFiles });
      const verifyInput = makeRoleInput('verifier', task, currentFiles, { diff: finalDiff, candidate: currentFiles });
      const testerInput = makeRoleInput('tester', task, currentFiles, { diff: finalDiff, candidate: currentFiles });

      const reviewer = await invoke('reviewer', reviewInput);
      const verifier = await invoke('verifier', verifyInput);
      await invoke('tester', testerInput);
      lastReviewerFindings = reviewer.blocking_findings;
      lastVerifierFindings = verifier.blocking_findings;

      const compile = await runGate(resolveCommand(task.compileCommand, worktreePath, hiddenRoot), worktreePath, timeoutMs);
      const visible = await runGate(resolveCommand(task.visibleCommand, worktreePath, hiddenRoot), worktreePath, timeoutMs, { retainOutput: true });
      const security = await runGate(resolveCommand(task.securityCommand, worktreePath, hiddenRoot), worktreePath, timeoutMs);
      gateStates.compile = compile.state;
      gateStates.visible_tests = visible.state;
      gateStates.security = security.state;
      lastVisibleFeedback = [
        `compile: ${compile.state} (exit ${compile.exitCode})`,
        `visible_tests: ${visible.state} (exit ${visible.exitCode})`,
        `security: ${security.state} (exit ${security.exitCode})`,
        visible.visibleFeedback
      ].join('\n').slice(-12_000);

      const visibleGatePassed = compile.state === 'PASS' && visible.state === 'PASS' && security.state === 'PASS';
      const reviewPassed = lastReviewerFindings.length === 0 && lastVerifierFindings.length === 0;
      const processFailure = [compile, visible, security].find(gate => gate.timedOut || gate.spawnError);
      if (processFailure) {
        outcome = processFailure.timedOut ? 'RESOURCE_LIMIT' : 'INFRA_FAILURE';
        failureReason = processFailure.timedOut ? 'deterministic gate timed out' : `deterministic gate failed to start: ${processFailure.spawnError}`;
        break;
      }
      if (visibleGatePassed && reviewPassed) break;
      if (repairCalls >= config.repairLimit) break;

      const repairer = await invoke('repairer', makeRoleInput('repairer', task, currentFiles, {
        candidate: currentFiles,
        visibleFeedback: lastVisibleFeedback,
        reviewerFindings: lastReviewerFindings,
        verifierFindings: lastVerifierFindings
      }));
      repairCalls += 1;
      replacements = parseReplacement(repairer, task.allowedPaths, 'repairer');
      changed = writeReplacements(worktreePath, replacements, task.allowedPaths);
      if (!changed.length || changed.some(file => !pathAllowed(file, task.allowedPaths))) {
        gateStates.patch_valid = changed.length ? 'PASS' : 'FAIL';
        gateStates.scope = changed.every(file => pathAllowed(file, task.allowedPaths)) ? 'PASS' : 'FAIL';
        failureReason = 'repairer patch was empty or out of scope';
        break;
      }
      attempt += 1;
    }

    finalDiff = getDiff(worktreePath);
    finalDiffSha256 = sha256(finalDiff);
    fs.writeFileSync(path.join(outputDir, 'final.diff'), finalDiff, 'utf8');
    const finalChanged = getChangedPaths(worktreePath);
    gateStates.patch_valid = finalDiff.length ? 'PASS' : 'FAIL';
    gateStates.scope = finalChanged.length > 0 && finalChanged.every(file => pathAllowed(file, task.allowedPaths)) ? 'PASS' : 'FAIL';

    // Held-out tests run once after candidate selection; outputs are never forwarded to an agent.
    if (candidateApplied && gateStates.scope === 'PASS') {
      hiddenGate = await runGate(resolveCommand(task.hiddenCommand, worktreePath, hiddenRoot), worktreePath, timeoutMs);
      gateStates.held_out_tests = hiddenGate.state;
      if (hiddenGate.timedOut) outcome = 'RESOURCE_LIMIT';
      else if (hiddenGate.spawnError) outcome = 'INFRA_FAILURE';
    }

    if (Date.now() - runStartedMs > config.budget.maxWallTimeMs) {
      outcome = 'RESOURCE_LIMIT';
      failureReason = 'workflow exceeded maxWallTimeMs';
    }

    const allGatesPass = Object.values(gateStates).every(state => state === 'PASS');
    const roleReviewPassed = lastReviewerFindings.length === 0 && lastVerifierFindings.length === 0;
    if (outcome !== 'RESOURCE_LIMIT' && outcome !== 'INFRA_FAILURE') outcome = allGatesPass && roleReviewPassed ? 'VERIFIED_SUCCESS' : 'QUALITY_FAIL';
    if (outcome === 'QUALITY_FAIL' && !failureReason) {
      failureReason = `required gate states: ${JSON.stringify(gateStates)}; reviewer/verifier blocking findings present: ${lastReviewerFindings.length + lastVerifierFindings.length}`;
    }
  } catch (error) {
    failureReason = error.message || String(error);
    if (error.resourceLimit) outcome = 'RESOURCE_LIMIT';
    else if (error.infraFailure) outcome = 'INFRA_FAILURE';
    else outcome = 'QUALITY_FAIL';
  } finally {
    if (worktreeCreated) {
      try {
        git(repo, ['worktree', 'remove', '--force', worktreePath]);
      } catch (error) {
        outcome = 'INVALID_RUN';
        failureReason = `worktree cleanup failed: ${error.message || String(error)}`;
      }
    }
    const tempResolved = path.resolve(tempRoot);
    const osTemp = path.resolve(os.tmpdir());
    const relativeTemp = path.relative(osTemp, tempResolved);
    if (relativeTemp && !relativeTemp.startsWith('..') && !path.isAbsolute(relativeTemp) && path.basename(tempResolved).startsWith('workflow-bench-')) {
      fs.rmSync(tempResolved, { recursive: true, force: true });
    } else {
      outcome = 'INVALID_RUN';
      failureReason = 'refused unsafe temporary-directory cleanup';
    }
  }

  const finishedAt = new Date().toISOString();
  const result = {
    schema_version: 1,
    run_id: id,
    task_id: task.taskId,
    task_family: task.family,
    seed: task.seed,
    task_hash: stableHash({
      ...task,
      privateHiddenRoot: task.privateHiddenRoot ? '[private-root]' : undefined,
      hiddenFiles: task.hiddenFiles.map((_, index) => `suite_${index + 1}`),
      hiddenCommand: '[redacted-command]'
    }),
    hidden_suite_hashes: hiddenTestHashes,
    base_commit: resolvedCommit,
    workflow_config_id: config.id,
    workflow_config_version: config.version,
    workflow_config_hash: configHash,
    provider: config.provider,
    model: config.model,
    model_digest: config.modelDigest || null,
    prompt_version: config.promptVersion || 'workflow-role-prompts-v1',
    started_at: startedAt,
    finished_at: finishedAt,
    duration_ms: Date.parse(finishedAt) - Date.parse(startedAt),
    role_events: roles,
    usage: usageTotals,
    budget: config.budget,
    repair_calls: repairCalls,
    reviewer_verifier_approved: lastReviewerFindings.length === 0 && lastVerifierFindings.length === 0,
    final_artifact_sha256: finalDiffSha256,
    artifact: finalDiff ? 'final.diff' : null,
    gates: gateStates,
    held_out_execution: hiddenGate ? {
      state: hiddenGate.state,
      exit_code: hiddenGate.exitCode,
      duration_ms: hiddenGate.durationMs,
      stdout_sha256: hiddenGate.stdoutSha256,
      stderr_sha256: hiddenGate.stderrSha256
    } : null,
    cost: {
      provider_billing_usd: null,
      local_energy_kwh: null,
      estimated_total_usd: null,
      note: 'Exploratory local run; monetary/energy cost not measured.'
    },
    outcome,
    failure_reason: failureReason
  };
  fs.writeFileSync(path.join(outputDir, 'result.json'), JSON.stringify(result, null, 2), 'utf8');
  return result;
}

export const WORKFLOW_BENCH_ROLES = [...REQUIRED_ROLES];
