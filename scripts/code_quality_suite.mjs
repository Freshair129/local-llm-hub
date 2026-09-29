// scripts/code_quality_suite.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const EVAL_DIR = path.join(ROOT_DIR, 'target', 'test_eval');

if (!fs.existsSync(EVAL_DIR)) {
  fs.mkdirSync(EVAL_DIR, { recursive: true });
}

// 4 Candidate Models
// Candidate Models for Test Round 2
const MODELS = [
  { name: 'Mellum2 12B Claude Opus Think', id: 'hf.co/yuxinlu1/Mellum2-12B-A2.5B-Claude-4.6-4.8-Opus-Thinking-GGUF:Q4_K_M' },
  { name: 'Qwen3.6 12B Thinking V2', id: 'hf.co/KevinJK51/Qwen3.6-12B-IQ-Ultra-Heretic-Uncensored-Thinking-V2-Hightop-GGUF:Q4_K_M' },
  { name: 'Ternary Bonsai 27B', id: 'hf.co/prism-ml/Ternary-Bonsai-27B-gguf:Q2_0' },
  { name: 'AMD Instella MoE 16B Think', id: 'hf.co/DevQuasar/amd.Instella-MoE-16B-A3B-Think-GGUF:Q2_K' },
  { name: 'JetBrains Mellum2 12B MoE (Baseline)', id: 'hf.co/JetBrains/Mellum2-12B-A2.5B-Instruct-GGUF-Q4_K_M:Q4_K_M' }
];

// Task 1: FR-002 Model Normalization
const TASK_1 = {
  id: 'FR-002',
  name: 'Model Name Normalizer',
  prompt: `You are an AI Coder working under STD-003 and ADR-100 guard rails.
Implement this exact specification for FR-002:

Specification:
1. Function signature: pub fn normalize_model_name(raw: &str) -> String
2. Strip registry prefix: 'registry.ollama.ai/library/', 'library/', 'hf.co/'
3. Strip quantization suffixes: '-q4_0', '-q4_k_m', '-q4_k_s', ':q4_0', ':q4_k_m', ':q4_k_s' (case-insensitive)
4. Convert result to lowercase
5. Guard rails: NO unwrap(), NO expect(), NO panic!
6. Traceability: Include comment '// trace:implements FR-002' directly before function declaration.

Output ONLY valid Rust code inside a \`\`\`rust code block. No conversation.`,
  testHarness: `
#[test]
fn test_normalize_cases() {
    assert_eq!(normalize_model_name("registry.ollama.ai/library/llama3.2:1b-instruct-q4_0"), "llama3.2:1b-instruct");
    assert_eq!(normalize_model_name("hf.co/mradermacher/Qwen3.5-9B-Coder-GGUF:Q4_K_M"), "mradermacher/qwen3.5-9b-coder-gguf");
    assert_eq!(normalize_model_name("library/gemma4:12b"), "gemma4:12b");
    assert_eq!(normalize_model_name("custom-model:latest"), "custom-model:latest");
}
`
};

