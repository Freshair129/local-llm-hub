// eval/harness/smoke-test.mjs
// trace:implements SPEC-EVAL-002
//! Smoke Test Runner to Generate Initial Evaluation Scorecard

import { runEvaluationBatch } from './run-eval.mjs';

async function main() {
  console.log('🚀 Running Evaluation Framework Smoke Test...');

  const sampleTasks = [
    {
      task_id: 'SMOKE-001',
      benchmark_id: 'BASE-1',
      category: 'Rust',
      repo: 'Freshair129/local-llm-hub',
      base_commit: 'HEAD',
      request: 'Verify evaluation harness schema and gate pipeline',
      target_files: ['eval/tests/smoke_target.txt'],
      allowed_paths: ['eval/tests/smoke_target.txt'],
      visible_test_command: 'echo "SMOKE-001 compilation passed"',
      risk_level: 'LOW'
    },
    {
      task_id: 'SMOKE-002',
      benchmark_id: 'BASE-5',
      category: 'Rust',
      repo: 'Freshair129/local-llm-hub',
      base_commit: 'HEAD',
      request: 'Verify scorecard denominator reporting and reproducibility metadata',
      target_files: ['eval/tests/smoke_target.txt'],
      allowed_paths: ['eval/tests/smoke_target.txt'],
      visible_test_command: 'echo "SMOKE-002 test suite passed"',
      risk_level: 'LOW'
    }
  ];

  // Mock worker function that returns clean valid PatchArtifact
  const mockWorker = async (task, sandboxDir, attempt) => {
    return {
      task_id: task.task_id,
      files: [
        {
          path: task.target_files[0],
          patch: '// Verified by SPEC-EVAL-002 Smoke Test\n',
          reason: 'Pass gate'
        }
      ]
    };
  };

  const { scorecard, reportPath } = await runEvaluationBatch(sampleTasks, mockWorker, {
    useWorktree: false
  });

  console.log('\n✅ Smoke Test Finished Successfully!');
  console.log(`   Composite Score: ${scorecard.composite_score} / 100`);
  console.log(`   Report: ${reportPath}`);
}

main().catch(err => {
  console.error('Smoke test error:', err);
  process.exit(1);
});
