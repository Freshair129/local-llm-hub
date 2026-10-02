// eval/tests/eval_harness.test.mjs
// trace:implements SPEC-EVAL-002
//! Self-Verification Tests for Evaluation Framework

import assert from 'assert';
import { validatePatchArtifact } from '../harness/patch-validator.mjs';
import { buildSpecContract } from '../harness/spec-contract-builder.mjs';
import { buildTaskContext } from '../harness/context-builder.mjs';
import { calculateBatchScorecard } from '../harness/scorer.mjs';
import { runDeterministicTest } from '../harness/test-runner.mjs';

async function runTests() {
  console.log('🧪 Running Evaluation Harness Self-Verification Suite...');

  // Test 1: validatePatchArtifact valid
  const validPatch = {
    task_id: 'TASK-001',
    files: [
      {
        path: 'src/main.js',
        patch: 'console.log("hello");',
        reason: 'Add log'
      }
    ]
  };
  const valResult1 = validatePatchArtifact(validPatch, ['src/main.js']);
  assert.strictEqual(valResult1.valid, true, 'Valid patch should pass');
  console.log('  ✅ [1/5] Patch validation of valid PatchArtifact passed');

  // Test 2: validatePatchArtifact path traversal rejection (HG-01)
  const traversalPatch = {
    task_id: 'TASK-002',
    files: [
      {
        path: '../../Windows/System32/cmd.exe',
        patch: 'malicious',
        reason: 'Exploit'
      }
    ]
  };
  const valResult2 = validatePatchArtifact(traversalPatch, ['src/main.js']);
  assert.strictEqual(valResult2.valid, false, 'Path traversal should fail');
  assert(valResult2.errors.some(e => e.includes('Path traversal')), 'Should flag path traversal');
  console.log('  ✅ [2/5] Path traversal rejection (HG-01) passed');

  // Test 3: buildSpecContract dynamic AC derivation (GAP-001)
  const contract = buildSpecContract({
    taskId: 'TASK-003',
    goal: 'Improve zero-panic safety in Rust',
    targetFiles: ['src-tauri/src/commands/share.rs']
  });
  assert(contract.acceptance_criteria.length >= 3, 'Should derive at least 3 criteria');
  assert(contract.acceptance_criteria.some(ac => ac.description.includes('Zero-Panic Policy')), 'Should enforce Zero-Panic for Rust');
  console.log('  ✅ [3/5] Dynamic Acceptance Criteria derivation (GAP-001) passed');

  // Test 4: calculateBatchScorecard reporting and denominators (GAP-009)
  const mockRuns = [
    {
      task_id: 'T1',
      verdict: 'PASS',
      hard_gates: { hg_02_compile: true, hg_03_existing_tests: true, hg_06_scope_clean: true }
    },
    {
      task_id: 'T2',
      verdict: 'FAIL',
      hard_gates: { hg_02_compile: true, hg_03_existing_tests: false, hg_06_scope_clean: true }
    }
  ];
  const scorecard = calculateBatchScorecard(mockRuns);
  assert.strictEqual(scorecard.total_runs, 2);
  assert.strictEqual(scorecard.passed_runs, 1);
  assert.strictEqual(scorecard.raw_pass_summary, '1 / 2 tasks passed');
  assert.strictEqual(scorecard.compile_rate_pct, 100);
  assert(scorecard.composite_score > 0, 'Composite score must be positive');
  console.log('  ✅ [4/5] Denominator and composite scorecard calculation passed');

  // Test 5: runDeterministicTest deterministic CLI execution (GAP-005)
  const cmdResult = await runDeterministicTest('echo "eval harness online"');
  assert.strictEqual(cmdResult.success, true);
  assert(cmdResult.stdout.includes('eval harness online'));
  console.log('  ✅ [5/5] Deterministic CLI runner passed');

  console.log('\n🎉 ALL 5 EVAL HARNESS TESTS PASSED CLEANLY (100%)!\n');
}

runTests().catch(err => {
  console.error('❌ Eval harness test failed:', err);
  process.exit(1);
});
