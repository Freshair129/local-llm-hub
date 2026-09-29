// scripts/review_code_with_thinking_model.mjs
import http from 'node:http';
import fs from 'node:fs';

const OLLAMA_HOST = '127.0.0.1';
const OLLAMA_PORT = 11434;
const MODEL = 'hf.co/JetBrains/Mellum2-12B-A2.5B-Thinking-GGUF-Q4_K_M:Q4_K_M';

const mainJsCode = fs.readFileSync('src/main.js', 'utf8');

const prompt = `You are an expert Principal Frontend & Systems Architect reviewing code for a Tauri v2 Desktop Application.
Review the following JavaScript file ('src/main.js'):

\`\`\`javascript
${mainJsCode}
\`\`\`

Provide a thorough, professional, and structured Code Review in Thai (with English technical terms where appropriate).
Cover:
1. 🌟 ภาพรวมและข้อดีของโค้ด (Strengths & Clean Architecture)
2. ⚠️ ข้อสังเกตและจุดที่อาจเกิด Edge Cases / Bugs (Potential Issues, Race conditions, Error handling)
3. 💡 คำแนะนำในการปรับปรุง (Concrete Recommendations / Refactoring Tips for Tauri v2)
4. 🚀 สรุปคะแนนคุณภาพโค้ด (Code Quality Score)`;

const payload = JSON.stringify({
  model: MODEL,
  prompt,
  stream: false,
  keep_alive: '15m',
  options: {
    temperature: 0.2,
    top_p: 0.95,
    num_predict: 2048,
  }
});

console.log(`🤖 Dispatching code review to: ${MODEL}`);
const startTime = Date.now();

const req = http.request({
  hostname: OLLAMA_HOST,
  port: OLLAMA_PORT,
  path: '/api/generate',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  },
  timeout: 180000,
}, (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
      const evalCount = parsed.eval_count || 0;
      const tps = (evalCount / ((parsed.eval_duration || 1) / 1e9)).toFixed(1);

      console.log(`\n======================================================`);
      console.log(`⏱️ Speed: ${tps} t/s | Tokens: ${evalCount} | Time: ${durationSec}s`);
      console.log(`======================================================\n`);

      const review = (parsed.response && parsed.response.trim().length > 0)
        ? parsed.response
        : (parsed.thinking || '');

      fs.writeFileSync('scripts/mellum2_review_result.txt', review, 'utf8');
      if (parsed.thinking) {
        fs.writeFileSync('scripts/mellum2_thinking_trace.txt', parsed.thinking, 'utf8');
      }
      console.log('✅ Code Review written to scripts/mellum2_review_result.txt');
    } catch (e) {
      console.error('Failed to parse Ollama response:', e.message);
    }
  });
});

req.on('error', err => console.error('Request error:', err));
req.write(payload);
req.end();
