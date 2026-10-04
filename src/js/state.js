// src/js/state.js
// trace:implements ARCH-001
// Centralized Reactive Application State Container (Eliminates God Object in main.js)

class AppStore {
  constructor() {
    this._state = {
      lanSharingActive: false,
      lanSharedPath: 'models/gguf',
      lanPort: 8080,
      activeView: 'models',
      models: [],
      inferenceCatalog: { mode: null, models: [], loading: true, error: null },
      selectedModel: null,
      isScanningGguf: false
    };
    this._listeners = new Set();
  }

  get state() {
    return this._state;
  }

  getState() {
    return this._state;
  }

  setState(partial) {
    this._state = { ...this._state, ...partial };
    this._notify();
  }

  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  _notify() {
    for (const listener of this._listeners) {
      try {
        listener(this._state);
      } catch (err) {
        console.error('State listener error:', err);
      }
    }
  }
}

export const store = new AppStore();
