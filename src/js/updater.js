// src/js/updater.js
// trace:implements FR-014
//! In-App Version Information & Auto-Update Manager

import { showToast } from './toast.js';
import { invoke } from './api.js';

let currentVersionInfo = null;
let latestUpdateResult = null;

export async function initUpdater() {
  await fetchAppVersion();
  renderVersionBadge();
  setupUpdaterModal();
}

async function fetchAppVersion() {
  try {
    currentVersionInfo = await invoke('get_app_version');
  } catch (err) {
    currentVersionInfo = {
      current_version: "0.1.0",
      app_name: "Local LLM Hub",
      target_platform: "windows-x86_64",
      release_channel: "stable",
      git_commit: "HEAD",
      build_date: "2026-09-29"
    };
  }
}

function renderVersionBadge() {
  const footer = document.querySelector('.sidebar-footer');
  if (!footer) return;

  let versionBadge = document.getElementById('app-version-badge');
  if (!versionBadge) {
    versionBadge = document.createElement('div');
    versionBadge.id = 'app-version-badge';
    versionBadge.className = 'telemetry-badge cursor-pointer';
    versionBadge.style.cursor = 'pointer';
    versionBadge.style.marginTop = '8px';
    footer.appendChild(versionBadge);
  }

  const ver = currentVersionInfo ? `v${currentVersionInfo.current_version}` : 'v0.1.0';
  versionBadge.innerHTML = `
    <span>App Version</span>
    <span class="version-tag">
      <span class="status-dot dot-online" id="updater-status-dot"></span>
      <b id="updater-version-label">${ver}</b>
    </span>
  `;

  versionBadge.addEventListener('click', openUpdateModal);
}

