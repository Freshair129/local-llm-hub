// trace:implements FEAT-GPU-MODEL-ADVISOR

const BINARY_GIB = 1024 ** 3;
const MAX_COMPARE_GPUS = 6;
const DEFAULT_CAPACITIES_GIB = [4, 6, 8, 12, 16, 24, 32, 48];

export function validateVramGiB(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function addComparisonGpu(selectedIds, nextId) {
  if (!nextId || selectedIds.includes(nextId) || selectedIds.length >= MAX_COMPARE_GPUS) {
    return { selectedIds: [...selectedIds], added: false };
  }
  return { selectedIds: [...selectedIds, nextId], added: true };
}

export function recommendForVram(run, targetVramBytes, selectedGpuId = null) {
  if (selectedGpuId && run.gpu.id === selectedGpuId) {
    if (run.metrics.gpuOnly === true) return 'measured_on_selected_gpu';
    if (run.metrics.gpuOnly === false) return 'offloaded_on_selected_gpu';
    return 'measured_memory_unknown_on_selected_gpu';
  }
  if (!Number.isFinite(targetVramBytes) || targetVramBytes <= 0) return 'target_vram_required';
  if (run.metrics.gpuOnly === false) return 'offloaded_reference_only';
  if (run.metrics.gpuOnly !== true || !Number.isFinite(run.metrics.peakDeviceMiB)) return 'insufficient_memory_evidence';
  return targetVramBytes >= run.metrics.peakDeviceMiB * 1024 ** 2 ? 'capacity_candidate_unverified' : 'below_observed_peak';
}

const CONDITION_LABELS = {
  benchmark: 'ชุดทดสอบ',
  taskSetSha256: 'ชุดโจทย์',
  heldoutSha256: 'ชุด hidden tests',
  modelId: 'ไฟล์น้ำหนักโมเดล',
  options: 'sampler / context / token budget',
  mode: 'โหมด prompt',
  thinking: 'thinking mode',
  runtime: 'รุ่น runtime',
  stage: 'รอบทดสอบ',
  seeds: 'seeds'
};

export function compareRunConditions(left, right) {
  const differences = [];
  const fields = [
    ['benchmark', left.benchmark, right.benchmark],
    ['taskSetSha256', left.conditions.taskSetSha256, right.conditions.taskSetSha256],
    ['heldoutSha256', left.conditions.heldoutSha256, right.conditions.heldoutSha256],
    ['modelId', left.model.id, right.model.id],
    ['options', left.conditions.options, right.conditions.options],
    ['mode', left.conditions.mode, right.conditions.mode],
    ['thinking', left.conditions.thinking, right.conditions.thinking],
    ['runtime', left.conditions.runtime, right.conditions.runtime],
    ['stage', left.stage, right.stage],
    ['seeds', left.conditions.seeds, right.conditions.seeds]
  ];
  for (const [key, a, b] of fields) {
    if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) differences.push(CONDITION_LABELS[key]);
  }
  return differences;
}

export function filterBenchmarkRuns(runs, { query = '', stage = '', benchmark = '', task = '' } = {}) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return runs.filter(run => {
    const textMatch = !normalizedQuery || `${run.model.label} ${run.model.alias || ''} ${run.model.quantization || ''}`.toLocaleLowerCase().includes(normalizedQuery);
    const stageMatch = !stage || run.stage === stage;
    const benchmarkMatch = !benchmark || run.benchmark === benchmark;
    const taskMatch = !task || run.evidence.slots.some(row => row.task === task);
    return textMatch && stageMatch && benchmarkMatch && taskMatch;
  });
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function option(value, text) {
  const item = element('option', '', text);
  item.value = value;
  return item;
}

function evidenceLink(label, href) {
  const link = element('a', 'advisor-evidence-link', label);
  link.href = href;
  link.target = '_blank';
  link.rel = 'noreferrer';
  return link;
}