// Task 2: FR-006 nvidia-smi CSV Parser with Result<T, String>
const TASK_2 = {
  id: 'FR-006',
  name: 'nvidia-smi CSV Parser (Result<T, String>)',
  prompt: `You are an AI Coder working under STD-003 and ADR-100 guard rails.
Implement this exact specification for FR-006:

Specification:
1. Define struct:
#[derive(Debug, PartialEq)]
pub struct GpuStats {
    pub name: String,
    pub vram_used_mb: u64,
    pub vram_total_mb: u64,
    pub temp_c: u32,
    pub util_pct: u32,
}
2. Function signature: pub fn parse_gpu_csv(line: &str) -> Result<GpuStats, String>
3. Given a CSV line like "NVIDIA GeForce RTX 3060, 5800, 12288, 35, 25", parse it into GpuStats.
4. Robust error handling: Return Err(String) if columns are fewer than 5 or numbers fail to parse.
5. Guard rails: STRICTLY FORBIDDEN to use unwrap(), expect(), or panic! Return Err instead.
6. Traceability: Include comment '// trace:implements FR-006' directly before function declaration.

Output ONLY valid Rust code inside a \`\`\`rust code block. No conversation.`,
  testHarness: `
#[test]
fn test_parse_valid_csv() {
    let res = parse_gpu_csv("NVIDIA GeForce RTX 3060, 5800, 12288, 35, 25");
    assert!(res.is_ok());
    let stats = res.unwrap();
    assert_eq!(stats.name, "NVIDIA GeForce RTX 3060");
    assert_eq!(stats.vram_used_mb, 5800);
    assert_eq!(stats.vram_total_mb, 12288);
    assert_eq!(stats.temp_c, 35);
    assert_eq!(stats.util_pct, 25);
}

#[test]
fn test_parse_invalid_csv() {
    assert!(parse_gpu_csv("invalid,csv").is_err());
    assert!(parse_gpu_csv("GPU, not_a_number, 12288, 35, 25").is_err());
    assert!(parse_gpu_csv("").is_err());
}
`
};

function extractRustCode(text) {
  if (!text) return '';
  // Strip <think> tags
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const match = cleaned.match(/```rust([\s\S]*?)(?:```|$)/i);
  if (match) return match[1].trim();
  // fallback: if model didn't use markdown block
  const lines = cleaned.split('\n');
  const codeLines = lines.filter(l => !l.startsWith('Thinking') && !l.startsWith('<think>'));
  return codeLines.join('\n').trim();
}

