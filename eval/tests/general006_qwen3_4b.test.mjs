// trace:verifies BENCH-5060TI-GENERAL-006
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRequest, inspectCode, inspectRawFormat } from '../../scripts/benchmark_5060ti_pilot.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const profile = JSON.parse(fs.readFileSync(path.join(root, 'eval/config/qwen3-4b-general006.json'), 'utf8'));
const tasksFile = path.join(root, 'eval/project/local-llm-hub/pilot-5060ti-tasks.json');
const heldoutFile = path.join(root, 'eval/project/local-llm-hub/pilot-5060ti-heldout.mjs');
const tasks = JSON.parse(fs.readFileSync(tasksFile, 'utf8'));
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

assert.equal(sha(tasksFile), profile.tasks_sha256);
assert.equal(sha(heldoutFile), profile.heldout_sha256);
assert.equal(profile.source.hf_weight_match_verified, false);
assert.equal(profile.candidate.think, true);
assert.equal(profile.options.temperature, 0.6);
assert.equal(profile.options.top_p, 0.95);
assert.equal(profile.options.top_k, 20);
assert.equal(profile.options.num_ctx, 40960);
assert.equal(profile.options.num_predict, 32768);

for (const task of tasks) {
  for (const seed of profile.seeds) {
    const request = buildRequest({ ...profile.candidate, options: profile.options }, task, seed);
    assert.deepEqual(request.options, { ...profile.options, seed });
    assert.equal(request.think, true);
    assert.equal(request.messages[0].content, task.prompt);
  }
}

const fence = String.fromCharCode(96).repeat(3);
const source = '// trace:implements FR-002\npub fn normalize_model_name(raw: &str) -> String { raw.to_lowercase() }';
assert.equal(inspectRawFormat(fence + 'rust\n' + source + '\n' + fence).pass, true);
assert.equal(inspectRawFormat('prose\n' + fence + 'rust\n' + source + '\n' + fence).pass, false);
assert.equal(inspectRawFormat(fence + 'text\n' + source + '\n' + fence).pass, false);
assert.equal(inspectRawFormat(fence + 'rust\n' + source + '\n' + fence + '\n' + fence + 'rust\nfn extra() {}\n' + fence).pass, false);
assert.equal(inspectCode(source, 'FR-002').guard_pass, true);
assert.equal(inspectCode(source, 'FR-002').trace_pass, true);
assert.equal(inspectCode(source, 'FR-002').execution_review_flags.length, 0);

console.log('PASS: frozen Qwen3-4B profile, six exact request settings, task hashes, single-Rust-fence format gate, and code safety inspection.');
