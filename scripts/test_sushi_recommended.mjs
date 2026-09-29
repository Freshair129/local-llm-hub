// scripts/test_sushi_recommended.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const EVAL_DIR = path.join(ROOT_DIR, 'target', 'test_eval');

async function testTask(taskName, prompt, testHarness) {
  console.log(`\n▶ Testing ${taskName} with HF Recommended Settings...`);
  const start = Date.now();
  
  const res = await fetch('http://127.0.0.1:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'hf.co/bigatuna/Qwen3.5-9b-Sushi-Coder-RL-GGUF:Q4_K_M',
      messages: [
        { role: 'user', content: prompt }
      ],
      stream: false,
      options: {
        temperature: 0.2,
        top_p: 0.95,
        num_ctx: 16384,
        num_predict: 2048
      }
    })
  });

  const data = await res.json();
  const raw = data.message?.content || '';
  const evalCount = data.eval_count || 0;
  const evalDurS = (data.eval_duration || 1) / 1e9;
  const tps = parseFloat((evalCount / evalDurS).toFixed(1));

  const thinkMatch = raw.match(/<think>([\s\S]*?)<\/think>/i);
  const thinkTokensRough = thinkMatch ? thinkMatch[1].split(/\s+/).length : 0;
  const cleanCode = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  let codeBlock = cleanCode;
  const match = cleanCode.match(/```rust([\s\S]*?)```/i);
  if (match) codeBlock = match[1].trim();

  console.log(`  ⚡ Speed: ${tps} t/s | Total Gen Tokens: ${evalCount}`);
  console.log(`  🧠 Thinking Words: ~${thinkTokensRough}`);

  // Test compilation
  const rsFile = path.join(EVAL_DIR, `sushi_rec_${taskName}.rs`);
  const exeFile = path.join(EVAL_DIR, `sushi_rec_${taskName}.exe`);
  fs.writeFileSync(rsFile, `${codeBlock}\n\n${testHarness}\n`, 'utf8');

  try {
    execSync(`rustc --test "${rsFile}" -o "${exeFile}"`, { stdio: 'pipe', timeout: 15000 });
    const runOut = execSync(`"${exeFile}"`, { stdio: 'pipe', timeout: 15000 }).toString();
    console.log(`  🧪 Rust Unit Test: ✅ PASSED!`);
    return { passed: true, tps, code: codeBlock };
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : err.message;
    console.log(`  🧪 Rust Unit Test: ❌ FAILED: ${stderr.slice(0, 200)}`);
    return { passed: false, tps, code: codeBlock, error: stderr.slice(0, 200) };
  }
}

async function main() {
  const p1 = `You are an AI Coder working under STD-003 and ADR-100 guard rails.
Implement this exact specification for FR-002:

Specification:
1. Function signature: pub fn normalize_model_name(raw: &str) -> String
2. Strip registry prefixes: 'registry.ollama.ai/library/', 'library/', 'hf.co/'
3. Strip quantization suffixes: '-q4_0', '-q4_k_m', '-q4_k_s', ':q4_0', ':q4_k_m', ':q4_k_s' (case-insensitive)
4. Convert result to lowercase
5. Guard rails: NO unwrap(), NO expect(), NO panic!
6. Traceability: Include comment '// trace:implements FR-002' directly before function declaration.

Output ONLY valid Rust code inside a \`\`\`rust code block. Do NOT include text commentary inside the code block.`;

  const h1 = `
#[test]
fn test_normalize_cases() {
    assert_eq!(normalize_model_name("registry.ollama.ai/library/llama3.2:1b-instruct-q4_0"), "llama3.2:1b-instruct");
    assert_eq!(normalize_model_name("hf.co/mradermacher/Qwen3.5-9B-Coder-GGUF:Q4_K_M"), "mradermacher/qwen3.5-9b-coder-gguf");
    assert_eq!(normalize_model_name("library/gemma4:12b"), "gemma4:12b");
    assert_eq!(normalize_model_name("custom-model:latest"), "custom-model:latest");
}
`;

  const p2 = `You are an AI Coder working under STD-003 and ADR-100 guard rails.
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
7. CRITICAL: Output BOTH the 'pub struct GpuStats' AND 'pub fn parse_gpu_csv' inside the \`\`\`rust code block.

Output ONLY valid Rust code inside a \`\`\`rust code block.`;

  const h2 = `
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
`;

  await testTask("FR-002", p1, h1);
  await testTask("FR-006", p2, h2);
}

main().catch(console.error);
