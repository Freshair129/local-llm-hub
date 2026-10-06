// src/main.js
// trace:implements PRJ-003
// trace:implements FR-006
// trace:implements FR-007
// trace:implements FR-008
// trace:implements FR-009
// trace:implements FR-010
// trace:implements NFR-003
// trace:implements ARCH-001

import { triggerProbe, scanGgufDirectory } from './js/backend.js';
import { renderModels, syncAllModels } from './js/model.js';
import { startTelemetryPolling, setTelemetryRefreshRate } from './js/observability.js';
import { initChat } from './js/chat.js';
import { refreshInferenceCatalog } from './js/inference-catalog.js';
import { showToast } from './js/toast.js';
import { store } from './js/state.js';
import { renderStatsDashboard } from './js/stats.js';
import { initModelAdvisor } from './js/model_advisor.js';
import { initArena, populateArenaModelSelectors } from './js/arena.js';
import { initDownloader } from './js/downloader.js';
import { initUpdater } from './js/updater.js';
import { initDigitalTwin } from './js/digital_twin_3d.js';
import { initSensors, setupSensorsEvents, refreshSensorTree, setSensorsRefreshRate } from './js/sensors.js';
import { initProcessManager, setProcessRefreshRate, refreshProcesses } from './js/process_manager.js';
import { refreshCpuTelemetry } from './js/cpu_telemetry.js';
import { initGpuTuning, refreshGpuTelemetry } from './js/gpu_tuning.js';
import { refreshHardwareSurfaces } from './js/hardware_surfaces.js';
import { initGateway, refreshGatewayView } from './js/gateway.js';
import { initStorage, refreshStorageView } from './js/storage.js';
import { initShare } from './js/share.js';
import { invoke } from './js/api.js';

