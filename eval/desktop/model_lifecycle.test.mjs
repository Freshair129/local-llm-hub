import test from 'node:test';
import assert from 'node:assert/strict';
import { getModelLifecyclePresentation } from '../../src/js/model_lifecycle.js';

// trace:verifies FR-005
test('Ollama lifecycle controls follow known loaded state', () => {
  const loaded = getModelLifecyclePresentation({
    backend: 'ollama',
    is_active: true,
    lifecycle_status_known: true,
    lifecycle_supported: true
  });
  assert.equal(loaded.statusLabel, 'ACTIVE');
  assert.equal(loaded.canToggle, true);
  assert.equal(loaded.actionTitle, 'Unload model');
});

// trace:verifies FR-005
test('unknown Ollama state disables lifecycle changes', () => {
  const unknown = getModelLifecyclePresentation({
    backend: 'ollama',
    is_active: false,
    lifecycle_status_known: false,
    lifecycle_supported: true
  });
  assert.equal(unknown.statusLabel, 'UNKNOWN');
  assert.equal(unknown.canToggle, false);
});

// trace:verifies FR-005
test('vLLM is shown as serving while its external lifecycle control stays disabled', () => {
  const serving = getModelLifecyclePresentation({
    backend: 'vllm',
    is_active: true,
    lifecycle_status_known: true,
    lifecycle_supported: false
  });
  assert.equal(serving.statusLabel, 'SERVING');
  assert.equal(serving.canToggle, false);
  assert.match(serving.actionTitle, /external vLLM server/);
});

// trace:verifies FR-005
test('local model files do not appear as loaded or expose fake lifecycle controls', () => {
  const onDisk = getModelLifecyclePresentation({
    backend: 'gguf',
    is_active: false,
    lifecycle_status_known: true,
    lifecycle_supported: false
  });
  assert.equal(onDisk.statusLabel, 'ON DISK');
  assert.equal(onDisk.canToggle, false);
});
