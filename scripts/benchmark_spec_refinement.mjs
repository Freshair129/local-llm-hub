// scripts/benchmark_spec_refinement.mjs
// trace:implements BENCH-SPEC-REFINE-001
import fs from 'node:fs';
import path from 'node:path';

const BENCHMARK_ID = 'BENCH-SPEC-REFINE-001';
const TARGET_FILE = 'feat-01-mellum12b-instruct.md';
const GROUND_TRUTH_FILE = 'docs/domains/network-distribution/features/FEAT-012-lan-share.md';

const SETTING_REGISTRY = {
  'SET-MELLUM-THINK-OFFICIAL': {
    id: 'SET-MELLUM-THINK-OFFICIAL',
    name: 'Official HF Thinking Preset',
    params: { temperature: 0.6, top_p: 0.95, repeat_penalty: 1.1, min_p: 0.05 }
  },
  'SET-MELLUM-INST-OFFICIAL': {
    id: 'SET-MELLUM-INST-OFFICIAL',
    name: 'Official HF Instruct Preset',
    params: { temperature: 0.6, top_p: 0.95, repeat_penalty: 1.1, min_p: 0.05 }
  },
  'SET-DETERMINISTIC-ZERO': {
    id: 'SET-DETERMINISTIC-ZERO',
    name: 'Strict Zero-Variance Code Audit',
    params: { temperature: 0.0, top_p: 1.0, repeat_penalty: 1.0, min_p: 0.0 }
  },
  'SET-CODER-PRECISE-02': {
    id: 'SET-CODER-PRECISE-02',
    name: 'Precise Technical Spec Synthesis',
    params: { temperature: 0.2, top_p: 0.95, repeat_penalty: 1.1, min_p: 0.05 }
  },
  'SET-GEMMA-SENIOR-03': {
    id: 'SET-GEMMA-SENIOR-03',
    name: 'Senior Engineering Critique',
    params: { temperature: 0.3, top_p: 0.90, repeat_penalty: 1.05, min_p: 0.05 }
  }
};

const CANDIDATE_MODELS = [
  {
    modelId: 'MODEL-MELLUM2-THINK',
    fullName: 'hf.co/JetBrains/Mellum2-12B-A2.5B-Thinking-GGUF-Q4_K_M:Q4_K_M',
    defaultSettingId: 'SET-MELLUM-THINK-OFFICIAL'
  },
  {
    modelId: 'MODEL-MELLUM2-INST',
    fullName: 'hf.co/JetBrains/Mellum2-12B-A2.5B-Instruct-GGUF-Q4_K_M:Q4_K_M',
    defaultSettingId: 'SET-MELLUM-INST-OFFICIAL'
  },
  {
    modelId: 'MODEL-QWEN35-CODER',
    fullName: 'hf.co/mradermacher/Qwen3.5-9B-Coder-GGUF:Q4_K_M',
    defaultSettingId: 'SET-CODER-PRECISE-02'
  },
  {
    modelId: 'MODEL-GEMMA4-12B',
    fullName: 'hf.co/unsloth/gemma-4-12b-it-GGUF:UD-Q4_K_XL',
    defaultSettingId: 'SET-GEMMA-SENIOR-03'
  },
  {
    modelId: 'MODEL-SUSHI-CODER',
    fullName: 'hf.co/bigatuna/Qwen3.5-9b-Sushi-Coder-RL-GGUF:Q4_K_M',
    defaultSettingId: 'SET-DETERMINISTIC-ZERO'
  }
];

async function unloadModel(modelName) {
  try {
    await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelName, keep_alive: 0 })
    });
    // CUDA synchronization sleep
    await new Promise(r => setTimeout(r, 1500));
  } catch (err) {
    // Graceful ignore
  }
}

