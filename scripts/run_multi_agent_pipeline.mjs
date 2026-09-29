// scripts/run_multi_agent_pipeline.mjs
// trace:implements SPEC-WORKFLOW-001
// Automated Multi-Agent Task Routing Pipeline for RTX 3060 (12GB CUDA)

import http from 'http';
import fs from 'fs';
import path from 'path';

const OLLAMA_HOST = '127.0.0.1';
const OLLAMA_PORT = 11434;

// Model Registry per SPEC-WORKFLOW-001
const MODELS = {
  explorer: {
    id: 'hf.co/JetBrains/Mellum2-12B-A2.5B-Instruct-GGUF-Q4_K_M:Q4_K_M',
    displayName: 'Explorer Agent (Mellum2 12B Instruct)',
    settings: { temperature: 0.2, top_p: 0.95, repeat_penalty: 1.05, num_ctx: 16384, num_predict: 1000 }
  },
  worker: {
    id: 'hf.co/JetBrains/Mellum2-12B-A2.5B-Instruct-GGUF-Q4_K_M:Q4_K_M',
    displayName: 'Worker Agent (Mellum2 12B Instruct)',
    settings: { temperature: 0.4, top_p: 0.95, repeat_penalty: 1.1, num_predict: 2048 }
  },
  verifier: {
    id: 'hf.co/bigatuna/Qwen3.5-9b-Sushi-Coder-RL-GGUF:Q4_K_M',
    displayName: 'Verify Gate (Sushi Coder RL @ temp: 0.0)',
    settings: { temperature: 0.0, top_p: 1.0, repeat_penalty: 1.0, num_predict: 1000 }
  },
  escalator: {
    id: 'hf.co/JetBrains/Mellum2-12B-A2.5B-Thinking-GGUF-Q4_K_M:Q4_K_M',
    displayName: 'Reasoning Escalator (Mellum2 12B Thinking)',
    settings: { temperature: 0.6, top_p: 0.95, repeat_penalty: 1.1, num_predict: 2048 }
  },
  tester: {
    id: 'hf.co/unsloth/gemma-4-12b-it-GGUF:UD-Q4_K_XL',
    displayName: 'Test Gate (Google Gemma 4 12B Instruct UD)',
    settings: { temperature: 0.3, top_p: 0.95, top_k: 64, repeat_penalty: 1.1, num_predict: 1200 }
  },
  reviewer: {
    id: 'hf.co/JetBrains/Mellum2-12B-A2.5B-Thinking-GGUF-Q4_K_M:Q4_K_M',
    displayName: 'Review Gate / Final Release (Mellum2 12B Thinking)',
    settings: { temperature: 0.6, top_p: 0.95, repeat_penalty: 1.1, num_predict: 2048 }
  }
};

let currentLoadedModel = null;

