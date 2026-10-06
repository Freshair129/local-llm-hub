// trace:implements FR-023
// trace:implements UAT-SPEC-001
// Assertion-driven acceptance. Historical persona reports are not execution evidence.
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const legacy = ['UAT-001', 'UAT-002', 'UAT-003', 'UAT-004'];

export async function executeUatSuite({ enabled = false, baseUrl, token, fetchImpl = fetch, timeoutMs = 10000 } = {}) {
  const results = legacy.map(id => ({ id, status: 'SKIP', reason: 'Legacy hardware/proxy/UI scenario requires an executable fixture; persona text is not evidence' }));
  const scenarios = [
    { id: 'HUB-HEALTH', route: '/health', check: data => data.status === 'ok' && data.service === 'local-llm-hub' },
    { id: 'HUB-MODELS', route: '/v1/models', check: data => Array.isArray(data.data) && data.data.some(m => m.id === 'mock-local') },
    { id: 'HUB-AGENT', route: '/v1/agents/assistant/run', body: { input: 'echo:uat-ok' }, check: data => data.output === 'uat-ok' && typeof data.session_id === 'string' },
    { id: 'HUB-CHAT', route: '/v1/chat/completions', body: { model: 'mock-local', messages: [{ role: 'user', content: 'echo:uat-chat' }] }, check: data => data.choices?.[0]?.message?.content === 'uat-chat' },
  ];
  for (const scenario of scenarios) {
    if (!enabled) {
      results.push({ id: scenario.id, status: 'SKIP', reason: 'Set LOCAL_LLM_UAT=1 to execute mock-service acceptance' });
      continue;
    }
    const start = performance.now();
    let code;
    try {
      if (!baseUrl || !token) throw new Error('CONFIG_REQUIRED');
      const url = new URL(baseUrl);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('CONFIG_INVALID');
      const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}${scenario.route}`, {
        method: scenario.body ? 'POST' : 'GET', redirect: 'error',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: scenario.body ? JSON.stringify(scenario.body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) code = `HTTP_${response.status}`;
      else {
        let data;
        try { data = await response.json(); } catch { code = 'INVALID_JSON'; }
        if (!code && !scenario.check(data)) code = 'ASSERTION_FAILED';
      }
    } catch (error) {
      code = ['CONFIG_REQUIRED', 'CONFIG_INVALID'].includes(error.message) ? error.message : 'REQUEST_FAILED';
    }
    results.push({ id: scenario.id, status: code ? 'FAIL' : 'PASS', latency_ms: performance.now() - start, ...(code ? { error: code } : {}) });
  }
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  return { suite: 'hub-mock-contract-and-legacy-coverage', generated_at: new Date().toISOString(),
    status: failed ? 'FAIL' : passed ? 'PASS_WITH_SKIPS' : 'NOT_RUN', passed, failed, skipped,
    executed: passed + failed, pass_rate: passed + failed ? passed / (passed + failed) : null, results };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const report = await executeUatSuite({ enabled: process.env.LOCAL_LLM_UAT === '1',
    baseUrl: process.env.LOCAL_LLM_HUB_URL, token: process.env.LOCAL_LLM_HUB_TOKEN });
  const directory = path.join(process.cwd(), '.hub', 'reports');
  await fs.mkdir(directory, { recursive: true });
  const filename = path.join(directory, `uat-${Date.now()}.json`);
  await fs.writeFile(filename, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(`${report.status}: ${report.passed} PASS, ${report.failed} FAIL, ${report.skipped} SKIP; ${filename}`);
  process.exitCode = report.failed ? 1 : 0;
}
