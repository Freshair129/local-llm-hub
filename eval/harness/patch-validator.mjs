// eval/harness/patch-validator.mjs
// trace:implements SPEC-EVAL-002 HG-01 HG-06 GAP-003
//! Patch Validator & Unified Diff Application Guard

import path from 'path';
import fs from 'fs';

/**
 * Validates a PatchArtifact against schema and scope constraints
 * @param {object} patchArtifact 
 * @param {string[]} allowedPaths 
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePatchArtifact(patchArtifact, allowedPaths = []) {
  const errors = [];

  if (!patchArtifact || typeof patchArtifact !== 'object') {
    return { valid: false, errors: ['PatchArtifact must be an object'] };
  }

  if (!patchArtifact.task_id) {
    errors.push('Missing task_id in PatchArtifact');
  }

  if (!Array.isArray(patchArtifact.files) || patchArtifact.files.length === 0) {
    errors.push('PatchArtifact must contain at least one file entry in files array');
    return { valid: false, errors };
  }

  const normalizedAllowed = allowedPaths.map(p => path.normalize(p).toLowerCase().replace(/^[\\/]+/, ''));

  for (const [idx, fileEntry] of patchArtifact.files.entries()) {
    if (!fileEntry.path) {
      errors.push(`File entry [${idx}] is missing path`);
      continue;
    }

    const normPath = path.normalize(fileEntry.path).toLowerCase().replace(/^[\\/]+/, '');

    // HG-01 Path traversal guard
    if (normPath.includes('..') || path.isAbsolute(fileEntry.path)) {
      errors.push(`Path traversal detected in file [${fileEntry.path}]`);
    }

    // HG-06 Scope check against allowed paths
    if (normalizedAllowed.length > 0) {
      const isAllowed = normalizedAllowed.some(allowed => 
        normPath === allowed || normPath.startsWith(allowed + path.sep)
      );
      if (!isAllowed) {
        errors.push(`Scope violation: file [${fileEntry.path}] is outside allowed_paths`);
      }
    }

    if (typeof fileEntry.patch !== 'string' || fileEntry.patch.trim().length === 0) {
      errors.push(`File [${fileEntry.path}] contains empty or invalid patch content`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Applies a verified PatchArtifact into a target directory (or worktree)
 * Supports whole file replacement or unified diff
 * @param {string} targetDir 
 * @param {object} patchArtifact 
 * @returns {{ success: boolean, appliedFiles: string[], error?: string }}
 */
export function applyPatchToDirectory(targetDir, patchArtifact) {
  const appliedFiles = [];

  try {
    for (const fileEntry of patchArtifact.files) {
      const fullPath = path.join(targetDir, fileEntry.path);
      const fileDir = path.dirname(fullPath);

      if (!fs.existsSync(fileDir)) {
        fs.mkdirSync(fileDir, { recursive: true });
      }

      // Check if patch is unified diff or full replacement code
      const patchText = fileEntry.patch;
      if (patchText.startsWith('---') && patchText.includes('+++') && patchText.includes('@@')) {
        // Unified diff: parse chunks or write out patch file
        applyUnifiedDiff(fullPath, patchText);
      } else {
        // Whole file content replacement or clean snippet
        fs.writeFileSync(fullPath, patchText, 'utf8');
      }

      appliedFiles.push(fileEntry.path);
    }

    return { success: true, appliedFiles };
  } catch (err) {
    return { success: false, appliedFiles, error: err.message || String(err) };
  }
}

/**
 * Basic unified diff patch applier for single file
 */
function applyUnifiedDiff(targetFilePath, diffText) {
  if (!fs.existsSync(targetFilePath)) {
    // If new file created via diff
    const addedLines = diffText.split('\n')
      .filter(l => l.startsWith('+') && !l.startsWith('+++'))
      .map(l => l.substring(1));
    fs.writeFileSync(targetFilePath, addedLines.join('\n'), 'utf8');
    return;
  }

  const originalContent = fs.readFileSync(targetFilePath, 'utf8');
  const originalLines = originalContent.split(/\r?\n/);
  
  // Extract chunks from diff
  const lines = diffText.split('\n');
  let newLines = [];
  let origIdx = 0;
  let inHunk = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('@@')) {
      inHunk = true;
      continue;
    }
    if (!inHunk) continue;

    if (line.startsWith('+')) {
      newLines.push(line.substring(1));
    } else if (line.startsWith('-')) {
      origIdx++;
    } else {
      newLines.push(line.startsWith(' ') ? line.substring(1) : line);
      origIdx++;
    }
  }

  if (newLines.length > 0) {
    fs.writeFileSync(targetFilePath, newLines.join('\n'), 'utf8');
  }
}
