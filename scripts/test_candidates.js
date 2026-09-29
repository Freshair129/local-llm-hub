// scripts/test_candidates.js
const prompt = `Write a complete Rust function to normalize a model name according to these rules:
1. Strip registry prefix (e.g. 'registry.ollama.ai/library/', 'library/', 'hf.co/')
2. Strip quantization suffix (e.g. '-q4_0', '-Q4_K_M', '-Q4_0')
3. Convert to lowercase
Signature: pub fn normalize_model_name(raw: &str) -> String
Return only the Rust function code.`;

const modelsToTest = [
  { name: 'AMD Instella-MoE 16B (3B Active)', id: 'hf.co/DevQuasar/amd.Instella-MoE-16B-A3B-Think-GGUF:Q2_K' },
  { name: 'Llama 3.2 4x3B MoE (10B)', id: 'hf.co/DavidAU/Llama-3.2-4X3B-MOE-Hell-California-Uncensored-10B-GGUF:Q4_K_M' },
  { name: 'Mellum2 12B Claude Opus Thinking', id: 'hf.co/yuxinlu1/Mellum2-12B-A2.5B-Claude-4.6-4.8-Opus-Thinking-GGUF:Q4_K_M' },
  { name: 'Gemma4 12B Agentic Composer', id: 'hf.co/yuxinlu1/gemma-4-12B-agentic-fable5-composer2.5-v2-3.5x-tau2-GGUF:Q4_K_M' }
];

async function run() {
  console.log('🚀 Running Batch Benchmark on Candidate Models (RTX 3060 12GB)...');
  const results = [];

  for (const m of modelsToTest) {
    console.log(`\n--------------------------------------------------------------`);
    console.log(`Testing: ${m.name} (${m.id})`);
    const start = Date.now();
    try {
      const res = await fetch('http://127.0.0.1:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: m.id,
          prompt,
          stream: false,
          options: { temperature: 0.1, num_predict: 200 }
        })
      });

      if (!res.ok) {
        console.error(`HTTP Error: ${res.status}`);
        continue;
      }

      const d = await res.json();
      const dur = ((Date.now() - start) / 1000).toFixed(2);
      const evalCount = d.eval_count || 0;
      const evalDurS = (d.eval_duration || 1) / 1e9;
      const tps = (evalCount / evalDurS).toFixed(2);
      const promptTps = ((d.prompt_eval_count || 0) / ((d.prompt_eval_duration || 1) / 1e9)).toFixed(2);

      console.log(`⏱️ Duration: ${dur}s | Gen Speed: ${tps} t/s | Prompt: ${promptTps} t/s`);
      const outputSnippet = d.response ? d.response.trim().slice(0, 150) : (d.thinking ? '[Thinking]: ' + d.thinking.trim().slice(0, 150) : 'None');
      console.log(`💻 Preview: ${outputSnippet}...`);

      results.push({
        name: m.name,
        speed: tps,
        promptSpeed: promptTps,
        duration: dur,
        tokens: evalCount
      });
    } catch (e) {
      console.error(`Failed ${m.name}:`, e.message);
    }
  }

  console.log(`\n==============================================================`);
  console.log(`🏆 BATCH BENCHMARK SUMMARY TABLE`);
  console.log(`==============================================================`);
  console.log(`| Model Name | Gen Speed (t/s) | Prompt Speed (t/s) | Duration |`);
  console.log(`|---|---|---|---|`);
  for (const r of results) {
    console.log(`| ${r.name} | ${r.speed} t/s | ${r.promptSpeed} t/s | ${r.duration}s |`);
  }
  console.log(`==============================================================\n`);
}

run();
