// scripts/test_llama_moe.js
const prompt = `Write a complete Rust function to normalize a model name according to these rules:
1. Strip registry prefix (e.g. 'registry.ollama.ai/library/', 'library/', 'hf.co/')
2. Strip quantization suffix (e.g. '-q4_0', '-Q4_K_M', '-Q4_0')
3. Convert to lowercase
Signature: pub fn normalize_model_name(raw: &str) -> String
Return only the Rust function code.`;

const model = 'hf.co/DavidAU/Llama-3.2-4X3B-MOE-Hell-California-Uncensored-10B-GGUF:Q4_K_M';
console.log('Testing:', model);
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
  console.log('=== METRICS FOR Llama-3.2-4x3B-MOE ===');
  console.log('Duration:', dur + 's');
  console.log('Eval Tokens:', evalCount);
  console.log('Generation Speed:', tps + ' tokens/s');
  console.log('=== OUTPUT ===');
  console.log(d.response.trim());
})
.catch(e => console.error(e.message));
