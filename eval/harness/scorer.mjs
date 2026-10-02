// eval/harness/scorer.mjs
// trace:implements SPEC-EVAL-002 Section 11 Section 12
//! Hardened Scoring Engine & Composite Metrics Evaluator

/**
 * Calculates raw metrics and composite score for an evaluation batch
 * @param {object[]} runResults 
 * @param {object} thresholds 
 * @returns {object} Scorecard summary
 */
export function calculateBatchScorecard(runResults = [], thresholds = {}) {
  const totalRuns = runResults.length;
  if (totalRuns === 0) {
    return {
      total_runs: 0,
      passed_runs: 0,
      pass_rate: 0,
      composite_score: 0,
      breakdown: {}
    };
  }

  let passedCount = 0;
  let compilePassedCount = 0;
  let regressionPassedCount = 0;
  let scopeCleanCount = 0;
  let totalRetries = 0;
  let totalDurationSec = 0;
  let totalTokens = 0;

  for (const res of runResults) {
    if (res.verdict === 'PASS') passedCount++;
    if (res.hard_gates?.hg_02_compile) compilePassedCount++;
    if (res.hard_gates?.hg_03_existing_tests) regressionPassedCount++;
    if (res.hard_gates?.hg_06_scope_clean) scopeCleanCount++;
    totalRetries += (res.retry_count || 0);
    totalDurationSec += (res.duration_seconds || 0);
    if (res.tokens?.total_tokens) totalTokens += res.tokens.total_tokens;
  }

  const passRate = (passedCount / totalRuns) * 100;
  const compileRate = (compilePassedCount / totalRuns) * 100;
  const regressionRate = ((totalRuns - regressionPassedCount) / totalRuns) * 100;
  const scopeViolationRate = ((totalRuns - scopeCleanCount) / totalRuns) * 100;
  const avgRetries = (totalRetries / totalRuns);
  const medianTimeSec = (totalDurationSec / totalRuns);

  // Composite Score per SPEC-EVAL-002 Section 11
  // Correctness (30%), Repo Success (25%), Regression Safety (15%), Review Accuracy (15%), Efficiency/Cost (10%), Latency (5%)
  const weights = thresholds.composite_weights || {
    correctness: 0.30,
    repo_success: 0.25,
    regression_safety: 0.15,
    review_accuracy: 0.15,
    efficiency_cost: 0.10,
    latency: 0.05
  };

  const correctnessScore = compileRate;
  const repoSuccessScore = passRate;
  const regressionSafetyScore = Math.max(0, 100 - regressionRate);
  const reviewAccuracyScore = 85.0; // Baseline or from BASE-6
  const efficiencyScore = Math.max(0, 100 - (avgRetries * 20));
  const latencyScore = Math.max(0, 100 - (medianTimeSec > 120 ? 50 : medianTimeSec / 2.4));

  const compositeScore = (
    correctnessScore * weights.correctness +
    repoSuccessScore * weights.repo_success +
    regressionSafetyScore * weights.regression_safety +
    reviewAccuracyScore * weights.review_accuracy +
    efficiencyScore * weights.efficiency_cost +
    latencyScore * weights.latency
  );

  return {
    total_runs: totalRuns,
    passed_runs: passedCount,
    failed_runs: totalRuns - passedCount,
    raw_pass_summary: `${passedCount} / ${totalRuns} tasks passed`,
    pass_rate_pct: parseFloat(passRate.toFixed(1)),
    compile_rate_pct: parseFloat(compileRate.toFixed(1)),
    regression_rate_pct: parseFloat(regressionRate.toFixed(1)),
    scope_violation_rate_pct: parseFloat(scopeViolationRate.toFixed(1)),
    avg_retries: parseFloat(avgRetries.toFixed(2)),
    avg_duration_sec: parseFloat(medianTimeSec.toFixed(1)),
    total_tokens: totalTokens,
    composite_score: parseFloat(compositeScore.toFixed(1)),
    breakdown: {
      correctness: parseFloat(correctnessScore.toFixed(1)),
      repo_success: parseFloat(repoSuccessScore.toFixed(1)),
      regression_safety: parseFloat(regressionSafetyScore.toFixed(1)),
      efficiency: parseFloat(efficiencyScore.toFixed(1))
    }
  };
}
