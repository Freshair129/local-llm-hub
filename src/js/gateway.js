// src/js/gateway.js
// trace:implements FR-008
//! LiteLLM Unified Proxy Sidecar, API Key Management & Permissions Controller

import { showToast } from './toast.js';
import { store } from './state.js';

let mockKeysList = [
  {
    keyId: "key_master_hub",
    keySecret: "sk-local-hub",
    name: "Master Hub Key (Admin)",
    role: "admin",
    allowedModels: ["*"],
    maxBudget: null,
    spend: 0.0,
    tpmLimit: null,
    rpmLimit: null,
    createdAt: Date.now() - 3600000,
    expiresAt: null,
    active: true
  }
];

const invoke = window.__TAURI__?.core?.invoke || (async (cmd, args) => {
  console.log(`[Dev Invoke Mock] ${cmd}`, args);
  if (cmd === 'list_api_keys') {
    return [...mockKeysList];
  }
  if (cmd === 'create_api_key') {
    const newK = {
      keyId: `key_${Math.random().toString(36).substring(2, 8)}`,
      keySecret: `sk-litellm-${Math.random().toString(36).substring(2, 14)}`,
      name: args.name,
      role: args.role,
      allowedModels: args.allowedModels || ["*"],
      maxBudget: args.maxBudget,
      spend: 0.0,
      tpmLimit: args.tpmLimit,
      rpmLimit: args.rpmLimit,
      createdAt: Date.now(),
      expiresAt: args.durationDays ? Date.now() + (args.durationDays * 86400000) : null,
      active: true
    };
    mockKeysList.push(newK);
    return newK;
  }
  if (cmd === 'toggle_api_key') {
    const k = mockKeysList.find(x => x.keyId === args.keyId);
    if (k) {
      k.active = !k.active;
      return k.active;
    }
    return false;
  }
  if (cmd === 'delete_api_key') {
    mockKeysList = mockKeysList.filter(x => x.keyId !== args.keyId);
    return true;
  }
  if (cmd === 'get_proxy_status') {
    return {
      running: true,
      port: 4000,
      configPath: 'sidecar/config.yaml',
      registeredModels: ['mellum2', 'qwen2.5'],
      baseUrl: 'http://127.0.0.1:4000'
    };
  }
  return null;
});

let cachedKeys = [];
let activeKeyForSnippets = 'sk-local-hub';

export async function initGateway() {
  setupEventListeners();
  await refreshGatewayView();
}

export async function refreshGatewayView() {
  await Promise.all([
    checkProxyStatusUI(),
    loadAndRenderApiKeys()
  ]);
  updateCodeSnippets();
}

async function checkProxyStatusUI() {
  const statusVal = document.getElementById('proxy-status-val');
  const proxyPortBadge = document.getElementById('proxy-port-badge');
  try {
    const status = await invoke('get_proxy_status', { configPath: 'sidecar/config.yaml' });
    if (statusVal) {
      if (status?.running) {
        statusVal.textContent = 'ONLINE & ROUTING (:4000)';
        statusVal.style.color = 'var(--green)';
      } else {
        statusVal.textContent = 'READY / STANDBY (:4000)';
        statusVal.style.color = '#38bdf8';
      }
    }
    if (proxyPortBadge) {
      proxyPortBadge.textContent = status?.running ? 'ONLINE :4000' : 'STANDBY :4000';
      proxyPortBadge.className = status?.running ? 'badge badge-success' : 'badge badge-neutral';
    }
  } catch (err) {
    if (statusVal) {
      statusVal.textContent = 'STANDBY (:4000)';
      statusVal.style.color = 'var(--mut)';
    }
  }
}

export async function loadAndRenderApiKeys() {
  const container = document.getElementById('api-keys-table-body');
  if (!container) return;

  try {
    const keys = await invoke('list_api_keys');
    cachedKeys = keys || [];
    renderApiKeysTable(cachedKeys);
    if (cachedKeys.length > 0) {
      activeKeyForSnippets = cachedKeys[0].keySecret;
    }
  } catch (err) {
    console.error('Failed to load API keys:', err);
    container.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:24px; color:var(--red);">Failed to load keys: ${err}</td></tr>`;
  }
}

