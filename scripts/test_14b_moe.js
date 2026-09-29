// scripts/test_14b_moe.js
const prompt = `Write a complete Rust function to normalize a model name according to these rules:
1. Strip registry prefix (e.g. 'registry.ollama.ai/library/', 'library/', 'hf.co/')
2. Strip quantization suffix (e.g. '-q4_0', '-Q4_K_M', '-Q4_0')
3. Convert to lowercase
Signature: pub fn normalize_model_name(raw: &str) -> String
Return only the Rust function code.`;

const model = 'hf.co/tvall43/Qwen3.6-14B-A3B-FableVibes-GGUF:MXFP4_MOE';
console.log('Testing 14B MoE Model:', model);
const start = Date.now();

fetch('http://127.0.0.1:11434/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model,
    prompt,
    stream: false,
    options: { temperature: 0.1, num_predict: 250 }
  })
})
.then(r => r.json())
.then(d => {
  const dur = ((Date.now() - start) / 1000).toFixed(2);
  const evalCount = d.eval_count || 0;
  const evalDurS = (d.eval_duration || 1) / 1e9;
  const tps = (evalCount / evalDurS).toFixed(2);
  const promptEvalCount = d.prompt_eval_count || 0;
  const promptEvalDurS = (d.prompt_eval_duration || 1) / 1e9;
  const promptTps = (promptEvalCount / promptEvalDurS).toFixed(2);

  console.log('\n=== METRICS FOR Qwen3.6-14B-A3B (MoE MXFP4) ===');
  console.log(`- Total Duration:     ${dur} s`);
  console.log(`- Generation Speed:   ${tps} tokens/s (eval: ${evalCount} tokens)`);
  console.log(`- Prompt Processing:  ${promptTps} tokens/s (${promptEvalCount} tokens)`);
  console.log('=== OUTPUT ===');
  console.log(d.response ? d.response.trim() : (d.thinking ? '[Thinking]: ' + d.thinking.slice(0, 300) : 'None'));
})
.catch(e => console.error('Error:', e.message));
