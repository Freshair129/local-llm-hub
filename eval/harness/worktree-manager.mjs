// eval/harness/worktree-manager.mjs
// trace:implements SPEC-EVAL-002 GAP-007
//! Git Worktree Manager for Isolated Evaluation Sandboxes

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * Checks if the primary git repository is clean (no unstaged/staged dirty changes)
 * @param {string} repoDir 
 * @returns {boolean}
 */
export function isRepositoryClean(repoDir = process.cwd()) {
  try {
    const status = execSync('git status --porcelain', { cwd: repoDir, encoding: 'utf8' }).trim();
    return status.length === 0;
  } catch (e) {
    return false;
  }
}

/**
 * Creates an isolated git worktree at a temporary path
 * @param {string} repoDir 
 * @param {string} baseCommit 
 * @returns {{ worktreePath: string, cleanup: () => void }}
 */
export function createIsolatedWorktree(repoDir = process.cwd(), baseCommit = 'HEAD') {
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const worktreePath = path.join(os.tmpdir(), `llm_eval_wt_${Date.now()}_${randomSuffix}`);

  // Create isolated worktree detached from baseCommit
  execSync(`git worktree add --detach "${worktreePath}" ${baseCommit}`, {
    cwd: repoDir,
    stdio: 'pipe'
  });

  const cleanup = () => {
    try {
      if (fs.existsSync(worktreePath)) {
        execSync(`git worktree remove --force "${worktreePath}"`, {
          cwd: repoDir,
          stdio: 'pipe'
        });
      }
    } catch (err) {
      console.warn(`Failed to clean up worktree at ${worktreePath}:`, err.message);
      // Fallback manual directory cleanup
      try {
        fs.rmSync(worktreePath, { recursive: true, force: true });
        execSync(`git worktree prune`, { cwd: repoDir, stdio: 'pipe' });
      } catch (_) {}
    }
  };

  return {
    worktreePath,
    cleanup
  };
}