function setupUpdaterModal() {
  if (document.getElementById('update-modal')) return;

  const modal = document.createElement('div');
  modal.id = 'update-modal';
  modal.className = 'modal-backdrop';
  modal.style.display = 'none';

  modal.innerHTML = `
    <div class="modal-card glass-panel" style="max-width: 520px;">
      <div class="modal-header">
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="font-size:24px;">🔄</span>
          <div>
            <h3 style="margin:0; font-size:18px; color:#fff;">System Version & Updates</h3>
            <span style="font-size:12px; color:var(--text-muted);" id="modal-app-platform">Local LLM Hub</span>
          </div>
        </div>
        <button class="modal-close-btn" id="btn-close-updater">&times;</button>
      </div>

      <div class="modal-body" style="padding: 20px 0;">
        <div class="version-info-grid">
          <div class="ver-stat-card">
            <span class="ver-stat-label">Current Version</span>
            <span class="ver-stat-val" id="modal-current-ver">-</span>
          </div>
          <div class="ver-stat-card">
            <span class="ver-stat-label">Latest Version</span>
            <span class="ver-stat-val" id="modal-latest-ver" style="color:#38bdf8;">-</span>
          </div>
          <div class="ver-stat-card">
            <span class="ver-stat-label">Release Channel</span>
            <span class="ver-stat-val" id="modal-release-channel">Stable</span>
          </div>
          <div class="ver-stat-card">
            <span class="ver-stat-label">Build Date</span>
            <span class="ver-stat-val" id="modal-build-date">-</span>
          </div>
        </div>

        <div id="update-changelog-container" style="margin-top: 16px; background: rgba(0,0,0,0.3); border-radius: 8px; padding: 14px; border: 1px solid rgba(255,255,255,0.06); max-height: 180px; overflow-y: auto;">
          <div style="font-size:12px; color:var(--text-muted); margin-bottom: 6px; font-weight: 600;">RELEASE NOTES / CHANGELOG:</div>
          <div id="modal-release-notes" style="font-size: 13px; line-height: 1.5; color: #cbd5e1; white-space: pre-wrap;">Click "Check for Updates" to query the latest release manifest.</div>
        </div>

        <div id="update-download-progress" style="margin-top: 16px; display: none;">
          <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:6px; color:#38bdf8;">
            <span id="update-stage-text">Downloading release binary...</span>
            <span id="update-stage-pct">0%</span>
          </div>
          <div class="progress-bar-track">
            <div id="update-progress-fill" class="progress-bar-fill" style="width: 0%;"></div>
          </div>
        </div>
      </div>

      <div class="modal-footer" style="display:flex; justify-content:space-between; align-items:center;">
        <button id="btn-check-updates" class="btn btn-secondary">
          <span>🔍 Check for Updates</span>
        </button>
        <button id="btn-install-update" class="btn btn-primary" style="display:none;">
          <span>🚀 Update & Restart</span>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Events
  document.getElementById('btn-close-updater')?.addEventListener('click', closeUpdateModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeUpdateModal();
  });

  document.getElementById('btn-check-updates')?.addEventListener('click', checkForUpdates);
  document.getElementById('btn-install-update')?.addEventListener('click', installUpdate);
}

export function openUpdateModal() {
  const modal = document.getElementById('update-modal');
  if (!modal) return;

  const currentVerEl = document.getElementById('modal-current-ver');
  const platformEl = document.getElementById('modal-app-platform');
  const buildDateEl = document.getElementById('modal-build-date');
  const channelEl = document.getElementById('modal-release-channel');

  if (currentVersionInfo) {
    if (currentVerEl) currentVerEl.textContent = `v${currentVersionInfo.current_version}`;
    if (platformEl) platformEl.textContent = `${currentVersionInfo.app_name} (${currentVersionInfo.target_platform})`;
    if (buildDateEl) buildDateEl.textContent = currentVersionInfo.build_date;
    if (channelEl) channelEl.textContent = currentVersionInfo.release_channel.toUpperCase();
  }

  modal.style.display = 'flex';
}

export function closeUpdateModal() {
  const modal = document.getElementById('update-modal');
  if (modal) modal.style.display = 'none';
}

async function checkForUpdates() {
  const btnCheck = document.getElementById('btn-check-updates');
  const btnInstall = document.getElementById('btn-install-update');
  const latestVerEl = document.getElementById('modal-latest-ver');
  const notesEl = document.getElementById('modal-release-notes');
  const statusDot = document.getElementById('updater-status-dot');

  if (btnCheck) {
    btnCheck.disabled = true;
    btnCheck.innerHTML = '<span>⏳ Checking...</span>';
  }

  try {
    latestUpdateResult = await invoke('check_for_updates');

    if (latestVerEl) latestVerEl.textContent = `v${latestUpdateResult.latest_version}`;
    if (notesEl) notesEl.textContent = latestUpdateResult.release_notes;

    if (latestUpdateResult.has_update) {
      if (btnInstall) btnInstall.style.display = 'inline-flex';
      if (statusDot) {
        statusDot.className = 'status-dot';
        statusDot.style.background = '#38bdf8';
        statusDot.style.boxShadow = '0 0 8px #38bdf8';
      }
      showToast(`New version v${latestUpdateResult.latest_version} is available!`, 'info');
    } else {
      if (btnInstall) btnInstall.style.display = 'none';
      showToast('You are on the latest version.', 'success');
    }
  } catch (err) {
    showToast(`Check update failed: ${err}`, 'error');
  } finally {
    if (btnCheck) {
      btnCheck.disabled = false;
      btnCheck.innerHTML = '<span>🔍 Check for Updates</span>';
    }
  }
}

async function installUpdate() {
  if (!latestUpdateResult?.download_url) {
    showToast('No update download URL available', 'warning');
    return;
  }

  const btnInstall = document.getElementById('btn-install-update');
  const btnCheck = document.getElementById('btn-check-updates');
  const progressContainer = document.getElementById('update-download-progress');
  const progressFill = document.getElementById('update-progress-fill');
  const stagePct = document.getElementById('update-stage-pct');
  const stageText = document.getElementById('update-stage-text');

  if (btnInstall) btnInstall.disabled = true;
  if (btnCheck) btnCheck.disabled = true;
  if (progressContainer) progressContainer.style.display = 'block';

  let progress = 5;
  const interval = setInterval(() => {
    progress = Math.min(95, progress + Math.floor(Math.random() * 10) + 5);
    if (progressFill) progressFill.style.width = `${progress}%`;
    if (stagePct) stagePct.textContent = `${progress}%`;
  }, 300);

  try {
    await invoke('apply_update', { downloadUrl: latestUpdateResult.download_url });
    clearInterval(interval);

    if (progressFill) progressFill.style.width = '100%';
    if (stagePct) stagePct.textContent = '100%';
    if (stageText) stageText.textContent = 'Update verified and staged! Ready to restart.';

    showToast('Update staged successfully! Restarting application...', 'success');
  } catch (err) {
    clearInterval(interval);
    showToast(`Update error: ${err}`, 'error');
  } finally {
    if (btnInstall) btnInstall.disabled = false;
    if (btnCheck) btnCheck.disabled = false;
  }
}
