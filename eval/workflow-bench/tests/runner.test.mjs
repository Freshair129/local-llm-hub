import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runWorkflowBenchTask, WORKFLOW_BENCH_ROLES } from '../runner.mjs';

function git(repo, args) {
  const result = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr || `git ${args.join(' ')} failed`);
  return result.stdout.trim();
}

function createRepo() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-bench-test-repo-'));
  git(repo, ['init', '--initial-branch=main']);
  git(repo, ['config', 'user.email', 'workflow-bench-test@example.invalid']);
  git(repo, ['config', 'user.name', 'Workflow Bench Test']);
  fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'eval/workflow-bench'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'src/value.mjs'), 'export const value = -1;\n');
  fs.writeFileSync(path.join(repo, 'eval/workflow-bench/visible.mjs'), `
import assert from 'node:assert/strict';
import { value } from '../../src/value.mjs';
assert.equal(value, 42, 'EXPECTED_42');
console.log('visible suite passed');
`);
  fs.writeFileSync(path.join(repo, 'eval/workflow-bench/security.mjs'), `
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source = fs.readFileSync(new URL('../../src/value.mjs', import.meta.url), 'utf8');
assert.doesNotMatch(source, /\\beval\\s*\\(/);
console.log('security suite passed');
`);
  fs.writeFileSync(path.join(repo, 'eval/workflow-bench/hidden.mjs'), `
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const { value } = await import(pathToFileURL(process.argv[2]).href);
assert.equal(value, 42, 'HIDDEN_EXPECTED_SENTINEL');
const counter = process.argv[3];
const prior = fs.existsSync(counter) ? Number(fs.readFileSync(counter, 'utf8')) : 0;
fs.writeFileSync(counter, String(prior + 1));
console.log('HIDDEN_EXPECTED_SENTINEL');
`);
  git(repo, ['add', '.']);
  git(repo, ['commit', '-m', 'fixture']);
  return repo;
}

function makeTask(repo, overrides = {}) {
  const counter = path.join(os.tmpdir(), `workflow-bench-hidden-${Math.random().toString(36).slice(2)}.count`);
  return {
    taskId: 'test-task',
    family: 'focused-code-change',
    seed: 7,
    request: 'Set value to 42.',
    acceptanceCriteria: [{ id: 'AC-01', description: 'value equals 42' }],
    allowedPaths: ['src/value.mjs'],
    publicFiles: ['src/value.mjs'],
    hiddenFiles: ['eval/workflow-bench/hidden.mjs'],
    timeoutMs: 10_000,
    compileCommand: { executable: process.execPath, args: ['--check', 'src/value.mjs'] },
    visibleCommand: { executable: process.execPath, args: ['eval/workflow-bench/visible.mjs'] },
    securityCommand: { executable: process.execPath, args: ['eval/workflow-bench/security.mjs'] },
    hiddenCommand: { executable: process.execPath, args: ['eval/workflow-bench/hidden.mjs', '{{WORKTREE}}/src/value.mjs', counter] },
    hiddenCounter: counter,
    ...overrides
  };
}

function makeConfig(overrides = {}) {
  return {
    id: 'CFG-TEST-SIX',
    version: '1.0.0',
    provider: 'test',
    model: 'fake-model',
    settings: { temperature: 0 },
    roles: [...WORKFLOW_BENCH_ROLES],
    repairLimit: 0,
    budget: { maxRoleCalls: 9, maxTotalTokens: 1000, maxWallTimeMs: 60_000 },
    ...overrides
  };
}

function fakeAgent({ initialValue = 42, repairValue = 42, reviewerBlockFirst = false } = {}) {
  const prompts = [];
  let reviewerCalls = 0;
  return {
    prompts,
    async call({ role, prompt }) {
      prompts.push({ role, prompt });
      let result;
      if (role === 'planner') result = { plan: ['set the exported value'] };
      else if (role === 'executor') result = { files: [{ path: 'src/value.mjs', content: `export const value = ${initialValue};\n` }] };
      else if (role === 'reviewer') {
        reviewerCalls += 1;
        result = { blocking_findings: reviewerBlockFirst && reviewerCalls === 1 ? ['value is not correct'] : [], warnings: [] };
      } else if (role === 'verifier') result = { blocking_findings: [], ac_results: { 'AC-01': true } };
      else if (role === 'tester') result = { test_ideas: ['check value equals 42'] };
      else if (role === 'repairer') result = { files: [{ path: 'src/value.mjs', content: `export const value = ${repairValue};\n` }] };
      else throw new Error(`unexpected role ${role}`);
      return { text: JSON.stringify(result), usage: { prompt_tokens: 5, completion_tokens: 3 } };
    }
  };
}

