// src/js/card.js
// trace:implements FR-004
// Model Card Drawer Component with Markdown Rendering and Esc key dismissal

const invoke = window.__TAURI__?.core?.invoke || (async () => ({
  model_id: "mock-model",
  title: "Mock Model",
  readme_markdown: "# Mock Model\nThis is a mock model card README.",
  license: "Apache 2.0",
  parameters: "12B",
  source: "mock"
}));

let drawerEl = null;
let overlayEl = null;
let activeEscapeHandler = null;

function renderSimpleMarkdown(md) {
  if (!md) return '';
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h4 style="color:var(--text-primary); margin:16px 0 8px;">$1</h4>');
  html = html.replace(/^## (.*$)/gim, '<h3 style="color:var(--accent-glow); margin:20px 0 10px;">$1</h3>');
  html = html.replace(/^# (.*$)/gim, '<h2 style="color:var(--accent-color); margin:24px 0 12px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:8px;">$1</h2>');

  // Code blocks
  html = html.replace(/```([\s\S]*?)```/gm, '<pre style="background:rgba(0,0,0,0.4); padding:12px; border-radius:8px; overflow-x:auto; border:1px solid rgba(255,255,255,0.08); font-family:monospace; margin:12px 0;"><code>$1</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.08); padding:2px 6px; border-radius:4px; font-family:monospace;">$1</code>');

  // Bold & Italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Unordered lists
  html = html.replace(/^\s*[-*]\s+(.*$)/gim, '<li style="margin-left:20px; line-height:1.6;">$1</li>');

  // Paragraphs
  html = html.replace(/\n\n/g, '<br><br>');

  return html;
}

export async function openModelCard(modelId, backend, localPath = null) {
  closeModelCard();

  overlayEl = document.createElement('div');
  overlayEl.className = 'drawer-overlay';
  overlayEl.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(6px);
    z-index: 1000;
    opacity: 0;
    transition: opacity 0.3s ease;
  `;

  drawerEl = document.createElement('div');
  drawerEl.className = 'model-card-drawer';
  drawerEl.style.cssText = `
    position: fixed;
    top: 0; right: 0; bottom: 0;
    width: min(650px, 90vw);
    background: rgba(18, 22, 32, 0.95);
    backdrop-filter: blur(24px);
    border-left: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: -8px 0 32px rgba(0, 0, 0, 0.6);
    z-index: 1001;
    display: flex;
    flex-direction: column;
    transform: translateX(100%);
    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    color: #e0e6ed;
    font-family: inherit;
  `;

  drawerEl.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; padding:20px 24px; border-bottom:1px solid rgba(255,255,255,0.08);">
      <div style="display:flex; align-items:center; gap:12px;">
        <span style="font-size:22px;">📖</span>
        <div>
          <h2 style="font-size:18px; margin:0; font-weight:600; color:#fff;">Model Card</h2>
          <span style="font-size:12px; color:rgba(255,255,255,0.5);">${modelId}</span>
        </div>
      </div>
      <button id="close-drawer-btn" style="background:none; border:none; color:rgba(255,255,255,0.6); font-size:24px; cursor:pointer; padding:4px 8px; border-radius:6px; transition:all 0.2s;">✕</button>
    </div>
    <div id="drawer-body" style="padding:24px; overflow-y:auto; flex:1;">
      <div style="display:flex; justify-content:center; align-items:center; height:200px; color:rgba(255,255,255,0.5);">
        <span class="spinner" style="margin-right:10px;">⏳</span> Fetching model card documentation...
      </div>
    </div>
  `;

  document.body.appendChild(overlayEl);
  document.body.appendChild(drawerEl);

  // Trigger smooth entrance
  requestAnimationFrame(() => {
    overlayEl.style.opacity = '1';
    drawerEl.style.transform = 'translateX(0)';
  });

  // Event handlers
  overlayEl.addEventListener('click', closeModelCard);
  drawerEl.querySelector('#close-drawer-btn').addEventListener('click', closeModelCard);

  activeEscapeHandler = (e) => {
    if (e.key === 'Escape') {
      closeModelCard();
    }
  };
  document.addEventListener('keydown', activeEscapeHandler);

  // Fetch model card content
  try {
    const card = await invoke('get_model_card', {
      modelId,
      backend,
      localPath
    });

    const bodyEl = drawerEl.querySelector('#drawer-body');
    if (!bodyEl) return;

    bodyEl.innerHTML = `
      <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:20px;">
        <span class="badge" style="background:rgba(59, 130, 246, 0.2); color:#60a5fa; border:1px solid rgba(59, 130, 246, 0.3); padding:4px 10px; border-radius:12px; font-size:12px;">Source: ${card.source}</span>
        ${card.license ? `<span class="badge" style="background:rgba(16, 185, 129, 0.2); color:#34d399; border:1px solid rgba(16, 185, 129, 0.3); padding:4px 10px; border-radius:12px; font-size:12px;">License: ${card.license}</span>` : ''}
        ${card.parameters ? `<span class="badge" style="background:rgba(168, 85, 247, 0.2); color:#c084fc; border:1px solid rgba(168, 85, 247, 0.3); padding:4px 10px; border-radius:12px; font-size:12px;">Params: ${card.parameters}</span>` : ''}
      </div>
      <div class="markdown-rendered" style="line-height:1.7; font-size:14px; color:rgba(255,255,255,0.85);">
        ${renderSimpleMarkdown(card.readme_markdown)}
      </div>
    `;
  } catch (err) {
    const bodyEl = drawerEl?.querySelector('#drawer-body');
    if (bodyEl) {
      bodyEl.innerHTML = `<div style="color:#ef4444; padding:20px; background:rgba(239, 68, 68, 0.1); border-radius:8px; border:1px solid rgba(239, 68, 68, 0.2);">Failed to load model card: ${err}</div>`;
    }
  }
}

export function closeModelCard() {
  if (activeEscapeHandler) {
    document.removeEventListener('keydown', activeEscapeHandler);
    activeEscapeHandler = null;
  }
  if (drawerEl) {
    drawerEl.style.transform = 'translateX(100%)';
  }
  if (overlayEl) {
    overlayEl.style.opacity = '0';
  }
  setTimeout(() => {
    if (drawerEl && drawerEl.parentNode) drawerEl.parentNode.removeChild(drawerEl);
    if (overlayEl && overlayEl.parentNode) overlayEl.parentNode.removeChild(overlayEl);
    drawerEl = null;
    overlayEl = null;
  }, 300);
}
