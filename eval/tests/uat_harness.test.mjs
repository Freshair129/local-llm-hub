// trace:verifies FR-023
import assert from 'node:assert/strict';
import test from 'node:test';
import { executeUatSuite } from '../../scripts/run_local_llm_uat.mjs';

const options = { enabled: true, baseUrl: 'http://127.0.0.1:8787', token: 'test-only-token' };

test('disabled checks are SKIP, with no fabricated denominator or requests', async () => {
  const report = await executeUatSuite({ fetchImpl: () => assert.fail('network must not execute') });
  assert.equal(report.status, 'NOT_RUN');
  assert.equal(report.passed, 0);
  assert.equal(report.pass_rate, null);
  assert.equal(report.skipped, 8);
});

for (const [name, fetchImpl, expected] of [
  ['transport failure', async () => { throw new Error('SECRET_CANARY'); }, 'REQUEST_FAILED'],
  ['invalid JSON', async () => new Response('invalid'), 'INVALID_JSON'],
  ['failed assertion', async () => Response.json({ status: 'PASSED' }), 'ASSERTION_FAILED'],
  ['HTTP error', async () => new Response('secret', { status: 500 }), 'HTTP_500'],
]) {
  test(`${name} never produces a passing row`, async () => {
    const report = await executeUatSuite({ ...options, fetchImpl });
    assert.equal(report.status, 'FAIL');
    assert.equal(report.failed, 4);
    assert.equal(report.passed, 0);
    assert.equal(report.skipped, 4);
    assert.ok(report.results.filter(r => r.status === 'FAIL').every(r => r.error === expected));
    assert.ok(!JSON.stringify(report).includes('SECRET_CANARY'));
  });
}

test('successful assertions count only executed scenarios, leaving legacy UAT unverified', async () => {
  const fetchImpl = async url => Response.json(url.endsWith('/health') ? { status: 'ok', service: 'local-llm-hub' }
    : url.endsWith('/models') ? { data: [{ id: 'mock-local' }] }
    : url.endsWith('/run') ? { output: 'uat-ok', session_id: 'session' }
    : { choices: [{ message: { content: 'uat-chat' } }] });
  const report = await executeUatSuite({ ...options, fetchImpl });
  assert.equal(report.status, 'PASS_WITH_SKIPS');
  assert.equal(report.executed, 4);
  assert.equal(report.passed, 4);
  assert.equal(report.skipped, 4);
});
