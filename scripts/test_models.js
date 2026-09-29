// scripts/test_models.js
import fs from 'node:fs';

const prompt = `Write a complete Rust function to normalize a model name according to these rules:
1. Strip registry prefix (e.g. 'registry.ollama.ai/library/', 'library/', 'hf.co/')
2. Strip quantization suffix (e.g. '-q4_0', '-Q4_K_M', '-Q4_0')
3. Convert to lowercase
Signature: pub fn normalize_model_name(raw: &str) -> String
Return only the Rust function code.`;

async function testModel(modelName) {
  console.log(`\n================================================================`);
  console.log(`🚀 Benchmarking Model: ${modelName}`);
  console.log(`================================================================`);
  
  const startTime = Date.now();
  
  try {
    const res = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 300
        }
      })
    });
    
    if (!res.ok) {
      const errText = await res.text();
      console.error(`HTTP Error ${res.status}:`, errText);
      return null;
    }
    
    const data = await res.json();
    const totalTimeSec = ((Date.now() - startTime) / 1000).toFixed(2);
    const evalCount = data.eval_count || 0;
    const evalDurS = (data.eval_duration || 1) / 1e9;
    const tps = (evalCount / evalDurS).toFixed(2);
    const promptEvalCount = data.prompt_eval_count || 0;
    const promptEvalDurS = (data.prompt_eval_duration || 1) / 1e9;
    const promptTps = (promptEvalCount / promptEvalDurS).toFixed(2);

    console.log(`📊 [Metrics]`);
    console.log(`- Total Duration:     ${totalTimeSec} s`);
    console.log(`- Generation Speed:   ${tps} tokens/s (eval: ${evalCount} tokens)`);
    console.log(`- Prompt Processing:  ${promptTps} tokens/s (${promptEvalCount} tokens)`);
    console.log(`\n💻 [Code Output]:`);
    const output = (data.response && data.response.trim().length > 0) ? data.response.trim() : (data.thinking ? `[Thinking Mode]\n${data.thinking.slice(0, 400)}...\n\n[Content]:\n${data.response}` : '(No output)');
    console.log(output);

    return {
      model: modelName,
      totalTimeSec,
      tps,
      evalCount,
      output
    };
  } catch (err) {
    console.error('Fetch error:', err.message);
    return null;
  }
}

async function run() {
  const model1 = 'hf.co/mradermacher/Qwen3.5-9B-Coder-GGUF:Q4_K_M';
  const model2 = 'hf.co/JetBrains/Mellum2-12B-A2.5B-Instruct-GGUF-Q4_K_M:Q4_K_M';
  
  console.log(`Starting benchmark comparison on RTX 3060 (12GB VRAM)...`);
  
  const res1 = await testModel(model1);
  const res2 = await testModel(model2);
  
  console.log(`\n================================================================`);
  console.log(`🏁 SIDE-BY-SIDE SUMMARY COMPARISON`);
  console.log(`================================================================`);
  console.log(`| Model | Gen Speed | Eval Tokens | Total Time |`);
  console.log(`|---|---|---|---|`);
  if (res1) console.log(`| Qwen3.5-9B-Coder | ${res1.tps} t/s | ${res1.evalCount} | ${res1.totalTimeSec}s |`);
  if (res2) console.log(`| JetBrains Mellum2 12B (2.5B MoE) | ${res2.tps} t/s | ${res2.evalCount} | ${res2.totalTimeSec}s |`);
  console.log(`================================================================\n`);
}

run();