function renderApiKeysTable(keys) {
  const container = document.getElementById('api-keys-table-body');
  const countEl = document.getElementById('api-key-total-count');
  if (countEl) countEl.textContent = `${keys.length} Active Key${keys.length === 1 ? '' : 's'}`;

  if (!container) return;
  if (!keys || keys.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding:32px; color:var(--mut);">
          No API keys generated yet. Click <b>"+ Create Virtual Key"</b> to generate scoped credentials.
        </td>
      </tr>`;
    return;
  }

  container.innerHTML = keys.map(k => {
    const isMaster = k.keyId === 'key_master_hub' || k.role === 'admin';
    const isExpired = k.expiresAt && Date.now() > k.expiresAt;
    const statusText = !k.active ? 'REVOKED' : (isExpired ? 'EXPIRED' : 'ACTIVE');
    const statusColor = !k.active ? 'var(--red)' : (isExpired ? 'var(--amber)' : 'var(--green)');

    const budgetDisplay = k.maxBudget !== null && k.maxBudget !== undefined
      ? `$${(k.spend || 0).toFixed(2)} / $${k.maxBudget.toFixed(2)}`
      : `$${(k.spend || 0).toFixed(2)} / ∞`;

    const spendPct = (k.maxBudget && k.maxBudget > 0)
      ? Math.min(100, Math.round(((k.spend || 0) / k.maxBudget) * 100))
      : 0;

    const rateLimits = [];
    if (k.tpmLimit) rateLimits.push(`${(k.tpmLimit / 1000).toFixed(0)}k TPM`);
    if (k.rpmLimit) rateLimits.push(`${k.rpmLimit} RPM`);
    const rateText = rateLimits.length > 0 ? rateLimits.join(' • ') : 'Unlimited';

    const modelsBadges = (k.allowedModels || []).map(m => {
      const isAll = m === '*' || m.toLowerCase() === 'all';
      return `<span style="display:inline-block; font-size:10px; font-family:var(--mono); padding:2px 6px; border-radius:4px; margin:1px; background:${isAll ? 'rgba(124, 242, 107, 0.15)' : 'rgba(255,255,255,0.06)'}; color:${isAll ? 'var(--green)' : 'var(--tx)'}; border:1px solid ${isAll ? 'rgba(124, 242, 107, 0.3)' : 'rgba(255,255,255,0.1)'}">${m}</span>`;
    }).join('');

    const expiryText = k.expiresAt 
      ? new Date(k.expiresAt).toLocaleDateString()
      : 'Never';

    // Mask key secret: sk-litellm-abc...1234
    const maskedSecret = k.keySecret.length > 18
      ? `${k.keySecret.substring(0, 14)}...${k.keySecret.substring(k.keySecret.length - 4)}`
      : k.keySecret;

    return `
      <tr style="border-bottom:1px solid var(--line); transition:background 0.15s;" class="key-row" data-key-id="${k.keyId}">
        <td style="padding:12px 14px; font-weight:600; color:var(--tx);">
          <div style="display:flex; align-items:center; gap:8px;">
            <span>${k.name}</span>
            <span style="font-size:10px; font-family:var(--mono); padding:1px 6px; border-radius:4px; text-transform:uppercase; font-weight:700; background:${getRoleBadgeBg(k.role)}; color:${getRoleBadgeColor(k.role)}; border:1px solid ${getRoleBadgeBorder(k.role)};">${k.role}</span>
          </div>
          <div style="font-size:11px; color:var(--mut); font-family:var(--mono); margin-top:2px;">ID: ${k.keyId}</div>
        </td>
        <td style="padding:12px 14px;">
          <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(0,0,0,0.4); padding:3px 8px; border-radius:6px; border:1px solid var(--line);">
            <code style="font-family:var(--mono); font-size:11px; color:#60a5fa;" id="key-text-${k.keyId}">${maskedSecret}</code>
            <button type="button" class="btn-copy-key tb-ico" data-secret="${k.keySecret}" title="Copy Virtual API Key" style="width:22px; height:22px; padding:0;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>
        </td>
        <td style="padding:12px 14px; max-width:200px;">
          <div style="display:flex; flex-wrap:wrap; gap:2px;">${modelsBadges}</div>
        </td>
        <td style="padding:12px 14px;">
          <div style="font-size:11.5px; font-family:var(--mono); color:var(--tx);">${budgetDisplay}</div>
          ${k.maxBudget ? `
            <div style="width:100%; height:4px; background:rgba(255,255,255,0.08); border-radius:2px; margin-top:4px; overflow:hidden;">
              <div style="width:${spendPct}%; height:100%; background:${spendPct > 80 ? 'var(--red)' : 'var(--green)'};"></div>
            </div>` : ''}
        </td>
        <td style="padding:12px 14px; font-size:11px; font-family:var(--mono); color:var(--mut);">
          ${rateText}
        </td>
        <td style="padding:12px 14px; font-size:11px; font-family:var(--mono); color:var(--mut);">
          ${expiryText}
        </td>
        <td style="padding:12px 14px;">
          <span style="display:inline-flex; align-items:center; gap:5px; font-size:10.5px; font-family:var(--mono); font-weight:700; color:${statusColor};">
            <span style="width:6px; height:6px; border-radius:50%; background:${statusColor}; display:inline-block;"></span>
            ${statusText}
          </span>
        </td>
        <td style="padding:12px 14px; text-align:right;">
          <div style="display:inline-flex; align-items:center; gap:6px;">
            <button type="button" class="btn-use-snippet btn btn-ghost" data-secret="${k.keySecret}" style="padding:4px 8px; font-size:11px;" title="Insert into Code Snippets">Use In Snippet</button>
            ${!isMaster ? `
              <button type="button" class="btn-toggle-key btn btn-ghost" data-key-id="${k.keyId}" style="padding:4px 8px; font-size:11px; color:${k.active ? 'var(--amber)' : 'var(--green)'};" title="${k.active ? 'Revoke key access' : 'Reactivate key'}">
                ${k.active ? 'Revoke' : 'Activate'}
              </button>
              <button type="button" class="btn-delete-key btn btn-ghost" data-key-id="${k.keyId}" style="padding:4px 8px; font-size:11px; color:var(--red);" title="Delete API key">
                ✕
              </button>
            ` : '<span style="font-size:10px; color:var(--mut); padding:4px 8px;">Master Key</span>'}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  attachKeyRowActions();
}

function getRoleBadgeBg(role) {
  switch (role) {
    case 'admin': return 'rgba(154, 140, 255, 0.15)';
    case 'read_only': return 'rgba(91, 192, 235, 0.15)';
    default: return 'rgba(124, 242, 107, 0.15)';
  }
}
function getRoleBadgeColor(role) {
  switch (role) {
    case 'admin': return '#b4a6ff';
    case 'read_only': return 'var(--cyan)';
    default: return 'var(--green)';
  }
}
function getRoleBadgeBorder(role) {
  switch (role) {
    case 'admin': return 'rgba(154, 140, 255, 0.35)';
    case 'read_only': return 'rgba(91, 192, 235, 0.35)';
    default: return 'rgba(124, 242, 107, 0.35)';
  }
}

function attachKeyRowActions() {
  document.querySelectorAll('.btn-copy-key').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const secret = btn.getAttribute('data-secret');
      navigator.clipboard.writeText(secret).then(() => {
        showToast('Virtual API Key copied to clipboard! 📋', 'success');
      }).catch(err => {
        showToast('Failed to copy to clipboard', 'error');
      });
    });
  });

  document.querySelectorAll('.btn-toggle-key').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const keyId = btn.getAttribute('data-key-id');
      try {
        const newStatus = await invoke('toggle_api_key', { keyId });
        showToast(newStatus ? 'API Key re-activated' : 'API Key revoked', 'info');
        await loadAndRenderApiKeys();
      } catch (err) {
        showToast(`Failed to toggle key status: ${err}`, 'error');
      }
    });
  });

  document.querySelectorAll('.btn-delete-key').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const keyId = btn.getAttribute('data-key-id');
      if (confirm(`Are you sure you want to permanently delete API key ${keyId}?`)) {
        try {
          await invoke('delete_api_key', { keyId });
          showToast('API Key deleted successfully', 'success');
          await loadAndRenderApiKeys();
        } catch (err) {
          showToast(`Failed to delete key: ${err}`, 'error');
        }
      }
    });
  });

  document.querySelectorAll('.btn-use-snippet').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const secret = btn.getAttribute('data-secret');
      activeKeyForSnippets = secret;
      updateCodeSnippets();
      showToast('Key updated in code snippets below ⚡', 'info');
      const snippetSection = document.getElementById('gateway-code-snippets-card');
      if (snippetSection) {
        snippetSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
}

