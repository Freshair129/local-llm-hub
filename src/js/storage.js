// src/js/storage.js
// trace:implements FR-015
// trace:implements ARCH-001

import { invoke } from './api.js';
import { formatBytes } from './model.js';
import { showToast } from './toast.js';

let isAuditing = false;

/**
 * Refreshes the Storage & Symlink Offload view with real filesystem data
 */
export async function refreshStorageView() {
  if (isAuditing) return;
  isAuditing = true;

  const btnAudit = document.getElementById('btn-studio-audit-storage');
  if (btnAudit) {
    btnAudit.classList.add('loading');
    btnAudit.disabled = true;
  }

  try {
    const health = await invoke('get_storage_health', {
      storage_root: 'G:\\.ollama_blobs_root',
      blob_pointer_root: null
    });

    renderStorageView(health);
  } catch (err) {
    console.error('Failed to audit storage:', err);
    showToast(`Storage audit error: ${err.message || err}`, 'error');
  } finally {
    isAuditing = false;
    if (btnAudit) {
      btnAudit.classList.remove('loading');
      btnAudit.disabled = false;
    }
  }
}

/**
 * Renders the audited storage statistics and blob table
 * @param {Object} health 
 */
export function renderStorageView(health) {
  if (!health) return;

  const elDefaultBlobs = document.getElementById('storage-kpi-default-blobs');
  const elTarget = document.getElementById('storage-kpi-target');
  const elHealth = document.getElementById('storage-kpi-health');
  const elHealthSub = document.getElementById('storage-kpi-health-sub');
  const elCandidateCount = document.getElementById('storage-candidate-count');
  const tbody = document.getElementById('storage-blobs-tbody');

  if (elDefaultBlobs) {
    elDefaultBlobs.textContent = `${health.default_blobs_gb || 0} GB`;
  }

  if (elTarget) {
    elTarget.textContent = `${health.target_storage_gb || 0} GB`;
  }

  if (elHealth) {
    if (health.bad_symlink_count === 0) {
      elHealth.textContent = '100% HEALTHY';
      elHealth.className = 'metric-val green';
    } else {
      elHealth.textContent = `${health.bad_symlink_count} ISSUES`;
      elHealth.className = 'metric-val amber';
    }
  }

  if (elHealthSub) {
    elHealthSub.textContent = `${health.symlink_count || 0} Verified Symlinks, ${health.bad_symlink_count || 0} Broken`;
  }

  if (elCandidateCount) {
    elCandidateCount.textContent = `${health.large_real_blob_count || 0} Candidates (${health.reclaimable_gb || 0} GB Reclaimable)`;
  }

  if (tbody) {
    if (!health.blobs || health.blobs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center; padding:24px; color:var(--mut);">
            No Ollama blobs found in ${health.blob_pointer_root}
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = health.blobs.map(blob => {
      const isSym = blob.is_symlink;
      const sizeStr = formatBytes(blob.size_bytes);
      const isLarge = blob.size_bytes > 50 * 1024 * 1024;
      const modelTag = blob.associated_model ? `<b>${blob.associated_model}</b> ` : '';

      return `
        <tr data-blob="${blob.hash}">
          <td style="font-family:var(--mono); font-size:12px;">
            ${modelTag}
            <span style="color:var(--faint);" title="${blob.hash}">(${blob.hash.slice(0, 16)}...)</span>
          </td>
          <td style="font-family:var(--mono); font-size:12px; font-weight:700; color:${isLarge ? 'var(--amber)' : 'var(--tx)'};">
            ${sizeStr}
          </td>
          <td>
            <span class="badge" style="background:${isSym ? 'rgba(56,189,248,0.12)' : 'rgba(255,138,30,0.12)'}; color:${isSym ? 'var(--cyan)' : 'var(--amber)'}; font-size:11px;">
              ${blob.storage_location}
            </span>
          </td>
          <td>
            <span class="badge" style="background:${isSym ? 'rgba(124,242,107,0.12)' : 'rgba(255,255,255,0.06)'}; color:${isSym ? 'var(--green)' : 'var(--mut)'}; font-size:11px;">
              ${isSym ? '✓ ' + blob.symlink_status : 'Pending Offload'}
            </span>
          </td>
          <td>
            ${isSym ? `
              <button class="btn btn-ghost" disabled style="padding:4px 10px; font-size:11px; opacity:0.6;">
                Verified
              </button>
            ` : `
              <button class="btn btn-ghost" onclick="window.__offloadBlob && window.__offloadBlob('${blob.hash}')" style="padding:4px 12px; font-size:11px; border-color:var(--green); color:var(--green); cursor:pointer;">
                Offload
              </button>
            `}
          </td>
        </tr>
      `;
    }).join('');
  }
}

/**
 * Initializes the Storage Offloader module
 */
export function initStorage() {
  const btnAudit = document.getElementById('btn-studio-audit-storage');
  if (btnAudit) {
    btnAudit.addEventListener('click', () => {
      showToast('Scanning real Ollama blobs and symlinks...', 'info');
      refreshStorageView();
    });
  }

  const btnQuickOffload = document.getElementById('btn-quick-offload');
  if (btnQuickOffload) {
    btnQuickOffload.addEventListener('click', async () => {
      btnQuickOffload.disabled = true;
      btnQuickOffload.classList.add('loading');
      showToast('Starting batch safe offload to G:\\.ollama_blobs_root...', 'info');

      try {
        const health = await invoke('get_storage_health', { storage_root: 'G:\\.ollama_blobs_root' });
        const pendingBlobs = (health.blobs || []).filter(b => !b.is_symlink && b.size_bytes > 50 * 1024 * 1024);

        if (pendingBlobs.length === 0) {
          showToast('All large model blobs are already offloaded!', 'success');
          return;
        }

        let successCount = 0;
        for (const blob of pendingBlobs) {
          try {
            await invoke('offload_storage_blob', {
              blob_hash: blob.hash,
              storage_root: 'G:\\.ollama_blobs_root'
            });
            successCount++;
          } catch (e) {
            console.warn(`Failed offload ${blob.hash}:`, e);
          }
        }

        showToast(`Successfully offloaded ${successCount} blobs to NVMe storage!`, 'success');
        await refreshStorageView();
      } catch (err) {
        showToast(`Batch offload error: ${err}`, 'error');
      } finally {
        btnQuickOffload.disabled = false;
        btnQuickOffload.classList.remove('loading');
      }
    });
  }

  // Global single blob offload helper
  window.__offloadBlob = async (blobHash) => {
    try {
      showToast(`Offloading blob ${blobHash.slice(0, 12)}...`, 'info');
      const res = await invoke('offload_storage_blob', {
        blob_hash: blobHash,
        storage_root: 'G:\\.ollama_blobs_root'
      });
      if (res.success) {
        showToast(`Offloaded ${formatBytes(res.bytes_freed)} to G:\\`, 'success');
        await refreshStorageView();
      } else {
        showToast(`Offload notice: ${res.message}`, 'warning');
      }
    } catch (err) {
      showToast(`Offload failed: ${err.message || err}`, 'error');
    }
  };
}
