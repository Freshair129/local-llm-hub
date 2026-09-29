import http from 'http';
import fs from 'fs';
import path from 'path';

const OLLAMA_HOST = '127.0.0.1';
const OLLAMA_PORT = 11434;

const candidates = [
  {
    id: 'hf.co/KevinJK51/Qwen3.6-12B-IQ-Ultra-Heretic-Uncensored-Thinking-V2-Hightop-GGUF:Q4_K_M',
    displayName: 'Qwen 3.6 12B IQ-Ultra Thinking V2',
    slug: 'qwen3_6_12b_iq_ultra_thinking',
    settings: {
      temperature: 0.6,
      top_p: 0.95,
      top_k: 20,
      repeat_penalty: 1.1,
      num_predict: 1800
    }
  },
  {
    id: 'hf.co/unsloth/gemma-4-12b-it-GGUF:UD-Q4_K_XL',
    displayName: 'Google Gemma 4 12B Instruct (Unsloth UD)',
    slug: 'unsloth_gemma4_12b_it',
    settings: {
      temperature: 0.6,
      top_p: 0.95,
      top_k: 64,
      repeat_penalty: 1.1,
      num_predict: 1200
    }
  }
];

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
    console.warn(`   - VRAM cleanup warning: ${err.message}`);
  }
}

async function queryModel(candidate, prompt) {
  await unloadVram();

  console.log(`\n=============================================================`);
  console.log(`🚀 Benchmarking Candidate: ${candidate.displayName}`);
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

  return new Promise((resolve) => {
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

          resolve({
            id: candidate.id,
            displayName: candidate.displayName,
            slug: candidate.slug,
            success: true,
            evalCount,
            promptCount,
            tps: parseFloat(tps),
            promptTps: parseFloat(promptTps),
            durationSec: parseFloat(durationSec),
            sizeVramGb,
            output: parsed.response || parsed.thinking || '',
            thinking: parsed.thinking || ''
          });
        } catch (err) {
          console.error(`❌ Failed parsing response:`, err.message);
          resolve({
            id: candidate.id,
            displayName: candidate.displayName,
            slug: candidate.slug,
            success: false,
            error: err.message
          });
        }
      });
    });

    req.on('error', (err) => {
      console.error(`❌ Request error:`, err.message);
      resolve({
        id: candidate.id,
        displayName: candidate.displayName,
        slug: candidate.slug,
        success: false,
        error: err.message
      });
    });

    req.write(payload);
    req.end();
  });
}

async function main() {
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

  const results = [];

  for (const c of candidates) {
    const res = await queryModel(c, prompt);
    results.push(res);

    if (res.success) {
      const outDir = path.resolve('docs/benchmarks/reviews');
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

      const reviewFile = path.join(outDir, `${c.slug}.md`);
      const doc = `# 🧠 ${c.displayName} Review (RTX 3060 GPU)

- **Model ID:** \`${c.id}\`
- **Hardware:** NVIDIA GeForce RTX 3060 12GB (CUDA0)
- **Settings:** \`temperature: ${c.settings.temperature}\`, \`top_p: ${c.settings.top_p}\`, \`repeat_penalty: ${c.settings.repeat_penalty}\`
- **Performance:** **${res.tps} tokens/s** (Prompt: **${res.promptTps} tokens/s**)
- **Duration:** ${res.durationSec} seconds (${res.evalCount} tokens generated)
- **VRAM Allocation:** ${res.sizeVramGb}

---

${res.thinking ? `## Thinking Trace (Reasoning)\n\`\`\`text\n${res.thinking}\n\`\`\`\n\n---\n` : ''}

## Review Output
${res.output}
`;
      fs.writeFileSync(reviewFile, doc, 'utf8');
      console.log(`📄 Saved review to ${reviewFile}`);

      // Update benchmark table
      const reportPath = path.resolve('docs/benchmarks/code_review_model_benchmark.md');
      if (fs.existsSync(reportPath)) {
        let reportContent = fs.readFileSync(reportPath, 'utf8');
        const newRow = `| 💎 **${c.displayName}** | \`temp=${c.settings.temperature}, p=${c.settings.top_p}, rep=${c.settings.repeat_penalty}\` | **${res.tps} t/s** | **${res.promptTps} t/s** | ${res.evalCount} | **${res.durationSec}s** | ${res.sizeVramGb} |`;
        
        if (!reportContent.includes(c.displayName)) {
          const tableMarker = '|---|---|:---:|:---:|:---:|:---:|:---:|';
          reportContent = reportContent.replace(tableMarker, `${tableMarker}\n${newRow}`);
          fs.writeFileSync(reportPath, reportContent, 'utf8');
          console.log(`🎉 Added ${c.displayName} metrics to ${reportPath}!`);
        }
      }
    }
  }

  await unloadVram();
  console.log(`\n🎉 High-IQ 12B Benchmarks complete!`);
}

main();
