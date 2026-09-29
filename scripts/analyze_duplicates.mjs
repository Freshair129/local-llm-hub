// scripts/analyze_duplicates.mjs
import fs from 'node:fs';

const candidatesToDelete = [
  // 1. Exact Duplicate Quantizations (F16 unquantized when Q4_K_M exists)
  { name: 'hf.co/AnkitAI/Parable-Qwen3-4B-Claude-Fable-5-GGUF:F16', size_gb: 7.50, reason: 'Duplicate weights (มี Q4_K_M ขนาด 2.33 GB อยู่แล้ว)' },
  { name: 'hf.co/LiquidAI/LFM2-1.2B-RAG-GGUF:F16', size_gb: 2.18, reason: 'Duplicate weights (มี Q4_K_M ขนาด 0.68 GB อยู่แล้ว)' },

  // 2. Old Versions Superseded by Newer Version
  { name: 'hf.co/mradermacher/Pathumma-ThaiLLM-qwen3-8b-it-2.0.0-GGUF:Q4_K_M', size_gb: 4.68, reason: 'เวอร์ชันเก่า (มี Pathumma 8B Think v3.0.0 NECTEC ใหม่กว่า)' },
  { name: 'gemma4-rust-coder:latest', size_gb: 3.19, reason: 'เวอร์ชันเก่า (May 2026 ขนาด 4.6B มี Gemma 4 12B/26B และ Mellum2 Coder ดีกว่า)' },

  // 3. Broken / Unsupported Tensor Architecture in Ollama
  { name: 'hf.co/prism-ml/Ternary-Bonsai-27B-gguf:Q2_0', size_gb: 7.26, reason: 'โมเดลมีข้อผิดพลาด GGUF tensor โหลดไม่ขึ้นใน Ollama' },
  { name: 'hf.co/DevQuasar/amd.Instella-MoE-16B-A3B-Think-GGUF:Q2_K', size_gb: 6.07, reason: 'สถาปัตยกรรม instella-moe ไม่รองรับใน Ollama โหลดไม่ขึ้น' },

  // 4. Redundant Mellum2 thinking duplicates (Baseline Mellum2 Instruct 100% pass)
  { name: 'hf.co/JetBrains/Mellum2-12B-A2.5B-Thinking-GGUF-Q4_K_M:Q4_K_M', size_gb: 7.52, reason: 'ซ้ำซ้อนกับตัวหลัก Mellum2-12B-Instruct ที่ผ่าน Benchmark 100%' },
  { name: 'hf.co/yuxinlu1/Mellum2-12B-A2.5B-Claude-4.6-4.8-Opus-Thinking-GGUF:Q4_K_M', size_gb: 7.52, reason: 'ซ้ำซ้อนและมี Code hallucination จากการ Fine-tune' },

  // 5. Redundant Gemma4 12B merges (Keep unsloth IT and raw 12b)
  { name: 'hf.co/LuffyTheFox/Gemma4-12B-QAT-Genesis:Q4_0', size_gb: 6.66, reason: 'ซ้ำซ้อนกับ Gemma4-12b ตัวอื่น (มี unsloth UD-Q4_K_XL อยู่แล้ว)' },

  // 6. Redundant Qwythos merges (Keep 1 best version)
  { name: 'hf.co/mradermacher/Huihui-Qwythos-9B-Claude-Mythos-5-1M-abliterated-i1-GGUF:Q4_K_M', size_gb: 5.38, reason: 'ซ้ำซ้อนกับ Qwythos 9B ตัวอื่น (มี empero-ai และ llmfan46)' }
];

let totalReclaim = 0;
console.log('=== CANDIDATES FOR DELETION (OLD / DUPLICATES / BROKEN) ===');
candidatesToDelete.forEach((c, i) => {
  totalReclaim += c.size_gb;
  console.log(`${i + 1}. [${c.size_gb.toFixed(2)} GB] ${c.name}`);
  console.log(`   -> ${c.reason}`);
});

console.log(`\nTotal Space Reclaimable: ${totalReclaim.toFixed(2)} GB`);