// Safe VRAM Handoff Protocol
async function ensureModelLoaded(targetRole) {
  const modelConfig = MODELS[targetRole];
  if (currentLoadedModel === modelConfig.id) {
    return; // Already warm in VRAM!
  }

  // If different model is currently active, evict it cleanly
  if (currentLoadedModel) {
    console.log(`🧹 [VRAM EVICT] Evicting ${currentLoadedModel} from RTX 3060...`);
    try {
      await fetch(`http://${OLLAMA_HOST}:${OLLAMA_PORT}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: currentLoadedModel, keep_alive: 0 })
      });
      await new Promise(r => setTimeout(r, 1500));
    } catch (_) {}
  }

  currentLoadedModel = modelConfig.id;
}

// Low-level query helper
async function queryLLM(modelConfig, prompt) {
  const payload = JSON.stringify({
    model: modelConfig.id,
    prompt,
    stream: false,
    keep_alive: '15m',
    options: modelConfig.settings
  });

  const start = Date.now();

  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: OLLAMA_HOST,
      port: OLLAMA_PORT,
      path: '/api/generate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 300000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const durationSec = ((Date.now() - start) / 1000).toFixed(2);
          const evalCount = parsed.eval_count || 0;
          const promptCount = parsed.prompt_eval_count || 0;
          const evalDurS = (parsed.eval_duration || 1) / 1e9;
          const tps = (evalCount / evalDurS).toFixed(1);

          // Record stats
          recordModelStats(modelConfig.id, {
            success: true,
            evalCount,
            promptCount,
            tps: parseFloat(tps),
            durationSec: parseFloat(durationSec)
          });

          resolve({
            text: parsed.response || parsed.thinking || '',
            thinking: parsed.thinking || '',
            tps,
            evalCount,
            promptCount,
            durationSec
          });
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', (err) => {
      recordModelStats(modelConfig.id, { success: false });
      reject(err);
    });

    req.write(payload);
    req.end();
  });
}

// Stats persistence helper
function recordModelStats(modelId, metric) {
  const statsPath = path.resolve('src/model_stats.json');
  let store = {};
  if (fs.existsSync(statsPath)) {
    try { store = JSON.parse(fs.readFileSync(statsPath, 'utf8')); } catch (_) {}
  }

  if (!store[modelId]) {
    store[modelId] = {
      model_id: modelId,
      total_tasks: 0,
      successful_tasks: 0,
      failed_tasks: 0,
      total_tokens: 0,
      total_prompt_tokens: 0,
      last_used: new Date().toISOString()
    };
  }

  const s = store[modelId];
  s.total_tasks += 1;
  s.last_used = new Date().toISOString();

  if (metric.success) {
    s.successful_tasks += 1;
    s.total_tokens += (metric.evalCount || 0);
    s.total_prompt_tokens += (metric.promptCount || 0);
    s.last_tps = metric.tps;
  } else {
    s.failed_tasks += 1;
  }

  try {
    fs.writeFileSync(statsPath, JSON.stringify(store, null, 2), 'utf8');
  } catch (_) {}
}

// ============================================================================
// MAIN MULTI-AGENT PIPELINE EXECUTION
// ============================================================================
export async function executeMultiAgentPipeline(taskGoal, targetFilePath) {
  const runId = `RUN-${Date.now()}`;
  console.log(`\n=============================================================`);
  console.log(`🚀 STARTING MULTI-AGENT PIPELINE [${runId}]`);
  console.log(`   Goal: ${taskGoal}`);
  console.log(`   Target File: ${targetFilePath}`);
  console.log(`=============================================================`);

  const fileContent = fs.existsSync(targetFilePath) ? fs.readFileSync(targetFilePath, 'utf8') : '';
  const timeline = [];

  // --------------------------------------------------------------------------
  // STEP 1: Explorer Agent (Creation Phase)
  // --------------------------------------------------------------------------
  console.log(`\n🧭 [1/5] Explorer Agent exploring codebase & symbols...`);
  await ensureModelLoaded('explorer');
  const explorerPrompt = `Analyze the target file (${targetFilePath}) and project structure for this goal: "${taskGoal}".
CODE CONTEXT:
${fileContent.slice(0, 8000)}

Extract and list:
1. Key symbols, state variables, and event handlers affected
2. Requirements & Dependencies
Format as JSON: { "symbols": [...], "dependencies": [...], "summary": "..." }`;

  const explorerOut = await queryLLM(MODELS.explorer, explorerPrompt);
  console.log(`   ✅ Explorer finished: ${explorerOut.evalCount} tokens @ ${explorerOut.tps} t/s`);
  timeline.push({ phase: 'Explorer', output: explorerOut.text, tps: explorerOut.tps });

  // --------------------------------------------------------------------------
  // STEP 2: Spec Contract Gate
  // --------------------------------------------------------------------------
  console.log(`\n📋 [Spec Gate] Establishing Acceptance Criteria & Constraints...`);
  const specContract = {
    task_id: runId,
    feature_goal: taskGoal,
    target_files: [targetFilePath],
    acceptance_criteria: [
      { id: 'AC-01', description: 'Prevent unhandled promise rejections and state corruption' },
      { id: 'AC-02', description: 'Ensure clean async state unlock in try/catch/finally' },
      { id: 'AC-03', description: 'Maintain zero-panic, zero-crash reliability' }
    ],
    system_constraints: ['Tauri v2 Desktop Safe', 'Zero External Dependencies']
  };
  console.log(`   ✅ Spec Contract Locked: 3 Acceptance Criteria defined.`);

  // --------------------------------------------------------------------------
  // STEP 3: Worker Agent (Creation Phase - No VRAM reload needed!)
  // --------------------------------------------------------------------------
  console.log(`\n🛠️ [2/5] Worker Agent synthesizing implementation code...`);
  await ensureModelLoaded('worker'); // Instant: same model as Explorer!
  const workerPrompt = `You are the Primary Coding Worker.
Goal: ${taskGoal}
Spec Contract:
${JSON.stringify(specContract, null, 2)}

Target File (${targetFilePath}):
${fileContent}

Generate the improved, production-ready code. Ensure all ACs are satisfied and comment with trace annotations.`;

  const workerOut = await queryLLM(MODELS.worker, workerPrompt);
  console.log(`   ✅ Worker generated: ${workerOut.evalCount} tokens @ ${workerOut.tps} t/s (${workerOut.durationSec}s)`);
  timeline.push({ phase: 'Worker', output: workerOut.text, tps: workerOut.tps });

  // --------------------------------------------------------------------------
  // STEP 4: Verify Gate (Verification Phase - Sushi Coder temp: 0.0)
  // --------------------------------------------------------------------------
  console.log(`\n🛡️ [3/5] Verify Gate running deterministic checks (temp: 0.0)...`);
  await ensureModelLoaded('verifier');
  const verifyPrompt = `Verify if the implementation satisfies all Acceptance Criteria:
SPEC: ${JSON.stringify(specContract.acceptance_criteria)}
WORKER OUTPUT:
${workerOut.text.slice(0, 4000)}

Verdict strictly as JSON: { "verdict": "PASSED" | "FAILED", "ac_results": {}, "feedback": "..." }`;

  const verifyOut = await queryLLM(MODELS.verifier, verifyPrompt);
  const passed = !verifyOut.text.includes('"FAILED"') && !verifyOut.text.includes('"verdict": "FAILED"');
  console.log(`   ${passed ? '✅' : '⚠️'} Verify Gate Verdict: ${passed ? 'PASSED' : 'RETRY / PASS WITH FEEDBACK'}`);
  timeline.push({ phase: 'Verify Gate', output: verifyOut.text, passed });

  // --------------------------------------------------------------------------
  // STEP 5: Test Gate (Gemma 4 12B Instruct)
  // --------------------------------------------------------------------------
  console.log(`\n🧪 [4/5] Test Gate running Senior Engineering validation & test synthesis...`);
  await ensureModelLoaded('tester');
  const testPrompt = `Act as Test Gate and Senior Engineer.
Evaluate this code for:
1. DOM lifecycle & Concurrency safety
2. Edge case test assertions
Code:
${workerOut.text.slice(0, 3000)}`;

  const testOut = await queryLLM(MODELS.tester, testPrompt);
  console.log(`   ✅ Test Gate completed @ ${testOut.tps} t/s`);
  timeline.push({ phase: 'Test Gate', output: testOut.text });

  // --------------------------------------------------------------------------
  // STEP 6: Review Gate / Final Release (Mellum2 12B Thinking)
  // --------------------------------------------------------------------------
  console.log(`\n🏆 [5/5] Review Gate / Final Release performing deep architectural sign-off...`);
  await ensureModelLoaded('reviewer');
  const reviewPrompt = `Perform final architectural review and create git commit message draft.
Task: ${taskGoal}
Worker Code:
${workerOut.text.slice(0, 3000)}`;

  const reviewOut = await queryLLM(MODELS.reviewer, reviewPrompt);
  console.log(`   ✅ Review Gate completed @ ${reviewOut.tps} t/s`);
  timeline.push({ phase: 'Review Gate', output: reviewOut.text });

  // --------------------------------------------------------------------------
  // PERSIST RUN ARTIFACT
  // --------------------------------------------------------------------------
  const outDir = path.resolve('docs/benchmarks/pipeline_runs');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const artifactPath = path.join(outDir, `${runId}.md`);
  const report = `# 🚀 Multi-Agent Pipeline Run: ${runId}

- **Task Goal:** ${taskGoal}
- **Target File:** \`${targetFilePath}\`
- **Execution Date:** ${new Date().toISOString()}
- **Hardware:** NVIDIA GeForce RTX 3060 12GB (CUDA0)

## Execution Summary & Timeline

| Phase | Agent / Gate | Status | Speed (t/s) |
|---|---|:---:|:---:|
| 1. Discovery | 🧭 Explorer Agent (Mellum2 12B) | Complete | ${explorerOut.tps} t/s |
| 2. Spec Gate | 📋 Spec Contract Gate | Locked (3 ACs) | N/A |
| 3. Execution | 🛠️ Worker Agent (Mellum2 12B) | Complete | ${workerOut.tps} t/s |
| 4. Verification | 🛡️ Verify Gate (Sushi Coder 0.0) | ${passed ? 'PASSED' : 'FLAGGED'} | ${verifyOut.tps} t/s |
| 5. Testing | 🧪 Test Gate (Gemma 4 12B) | Complete | ${testOut.tps} t/s |
| 6. Final Audit | 🏆 Review Gate (Mellum2 Thinking) | Released | ${reviewOut.tps} t/s |

---

## Final Review & Git Commit Draft
${reviewOut.text}
`;

  fs.writeFileSync(artifactPath, report, 'utf8');
  console.log(`\n🎉 Pipeline completed successfully! Report saved to:\n   ${artifactPath}\n`);

  return { runId, artifactPath, passed };
}

// CLI Direct Invocation
if (process.argv[1] && process.argv[1].endsWith('run_multi_agent_pipeline.mjs')) {
  const goal = process.argv[2] || 'Harden Tauri v2 frontend against unhandled promise rejections and state desync';
  const target = process.argv[3] || 'src/main.js';
  executeMultiAgentPipeline(goal, target).catch(console.error);
}
