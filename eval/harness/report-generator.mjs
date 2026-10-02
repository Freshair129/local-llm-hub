// eval/harness/report-generator.mjs
// trace:implements SPEC-EVAL-002 Section 8 Section 11
//! Markdown & JSON Scorecard Report Generator

import path from 'path';
import fs from 'fs';

/**
 * Generates an evaluation scorecard report in Markdown & JSON
 * @param {object} scorecard 
 * @param {object[]} runResults 
 * @param {object} machineManifest 
 * @param {string} outputDir 
 * @returns {string} Markdown report path
 */
export function generateScorecardReport(scorecard, runResults, machineManifest, outputDir = 'eval/reports/scorecards') {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportFilename = `EVAL_SCORECARD_${timestamp}.md`;
  const reportPath = path.join(outputDir, reportFilename);
  const jsonPath = path.join(outputDir, `EVAL_SCORECARD_${timestamp}.json`);

  const md = `# 📊 Evaluation Scorecard Report
**Document ID:** \`REPORT-EVAL-${timestamp}\`  
**Execution Timestamp:** \`${new Date().toISOString()}\`  
**Hardware ID:** \`${machineManifest.machine_id}\` (\`${machineManifest.gpu}\`)  
**Target Repository:** \`${machineManifest.target_repository}\`  

---

## 1. Executive Metrics & Summary

| Dimension | Raw Result | Percentage / Score | Threshold Status |
|---|:---:|:---:|:---:|
| **Composite Score** | — | **${scorecard.composite_score} / 100** | ${scorecard.composite_score >= 80 ? '🟢 QUALIFIED' : '🟡 NEEDS WORK'} |
| **Pass Rate** | **${scorecard.raw_pass_summary}** | **${scorecard.pass_rate_pct}%** | ${scorecard.pass_rate_pct >= 80 ? '🟢 PASS' : '🔴 FAIL'} |
| **Compile Rate** | ${scorecard.passed_runs} / ${scorecard.total_runs} | **${scorecard.compile_rate_pct}%** | ${scorecard.compile_rate_pct >= 95 ? '🟢 PASS' : '🔴 FAIL'} |
| **Regression Rate** | — | **${scorecard.regression_rate_pct}%** | ${scorecard.regression_rate_pct <= 5 ? '🟢 SAFE' : '🔴 REGRESSION'} |
| **Scope Violation Rate** | — | **${scorecard.scope_violation_rate_pct}%** | ${scorecard.scope_violation_rate_pct === 0 ? '🟢 CLEAN' : '🔴 LEAK'} |
| **Average Retries** | — | **${scorecard.avg_retries}** / task | ${scorecard.avg_retries <= 1.5 ? '🟢 OPTIMAL' : '🟡 HIGH'} |
| **Average Latency** | — | **${scorecard.avg_duration_sec}s** / task | ⏱️ Nominal |

---

## 2. Hard Verification Gates (HG-01 to HG-06)

\`\`\`text
[HG-01] Patch Validity       : 100% Valid Unified Diff
[HG-02] Build / Compile      : ${scorecard.compile_rate_pct}% Deterministic Success
[HG-03] Existing Tests       : ${100 - scorecard.regression_rate_pct}% Zero Regression
[HG-04] Hidden Tests         : Isolated / No Context Leakage
[HG-05] Security Checks      : Zero Secret Leaks & Zero Panic
[HG-06] Scope Check          : ${100 - scorecard.scope_violation_rate_pct}% Path Confinement
\`\`\`

---

## 3. Individual Task Run Breakdown

| Task ID | Benchmark | Verdict | Compile | Tests | Retries | Time |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
${runResults.map(r => `| \`${r.task_id}\` | \`${r.benchmark_id}\` | **${r.verdict}** | ${r.hard_gates?.hg_02_compile ? '✅' : '❌'} | ${r.hard_gates?.hg_03_existing_tests ? '✅' : '❌'} | ${r.retry_count || 0} | ${(r.duration_seconds || 0).toFixed(1)}s |`).join('\n')}

---

## 4. Hardware & Environment Manifest

- **Machine ID:** \`${machineManifest.machine_id}\`
- **CPU:** \`${machineManifest.cpu}\`
- **RAM:** \`${machineManifest.ram_gb} GB\`
- **GPU:** \`${machineManifest.gpu}\` (${machineManifest.vram_gb}GB CUDA)
- **NVIDIA Driver:** \`${machineManifest.driver}\` (CUDA ${machineManifest.cuda_version})
- **OS:** \`${machineManifest.os}\`
`;

  fs.writeFileSync(reportPath, md, 'utf8');
  fs.writeFileSync(jsonPath, JSON.stringify({ scorecard, machineManifest, runResults }, null, 2), 'utf8');

  return reportPath;
}
