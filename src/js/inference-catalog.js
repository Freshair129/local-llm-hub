// trace:implements FR-023
import { invoke } from './api.js';
import { store } from './state.js';

let refreshId = 0;

export async function refreshInferenceCatalog() {
  const id = ++refreshId;
  store.setState({ inferenceCatalog: { ...store.state.inferenceCatalog, loading: true, error: null } });
  try {
    const catalog = await invoke('get_chat_catalog');
    if (!['hub', 'legacy'].includes(catalog?.mode) || !Array.isArray(catalog.models) ||
        !catalog.models.every(model => ['id', 'name', 'model', 'backend'].every(key => typeof model[key] === 'string' && model[key]))) {
      throw new Error('Invalid inference catalog');
    }
    if (id === refreshId) store.setState({ inferenceCatalog: { ...catalog, loading: false, error: null } });
  } catch (error) {
    if (id === refreshId) store.setState({ inferenceCatalog: { mode: null, models: [], loading: false, error: String(error) } });
  }
  return store.state.inferenceCatalog;
}

export function populateInferenceSelect(select, catalog, defaultIndex = 0) {
  if (!select) return;
  const selected = select.value;
  select.replaceChildren();
  for (const model of catalog.models) {
    const option = document.createElement('option');
    option.value = model.id;
    option.textContent = `${model.name} (${model.backend})`;
    select.appendChild(option);
  }
  if (!catalog.models.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = catalog.error || (catalog.loading ? 'Loading models...' : 'No inference models available');
    select.appendChild(option);
    select.value = '';
  } else {
    select.value = catalog.models.some(model => model.id === selected) ? selected
      : catalog.models[Math.min(defaultIndex, catalog.models.length - 1)].id;
  }
  select.disabled = catalog.loading || !!catalog.error || !catalog.models.length;
}