function populateModelCheckboxes() {
  const container = document.getElementById('modal-key-models-list');
  if (!container) return;

  const models = store.state.models || [];
  let html = `
    <label style="display:flex; align-items:center; gap:8px; font-size:12px; color:var(--green); font-weight:600; margin-bottom:6px; cursor:pointer;">
      <input type="checkbox" id="chk-model-all" value="*" checked style="accent-color:var(--green);" />
      <span>* All Available Models (Wildcard)</span>
    </label>
    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:6px; max-height:140px; overflow-y:auto; padding-right:4px;">
  `;

  if (models.length === 0) {
    html += `<span style="font-size:11px; color:var(--mut);">No models discovered yet. Will default to wildcard (*).</span>`;
  } else {
    models.forEach(m => {
      const clean = m.name.split(':')[0];
      html += `
        <label style="display:flex; align-items:center; gap:6px; font-size:11.5px; color:var(--tx); background:rgba(255,255,255,0.03); padding:4px 8px; border-radius:4px; border:1px solid var(--line); cursor:pointer;">
          <input type="checkbox" class="chk-specific-model" value="${clean}" checked style="accent-color:var(--green);" />
          <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${m.name}">${clean}</span>
        </label>
      `;
    });
  }
  html += `</div>`;
  container.innerHTML = html;

  const allChk = document.getElementById('chk-model-all');
  if (allChk) {
    allChk.addEventListener('change', () => {
      const specific = document.querySelectorAll('.chk-specific-model');
      specific.forEach(c => c.checked = allChk.checked);
    });
  }
}