function formatGib(mib) {
  return Number.isFinite(mib) ? `${(mib / 1024).toFixed(2)} GiB` : 'ไม่มีข้อมูล';
}

function formatMetric(value, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : '—';
}

function qualityText(run) {
  const passed = run.metrics.combinedPasses;
  const total = run.metrics.planned;
  return Number.isFinite(passed) && Number.isFinite(total) && total > 0 ? `${passed}/${total}` : 'ไม่มีผลคะแนน';
}

function labelForRecommendation(state) {
  return ({
    target_vram_required: 'เลือกขนาด VRAM เพื่อประเมิน',
    measured_on_selected_gpu: 'ทดสอบบน GPU รุ่นนี้',
    offloaded_on_selected_gpu: 'ทดสอบบน GPU รุ่นนี้ · มี offload',
    measured_memory_unknown_on_selected_gpu: 'ทดสอบแล้ว · ไม่ทราบสถานะ VRAM',
    capacity_candidate_unverified: 'ความจุใกล้เคียงผลอ้างอิง · ยังไม่ยืนยัน',
    below_observed_peak: 'VRAM ต่ำกว่าค่าสูงสุดที่เคยวัด',
    offloaded_reference_only: 'ผลอ้างอิงมี CPU/GPU offload',
    insufficient_memory_evidence: 'หลักฐาน VRAM ยังไม่พอ'
  })[state] || 'ไม่มีข้อมูล';
}

function conditionsText(run) {
  const options = run.conditions.options || {};
  const fields = [
    `ctx ${Number.isFinite(options.num_ctx) ? options.num_ctx.toLocaleString() : '—'}`,
    `output ${Number.isFinite(options.num_predict) ? options.num_predict.toLocaleString() : '—'}`,
    `T=${formatMetric(options.temperature, 2)}`,
    `presence=${formatMetric(options.presence_penalty, 2)}`,
    `think=${run.conditions.thinking ?? 'native'}`
  ];
  return fields.join(' · ');
}

export async function initModelAdvisor() {
  const root = document.getElementById('view-model-advisor');
  if (!root || root.dataset.initialized === 'true') return;
  root.dataset.initialized = 'true';
  try {
    const [runsResponse, gpuResponse] = await Promise.all([
      fetch('./data/benchmark_catalog.json'),
      fetch('./data/gpu_catalog.json')
    ]);
    if (!runsResponse.ok || !gpuResponse.ok) throw new Error('โหลด benchmark catalog ไม่สำเร็จ');
    const catalog = await runsResponse.json();
    const gpuCatalog = await gpuResponse.json();
    renderAdvisor(root, catalog, gpuCatalog);
  } catch (error) {
    root.dataset.initialized = '';
    root.replaceChildren(element('p', 'advisor-empty', `เปิด Model Advisor ไม่ได้: ${error.message || error}`));
    const retry = element('button', 'advisor-button', 'ลองโหลดใหม่');
    retry.type = 'button';
    retry.addEventListener('click', initModelAdvisor);
    root.append(retry);
  }
}

