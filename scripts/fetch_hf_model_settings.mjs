// scripts/fetch_hf_model_settings.mjs
// Fetches official Model Cards from Hugging Face and extracts recommended inference settings

const candidates = [
  {
    id: 'hf.co/JetBrains/Mellum2-12B-A2.5B-Instruct-GGUF-Q4_K_M:Q4_K_M',
    repos: ['JetBrains/Mellum2-12B-A2.5B-Instruct-GGUF', 'JetBrains/Mellum2-12B-A2.5B-Instruct']
  },
  {
    id: 'hf.co/JetBrains/Mellum2-12B-A2.5B-Thinking-GGUF-Q4_K_M:Q4_K_M',
    repos: ['JetBrains/Mellum2-12B-A2.5B-Thinking-GGUF', 'JetBrains/Mellum2-12B-A2.5B-Thinking']
  },
  {
    id: 'hf.co/bigatuna/Qwen3.5-9b-Sushi-Coder-RL-GGUF:Q4_K_M',
    repos: ['bigatuna/Qwen3.5-9b-Sushi-Coder-RL-GGUF', 'bigatuna/Qwen3.5-9b-Sushi-Coder-RL']
  },
  {
    id: 'hf.co/mradermacher/Qwen3.5-9B-Coder-GGUF:Q4_K_M',
    repos: ['mradermacher/Qwen3.5-9B-Coder-GGUF', 'Qwen/Qwen2.5-Coder-7B-Instruct']
  },
  {
    id: 'hf.co/sillykiwi/Aroow-Rust-Coder-9B-Q4_K_S-GGUF:Q4_K_S',
    repos: ['sillykiwi/Aroow-Rust-Coder-9B-Q4_K_S-GGUF', 'sillykiwi/Aroow-Rust-Coder-9B']
  },
  {
    id: 'hf.co/empero-ai/Qwythos-9B-Claude-Mythos-5-1M-GGUF:Q4_K_M',
    repos: ['empero-ai/Qwythos-9B-Claude-Mythos-5-1M-GGUF', 'empero-ai/Qwythos-9B-Claude-Mythos-5-1M']
  }
];

function extractRecommendedSettings(readmeText) {
  const settings = {};

  // Check temperature
  const tempMatch = readmeText.match(/temperature[:\s=]+([0-9.]+)/i) ||
                    readmeText.match(/temp[:\s=]+([0-9.]+)/i);
  if (tempMatch) settings.temperature = parseFloat(tempMatch[1]);

  // Check top_p
  const topPMatch = readmeText.match(/top[_\s-]?p[:\s=]+([0-9.]+)/i);
  if (topPMatch) settings.top_p = parseFloat(topPMatch[1]);

  // Check repeat penalty
  const repMatch = readmeText.match(/repetition[_\s-]?penalty[:\s=]+([0-9.]+)/i) ||
                   readmeText.match(/repeat[_\s-]?penalty[:\s=]+([0-9.]+)/i);
  if (repMatch) settings.repeat_penalty = parseFloat(repMatch[1]);

  // Check min_p
  const minPMatch = readmeText.match(/min[_\s-]?p[:\s=]+([0-9.]+)/i);
  if (minPMatch) settings.min_p = parseFloat(minPMatch[1]);

  return settings;
}

async function run() {
  console.log(`================================================================`);
  console.log(`🌐 FETCHING OFFICIAL HUGGING FACE MODEL CARDS & SETTINGS`);
  console.log(`================================================================\n`);

  const results = [];

  for (const c of candidates) {
    let fetched = false;
    for (const repo of c.repos) {
      try {
        const url = `https://huggingface.co/${repo}/raw/main/README.md`;
        const res = await fetch(url);
        if (res.ok) {
          const text = await res.text();
          const settings = extractRecommendedSettings(text);
          console.log(`✅ [FOUND] ${repo}`);
          console.log(`   - Settings Detected:`, settings);

          results.push({
            id: c.id,
            repo,
            settings: {
              temperature: settings.temperature ?? 0.2,
              top_p: settings.top_p ?? 0.95,
              repeat_penalty: settings.repeat_penalty ?? 1.1,
              min_p: settings.min_p ?? 0.05
            },
            snippet: text.slice(0, 300).replace(/\n/g, ' ')
          });
          fetched = true;
          break;
        }
      } catch (e) {
        // try next repo
      }
    }

    if (!fetched) {
      console.log(`⚠️ [FALLBACK] Could not reach raw README for ${c.id}, using default code review params`);
      results.push({
        id: c.id,
        repo: c.repos[0],
        settings: {
          temperature: 0.2,
          top_p: 0.95,
          repeat_penalty: 1.1,
          min_p: 0.05
        },
        snippet: 'Default recommended coding settings (low temperature for deterministic code inspection)'
      });
    }
  }

  return results;
}

run().then(res => {
  import('fs').then(fs => {
    fs.writeFileSync('scripts/hf_detected_settings.json', JSON.stringify(res, null, 2), 'utf8');
    console.log('\n📄 Saved settings to scripts/hf_detected_settings.json');
  });
}).catch(console.error);
