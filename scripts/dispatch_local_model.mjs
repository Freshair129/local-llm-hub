// scripts/dispatch_local_model.mjs
// Dispatches tasks to local models running on Ollama (127.0.0.1:11434)

import http from 'node:http';

const OLLAMA_HOST = '127.0.0.1';
const OLLAMA_PORT = 11434;

export async function askLocalModel(model, prompt, options = {}) {
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

  console.log(`\n======================================================`);
  console.log(`🤖 DISPATCHING TO LOCAL MODEL: ${model}`);
  console.log(`======================================================`);
  const startTime = Date.now();

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
      timeout: 120000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const durationSec = (Date.now() - startTime) / 1000;
          const evalCount = parsed.eval_count || 0;
          const evalDurationMs = (parsed.eval_duration || 1) / 1e6;
          const tps = evalCount > 0 ? (evalCount / (evalDurationMs / 1000)).toFixed(1) : 0;
          
          const output = (parsed.response && parsed.response.trim().length > 0)
            ? parsed.response
            : (parsed.thinking || '');
          
          console.log(`⏱️ Response Time: ${durationSec.toFixed(2)}s | Tokens: ${evalCount} | Speed: ${tps} t/s`);
          console.log(`------------------------------------------------------`);
          console.log((output || '').slice(0, 300) + '...\n');
          resolve({
            response: output,
            thinking: parsed.thinking || null,
            evalCount,
            tps,
            durationSec
          });
        } catch (e) {
          reject(new Error(`Failed to parse Ollama response: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// CLI runner if invoked directly
if (process.argv[1] && process.argv[1].endsWith('dispatch_local_model.mjs')) {
  const model = process.argv[2] || 'hf.co/JetBrains/Mellum2-12B-A2.5B-Instruct-GGUF-Q4_K_M:Q4_K_M';
  const prompt = process.argv[3] || 'Write a concise function in JavaScript.';
  askLocalModel(model, prompt)
    .then(res => console.log('FULL RESULT:\n', res.response))
    .catch(err => console.error('ERROR:', err));
}
