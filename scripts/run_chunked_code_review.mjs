// scripts/run_chunked_code_review.mjs
// trace:implements SPEC-WORKFLOW-001
//! Lead Architect Chunked Codebase Reviewer for Local LLM Fleet on RTX 3060 CUDA

import http from 'http';
import fs from 'fs';
import path from 'path';

const OLLAMA_HOST = '127.0.0.1';
const OLLAMA_PORT = 11434;
const REVIEW_MODEL = 'hf.co/JetBrains/Mellum2-12B-A2.5B-Thinking-GGUF-Q4_K_M:Q4_K_M';

const CHUNKS = [
  {
    name: 'Chunk 1: Rust Core & Safety Contracts',
    files: ['src-tauri/src/state.rs', 'src-tauri/src/models/types.rs', 'src-tauri/src/lib.rs'],
    focus: 'ADR-100 Zero Panic compliance (no .unwrap()/.expect()), Mutex thread-safety, type serialization'
  },
  {
    name: 'Chunk 2: Tauri Commands & Backend Adapters',
    files: ['src-tauri/src/commands/models.rs', 'src-tauri/src/commands/share.rs', 'src-tauri/src/commands/chat.rs'],
    focus: 'IPC error handling, PIN rate-limiting, range byte streaming, tag classification'
  },
  {
    name: 'Chunk 3: Frontend Presentation & UI State',
    files: ['src/js/state.js', 'src/js/model.js', 'src/js/chat.js', 'src/js/share.js'],
    focus: 'Reactive store pattern, event listener cleanup, live token estimator, bento tag pills'
  },
  {
    name: 'Chunk 4: Hardware Telemetry & Digital Twin',
    files: ['src/js/sensors.js', 'src/js/observability.js', 'src/js/digital_twin_3d.js'],
    focus: 'Thermal alert debounce (>88°C), WebGL Three.js render loop efficiency, polling interval safety'
  }
];

async function queryOllama(prompt) {
  const payload = JSON.stringify({
    model: REVIEW_MODEL,
    prompt,
    stream: false,
    options: { temperature: 0.2, num_predict: 800 }
  });

  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: OLLAMA_HOST,
      port: OLLAMA_PORT,
      path: '/api/generate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      timeout: 180000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.response || parsed.thinking || '');
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  console.log('=============================================================');
  console.log('🏛️ LEAD ARCHITECT CHUNKED CODEBASE REVIEW (LOCAL FLEET)');
  console.log('   Strategy: Micro-Task Chunks (< 150 lines per query)');
  console.log('   Engine: Mellum2 12B Thinking on RTX 3060 CUDA');
  console.log('=============================================================\n');

  const reportLines = ['# 🏛️ Local LLM Fleet Chunked Codebase Review Report\n'];

  for (const chunk of CHUNKS) {
    console.log(`🔍 Processing ${chunk.name}...`);
    let combinedSnippet = '';
    for (const f of chunk.files) {
      if (fs.existsSync(f)) {
        const content = fs.readFileSync(f, 'utf8');
        // Extract top 100 lines to keep context tight and hallucination-free
        combinedSnippet += `\n--- File: ${f} (Top 100 lines) ---\n` + content.split('\n').slice(0, 100).join('\n') + '\n';
      }
    }

    const prompt = `You are a Senior Lead Architect reviewing code for Local LLM Hub.
Focus: ${chunk.focus}

Code Snippet:
${combinedSnippet}

Provide a concise, 3-bullet point technical audit:
1. Architectural Quality & Compliance
2. Potential Risk or Bottleneck
3. Final Status (APPROVED / NEEDS REFONTMING)`;

    try {
      const result = await queryOllama(prompt);
      console.log(`   ✅ Completed ${chunk.name}\n`);
      reportLines.push(`## ${chunk.name}`);
      reportLines.push(`**Focus:** ${chunk.focus}`);
      reportLines.push(result.trim());
      reportLines.push('\n---\n');
    } catch (err) {
      console.error(`   ❌ Failed ${chunk.name}:`, err.message);
    }
  }

  const reportPath = path.resolve('eval/reports/LOCAL_FLEET_CODE_REVIEW.md');
  fs.writeFileSync(reportPath, reportLines.join('\n'), 'utf8');
  console.log(`\n🎉 Local Fleet Code Review Complete! Report saved to:\n   ${reportPath}`);
}

main().catch(console.error);