function tempArtifacts(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-bench-artifacts-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test('applies and hashes the exact final diff, runs hidden suite once, and excludes hidden data from role prompts', async t => {
  const repo = createRepo();
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  const task = makeTask(repo);
  const agent = fakeAgent();
  const result = await runWorkflowBenchTask({
    repoDir: repo,
    task,
    config: makeConfig(),
    agentCall: args => agent.call(args),
    artifactRoot: tempArtifacts(t),
    baseCommit: git(repo, ['rev-parse', 'HEAD'])
  });

  assert.equal(result.outcome, 'VERIFIED_SUCCESS');
  assert.deepEqual(Object.values(result.gates), ['PASS', 'PASS', 'PASS', 'PASS', 'PASS', 'PASS']);
  assert.equal(fs.readFileSync(task.hiddenCounter, 'utf8'), '1');
  assert.ok(result.final_artifact_sha256);
  assert.equal(result.reviewer_verifier_approved, true);
  assert.equal(result.role_events.filter(event => event.role === 'repairer').length, 0);
  assert.ok(agent.prompts.every(({ prompt }) => !prompt.includes('HIDDEN_EXPECTED_SENTINEL')));
  assert.ok(agent.prompts.every(({ prompt }) => !prompt.includes('hiddenCommand')));
  fs.rmSync(task.hiddenCounter, { force: true });
});

test('runs visible repair feedback, then adjudicates held-out tests only once without leakage', async t => {
  const repo = createRepo();
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  const task = makeTask(repo);
  const agent = fakeAgent({ initialValue: 0, repairValue: 42, reviewerBlockFirst: true });
  const result = await runWorkflowBenchTask({
    repoDir: repo,
    task,
    config: makeConfig({ repairLimit: 1 }),
    agentCall: args => agent.call(args),
    artifactRoot: tempArtifacts(t),
    baseCommit: git(repo, ['rev-parse', 'HEAD'])
  });

  assert.equal(result.outcome, 'VERIFIED_SUCCESS');
  assert.equal(result.repair_calls, 1);
  assert.equal(fs.readFileSync(task.hiddenCounter, 'utf8'), '1');
  const repairPrompt = agent.prompts.find(item => item.role === 'repairer')?.prompt || '';
  assert.match(repairPrompt, /EXPECTED_42/);
  assert.doesNotMatch(repairPrompt, /HIDDEN_EXPECTED_SENTINEL/);
  assert.doesNotMatch(repairPrompt, /hiddenCommand/);
  fs.rmSync(task.hiddenCounter, { force: true });
});

test('known-bad applied patch fails a deterministic gate and required suite configuration fails closed', async t => {
  const repo = createRepo();
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  const task = makeTask(repo);
  const result = await runWorkflowBenchTask({
    repoDir: repo,
    task,
    config: makeConfig(),
    agentCall: args => fakeAgent({ initialValue: 0 }).call(args),
    artifactRoot: tempArtifacts(t),
    baseCommit: git(repo, ['rev-parse', 'HEAD'])
  });
  assert.equal(result.gates.patch_valid, 'PASS');
  assert.equal(result.gates.visible_tests, 'FAIL');
  assert.notEqual(result.outcome, 'VERIFIED_SUCCESS');

  let calls = 0;
  await assert.rejects(runWorkflowBenchTask({
    repoDir: repo,
    task: makeTask(repo, { hiddenCommand: null }),
    config: makeConfig(),
    agentCall: async () => { calls += 1; return { text: '{}' }; },
    artifactRoot: tempArtifacts(t),
    baseCommit: git(repo, ['rev-parse', 'HEAD'])
  }), /task.hiddenCommand must define/);
  assert.equal(calls, 0);
});

test('private hidden suites run outside the checkout without leaking their root into artifacts', async t => {
  const repo = createRepo();
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  const privateRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-bench-private-'));
  t.after(() => fs.rmSync(privateRoot, { recursive: true, force: true }));
  fs.copyFileSync(path.join(repo, 'eval/workflow-bench/hidden.mjs'), path.join(privateRoot, 'hidden.mjs'));
  const task = makeTask(repo, {
    hiddenFiles: ['hidden.mjs'],
    privateHiddenRoot: privateRoot,
    hiddenCommand: { executable: process.execPath, args: ['{{HIDDEN_ROOT}}/hidden.mjs', '{{WORKTREE}}/src/value.mjs', path.join(privateRoot, 'count')] }
  });
  const result = await runWorkflowBenchTask({
    repoDir: repo,
    task,
    config: makeConfig(),
    agentCall: args => fakeAgent().call(args),
    artifactRoot: tempArtifacts(t),
    baseCommit: git(repo, ['rev-parse', 'HEAD'])
  });
  const serialized = JSON.stringify(result);
  assert.equal(result.outcome, 'VERIFIED_SUCCESS');
  assert.ok(result.hidden_suite_hashes.suite_1);
  assert.ok(!serialized.includes(privateRoot));
});

test('an unrun required security gate cannot produce a verified success', async t => {
  const repo = createRepo();
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  const task = makeTask(repo, { securityCommand: { executable: 'workflow-bench-command-that-does-not-exist', args: [] } });
  const result = await runWorkflowBenchTask({
    repoDir: repo,
    task,
    config: makeConfig(),
    agentCall: args => fakeAgent().call(args),
    artifactRoot: tempArtifacts(t),
    baseCommit: git(repo, ['rev-parse', 'HEAD'])
  });
  assert.equal(result.gates.security, 'NOT_RUN');
  assert.equal(result.outcome, 'INFRA_FAILURE');
});

test('rejects out-of-scope replacements before applying them', async t => {
  const repo = createRepo();
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  const task = makeTask(repo);
  const agent = fakeAgent();
  const call = agent.call.bind(agent);
  const result = await runWorkflowBenchTask({
    repoDir: repo,
    task,
    config: makeConfig(),
    agentCall: async args => args.role === 'executor'
      ? { text: JSON.stringify({ files: [{ path: '../outside.mjs', content: 'bad' }] }) }
      : call(args),
    artifactRoot: tempArtifacts(t),
    baseCommit: git(repo, ['rev-parse', 'HEAD'])
  });
  assert.equal(result.outcome, 'QUALITY_FAIL');
  assert.equal(result.gates.patch_valid, 'FAIL');
  assert.equal(result.gates.held_out_tests, 'NOT_RUN');
  assert.equal(fs.existsSync(path.join(path.dirname(repo), 'outside.mjs')), false);
});