// Navigation Tabs Setup (GHT Command Center 2-Tier Architecture)
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const viewPanels = document.querySelectorAll('.view-panel');
  const crumb = document.getElementById('sidebar-crumb');
  const parentTabs = document.querySelectorAll('.ptab, .top-tab-btn');
  const sidebar = document.getElementById('sidebar');
  const shell = document.getElementById('app-shell');
  const pinBtn = document.getElementById('sidebar-pin-btn');

  // Sidebar Hover & Pin Handlers (GHT Architecture)
  if (sidebar) {
    sidebar.addEventListener('mouseenter', () => {
      sidebar.classList.add('open');
    });
    sidebar.addEventListener('mouseleave', () => {
      if (!sidebar.classList.contains('pinned')) {
        sidebar.classList.remove('open');
      }
    });
  }

  // Sidebar Pin & Menu Toggle (Toggle button in topbar and rail pin)
  const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
  if (sidebar && shell) {
    const applyPinState = (isPinned) => {
      sidebar.classList.toggle('pinned', isPinned);
      sidebar.classList.toggle('open', isPinned);
      sidebar.classList.toggle('collapsed', !isPinned);
      shell.classList.toggle('rail-pinned', isPinned);
      shell.classList.toggle('rail-collapsed', !isPinned);
      if (pinBtn) pinBtn.classList.toggle('on', isPinned);
      if (btnToggleSidebar) btnToggleSidebar.classList.toggle('active', isPinned);
    };

    const toggleSidebar = (e) => {
      if (e) e.stopPropagation();
      const newState = !sidebar.classList.contains('pinned');
      applyPinState(newState);
      try {
        localStorage.setItem('local-llm-hub-rail-pinned', newState ? 'true' : 'false');
      } catch (err) {}
    };

    if (pinBtn) pinBtn.addEventListener('click', toggleSidebar);
    if (btnToggleSidebar) btnToggleSidebar.addEventListener('click', toggleSidebar);

    // Default to PINNED / EXPANDED for clean full labels
    let savedPin = 'true';
    try {
      const stored = localStorage.getItem('local-llm-hub-rail-pinned');
      if (stored !== null) savedPin = stored;
    } catch (err) {}
    applyPinState(savedPin !== 'false');
  }

  const groupHeaders = document.querySelectorAll('.s-grp');

  // Domain Switcher: Topbar tab filters Sidebar modules to ONLY that domain
  function switchDomain(domainKey) {
    parentTabs.forEach(t => {
      const isTarget = t.getAttribute('data-domain') === domainKey;
      t.classList.toggle('active', isTarget);
      t.classList.toggle('on', isTarget);
    });

    groupHeaders.forEach(grp => {
      const matches = grp.getAttribute('data-domain') === domainKey;
      grp.classList.toggle('active-domain', matches);
      grp.style.display = matches ? 'block' : 'none';
    });

    let firstItem = null;
    navItems.forEach(item => {
      const matches = item.getAttribute('data-domain') === domainKey;
      if (matches) {
        item.style.display = 'flex';
        if (!firstItem) firstItem = item;
      } else {
        item.style.display = 'none';
        item.classList.remove('active');
      }
    });

    if (firstItem) {
      firstItem.click();
    }
  }

  // Set initial active domain on startup
  switchDomain('model-management');

  // Parent Domain Tabs Switching
  parentTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const domainKey = tab.getAttribute('data-domain');
      if (domainKey) {
        switchDomain(domainKey);
      }
    });
  });

  // Rail Item Clicks (Modules inside active domain)
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');

      const targetView = item.getAttribute('data-view');
      const domainKey = item.getAttribute('data-domain') || 'model-management';
      const domainTab = document.querySelector(`.ptab[data-domain="${domainKey}"]`);
      const domainTitle = domainTab?.textContent?.trim() || domainKey.toUpperCase();
      const labelText = item.querySelector('.s-lbl')?.textContent?.trim() || targetView;

      // Update Breadcrumb: DOMAIN / MODULE
      if (crumb) {
        crumb.innerHTML = `${domainTitle.toUpperCase()} / <b>${labelText.toUpperCase()}</b>`;
      }

      // Sync active state on top domain tabs
      parentTabs.forEach(t => {
        const matches = t.getAttribute('data-domain') === domainKey;
        t.classList.toggle('active', matches);
        t.classList.toggle('on', matches);
      });

      store.setState({ activeView: targetView });

      viewPanels.forEach(panel => {
        panel.style.display = 'none';
      });

      const activePanel = document.getElementById(`view-${targetView}`);
      if (activePanel) {
        if (targetView === 'chat' || targetView === 'arena') {
          activePanel.style.display = 'flex';
        } else {
          activePanel.style.display = 'block';
        }
      }

      if (targetView === 'stats') {
        renderStatsDashboard();
      } else if (targetView === 'model-advisor') {
        initModelAdvisor();
      } else if (targetView === 'arena') {
        populateArenaModelSelectors();
      } else if (targetView === 'twin') {
        setTimeout(() => initDigitalTwin(), 60);
      } else if (targetView === 'sensors') {
        refreshSensorTree();
      } else if (targetView === 'gpu') {
        refreshProcesses();
      } else if (targetView === 'cpu') {
        refreshCpuTelemetry();
      } else if (targetView === 'gpu-tuning') {
        refreshGpuTelemetry();
      } else if (targetView === 'storage-telemetry' || targetView === 'motherboard-telemetry') {
        refreshHardwareSurfaces();
      } else if (targetView === 'gateway') {
        refreshGatewayView();
      } else if (targetView === 'storage') {
        refreshStorageView();
      }
    });
  });

  // Expose helper globally
  window.__switchDomain = switchDomain;
  window.__triggerProbe = triggerProbe;

  // Initialize with Domain 1: Model Management
  switchDomain('model-management');

  // Agent Mascot Avatar Interaction
  const mascotAvatar = document.getElementById('agent-mascot-avatar');
  if (mascotAvatar) {
    mascotAvatar.addEventListener('click', () => {
      showToast('🤖 Local Model Fleet: RTX 3060 CUDA Nominal — All systems ready!', 'success');
      mascotAvatar.style.transform = 'scale(1.25) rotate(15deg)';
      setTimeout(() => { mascotAvatar.style.transform = ''; }, 300);
    });
  }

  // Sync models button
  const btnSync = document.getElementById('btn-refresh-models');
  if (btnSync) {
    btnSync.addEventListener('click', async () => {
      btnSync.disabled = true;
      try {
        const models = await syncAllModels();
        store.setState({ models });
        await refreshInferenceViews();
        showToast('All models synced successfully', 'success');
      } catch (err) {
        showToast(`Model sync failed: ${err.message || err}`, 'error');
      } finally {
        btnSync.disabled = false;
      }
    });
  }

  // Probe backends button
  const btnProbe = document.getElementById('btn-probe-backends');
  if (btnProbe) {
    btnProbe.addEventListener('click', () => {
      triggerProbe();
      showToast('Probing backend adapters...', 'info');
    });
  }

  // Minimize to Tray button (Silent Background Mode)
  const btnTray = document.getElementById('btn-minimize-tray');
  if (btnTray) {
    btnTray.addEventListener('click', async () => {
      try {
        await invoke('hide_to_tray');
        showToast('Running silently in system tray (0% CPU). Click tray icon to restore.', 'info');
      } catch (err) {
        console.warn('Tray hide:', err);
      }
    });
  }

  // Frameless Window Controls (Tauri Borderless Mode)
  const btnWinMin = document.getElementById('btn-win-minimize');
  if (btnWinMin) {
    btnWinMin.addEventListener('click', async () => {
      try {
        await invoke('window_minimize');
      } catch (err) {
        console.warn('Window minimize failed:', err);
      }
    });
  }

  const btnWinMax = document.getElementById('btn-win-maximize');
  if (btnWinMax) {
    btnWinMax.addEventListener('click', async () => {
      try {
        await invoke('window_maximize');
      } catch (err) {
        console.warn('Window maximize failed:', err);
      }
    });
  }

  const btnWinClose = document.getElementById('btn-win-close');
  if (btnWinClose) {
    btnWinClose.addEventListener('click', async () => {
      try {
        await invoke('window_close');
        showToast('Running silently in system tray. Click tray icon to restore.', 'info');
      } catch (err) {
        console.warn('Window close failed:', err);
      }
    });
  }

  const titlebarDrag = document.querySelector('.titlebar-drag-spacer');
  if (titlebarDrag) {
    titlebarDrag.addEventListener('dblclick', async () => {
      try {
        await invoke('window_maximize');
      } catch (err) {}
    });
  }

  // Native Window Dragging Setup for Frameless Window
  const dragRegions = document.querySelectorAll('[data-tauri-drag-region], #app-titlebar, .titlebar-drag-spacer');
  dragRegions.forEach(region => {
    region.addEventListener('mousedown', async (e) => {
      // Ignore clicks on buttons, inputs, interactive widgets
      if (e.target.closest('button') || e.target.closest('.win-btn') || e.target.closest('#app-version-badge')) {
        return;
      }
      if (e.button === 0) { // Primary mouse click
        try {
          await invoke('window_start_dragging');
        } catch (err) {
          console.warn('Native drag invoke error:', err);
        }
      }
    });
  });

  // Scan GGUF Directory button
  const btnScanGguf = document.getElementById('btn-scan-gguf');
  if (btnScanGguf) {
    btnScanGguf.addEventListener('click', async () => {
      const defaultDir = store.state.lanSharedPath || 'models/gguf';
      btnScanGguf.classList.add('loading');
      btnScanGguf.disabled = true;
      try {
        const res = await scanGgufDirectory(defaultDir);
        if (res.success) {
          const models = await syncAllModels();
          store.setState({ models });
          await refreshInferenceViews();
          showToast(`GGUF scan complete: found ${models.length} models`, 'success');
        } else {
          showToast(`Scan failed: ${res.error}`, 'error');
        }
      } catch (err) {
        showToast(`Scan error: ${err.message || err}`, 'error');
      } finally {
        btnScanGguf.classList.remove('loading');
        btnScanGguf.disabled = false;
      }
    });
  }

  // Generate LiteLLM config button
  const btnGenProxy = document.getElementById('btn-gen-proxy-config');
  if (btnGenProxy) {
    btnGenProxy.addEventListener('click', async () => {
      btnGenProxy.disabled = true;
      try {
        const yaml = await invoke('generate_proxy_config', { outputPath: 'sidecar/config.yaml' });
        const previewEl = document.getElementById('proxy-config-preview');
        if (previewEl) previewEl.textContent = yaml;
        showToast('LiteLLM config.yaml generated successfully!', 'success');
      } catch (err) {
        showToast(`Failed to generate LiteLLM config: ${err}`, 'error');
      } finally {
        btnGenProxy.disabled = false;
      }
    });
  }
}