function renderAdvisor(root, catalog, gpuCatalog) {
  const runs = catalog.runs || [];
  const gpus = gpuCatalog.variants || catalog.gpus || [];
  const testedGpuIds = new Set(runs.map(run => run.gpu.id));
  const state = {
    targetVram: 16 * BINARY_GIB,
    selectedGpuIds: [null],
    selectedRunId: runs[0]?.id || '',
    search: '',
    stage: '',
    benchmark: '',
    task: ''
  };

  const header = element('div', 'view-header advisor-header');
  const heading = element('div', 'view-heading');
  heading.append(element('h1', '', 'เลือกโมเดลให้เหมาะกับ GPU'));
  heading.append(element('p', '', 'คำแนะนำ VRAM พร้อมผลทดสอบแยกตามการ์ดจอและโปรไฟล์'));
  header.append(heading);
  root.replaceChildren(header);

  const summary = element('div', 'advisor-evidence-summary');
  summary.append(element('span', 'advisor-badge', `${runs.length} โปรไฟล์ทดสอบ`));
  summary.append(element('span', 'advisor-badge', `${testedGpuIds.size} GPU ที่มีผลจริง`));
  summary.append(element('span', 'advisor-note', 'ข้อมูลจากรายงานที่ตรวจสอบแล้ว · เปิดหน้าไม่เริ่ม inference'));
  root.append(summary);

  const filterPanel = element('section', 'advisor-controls');
  filterPanel.setAttribute('aria-label', 'ตัวกรองคำแนะนำโมเดล');
  const vramLabel = element('label', 'advisor-field', 'VRAM เป้าหมาย');
  const vramSelect = element('select', 'advisor-select');
  vramSelect.id = 'advisor-vram-preset';
  vramSelect.append(option('', 'เลือกขนาด VRAM'));
  for (const amount of DEFAULT_CAPACITIES_GIB) vramSelect.append(option(String(amount), `${amount} GiB`));
  vramSelect.append(option('custom', 'กำหนดเอง'));
  vramSelect.value = '16';
  vramLabel.append(vramSelect);
  const customVram = element('input', 'advisor-input');
  customVram.type = 'number';
  customVram.min = '0.1';
  customVram.step = '0.1';
  customVram.value = '16';
  customVram.setAttribute('aria-label', 'VRAM ที่ต้องการ หน่วย GiB');
  vramLabel.append(customVram);
  filterPanel.append(vramLabel);

  const searchLabel = element('label', 'advisor-field', 'ค้นหาโมเดล');
  const searchInput = element('input', 'advisor-input');
  searchInput.type = 'search';
  searchInput.placeholder = 'ชื่อ / alias / quantization';
  searchLabel.append(searchInput);
  filterPanel.append(searchLabel);

  const stageLabel = element('label', 'advisor-field', 'รอบทดสอบ');
  const stageSelect = element('select', 'advisor-select');
  stageSelect.append(option('', 'ทุกรอบ'));
  [...new Set(runs.map(run => run.stage))].sort().forEach(value => stageSelect.append(option(value, value)));
  stageLabel.append(stageSelect);
  filterPanel.append(stageLabel);

  const benchmarkLabel = element('label', 'advisor-field', 'ชุดทดสอบ');
  const benchmarkSelect = element('select', 'advisor-select');
  benchmarkSelect.append(option('', 'ทุกชุด'));
  [...new Set(runs.map(run => run.benchmark))].sort().forEach(value => benchmarkSelect.append(option(value, value)));
  benchmarkLabel.append(benchmarkSelect);
  filterPanel.append(benchmarkLabel);

  const taskLabel = element('label', 'advisor-field', 'โจทย์');
  const taskSelect = element('select', 'advisor-select');
  taskSelect.append(option('', 'ทุกโจทย์'));
  const tasks = [...new Set(runs.flatMap(run => run.evidence.slots.map(row => row.task).filter(Boolean)))].sort();
  tasks.forEach(value => taskSelect.append(option(value, value)));
  taskLabel.append(taskSelect);
  filterPanel.append(taskLabel);
  root.append(filterPanel);

  const recommendations = element('section', 'advisor-section');
  recommendations.append(element('h2', '', 'โมเดลและผลที่วัดได้'));
  recommendations.append(element('p', 'advisor-note', 'ผลคะแนนแสดงตัวเศษ/ตัวหารของชุดทดสอบนั้น ค่า VRAM เป็นยอดสูงสุดที่รายงานไว้และอาจรวมการใช้งานอื่นในเครื่อง'));
  const cards = element('div', 'advisor-model-grid');
  recommendations.append(cards);
  root.append(recommendations);

  const compareSection = element('section', 'advisor-section');
  const compareHeading = element('div', 'advisor-section-heading');
  compareHeading.append(element('h2', '', 'เปรียบเทียบ GPU สูงสุด 6 รุ่น'));
  const addGpu = element('button', 'advisor-button', 'เพิ่ม GPU');
  addGpu.type = 'button';
  compareHeading.append(addGpu);
  compareSection.append(compareHeading);
  compareSection.append(element('p', 'advisor-note', 'เทียบโมเดลน้ำหนักเดียวกันและตรวจว่า suite, settings, runtime, stage และ seeds ตรงกันก่อนสรุปผล'));
  const compareSlots = element('div', 'advisor-gpu-slots');
  compareSection.append(compareSlots);
  const comparison = element('div', 'advisor-comparison-scroll');
  compareSection.append(comparison);
  root.append(compareSection);

  function currentVram() {
    const amount = validateVramGiB(customVram.value);
    return amount ? amount * BINARY_GIB : null;
  }

  function filteredRuns() {
    return filterBenchmarkRuns(runs, state);
  }

  function renderCards() {
    const targetBytes = currentVram();
    const selectedGpu = gpus.find(gpu => state.selectedGpuIds.includes(gpu.id));
    const list = filteredRuns();
    cards.replaceChildren();
    if (!list.length) {
      cards.append(element('p', 'advisor-empty', 'ไม่พบผลตามตัวกรองนี้'));
      return;
    }
    for (const run of list) {
      const card = element('article', `advisor-model-card${run.id === state.selectedRunId ? ' is-selected' : ''}`);
      const title = element('div', 'advisor-card-title');
      title.append(element('h3', '', run.model.label));
      title.append(element('span', 'advisor-badge', run.model.quantization || 'quant ไม่ระบุ'));
      card.append(title);
      card.append(element('p', 'advisor-note', `${run.benchmark} · ${run.stage} · ${run.model.alias || 'alias ไม่มี'}`));
      const decision = run.decision || 'baseline_or_unrated';
      if (decision === 'do_not_promote') card.append(element('p', 'advisor-status is-warning', 'ค่าทดลองนี้ไม่ผ่านการยืนยัน · ไม่แนะนำให้เลื่อนเป็น baseline'));
      const recommendation = recommendForVram(run, targetBytes || 0, selectedGpu?.id || null);
      card.append(element('p', `advisor-status ${recommendation === 'measured_on_selected_gpu' ? 'is-success' : ''}`, labelForRecommendation(recommendation)));
      const metrics = element('dl', 'advisor-metrics');
      for (const [term, value] of [
        ['Quality gate', qualityText(run)],
        ['ความเร็วมัธยฐาน', Number.isFinite(run.metrics.medianTokensPerSecond) ? `${formatMetric(run.metrics.medianTokensPerSecond)} t/s · n=${run.metrics.speedSampleCount}` : '—'],
        ['เวลามัธยฐาน', Number.isFinite(run.metrics.medianSeconds) ? `${formatMetric(run.metrics.medianSeconds)} วินาที` : '—'],
        ['VRAM สูงสุดที่วัด', formatGib(run.metrics.peakDeviceMiB)],
        ['GPU / offload', run.metrics.gpuOnly === true ? 'GPU only' : run.metrics.gpuOnly === false ? 'CPU + GPU offload' : 'ไม่ทราบ'],
        ['หยุดเพราะ token limit', run.metrics.budgetStops ?? '—']
      ]) {
        metrics.append(element('dt', '', term));
        metrics.append(element('dd', '', String(value)));
      }
      card.append(metrics);
      card.append(element('p', 'advisor-conditions', conditionsText(run)));
      card.append(element('p', 'advisor-note', `${run.gpu.name} · ${run.gpu.variant} · ${run.metrics.planned} slots · ${run.date ? new Date(run.date).toLocaleDateString() : 'วันที่ไม่ระบุ'}`));
      if (run.metrics.edgeDiagnostic) card.append(element('p', 'advisor-status is-warning', `Edge diagnostic: ${run.metrics.edgeDiagnostic.passed} ผ่าน · ${run.metrics.edgeDiagnostic.failed} ล้มเหลว · ${run.metrics.edgeDiagnostic.notExecutable} รันไม่ได้`));
      if (run.evidence.path) card.append(element('p', 'advisor-note', `ไฟล์รายงานต้นทาง: ${run.evidence.path}`));
      const choose = element('button', 'advisor-button advisor-select-run', run.id === state.selectedRunId ? 'เลือกโปรไฟล์นี้แล้ว' : 'เลือกเทียบข้าม GPU');
      choose.type = 'button';
      choose.addEventListener('click', () => {
        state.selectedRunId = run.id;
        renderCards();
        renderComparison();
      });
      card.append(choose);
      cards.append(card);
    }
  }

  function renderGpuSlots() {
    compareSlots.replaceChildren();
    state.selectedGpuIds.forEach((selectedId, index) => {
      const row = element('div', 'advisor-gpu-slot');
      const select = element('select', 'advisor-select');
      select.setAttribute('aria-label', `GPU เปรียบเทียบ ${index + 1}`);
      select.append(option('', 'เลือกการ์ดจอ'));
      for (const gpu of gpus) {
        const name = `${gpu.name} · ${gpu.variant}${testedGpuIds.has(gpu.id) ? ' · มีผลทดสอบ' : ' · ยังไม่มีผล'}`;
        const item = option(gpu.id, name);
        item.disabled = state.selectedGpuIds.includes(gpu.id) && gpu.id !== selectedId;
        select.append(item);
      }
      select.value = selectedId || '';
      select.addEventListener('change', () => {
        state.selectedGpuIds[index] = select.value || null;
        renderGpuSlots();
        renderComparison();
        renderCards();
      });
      row.append(select);
      const remove = element('button', 'advisor-icon-button', 'ลบ');
      remove.type = 'button';
      remove.setAttribute('aria-label', `ลบช่อง GPU ${index + 1}`);
      remove.addEventListener('click', () => {
        state.selectedGpuIds.splice(index, 1);
        renderGpuSlots();
        renderComparison();
        renderCards();
      });
      row.append(remove);
      compareSlots.append(row);
    });
    addGpu.disabled = state.selectedGpuIds.length >= MAX_COMPARE_GPUS;
    addGpu.textContent = `เพิ่ม GPU (${state.selectedGpuIds.filter(Boolean).length}/6)`;
  }

  function renderComparison() {
    comparison.replaceChildren();
    const selectedRun = runs.find(run => run.id === state.selectedRunId);
    if (!selectedRun) {
      comparison.append(element('p', 'advisor-empty', 'ยังไม่มีโปรไฟล์ผลทดสอบให้เปรียบเทียบ'));
      return;
    }
    const grid = element('div', 'advisor-comparison-grid');
    grid.style.setProperty('--advisor-columns', String(Math.max(1, state.selectedGpuIds.length)));
    for (const gpuId of state.selectedGpuIds) {
      const gpu = gpus.find(item => item.id === gpuId);
      if (!gpu) {
        grid.append(element('article', 'advisor-compare-card advisor-empty', 'เลือก GPU ในช่องด้านบน'));
        continue;
      }
      const card = element('article', 'advisor-compare-card');
      card.append(element('h3', '', gpu.name));
      card.append(element('p', 'advisor-note', `${gpu.variant} · ${(gpu.vramBytes / BINARY_GIB).toLocaleString(undefined, { maximumFractionDigits: 2 })} GiB`));
      const exact = runs.find(run => run.gpu.id === gpuId && run.cohortKey === selectedRun.cohortKey);
      if (exact) {
        card.append(element('p', 'advisor-status is-success', 'เงื่อนไขทดสอบตรงกัน'));
        const metrics = element('dl', 'advisor-metrics');
        for (const [term, value] of [
          ['Quality gate', qualityText(exact)],
          ['ความเร็วมัธยฐาน', Number.isFinite(exact.metrics.medianTokensPerSecond) ? `${formatMetric(exact.metrics.medianTokensPerSecond)} t/s` : '—'],
          ['เวลามัธยฐาน', Number.isFinite(exact.metrics.medianSeconds) ? `${formatMetric(exact.metrics.medianSeconds)} วินาที` : '—'],
          ['Peak VRAM', formatGib(exact.metrics.peakDeviceMiB)],
          ['Offload', exact.metrics.gpuOnly === true ? 'GPU only' : exact.metrics.gpuOnly === false ? 'CPU + GPU' : 'ไม่ทราบ']
        ]) {
          metrics.append(element('dt', '', term));
          metrics.append(element('dd', '', String(value)));
        }
        card.append(metrics);
        card.append(element('p', 'advisor-note', `driver ${exact.conditions.driver || '—'} · CPU ${exact.conditions.cpu || '—'} · ${exact.conditions.systemRamBytes ? `${(exact.conditions.systemRamBytes / BINARY_GIB).toFixed(1)} GiB RAM` : 'RAM —'}`));
        card.append(conditionDetails(exact));
      } else {
        const reference = runs.filter(run => run.gpu.id === gpuId && run.model.id === selectedRun.model.id)
          .sort((a, b) => compareRunConditions(selectedRun, a).length - compareRunConditions(selectedRun, b).length)[0];
        if (!reference) {
          card.append(element('p', 'advisor-empty', 'ยังไม่มีผลทดสอบสำหรับ GPU รุ่นนี้'));
          if (gpu.sourceUrl) card.append(evidenceLink(`สเปก VRAM จาก ${gpu.sourceLabel}`, gpu.sourceUrl));
        } else {
          card.append(element('p', 'advisor-status is-warning', `มีผลของน้ำหนักเดียวกัน แต่เงื่อนไขต่าง: ${compareRunConditions(selectedRun, reference).join(', ') || 'โปรไฟล์'}`));
          card.append(element('p', 'advisor-note', `${reference.benchmark} · ${reference.stage} · ${qualityText(reference)} · ${formatMetric(reference.metrics.medianTokensPerSecond)} t/s · ${formatGib(reference.metrics.peakDeviceMiB)}`));
          card.append(conditionDetails(reference));
        }
      }
      grid.append(card);
    }
    comparison.append(grid);
  }

  function updateFilters() {
    state.targetVram = currentVram();
    state.search = searchInput.value;
    state.stage = stageSelect.value;
    state.benchmark = benchmarkSelect.value;
    state.task = taskSelect.value;
    renderCards();
  }

  vramSelect.addEventListener('change', () => {
    if (vramSelect.value === 'custom') customVram.focus();
    else if (vramSelect.value) customVram.value = vramSelect.value;
    updateFilters();
  });
  customVram.addEventListener('input', updateFilters);
  searchInput.addEventListener('input', updateFilters);
  stageSelect.addEventListener('change', updateFilters);
  benchmarkSelect.addEventListener('change', updateFilters);
  taskSelect.addEventListener('change', updateFilters);
  addGpu.addEventListener('click', () => {
    if (state.selectedGpuIds.length < MAX_COMPARE_GPUS) state.selectedGpuIds.push(null);
    renderGpuSlots();
    renderComparison();
  });

  const decisionByAlias = new Map((catalog.decisions || []).map(item => [item.alias, item.status]));
  for (const run of runs) {
    run.decision = decisionByAlias.get(run.model.alias) || null;
  }
  renderGpuSlots();
  renderCards();
  renderComparison();
}

function conditionDetails(run) {
  const details = element('details', 'advisor-condition-details');
  details.append(element('summary', '', 'ดู settings, seeds และสภาพเครื่อง'));
  details.append(element('pre', 'advisor-condition-json', JSON.stringify({
    model: run.model,
    benchmark: run.benchmark,
    stage: run.stage,
    conditions: run.conditions,
    peakDeviceMiB: run.metrics.peakDeviceMiB,
    gpuOnly: run.metrics.gpuOnly
  }, null, 2)));
  return details;
}
