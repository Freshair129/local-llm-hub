// eval/harness/test-runner.mjs
// trace:implements SPEC-EVAL-002 HG-02 HG-03 HG-04 GAP-005
//! Deterministic Test Runner & Compiler Execution Gate

import { spawn } from 'child_process';
import path from 'path';

/**
 * Runs a deterministic command (e.g. `cargo test`, `npm test`) inside a sandbox directory
 * @param {string} commandLine 
 * @param {string} cwd 
 * @param {number} timeoutMs 
 * @returns {Promise<{ success: boolean, exitCode: number, stdout: string, stderr: string, durationMs: number }>}
 */
export async function runDeterministicTest(commandLine, cwd = process.cwd(), timeoutMs = 120000) {
  const start = Date.now();

  return new Promise((resolve) => {
    // On Windows, run through powershell.exe or cmd.exe
    const isWin = process.platform === 'win32';
    const shellCmd = isWin ? 'powershell.exe' : '/bin/sh';
    const shellArgs = isWin ? ['-NoProfile', '-Command', commandLine] : ['-c', commandLine];

    // Ensure D:\tmp or temp dir is set to prevent out of disk space error on C:
    const env = { ...process.env };
    if (isWin) {
      env.TMP = env.TMP || 'D:\\tmp';
      env.TEMP = env.TEMP || 'D:\\tmp';
    }

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const child = spawn(shellCmd, shellArgs, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        if (isWin) {
          spawn('taskkill', ['/pid', child.pid.toString(), '/f', '/t']);
        } else {
          child.kill('SIGKILL');
        }
      } catch (_) {}
    }, timeoutMs);

    child.stdout.on('data', chunk => stdout += chunk.toString());
    child.stderr.on('data', chunk => stderr += chunk.toString());

    child.on('close', (code) => {
      clearTimeout(timer);
      const durationMs = Date.now() - start;

      if (timedOut) {
        resolve({
          success: false,
          exitCode: -1,
          stdout,
          stderr: stderr + `\n[TIMEOUT] Command exceeded ${timeoutMs}ms limit`,
          durationMs
        });
      } else {
        resolve({
          success: code === 0,
          exitCode: code || 0,
          stdout,
          stderr,
          durationMs
        });
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        success: false,
        exitCode: -2,
        stdout,
        stderr: err.message,
        durationMs: Date.now() - start
      });
    });
  });
}

/**
 * High-level Hard Verification Gate runner
 * Evaluates HG-02 (compile), HG-03 (regression tests), and HG-04 (hidden tests)
 * @param {string} projectDir 
 * @param {{ visibleCommand?: string, hiddenCommand?: string }} options 
 * @returns {Promise<{ hg_02_compile: boolean, hg_03_existing_tests: boolean, hg_04_hidden_tests: boolean, logs: object }>}
 */
export async function executeHardVerificationGates(projectDir, options = {}) {
  const logs = {};

  // 1. Detect project type if no explicit commands provided
  const hasCargo = path.resolve(projectDir, 'src-tauri', 'Cargo.toml') || path.resolve(projectDir, 'Cargo.toml');
  const hasPackageJson = path.resolve(projectDir, 'package.json');

  let testCmd = options.visibleCommand;
  if (!testCmd) {
    if (hasCargo) {
      testCmd = 'cargo test --lib';
    } else if (hasPackageJson) {
      testCmd = 'npm test';
    } else {
      testCmd = 'echo "No build system detected"';
    }
  }

  // Execute existing / visible regression suite (HG-02 & HG-03)
  const regResult = await runDeterministicTest(testCmd, projectDir);
  logs.regression_test = regResult;

  const hg_02_compile = !regResult.stderr.includes('error: could not compile') && regResult.exitCode !== 101;
  const hg_03_existing_tests = regResult.success;

  let hg_04_hidden_tests = true;
  if (options.hiddenCommand) {
    const hiddenResult = await runDeterministicTest(options.hiddenCommand, projectDir);
    logs.hidden_test = hiddenResult;
    hg_04_hidden_tests = hiddenResult.success;
  }

  return {
    hg_02_compile,
    hg_03_existing_tests,
    hg_04_hidden_tests,
    logs
  };
}