// Initialize Application
window.addEventListener('DOMContentLoaded', async () => {
  setupNavigation();
  renderStatsDashboard();
  initArena();
  await refreshInferenceViews();
  initDownloader();
  initUpdater();
  initSensors();
  setupSensorsEvents();
  initProcessManager();
  initGpuTuning();
  refreshCpuTelemetry();
  refreshHardwareSurfaces();
  initGateway();
  initStorage();
  initShare();
  startTelemetryPolling(2000);

  // Setup Refresh Rate Cadence Selector Listener
  const rateSelect = document.getElementById('select-telemetry-rate');
  if (rateSelect) {
    rateSelect.addEventListener('change', (e) => {
      const rate = parseInt(e.target.value, 10);
      setTelemetryRefreshRate(rate);
      setSensorsRefreshRate(rate);
      setProcessRefreshRate(rate);
      const text = e.target.options[e.target.selectedIndex]?.text || `${rate}ms`;
      showToast(rate > 0 ? `Telemetry refresh cadence set to ${text}` : 'Telemetry polling paused ⏸️', 'info');
    });
  }

  // Expose global backend reconnect handler for UI buttons
  window.__retryBackendSync = async () => {
    showToast('Probing backends and syncing models...', 'info');
    await triggerProbe();
    const models = await syncAllModels();
    if (models && models.length > 0) {
      store.setState({ models });
      await refreshInferenceViews();
      showToast(`Successfully connected! ${models.length} models loaded.`, 'success');
    } else {
      await refreshInferenceViews();
      showToast('No models detected yet. Please verify Ollama is active on 127.0.0.1:11434', 'warning');
    }
  };

  triggerProbe();
  const models = await syncAllModels();
  if (models && models.length > 0) {
    store.setState({ models });
    await refreshInferenceViews();
  } else {
    // If backend was still starting up, auto-retry once after 1.5s
    setTimeout(async () => {
      await triggerProbe();
      const retried = await syncAllModels();
      await refreshInferenceViews();
      if (retried && retried.length > 0) {
        store.setState({ models: retried });
      }
    }, 1500);
  }
});

// trace:implements FR-023
async function refreshInferenceViews() {
  const pending = refreshInferenceCatalog();
  initChat();
  populateArenaModelSelectors();
  await pending;
  initChat();
  populateArenaModelSelectors();
}
