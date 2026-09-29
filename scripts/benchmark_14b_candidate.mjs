import http from 'http';
import fs from 'fs';
import path from 'path';

const OLLAMA_HOST = '127.0.0.1';
const OLLAMA_PORT = 11434;

const candidate = {
  id: 'hf.co/tvall43/Qwen3.6-14B-A3B-FableVibes-GGUF:MXFP4_MOE',
  displayName: 'Qwen 3.6 14B-A3B FableVibes (MoE)',
  settings: {
    temperature: 0.6,
    top_p: 0.95,
    top_k: 20,
    repeat_penalty: 1.1,
    num_predict: 1200
  }
};

async function unloadVram() {
  console.log(`\n🧹 [VRAM CLEANUP] Unloading any existing models from GPU VRAM...`);
  try {
    const res = await fetch(`http://${OLLAMA_HOST}:${OLLAMA_PORT}/api/ps`);
    const data = await res.json();
    for (const m of data.models || []) {
      console.log(`   - Evicting: ${m.name}`);
      await fetch(`http://${OLLAMA_HOST}:${OLLAMA_PORT}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: m.name, keep_alive: 0 })
      });
    }
    await new Promise(r => setTimeout(r, 2000));
  } catch (err) {
    console.warn(`   - VRAM warning: ${err.message}`);
  }
}

async function run() {
  await unloadVram();

  const codePath = path.resolve('src/main.js');
  const codeContent = fs.readFileSync(codePath, 'utf8');

  const prompt = `You are a Senior Full-Stack and Systems Code Reviewer.
Conduct a rigorous, professional code review of the following JavaScript file from our Tauri v2 desktop application (\`src/main.js\`).

=== CODE TO REVIEW (src/main.js) ===
${codeContent}
=== END OF CODE ===

Provide your review covering:
1. Overall architectural review & Strengths
2. Potential Bugs, Race conditions, or Async/Await State inconsistencies
3. Tauri v2 IPC Security & Error handling improvements
4. Concrete actionable code fixes
5. Final Code Quality Score out of 10

Format your response in structured Markdown.`;

  console.log(`\n=============================================================`);
  console.log(`🚀 Benchmarking 14B Candidate: ${candidate.displayName}`);
  console.log(`   Model ID: ${candidate.id}`);
  console.log(`   Settings:`, candidate.settings);
  console.log(`=============================================================`);

  const payload = JSON.stringify({
    model: candidate.id,
    prompt,
    stream: false,
    keep_alive: '15m',
    options: candidate.settings
  });

  const start = Date.now();

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
    res.on('end', async () => {
      try {
        const parsed = JSON.parse(data);
        const durationSec = ((Date.now() - start) / 1000).toFixed(2);
        const evalCount = parsed.eval_count || 0;
        const promptCount = parsed.prompt_eval_count || 0;
        const evalDurS = (parsed.eval_duration || 1) / 1e9;
        const promptDurS = (parsed.prompt_eval_duration || 1) / 1e9;
        const tps = (evalCount / evalDurS).toFixed(1);
        const promptTps = (promptCount / promptDurS).toFixed(1);

        let sizeVramGb = 'Full GPU';
        try {
          const psRes = await fetch(`http://${OLLAMA_HOST}:${OLLAMA_PORT}/api/ps`);
          const psData = await psRes.json();
          const active = (psData.models || []).find(m => m.name === candidate.id);
          if (active && active.size_vram !== undefined) {
            sizeVramGb = (active.size_vram / 1e9).toFixed(2) + ' GB VRAM';
          }
        } catch (_) {}

        console.log(`\n✅ Result: ${evalCount} tokens | Speed: ${tps} t/s | Prompt: ${promptTps} t/s | Dur: ${durationSec}s | VRAM: ${sizeVramGb}`);

        const outDir = path.resolve('docs/benchmarks/reviews');
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

        const reviewFile = path.join(outDir, 'qwen3_6_14b_fablevibes_moe.md');
        const doc = `# 🌟 ${candidate.displayName} Review (14B on GPU)

- **Model ID:** \`${candidate.id}\`
- **Architecture:** Qwen 3.5 MoE (Total: 13.8B, Active: 3B, MXFP4_MOE)
- **Hardware:** NVIDIA GeForce RTX 3060 12GB (CUDA0)
- **Settings:** \`temperature: 0.6\`, \`top_p: 0.95\`, \`top_k: 20\`, \`repeat_penalty: 1.1\`
- **Performance:** **${tps} tokens/s** (Prompt: **${promptTps} tokens/s**)
- **Duration:** ${durationSec} seconds (${evalCount} tokens generated)
- **VRAM Allocation:** ${sizeVramGb}

---

## Review Output
${parsed.response || parsed.thinking || 'No response generated'}
`;
        fs.writeFileSync(reviewFile, doc, 'utf8');
        console.log(`📄 Saved review to ${reviewFile}`);

        // Update benchmark report table
        const reportPath = path.resolve('docs/benchmarks/code_review_model_benchmark.md');
        if (fs.existsSync(reportPath)) {
          let reportContent = fs.readFileSync(reportPath, 'utf8');
          const newRow = `| 🌟 **Qwen 3.6 14B-A3B FableVibes** | \`temp=0.6, p=0.95, rep=1.1\` | **${tps} t/s** | **${promptTps} t/s** | ${evalCount} | **${durationSec}s** | ${sizeVramGb} |`;
          
          if (!reportContent.includes('Qwen 3.6 14B-A3B FableVibes')) {
            const tableMarker = '|---|---|:---:|:---:|:---:|:---:|:---:|';
            reportContent = reportContent.replace(tableMarker, `${tableMarker}\n${newRow}`);
            fs.writeFileSync(reportPath, reportContent, 'utf8');
            console.log(`🎉 Added 14B metrics to ${reportPath}!`);
          }
        }
      } catch (err) {
        console.error('❌ Error parsing response:', err.message);
      }
    });
  });

  req.on('error', (err) => {
    console.error('❌ Request error:', err.message);
  });

  req.write(payload);
  req.end();
}

run();
