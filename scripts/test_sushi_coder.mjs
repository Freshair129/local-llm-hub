// scripts/test_sushi_coder.mjs
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

const MODELS = [
  { name: 'Sushi Coder RL 9B (Q4_K_M)', id: 'hf.co/bigatuna/Qwen3.5-9b-Sushi-Coder-RL-GGUF:Q4_K_M' },
  { name: 'JetBrains Mellum2 12B MoE (Baseline)', id: 'hf.co/JetBrains/Mellum2-12B-A2.5B-Instruct-GGUF-Q4_K_M:Q4_K_M' }
];

const TASK_1 = {
  id: 'FR-002',
  name: 'Model Name Normalizer (FR-002)',
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

const TASK_2 = {
  id: 'FR-006',
  name: 'nvidia-smi CSV Parser with Result<T, String> (FR-006)',
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
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const match = cleaned.match(/```rust([\s\S]*?)(?:```|$)/i);
  if (match) return match[1].trim();
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
    execSync(`rustc --test "${rsFile}" -o "${exeFile}"`, { stdio: 'pipe', timeout: 15000 });
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : err.message;
    return { compiled: false, passed: false, error: 'Compile Error: ' + stderr.slice(0, 300) };
  }

  try {
    const runOutput = execSync(`"${exeFile}"`, { stdio: 'pipe', timeout: 15000 }).toString();
    return { compiled: true, passed: true, output: runOutput };
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : err.message;
    return { compiled: true, passed: false, error: 'Test Failure: ' + stderr.slice(0, 300) };
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
        options: { temperature: 0.1, num_predict: 1000 }
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

  const guard = verifyGuardRails(rustCode);
  const trace = verifyTraceability(rustCode, task.id);
  const safeModelName = model.name.replace(/[^a-zA-Z0-9]/g, '_');
  const testName = `${safeModelName}_${task.id}`;
  const testResult = compileAndTestRust(rustCode, task.testHarness, testName);

  console.log(`  ⚡ Speed: ${tps} t/s | Dur: ${durationSec}s | Tokens: ${evalCount}`);
  console.log(`  🛡️ Guard Rails (ADR-100): ${guard.passed ? '✅ PASS' : '❌ FAIL (' + guard.issues.join(', ') + ')'}`);
  console.log(`  🏷️ Traceability (ANN-001): ${trace ? '✅ PRESENT' : '⚠️ MISSING'}`);
  console.log(`  🧪 Rust Unit Tests: ${testResult.passed ? '✅ 100% PASSED' : (testResult.compiled ? '❌ TESTS FAILED: ' + testResult.error : '❌ COMPILE ERROR: ' + testResult.error)}`);

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
  console.log(`🍣 EMPIRICAL BENCHMARK SUITE: Sushi Coder RL 9B vs Mellum2 12B Baseline`);
  console.log(`========================================================================================`);

  for (const model of MODELS) {
    console.log(`\n========================================================================================`);
    console.log(`🔍 EVALUATING: ${model.name}`);
    console.log(`========================================================================================`);

    const r1 = await evaluateModelOnTask(model, TASK_1);
    const r2 = await evaluateModelOnTask(model, TASK_2);

    console.log(`\n📋 SUMMARY FOR ${model.name}:`);
    console.log(`  - Task 1: ${r1.testsPassed ? 'PASSED ✅' : 'FAILED ❌'} (Guard: ${r1.guardPassed ? 'OK' : 'FAIL'}, Trace: ${r1.tracePassed ? 'OK' : 'MISSING'})`);
    console.log(`  - Task 2: ${r2.testsPassed ? 'PASSED ✅' : 'FAILED ❌'} (Guard: ${r2.guardPassed ? 'OK' : 'FAIL'}, Trace: ${r2.tracePassed ? 'OK' : 'MISSING'})`);
    console.log(`  - Average Speed: ${((r1.tps + r2.tps) / 2).toFixed(1)} t/s`);
  }
}

main().catch(console.error);
