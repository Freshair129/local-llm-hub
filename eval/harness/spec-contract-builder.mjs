// eval/harness/spec-contract-builder.mjs
// trace:implements SPEC-EVAL-002 GAP-001
//! Dynamic Spec Contract Builder & Acceptance Criteria Deriver

import path from 'path';
import fs from 'fs';

/**
 * Builds a dynamic, task-specific Spec Contract with derived Acceptance Criteria
 * @param {object} params
 * @param {string} params.taskId
 * @param {string} params.goal
 * @param {string[]} params.targetFiles
 * @param {string[]} [params.allowedPaths]
 * @param {string} [params.repoRoot]
 * @returns {object} SpecContract conforming to task.schema.json
 */
export function buildSpecContract({ taskId, goal, targetFiles, allowedPaths, repoRoot = process.cwd() }) {
  const derivedACs = [];
  let acCounter = 1;

  // 1. Goal-driven Functional Criteria
  derivedACs.push({
    id: `AC-0${acCounter++}`,
    description: `Functional Goal: "${goal}" must be fully implemented without breaking existing interfaces.`,
    critical: true
  });

  // 2. Language & Domain Specific Criteria
  const touchesRust = targetFiles.some(f => f.endsWith('.rs') || f.includes('src-tauri'));
  const touchesJS = targetFiles.some(f => f.endsWith('.js') || f.endsWith('.mjs') || f.endsWith('.html'));

  if (touchesRust) {
    derivedACs.push({
      id: `AC-0${acCounter++}`,
      description: 'Zero-Panic Policy (ADR-100): All Rust functions must return Result<T, String>; no unwrap() or panic! on runtime paths.',
      critical: true
    });
    derivedACs.push({
      id: `AC-0${acCounter++}`,
      description: 'Compilation & Test Suite: Rust crate must compile clean and all unit tests must pass.',
      critical: true
    });
  }

  if (touchesJS) {
    derivedACs.push({
      id: `AC-0${acCounter++}`,
      description: 'State & Async Safety: Unhandled promise rejection prevented; async locks cleanly released in try/finally blocks.',
      critical: true
    });
    derivedACs.push({
      id: `AC-0${acCounter++}`,
      description: 'DOM Lifecycle: DOM element access guarded against null reference when navigating views.',
      critical: false
    });
  }

  // 3. Scope Boundary Criterion
  derivedACs.push({
    id: `AC-0${acCounter++}`,
    description: `Scope Enforced: Changes strictly restricted to target files: [${targetFiles.join(', ')}].`,
    critical: true
  });

  const contract = {
    task_id: taskId,
    benchmark_id: 'PIPELINE',
    category: touchesRust ? 'Rust' : touchesJS ? 'JavaScript' : 'General',
    repo: 'Freshair129/local-llm-hub',
    base_commit: 'HEAD',
    request: goal,
    target_files: targetFiles,
    allowed_paths: allowedPaths || targetFiles,
    acceptance_criteria: derivedACs,
    visible_test_command: touchesRust ? 'cargo test --lib' : 'npm test',
    risk_level: touchesRust ? 'MEDIUM' : 'LOW',
    metadata: {
      derived_at: new Date().toISOString(),
      builder_version: '1.0.0'
    }
  };

  return contract;
}
