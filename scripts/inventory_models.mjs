// scripts/inventory_models.mjs
import fs from 'node:fs';

async function listInventory() {
  const res = await fetch('http://127.0.0.1:11434/api/tags');
  const d = await res.json();
  const models = d.models.filter(m => !m.name.includes(':cloud'));

  console.log(`TOTAL LOCAL OLLAMA MODELS: ${models.length}`);
  let totalBytes = 0;

  const rows = models.map((m, idx) => {
    totalBytes += m.size;
    return {
      index: idx + 1,
      name: m.name,
      sizeGB: (m.size / (1024 * 1024 * 1024)).toFixed(2),
      family: m.details?.family || 'unknown',
      parameter: m.details?.parameter_size || 'unknown',
      quant: m.details?.quantization_level || 'unknown',
      modified: m.modified_at ? m.modified_at.split('T')[0] : ''
    };
  });

  console.table(rows);
  console.log(`Total Ollama Local Disk Usage: ${(totalBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`);

  // Check standalone GGUF files
  console.log('\n--- STANDALONE GGUF FILES ---');
  const standalone = [
    'O:\\models\\qwen-thai\\qwen-4b-thai-reasoning.gguf'
  ];
  for (const s of standalone) {
    if (fs.existsSync(s)) {
      const stat = fs.statSync(s);
      console.log(`- ${s} (${(stat.size / (1024 * 1024 * 1024)).toFixed(2)} GB)`);
    }
  }

  // Check HuggingFace Cache
  console.log('\n--- HUGGINGFACE CACHE SNAPSHOTS ---');
  const hfDir = 'O:\\.cache\\huggingface\\hub';
  if (fs.existsSync(hfDir)) {
    const list = fs.readdirSync(hfDir).filter(f => f.startsWith('models--'));
    for (const h of list) {
      console.log(`- ${h}`);
    }
  }
}

listInventory();