function setupEventListeners() {
  // Open Create Key Modal
  const btnOpenModal = document.getElementById('btn-open-create-key-modal');
  const modal = document.getElementById('modal-create-api-key');
  const btnCloseModal = document.getElementById('btn-close-key-modal');
  const btnCancelModal = document.getElementById('btn-cancel-key-modal');

  if (btnOpenModal && modal) {
    btnOpenModal.addEventListener('click', () => {
      populateModelCheckboxes();
      modal.style.display = 'flex';
      const nameInput = document.getElementById('input-key-name');
      if (nameInput) {
        nameInput.value = '';
        nameInput.focus();
      }
    });
  }

  const closeModal = () => {
    if (modal) modal.style.display = 'none';
  };

  if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
  if (btnCancelModal) btnCancelModal.addEventListener('click', closeModal);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  // Create Key Form Submit
  const form = document.getElementById('form-create-api-key');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('input-key-name')?.value?.trim();
      const role = document.getElementById('select-key-role')?.value || 'developer';
      const maxBudgetVal = document.getElementById('input-key-budget')?.value;
      const maxBudget = maxBudgetVal && parseFloat(maxBudgetVal) > 0 ? parseFloat(maxBudgetVal) : null;
      const tpmVal = document.getElementById('input-key-tpm')?.value;
      const tpmLimit = tpmVal && parseInt(tpmVal, 10) > 0 ? parseInt(tpmVal, 10) : null;
      const rpmVal = document.getElementById('input-key-rpm')?.value;
      const rpmLimit = rpmVal && parseInt(rpmVal, 10) > 0 ? parseInt(rpmVal, 10) : null;
      const durationVal = document.getElementById('select-key-duration')?.value;
      const durationDays = durationVal && parseInt(durationVal, 10) > 0 ? parseInt(durationVal, 10) : null;

      const isAllChecked = document.getElementById('chk-model-all')?.checked;
      let allowedModels = [];
      if (isAllChecked) {
        allowedModels = ['*'];
      } else {
        const specific = document.querySelectorAll('.chk-specific-model:checked');
        allowedModels = Array.from(specific).map(c => c.value);
        if (allowedModels.length === 0) allowedModels = ['*'];
      }

      if (!name) {
        showToast('Please enter a Key Name / Purpose', 'error');
        return;
      }

      try {
        const newKey = await invoke('create_api_key', {
          name,
          role,
          allowedModels,
          maxBudget,
          tpmLimit,
          rpmLimit,
          durationDays
        });

        closeModal();
        await loadAndRenderApiKeys();
        activeKeyForSnippets = newKey.keySecret;
        updateCodeSnippets();

        // Prompt user with copy toast
        navigator.clipboard?.writeText(newKey.keySecret);
        showToast(`🎉 Created '${newKey.name}' (${newKey.keySecret}) — Copied to clipboard!`, 'success');
      } catch (err) {
        showToast(`Failed to create API key: ${err}`, 'error');
      }
    });
  }

  // Refresh Keys List Button
  const btnRefreshKeys = document.getElementById('btn-refresh-keys-list');
  if (btnRefreshKeys) {
    btnRefreshKeys.addEventListener('click', async () => {
      btnRefreshKeys.disabled = true;
      try {
        await loadAndRenderApiKeys();
        showToast('API Keys refreshed', 'success');
      } finally {
        btnRefreshKeys.disabled = false;
      }
    });
  }

  // Open LiteLLM Console Button (External Browser / Link)
  const btnOpenConsole = document.getElementById('btn-open-litellm-console');
  if (btnOpenConsole) {
    btnOpenConsole.addEventListener('click', async () => {
      const consoleUrl = 'http://127.0.0.1:4000/ui';
      try {
        await invoke('open_litellm_console', { url: consoleUrl });
        showToast(`Opening LiteLLM Console in browser (${consoleUrl}) 🌐`, 'success');
      } catch (err) {
        window.open(consoleUrl, '_blank');
        showToast(`Opened LiteLLM Console: ${consoleUrl}`, 'info');
      }
    });
  }

  // Copy Master Key Button
  const btnCopyMaster = document.getElementById('btn-copy-master-key');
  if (btnCopyMaster) {
    btnCopyMaster.addEventListener('click', () => {
      navigator.clipboard.writeText('sk-local-hub').then(() => {
        showToast('Master Key copied: sk-local-hub 📋', 'success');
      });
    });
  }

  // Copy Snippet Buttons
  const btnCopyPython = document.getElementById('btn-copy-python-snippet');
  if (btnCopyPython) {
    btnCopyPython.addEventListener('click', () => {
      const code = document.getElementById('snippet-python-code')?.textContent;
      if (code) {
        navigator.clipboard.writeText(code).then(() => {
          showToast('Python snippet copied to clipboard! 🐍', 'success');
        });
      }
    });
  }

  const btnCopyCurl = document.getElementById('btn-copy-curl-snippet');
  if (btnCopyCurl) {
    btnCopyCurl.addEventListener('click', () => {
      const code = document.getElementById('snippet-curl-code')?.textContent;
      if (code) {
        navigator.clipboard.writeText(code).then(() => {
          showToast('cURL snippet copied to clipboard! ⚡', 'success');
        });
      }
    });
  }
}

function updateCodeSnippets() {
  const models = store.state.models || [];
  const modelName = models.length > 0 ? models[0].name.split(':')[0] : 'mellum2';
  const key = activeKeyForSnippets || 'sk-local-hub';

  const pythonEl = document.getElementById('snippet-python-code');
  if (pythonEl) {
    pythonEl.textContent = `from openai import OpenAI

client = OpenAI(
    api_key="${key}",
    base_url="http://127.0.0.1:4000/v1"
)

response = client.chat.completions.create(
    model="${modelName}",
    messages=[
        {"role": "system", "content": "You are a helpful coding assistant."},
        {"role": "user", "content": "Hello local LLM fleet!"}
    ]
)

print(response.choices[0].message.content)`;
  }

  const curlEl = document.getElementById('snippet-curl-code');
  if (curlEl) {
    curlEl.textContent = `curl -X POST http://127.0.0.1:4000/v1/chat/completions \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${modelName}",
    "messages": [{"role": "user", "content": "Hello local LLM!"}]
  }'`;
  }
}
