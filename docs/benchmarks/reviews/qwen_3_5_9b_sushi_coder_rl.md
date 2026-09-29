# Code Review by Qwen 3.5 9B Sushi Coder RL

Let me analyze this frontend code systematically:

**Architecture Overview:**
- Single entry point `main.js` handling navigation, model sync, chat init
- Uses mock invoke for development (no real Tauri core)
- Event-driven UI with inline handlers
- No state management library (vanilla JS)

**1. Strengths:**
- Clean separation of concerns (navigation, model sync, chat init)
- Mock invoke provides good dev experience
- Error handling with try/finally for async operations
- Telemetry polling implemented
- Responsive UI state management (loading/disabled states)

**2. Issues & Risks:**
- **Race Condition**: `initChat(models)` called multiple times without deduplication
- **State Desync**: `lanSharingActive` flag not synced with actual backend state
- **Error Handling**: Silent failures in `triggerProbe()` and `syncAllModels()`
- **Memory Leak**: Event listeners not cleaned up
- **No Debounce**: Rapid clicks could cause multiple invocations
- **Hardcoded Paths**: `models/gguf` hardcoded in multiple places
- **No User Feedback**: Alerts used instead of proper toast notifications
- **No Loading States**: UI doesn't show progress during long operations

**3. Recommendations:**
- Implement proper state management (Zustand/Redux)
- Add debouncing for expensive operations
- Use proper error boundaries
- Implement proper cleanup on app destroy
- Add proper loading skeletons instead of disabling buttons
- Use proper toast notification library
- Add proper type definitions
- Implement proper event listener cleanup
</think>

## Code Review: src/main.js

### 1. จุดแข็งและข้อดีของโค้ด (Strengths)

| Aspect | Details |
|--------|---------|
| **Modular Architecture** | Separates concerns: navigation, model sync, chat init, telemetry |
| **Dev Experience** | Mock invoke provides graceful fallback when Tauri core unavailable |
| **Async Safety** | Uses `try/finally` for cleanup in button handlers |
| **State Tracking** | `lanSharingActive` flag prevents duplicate start attempts |
| **Telemetry** | Polling mechanism for observability implemented |

---

### 2. ปัญหาและจุดเสี่ยงที่ต้องระวัง (Issues & Risks)

| Issue | Severity | Description |
|-------|----------|-------------|
| **Race Condition** | 🔴 Critical | `initChat(models)` called multiple times without deduplication. If `syncAllModels()` returns faster than UI updates, chat could be re-initialized with stale data |
| **State Desync** | 🟠 High | `lanSharingActive` flag is local-only. If backend fails silently, UI shows "active" but backend is stopped |
| **Silent Failures** | 🟠 High | `triggerProbe()` and `syncAllModels()` return undefined on error, but errors are not logged or shown to user |
| **Memory Leak** | 🟡 Medium | Event listeners attached but never removed. App restarts could cause memory bloat |
| **No Debounce** | 🟡 Medium | Rapid clicks on buttons could trigger multiple `invoke` calls |
| **Hardcoded Paths** | 🟡 Medium | `models/gguf` hardcoded in 3 places. Should use config or env vars |
| **Alert Usage** | 🟡 Medium | Native `alert()` blocks UI. Should use toast/notification library |
| **No Loading States** | 🟡 Medium | Buttons disabled but no visual feedback during long operations |

---

### 3. ข้อเสนอแนะในการปรับปรุงตามมาตรฐาน Tauri v2

```javascript
// ✅ RECOMMENDED: Add proper state management
import { create } from 'zustand';

const useAppState = create((set, get) => ({
  lanSharingActive: false,
  models: [],
  chatInitialized: false,
  
  setLanSharingActive: (active) => set({ lanSharingActive: active }),
  setModels: (models) => set({ models }),
  initChat: (models) => {
    if (get().chatInitialized) return;
    set({ models, chatInitialized: true });
    initChat(models);
  },
}));

// ✅ RECOMMENDED: Add debouncing
const debounce = (fn, ms) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), ms);
  };
};

// ✅ RECOMMENDED: Proper error handling wrapper
const safeInvoke = async (cmd, args, fallback = null) => {
  try {
    const result = await invoke(cmd, args);
    return result;
  } catch (err) {
    console.error(`[Invoke Error] ${cmd}:`, err);
    return fallback;
  }
};

// ✅ RECOMMENDED: Add cleanup on app destroy
window.addEventListener('beforeunload', () => {
  // Remove event listeners
  // Stop telemetry polling
  // Stop LAN share
});

// ✅ RECOMMENDED: Use toast library instead of alert
import { toast } from 'react-hot-toast'; // or similar

// ✅ RECOMMENDED: Add proper loading states
const LoadingSpinner = () => (
  <div className="spinner">Loading...</div>
);

// ✅ RECOMMENDED: Use config for paths
const CONFIG = {
  ggufDir: import.meta.env.VITE_GGUF_DIR || 'models/gguf',
  ollamaUrl: import.meta.env.VITE_OLLAMA_URL || '