async function runModelEvaluation(modelConfig, settingConfig, rawDraftContent, runId) {
  console.log(`\n======================================================`);
  console.log(`🚀 Executing Run ID: ${runId}`);
  console.log(`📌 Benchmark ID: ${BENCHMARK_ID}`);
  console.log(`🤖 Model ID: ${modelConfig.modelId} (${modelConfig.fullName})`);
  console.log(`⚙️  Setting ID: ${settingConfig.id} (${JSON.stringify(settingConfig.params)})`);
  console.log(`======================================================`);

  // 1. Ensure clean VRAM state before test
  await unloadModel(modelConfig.fullName);

  const systemPrompt = `You are a Senior Software Systems Architect and Code Reviewer.
Your task is to thoroughly review and refine the following draft technical specification for a Rust/Tauri application feature.
Evaluate for:
1. Formatting defects (glued lines, malformed markdown, unescaped mermaid sequence diagrams)
2. Inaccurate file paths or hallucinated component locations (e.g. nvidia-smi vs share commands)
3. Traceability to true Rust backend IPC types and unit tests
4. Recommended architectural extensions for safety and usability (e.g. PIN auth, QR code, bandwidth throttling)

Output your response in structured Markdown containing:
1. Executive Gap Analysis (pointing out specific detected defects)
2. Complete, professionally formatted and refined technical specification`;

  const userPrompt = `Here is the raw draft technical specification to review and refine:\n\n${rawDraftContent}`;

  const startTime = Date.now();

  const response = await fetch('http://127.0.0.1:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelConfig.fullName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      options: settingConfig.params,
      stream: false
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP error ${response.status}: ${await response.text()}`);
  }

  const result = await response.json();
  const durationMs = Date.now() - startTime;
  const evalCount = result.eval_count || 0;
  const evalDurationNs = result.eval_duration || 1;
  const promptEvalCount = result.prompt_eval_count || 0;
  const promptDurationNs = result.prompt_eval_duration || 1;

  const genSpeedTps = (evalCount / (evalDurationNs / 1e9)).toFixed(1);
  const promptSpeedTps = (promptEvalCount / (promptDurationNs / 1e9)).toFixed(1);

  const reply = result.message?.content || '';

  // Calculate rubric score
  let defectScore = 0;
  const replyLower = reply.toLowerCase();

  // Defect 1: Catching nvidia-smi hallucination
  const caughtNvidia = replyLower.includes('nvidia') || replyLower.includes('commands/share.rs');
  if (caughtNvidia) defectScore += 10;

  // Defect 2: Catching scanner.rs path traversal hallucination
  const caughtScanner = replyLower.includes('scanner') || replyLower.includes('safe_resolve_path');
  if (caughtScanner) defectScore += 10;

  // Defect 3: Catching telemetry logging prefix confusion
  const caughtTelemetry = replyLower.includes('telemetry') || replyLower.includes('logging');
  if (caughtTelemetry) defectScore += 8;

  // Defect 4: Fixing Mermaid diagram syntax
  const hasMermaidBlock = reply.includes('```mermaid') && reply.includes('sequenceDiagram');
  if (hasMermaidBlock) defectScore += 15;

  // Defect 5: Formatting and line separation
  const hasProperHeaders = reply.includes('## 1.') || reply.includes('# Feature');
  if (hasProperHeaders) defectScore += 15;

  // Architecture extensions
  const hasQrOrPin = replyLower.includes('qr') || replyLower.includes('pin') || replyLower.includes('throttle') || replyLower.includes('portal');
  if (hasQrOrPin) defectScore += 20;

  // Rust / Contract types
  const hasRustTypes = reply.includes('LanShareStatus') || reply.includes('LanShareConfig') || reply.includes('commands/share.rs');
  if (hasRustTypes) defectScore += 22;

  // Cleanup VRAM after test
  await unloadModel(modelConfig.fullName);

  return {
    runId,
    benchmarkId: BENCHMARK_ID,
    modelId: modelConfig.modelId,
    modelName: modelConfig.fullName,
    settingId: settingConfig.id,
    settingParams: settingConfig.params,
    durationMs,
    promptTokens: promptEvalCount,
    completionTokens: evalCount,
    genSpeedTps: parseFloat(genSpeedTps),
    promptSpeedTps: parseFloat(promptSpeedTps),
    defectScore: Math.min(100, defectScore),
    replySnippet: reply.slice(0, 400),
    fullReply: reply
  };
}

async function main() {
  const targetModelArg = process.argv[2] || 'MODEL-MELLUM2-THINK';
  const targetSettingArg = process.argv[3]; // optional custom Setting ID

  const rawDraft = fs.readFileSync(TARGET_FILE, 'utf-8');
  const timestamp = Date.now();
  const runId = `RUN-SPEC-${timestamp}`;

  const selectedModel = CANDIDATE_MODELS.find(m => m.modelId === targetModelArg || m.fullName.includes(targetModelArg));

  if (!selectedModel) {
    console.error(`❌ Model "${targetModelArg}" not found. Available models:`, CANDIDATE_MODELS.map(m => m.modelId));
    process.exit(1);
  }

  const settingId = targetSettingArg || selectedModel.defaultSettingId;
  const selectedSetting = SETTING_REGISTRY[settingId] || {
    id: settingId,
    name: 'Custom User Setting',
    params: { temperature: 0.6, top_p: 0.95 }
  };

  const res = await runModelEvaluation(selectedModel, selectedSetting, rawDraft, runId);

  // Save detailed benchmark run report
  const runReportPath = path.join('docs', 'benchmarks', 'pipeline_runs', `${runId}.md`);
  let reportContent = `# 🚀 Benchmark Execution Report: ${runId}\n\n`;
  reportContent += `| 4-Tuple Identifier | Value |\n|---|---|\n`;
  reportContent += `| **1. Benchmark ID** | \`${BENCHMARK_ID}\` |\n`;
  reportContent += `| **2. Run ID** | \`${runId}\` |\n`;
  reportContent += `| **3. Model ID** | \`${res.modelId}\` (${res.modelName}) |\n`;
  reportContent += `| **4. Setting ID** | \`${res.settingId}\` (\`temp: ${res.settingParams.temperature}, top_p: ${res.settingParams.top_p}\`) |\n`;
  reportContent += `| **Target File** | [\`${TARGET_FILE}\`](file:///d:/local-llm-hub/${TARGET_FILE}) |\n`;
  reportContent += `| **Execution Timestamp** | ${new Date(timestamp).toISOString()} |\n\n`;

  reportContent += `## Scorecard & Performance Metrics\n\n`;
  reportContent += `| Metric | Result |\n|---|:---:|\n`;
  reportContent += `| **Defect & Refinement Score** | **${res.defectScore}/100** |\n`;
  reportContent += `| **Generation Speed** | **${res.genSpeedTps} t/s** |\n`;
  reportContent += `| **Prompt Processing Speed** | **${res.promptSpeedTps} t/s** |\n`;
  reportContent += `| **Completion Tokens** | ${res.completionTokens} tokens |\n`;
  reportContent += `| **Total Wall Duration** | ${(res.durationMs / 1000).toFixed(1)}s |\n\n`;

  reportContent += `## Refined Output Generated by Model\n\n`;
  reportContent += `\`\`\`markdown\n${res.fullReply}\n\`\`\`\n\n`;

  fs.mkdirSync(path.dirname(runReportPath), { recursive: true });
  fs.writeFileSync(runReportPath, reportContent, 'utf-8');

  console.log(`\n✅ Benchmark Run Complete!`);
  console.log(`📄 Report saved to: ${runReportPath}`);
  console.table([{
    RunID: res.runId,
    BenchmarkID: res.benchmarkId,
    ModelID: res.modelId,
    SettingID: res.settingId,
    Score: `${res.defectScore}/100`,
    Speed: `${res.genSpeedTps} t/s`,
    Duration: `${(res.durationMs / 1000).toFixed(1)}s`
  }]);
}

main().catch(console.error);
