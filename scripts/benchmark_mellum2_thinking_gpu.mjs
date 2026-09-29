import http from 'http';
import fs from 'fs';
import path from 'path';

const OLLAMA_HOST = '127.0.0.1';
const OLLAMA_PORT = 11434;

const modelId = 'hf.co/JetBrains/Mellum2-12B-A2.5B-Thinking-GGUF-Q4_K_M:Q4_K_M';
const settings = {
  temperature: 0.6,
  top_p: 0.95,
  repeat_penalty: 1.1,
  num_predict: 2048
};

async function unloadVram() {
  console.log(`🧹 [VRAM CLEANUP] Unloading any existing models from GPU VRAM...`);
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
    await new Promise(r => setTimeout(r, 1500));
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
  console.log(`🚀 Benchmarking Candidate: JetBrains Mellum2 12B Thinking (on GPU)`);
  console.log(`   Model ID: ${modelId}`);
  console.log(`   HF Official Settings:`, settings);
  console.log(`=============================================================`);

  const payload = JSON.stringify({
    model: modelId,
    prompt,
    stream: false,
    keep_alive: '15m',
    options: settings
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

        let sizeVramGb = 'N/A';
        try {
          const psRes = await fetch(`http://${OLLAMA_HOST}:${OLLAMA_PORT}/api/ps`);
          const psData = await psRes.json();
          const active = (psData.models || []).find(m => m.name === modelId);
          if (active && active.size_vram !== undefined) {
            sizeVramGb = (active.size_vram / 1e9).toFixed(2) + ' GB VRAM';
          }
        } catch (_) {}

        console.log(`\n✅ Result: ${evalCount} tokens | Speed: ${tps} t/s | Prompt: ${promptTps} t/s | Dur: ${durationSec}s | VRAM: ${sizeVramGb}`);

        // Save review
        const outDir = path.resolve('docs/benchmarks/reviews');
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

        const reviewFile = path.join(outDir, 'jetbrains_mellum2_12b_thinking_gpu.md');
        const doc = `# 🧠 JetBrains Mellum2 12B Thinking Review (GPU Accelerated)

- **Model ID:** \`${modelId}\`
- **Hardware:** NVIDIA GeForce RTX 3060 12GB (CUDA0)
- **Hugging Face Official Settings:** \`temperature: 0.6\`, \`top_p: 0.95\`, \`repeat_penalty: 1.1\`
- **Performance:** **${tps} tokens/s** (Prompt: **${promptTps} tokens/s**)
- **Duration:** ${durationSec} seconds (${evalCount} tokens generated)
- **VRAM Allocation:** ${sizeVramGb}

---

## Thinking Trace (Reasoning)
\`\`\`text
${parsed.thinking || 'No separate thinking block returned'}
\`\`\`

---

## Final Review Output
${parsed.response || parsed.thinking || 'No response generated'}
`;
        fs.writeFileSync(reviewFile, doc, 'utf8');
        console.log(`📄 Saved review to ${reviewFile}`);

        // Update consolidated benchmark report
        const reportPath = path.resolve('docs/benchmarks/code_review_model_benchmark.md');
        if (fs.existsSync(reportPath)) {
          let reportContent = fs.readFileSync(reportPath, 'utf8');
          // Replace Thinking row
          const thinkingRegex = /\|\s*\*\*JetBrains Mellum2 12B Thinking\*\*.*\|/;
          const newRow = `| **JetBrains Mellum2 12B Thinking** | \`temp=0.6, p=0.95, rep=1.1\` | **${tps} t/s** | **${promptTps} t/s** | ${evalCount} | **${durationSec}s** | ${sizeVramGb} |`;
          if (thinkingRegex.test(reportContent)) {
            reportContent = reportContent.replace(thinkingRegex, newRow);
            fs.writeFileSync(reportPath, reportContent, 'utf8');
            console.log(`🎉 Updated ${reportPath} with new GPU benchmark metrics!`);
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
