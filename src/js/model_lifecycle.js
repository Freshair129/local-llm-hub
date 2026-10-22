// trace:implements FR-005
export function getModelLifecyclePresentation(model) {
  const backend = String(model?.backend || '').toLowerCase();
  const lifecycleSupported = typeof model?.lifecycle_supported === 'boolean'
    ? model.lifecycle_supported
    : backend === 'ollama';
  const lifecycleStatusKnown = typeof model?.lifecycle_status_known === 'boolean'
    ? model.lifecycle_status_known
    : backend !== 'ollama';

  let statusLabel = 'READY';
  if (!lifecycleStatusKnown) {
    statusLabel = 'UNKNOWN';
  } else if (model?.is_active) {
    statusLabel = backend === 'vllm' ? 'SERVING' : 'ACTIVE';
  } else if (backend === 'gguf' || backend === 'hf') {
    statusLabel = 'ON DISK';
  }

  let actionTitle;
  if (!lifecycleStatusKnown) {
    actionTitle = 'Loaded state unavailable; refresh before changing lifecycle';
  } else if (!lifecycleSupported) {
    actionTitle = backend === 'vllm'
      ? 'Lifecycle is managed by the external vLLM server'
      : 'No managed inference process is configured for this model';
  } else {
    actionTitle = model?.is_active ? 'Unload model' : 'Load model';
  }

  return {
    statusLabel,
    lifecycleStatusKnown,
    lifecycleSupported,
    canToggle: lifecycleStatusKnown && lifecycleSupported,
    actionTitle,
    actionIcon: model?.is_active ? 'ph-stop' : 'ph-play',
    actionColor: model?.is_active ? '#ef4444' : '#10b981'
  };
}