function verifyGuardRails(code) {
  const issues = [];
  if (/\.unwrap\(\)/.test(code)) issues.push('Violates ADR-100: contains .unwrap()');
  if (/\.expect\(/.test(code)) issues.push('Violates ADR-100: contains .expect()');
  if (/panic!\(/.test(code)) issues.push('Violates ADR-100: contains panic!()');
  return {
    passed: issues.length === 0,
    issues
  };
}

function verifyTraceability(code, frId) {
  const re = new RegExp(`//\\s*trace:implements\\s+${frId}`, 'i');
  return re.test(code);
}

function compileAndTestRust(rustCode, testHarness, testName) {
  const fullSource = `${rustCode}\n\n${testHarness}\n`;
  const rsFile = path.join(EVAL_DIR, `${testName}.rs`);
  const exeFile = path.join(EVAL_DIR, `${testName}.exe`);

  fs.writeFileSync(rsFile, fullSource, 'utf8');

  try {
    // Compile with rustc test runner
    execSync(`rustc --test "${rsFile}" -o "${exeFile}"`, { stdio: 'pipe', timeout: 10000 });
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : err.message;
    return { compiled: false, passed: false, error: 'Compile Error: ' + stderr.slice(0, 300) };
  }

  try {
    // Run the compiled unit tests
    const runOutput = execSync(`"${exeFile}"`, { stdio: 'pipe', timeout: 10000 }).toString();
    return { compiled: true, passed: true, output: runOutput };
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : err.message;
    return { compiled: true, passed: false, error: 'Test Assertion Failure: ' + stderr.slice(0, 300) };
  }
}

async function evaluateModelOnTask(model, task) {
  console.log(`\n▶ [${model.name}] Running ${task.name}...`);
  const start = Date.now();
  
  let responseData;
  try {
    const res = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model.id,
        prompt: task.prompt,
        stream: false,
        options: { temperature: 0.1, num_predict: 800 }
      })
    });
    
    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}` };
    }
    responseData = await res.json();
  } catch (e) {
    return { success: false, error: e.message };
  }

  const durationSec = ((Date.now() - start) / 1000).toFixed(2);
  const evalCount = responseData.eval_count || 0;
  const evalDurS = (responseData.eval_duration || 1) / 1e9;
  const tps = parseFloat((evalCount / evalDurS).toFixed(1));
  const rawText = responseData.response || '';
  const rustCode = extractRustCode(rawText);

  // 1. Guard rails check
  const guard = verifyGuardRails(rustCode);
  
  // 2. Traceability check
  const trace = verifyTraceability(rustCode, task.id);
  
  // 3. Compile & Test execution check
  const safeModelName = model.name.replace(/[^a-zA-Z0-9]/g, '_');
  const testName = `${safeModelName}_${task.id}`;
  const testResult = compileAndTestRust(rustCode, task.testHarness, testName);

  console.log(`  ⚡ Speed: ${tps} t/s | Dur: ${durationSec}s`);
  console.log(`  🛡️ Guard Rails (ADR-100): ${guard.passed ? '✅ PASS' : '❌ FAIL (' + guard.issues.join(', ') + ')'}`);
  console.log(`  🏷️ Traceability (ANN-001): ${trace ? '✅ PRESENT' : '⚠️ MISSING'}`);
  console.log(`  🧪 Rust Unit Tests: ${testResult.passed ? '✅ 100% PASSED' : (testResult.compiled ? '❌ TESTS FAILED' : '❌ COMPILE ERROR')}`);

  return {
    success: true,
    tps,
    durationSec,
    evalCount,
    guardPassed: guard.passed,
    guardIssues: guard.issues,
    tracePassed: trace,
    compiled: testResult.compiled,
    testsPassed: testResult.passed,
    testError: testResult.error,
    rustCode
  };
}

async function main() {
  console.log(`========================================================================================`);
  console.log(`🧪 MULTI-DIMENSIONAL CODE QUALITY SUITE (STD-003, ADR-100, ANN-001)`);
  console.log(`   Dimensions: [1] ADR-100 Guard Rails  [2] ANN-001 Trace  [3] Real rustc & Test Run  [4] Speed`);
  console.log(`========================================================================================`);

  const summary = [];

  for (const model of MODELS) {
    console.log(`\n========================================================================================`);
    console.log(`🤖 EVALUATING MODEL: ${model.name}`);
    console.log(`   ID: ${model.id}`);
    console.log(`========================================================================================`);

    const r1 = await evaluateModelOnTask(model, TASK_1);
    const r2 = await evaluateModelOnTask(model, TASK_2);

    summary.push({
      model: model.name,
      t1: r1,
      t2: r2
    });
  }

  // Print Grand Scorecard
  console.log(`\n\n========================================================================================`);
  console.log(`🏆 GRAND SCORECARD & BENCHMARK REPORT`);
  console.log(`========================================================================================\n`);

  console.log(`| Model | T1 Speed | T1 Rust Test | T1 Guard | T2 Speed | T2 Rust Test | T2 Guard | Trace |`);
  console.log(`|---|---|---|---|---|---|---|---|`);

  for (const s of summary) {
    const t1Speed = s.t1.success ? `${s.t1.tps} t/s` : 'ERR';
    const t1Test = s.t1.testsPassed ? '✅ PASS' : (s.t1.compiled ? '❌ FAIL' : '💥 COMPILE');
    const t1Guard = s.t1.guardPassed ? '✅ SAFE' : '❌ UNWRAP';

    const t2Speed = s.t2.success ? `${s.t2.tps} t/s` : 'ERR';
    const t2Test = s.t2.testsPassed ? '✅ PASS' : (s.t2.compiled ? '❌ FAIL' : '💥 COMPILE');
    const t2Guard = s.t2.guardPassed ? '✅ SAFE' : '❌ UNWRAP';

    const trace = (s.t1.tracePassed && s.t2.tracePassed) ? '✅ BOTH' : (s.t1.tracePassed || s.t2.tracePassed ? '⚠️ 1/2' : '❌ NONE');

    console.log(`| ${s.model} | ${t1Speed} | ${t1Test} | ${t1Guard} | ${t2Speed} | ${t2Test} | ${t2Guard} | ${trace} |`);
  }

  console.log(`\n========================================================================================\n`);
}

main();
