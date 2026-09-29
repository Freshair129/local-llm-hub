// scripts/ai_code_review.mjs
// trace:implements SPEC-WORKFLOW-001
// Pre-Commit / On-Demand AI Code Reviewer using Local JetBrains Mellum2 12B Thinking on RTX 3060 CUDA

import http from 'http';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const OLLAMA_HOST = '127.0.0.1';
const OLLAMA_PORT = 11434;
const REVIEW_MODEL = 'hf.co/JetBrains/Mellum2-12B-A2.5B-Thinking-GGUF-Q4_K_M:Q4_K_M';

console.log('\n=============================================================');
console.log('🤖 LOCAL AI PRE-COMMIT & CODE QUALITY REVIEWER');
console.log(`   Engine: JetBrains Mellum2 12B Thinking (MoE 2.5B Active)`);
console.log('   Guard Rails: ADR-100 (Zero Panic), ANN-001 (Traceability)');
console.log('=============================================================\n');

// 1. Gather diff / code changes
let diffText = '';
try {
  // Check git diff if git repository exists
  diffText = execSync('git diff HEAD', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  if (!diffText) {
    diffText = execSync('git diff --staged', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  }
} catch {
  // Fallback: If not a git repo or no commits, scan recent modified files in src / src-tauri
  console.log('ℹ️  No git diff detected. Analyzing latest modified source files...');
  const sampleFiles = [
    'src/main.js',
    'src/js/model.js',
    'src-tauri/src/commands/models.rs',
    'src-tauri/src/commands/share.rs'
  ];
  for (const f of sampleFiles) {
    if (fs.existsSync(f)) {
      const content = fs.readFileSync(f, 'utf8');
      diffText += `\n--- File: ${f} ---\n` + content.slice(0, 1500) + '\n';
    }
  }
}

if (!diffText) {
  console.log('✅ No pending changes or files to review.');
  process.exit(0);
}

console.log(`📊 Collected code snippet / diff (${diffText.length} characters). Prompting Mellum2 Thinking...\n`);

const prompt = `You are a Principal Software Engineer auditing code for a Tauri v2 Desktop App with strict ADR-100 (Safe Error Handling, Zero Panics) and ANN-001 (Traceability) policies.

Audit the following code changes:
${diffText.slice(0, 4000)}

Analyze and report strictly:
1. [Guard Rails (ADR-100)]: Any .unwrap(), .expect(), or unhandled panics/exceptions?
2. [Traceability (ANN-001)]: Are requirement annotations (// trace:implements) present and correct?
3. [Security & Robustness]: Any path traversal, race condition, or memory leaks?
4. [Final Verdict]: APPROVED / NEEDS REVISION, with specific code fixes if needed.`;

async function runReview() {
  const startTime = Date.now();
  const reqData = JSON.stringify({
    model: REVIEW_MODEL,
    prompt: prompt,
    stream: true,
    options: {
      temperature: 0.3,
      top_p: 0.95,
      repeat_penalty: 1.05,
      num_predict: 1500
    }
  });

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: OLLAMA_HOST,
        port: OLLAMA_PORT,
        path: '/api/generate',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(reqData)
        }
      },
      (res) => {
        let fullText = '';
        let evalCount = 0;
        let evalDuration = 0;

        res.on('data', (chunk) => {
          const lines = chunk.toString().split('\n');
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const json = JSON.parse(line);
              const token = json.response || json.thinking || '';
              if (token) {
                process.stdout.write(token);
                fullText += token;
              }
              if (json.eval_count) evalCount = json.eval_count;
              if (json.eval_duration) evalDuration = json.eval_duration;
            } catch {}
          }
        });

        res.on('end', () => {
          const elapsedSec = (Date.now() - startTime) / 1000;
          const tps = evalDuration > 0 ? (evalCount / (evalDuration / 1e9)).toFixed(1) : (evalCount / elapsedSec).toFixed(1);
          console.log('\n\n-------------------------------------------------------------');
          console.log(`⚡ Speed: ${tps} t/s | Generated ${evalCount} tokens in ${elapsedSec.toFixed(2)}s`);
          console.log('-------------------------------------------------------------\n');
          resolve({ fullText, tps });
        });
      }
    );

    req.on('error', (err) => {
      console.error('❌ Connection error to Ollama:', err.message);
      reject(err);
    });

    req.write(reqData);
    req.end();
  });
}

runReview().catch(err => {
  console.error(err);
  process.exit(1);
});
