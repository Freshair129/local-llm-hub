// scripts/find_review_candidates.mjs
async function run() {
  const res = await fetch('http://127.0.0.1:11434/api/tags');
  const data = await res.json();
  const models = data.models || [];

  console.log(`\n======================================================`);
  console.log(`📦 TOTAL LOCAL MODELS FOUND: ${models.length}`);
  console.log(`======================================================\n`);

  const categories = {
    'Specialized Coding & Architecture': [],
    'Deep Thinking & Reasoning': [],
    'General Instruct & Agentic': []
  };

  for (const m of models) {
    const sizeGb = (m.size / 1e9).toFixed(2) + ' GB';
    const name = m.name;

    if (/coder|code|rust/i.test(name)) {
      categories['Specialized Coding & Architecture'].push({ name, size: sizeGb });
    } else if (/think|reason|heretic|mythos/i.test(name)) {
      categories['Deep Thinking & Reasoning'].push({ name, size: sizeGb });
    } else if (/instruct|agentic|composer/i.test(name)) {
      categories['General Instruct & Agentic'].push({ name, size: sizeGb });
    }
  }

  for (const [cat, list] of Object.entries(categories)) {
    console.log(`### ${cat} (${list.length} models):`);
    for (const item of list) {
      console.log(`  - ${item.name} (${item.size})`);
    }
    console.log('');
  }
}

run().catch(console.error);
