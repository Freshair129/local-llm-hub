// scripts/parallel_dag_executor.mjs
// Parallel DAG Task Executor distributing Roadmap Tasks to Local LLM Fleet

import http from 'node:http';
import fs from 'node:fs';

const OLLAMA_HOST = '127.0.0.1';
const OLLAMA_PORT = 11434;

async function askLocalModel(model, prompt, options = {}) {
  const payload = JSON.stringify({
    model,
    prompt,
    stream: false,
    keep_alive: options.keep_alive ?? '15m',
    options: {
      temperature: options.temperature ?? 0.2,
      top_p: options.top_p ?? 0.95,
      num_predict: options.num_predict ?? 2048,
    }
  });

  const startTime = Date.now();
  console.log(`🚀 [DISPATCH] Launching task to: ${model}`);

  return new Promise((resolve, reject) => {
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
          const durationMs = Date.now() - startTime;
          const evalCount = parsed.eval_count || 0;
          const promptCount = parsed.prompt_eval_count || 0;
          const evalDurationMs = (parsed.eval_duration || 1) / 1e6;
          const tps = evalCount > 0 ? (evalCount / (evalDurationMs / 1000)).toFixed(1) : '0.0';

          const output = (parsed.response && parsed.response.trim().length > 0)
            ? parsed.response
            : (parsed.thinking || '');

          console.log(`✅ [DONE] ${model} | ${durationMs}ms | ${evalCount} tokens | Speed: ${tps} t/s`);
          resolve({
            model,
            output,
            thinking: parsed.thinking || null,
            evalCount,
            promptCount,
            durationMs,
            tps: parseFloat(tps),
            success: true
          });
        } catch (e) {
          console.error(`❌ [PARSE_ERROR] ${model}:`, e.message);
          resolve({
            model,
            output: '',
            evalCount: 0,
            promptCount: 0,
            durationMs: Date.now() - startTime,
            tps: 0.0,
            success: false,
            error: e.message
          });
        }
      });
    });

    req.on('error', (err) => {
      console.error(`❌ [REQ_ERROR] ${model}:`, err.message);
      resolve({
        model,
        output: '',
        evalCount: 0,
        promptCount: 0,
        durationMs: Date.now() - startTime,
        tps: 0.0,
        success: false,
        error: err.message
      });
    });

    req.write(payload);
    req.end();
  });
}

async function main() {
  console.log(`================================================================`);
  console.log(`⚡ PARALLEL DAG EXECUTION ENGINE - LOCAL LLM FLEET`);
  console.log(`   Keeping models warm with keep_alive: "15m" for KV caching`);
  console.log(`================================================================\n`);

  const taskInstruct = {
    model: 'hf.co/JetBrains/Mellum2-12B-A2.5B-Instruct-GGUF-Q4_K_M:Q4_K_M',
    prompt: `You are generating frontend module code for a Tauri v2 Dark Glassmorphism app.
Task: Write clean, modular ES module JavaScript for:
1. 'card.js' (sliding drawer for model cards with overlay, Esc key close, and markdown rendering).
2. 'observability.js' (polls 'get_hardware_telemetry' every 2s and updates GPU/RAM gauge DOM elements).
Provide the key functions: openModelCard(modelId), closeModelCard(), startTelemetryPolling(), stopTelemetryPolling().
Return well-commented clean JavaScript code only.`
  };

  const taskThinking = {
    model: 'hf.co/JetBrains/Mellum2-12B-A2.5B-Thinking-GGUF-Q4_K_M:Q4_K_M',
    prompt: `You are an expert systems and network architect.
Task: Analyze requirements for:
1. FR-010: LAN File Sharing Server in Rust (Tokio HTTP server with HTTP 206 Partial Content / 'Range: bytes=X-Y', security against path traversal '../', and QR code/LAN IP discovery).
2. FR-005: Model Lifecycle (Ollama unload via keep_alive: 0 vs load via keep_alive: '15m').
Provide concise architectural principles and edge cases to handle in Rust.`
  };

  console.log(`Dispatching 2 major DAG tasks in parallel to local models...`);
  const [resultInstruct, resultThinking] = await Promise.all([
    askLocalModel(taskInstruct.model, taskInstruct.prompt, { num_predict: 1200 }),
    askLocalModel(taskThinking.model, taskThinking.prompt, { num_predict: 1200 })
  ]);

  console.log(`\n================================================================`);
  console.log(`📊 EXECUTION SUMMARY`);
  console.log(`================================================================`);
  console.log(`1. Worker A (Mellum2 Instruct):`);
  console.log(`   Tokens: ${resultInstruct.evalCount} | Speed: ${resultInstruct.tps} t/s | Dur: ${(resultInstruct.durationMs/1000).toFixed(2)}s`);
  console.log(`2. Worker B (Mellum2 Thinking):`);
  console.log(`   Tokens: ${resultThinking.evalCount} | Speed: ${resultThinking.tps} t/s | Dur: ${(resultThinking.durationMs/1000).toFixed(2)}s`);
  console.log(`================================================================\n`);

  fs.writeFileSync('scripts/generated_frontend_modules.txt', resultInstruct.output, 'utf8');
  fs.writeFileSync('scripts/architecture_review.txt', resultThinking.output || resultThinking.thinking || '', 'utf8');
  console.log(`Artifacts saved to scripts/generated_frontend_modules.txt and scripts/architecture_review.txt`);
}

main().catch(console.error);
