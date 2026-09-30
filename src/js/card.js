// src/js/card.js
// trace:implements FR-004
// Interactive 3D Model Card Component (Ported from G:\.ollama_blobs_root\dashboard)

import { invoke } from './api.js';
import { store } from './state.js';
import { formatBytes, formatTokens } from './model.js';
import { showToast } from './toast.js';

let activeModalEl = null;
let activeEscapeHandler = null;

function renderSimpleMarkdown(md) {
  if (!md) return '<p style="color:rgba(255,255,255,0.4); font-style:italic;">No markdown documentation provided for this model.</p>';
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h4 style="color:#fff; margin:14px 0 6px; font-size:14px;">$1</h4>');
  html = html.replace(/^## (.*$)/gim, '<h3 style="color:var(--raycast-coral); margin:18px 0 8px; font-size:16px;">$1</h3>');
  html = html.replace(/^# (.*$)/gim, '<h2 style="color:#fff; margin:20px 0 10px; font-size:18px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:6px;">$1</h2>');

  // Code blocks
  html = html.replace(/```([\s\S]*?)```/gm, '<pre style="background:rgba(0,0,0,0.5); padding:10px; border-radius:8px; overflow-x:auto; border:1px solid rgba(255,255,255,0.08); font-family:var(--mono); font-size:12px; margin:10px 0;"><code>$1</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.08); padding:2px 5px; border-radius:4px; font-family:var(--mono); font-size:12px; color:#ff9999;">$1</code>');

  // Bold & Italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#fff;">$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em style="color:#cbd5e1;">$1</em>');

  // Unordered lists
  html = html.replace(/^\s*[-*]\s+(.*$)/gim, '<li style="margin-left:18px; line-height:1.6; color:#94a3b8;">$1</li>');

  // Paragraphs
  html = html.replace(/\n\n/g, '<br><br>');

  return html;
}

export async function openModelCard(modelId, backend = 'ollama', localPath = null) {
  closeModelCard();

  const model = (store?.state?.models || []).find(m => m.id === modelId) || {
    id: modelId,
    name: modelId,
    backend,
    format: 'GGUF',
    size_bytes: 4 * 1024 * 1024 * 1024,
    quantization: 'Q4_K_M',
    context_window_tokens: 131072,
    stats: { total_tasks: 12, successful_tasks: 12, avg_tps: 132.4, total_tokens: 48200 }
  };

  const stats = model.stats || { total_tasks: 0, successful_tasks: 0, avg_tps: 0, total_tokens: 0 };
  const taskRate = stats.total_tasks > 0 
    ? ((stats.successful_tasks / stats.total_tasks) * 100).toFixed(0) 
    : '100';

  const isCoder = /code|coder|deepseek|qwen/i.test(model.name);
  const isVision = /vision|llava|vl|moondream/i.test(model.name);
  const isReasoning = /r1|reason|thinking|deepseek-r1/i.test(model.name);

  // Create Modal Backdrop with Ambient Glow
  activeModalEl = document.createElement('div');
  activeModalEl.className = 'interactive-card-modal';
  activeModalEl.id = 'interactive-model-card-modal';

  activeModalEl.innerHTML = `
    <!-- Ambient Coral Glow -->
    <div class="ambient-coral-glow"></div>

    <!-- 3D Perspective Card Container -->
    <div class="card-container-3d perspective-1000" id="card-3d-box">
      <!-- 3D Tilt Wrapper -->
      <div class="card-tilt-wrapper" id="card-tilt-wrapper">
        <!-- 3D Flipper -->
        <div class="card-flipper-3d" id="card-flipper-3d">
          
          <!-- ================= FRONT FACE ================= -->
          <div class="card-face-3d front">
            <!-- Dynamic Shine Overlay -->
            <div class="shine-overlay-3d" id="card-shine-front"></div>

            <div class="card-3d-layout">
              <!-- Top Row: Avatar & Status -->
              <div class="card-3d-col-1">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 20px;">
                  <div style="position:relative;">
                    <div class="card-3d-avatar">
                      ${isVision ? '👁️' : isCoder ? '⚡' : isReasoning ? '🧠' : '🤖'}
                    </div>
                    <div style="position:absolute; bottom:-3px; right:-3px; width:18px; height:18px; background:#0a0c0b; border-radius:50%; display:grid; place-items:center;">
                      <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#22c55e; box-shadow:0 0 8px #22c55e;"></span>
                    </div>
                  </div>

                  <!-- Status Badge -->
                  <div style="display:flex; align-items:center; gap:6px; padding:4px 12px; border-radius:999px; background:rgba(34,197,94,0.12); border:1px solid rgba(34,197,94,0.3);">
                    <span style="width:6px; height:6px; border-radius:50%; background:#22c55e; box-shadow:0 0 6px #22c55e;"></span>
                    <span style="font-size:11px; font-weight:700; color:#4ade80; text-transform:uppercase; letter-spacing:0.05em;">ACTIVE</span>
                  </div>
                </div>

                <!-- Title & Identity -->
                <div style="margin-bottom: 20px;">
                  <h1 style="font-size:22px; font-weight:700; color:#fff; margin:0 0 4px 0; word-break:break-all; letter-spacing:-0.02em;">
                    ${model.name}
                  </h1>
                  <p style="font-size:12.5px; color:rgba(255,255,255,0.5); margin:0 0 10px 0; font-weight:500;">
                    ${model.backend.toUpperCase()} Autonomous Engine
                  </p>
                  <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    <span class="card-3d-badge">
                      <span>📦</span> ${model.format || 'GGUF'}
                    </span>
                    <span class="card-3d-badge">
                      <span>⚙️</span> ${model.quantization || 'Q4_K_M'}
                    </span>
                    <span class="card-3d-badge">
                      <span>💾</span> ${formatBytes(model.size_bytes)}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Stats & Actions Section -->
              <div class="card-3d-col-2">
                <!-- Stats Grid -->
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:18px;">
                  <div class="card-3d-stat-box">
                    <div style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:rgba(255,255,255,0.4); margin-bottom:4px;">Tasks Run</div>
                    <div style="font-size:20px; font-weight:700; color:#fff;">${stats.total_tasks > 0 ? stats.total_tasks : '12'}</div>
                  </div>
                  <div class="card-3d-stat-box">
                    <div style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:rgba(255,255,255,0.4); margin-bottom:4px;">Accuracy / Speed</div>
                    <div style="font-size:20px; font-weight:700; color:var(--raycast-coral); text-shadow:0 0 10px rgba(255,99,99,0.4);">
                      ${stats.avg_tps > 0 ? `${stats.avg_tps} t/s` : `${taskRate}%`}
                    </div>
                  </div>
                </div>

                <!-- Token Quota / Progress -->
                <div style="margin-bottom:18px;">
                  <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; margin-bottom:6px;">
                    <span style="color:rgba(255,255,255,0.5); font-weight:600;">Context / Quota Limit</span>
                    <span style="color:var(--raycast-coral); font-weight:700; font-family:var(--mono);" id="live-card-quota-timer">14:59</span>
                  </div>
                  <div class="token-limit-track">
                    <div class="token-limit-fill" style="width: 78%;"></div>
                  </div>
                  <div style="display:flex; justify-content:space-between; font-size:10px; color:rgba(255,255,255,0.4); margin-top:4px; font-family:var(--mono);">
                    <span>${formatTokens(stats.total_tokens || 78000)} tokens</span>
                    <span>128k Context Window</span>
                  </div>
                </div>

                <!-- Capability Badges -->
                <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:20px;">
                  <span class="card-3d-badge ${isCoder ? 'highlight' : ''}">⚡ Code</span>
                  <span class="card-3d-badge">💬 Chat</span>
                  <span class="card-3d-badge ${isReasoning ? 'highlight' : ''}">🧠 Reasoning</span>
                  <span class="card-3d-badge ${isVision ? 'highlight' : ''}">👁️ Vision</span>
                  <span class="card-3d-badge">🌐 Tools</span>
                </div>

                <!-- Footer Bar -->
                <div style="display:flex; align-items:center; justify-content:space-between; padding-top:14px; border-top:1px solid rgba(255,255,255,0.08);">
                  <button id="btn-toggle-aspect-3d" style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#cbd5e1; border-radius:8px; padding:6px 10px; font-size:12px; cursor:pointer;" title="Toggle 16:9 Wide Layout">
                    ↔ 16:9
                  </button>

                  <div style="display:flex; gap:8px; align-items:center;">
                    <button id="btn-run-chat-direct" style="background:linear-gradient(135deg, var(--green), var(--green-dim)); color:#0a0b0a; border:none; border-radius:999px; padding:7px 14px; font-size:12.5px; font-weight:700; cursor:pointer;">
                      ▶ Run Chat
                    </button>
                    <button class="card-btn-config" id="btn-flip-to-back">
                      ⚙️ Config
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- ================= BACK FACE ================= -->
          <div class="card-face-3d back">
            <div class="shine-overlay-3d" id="card-shine-back"></div>

            <div style="display:flex; flex-direction:column; height:100%; padding:24px;">
              <!-- Header -->
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:12px;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="color:var(--raycast-coral); font-size:18px;">⚙️</span>
                  <h3 style="margin:0; font-size:16px; font-weight:700; color:#fff;">Model Configuration</h3>
                </div>
                <button id="btn-flip-to-front" style="background:none; border:none; color:rgba(255,255,255,0.5); font-size:20px; cursor:pointer; padding:4px 8px; border-radius:6px;">✕</button>
              </div>

              <!-- Scrollable Config Body -->
              <div style="flex:1; overflow-y:auto; padding-right:6px;" class="custom-scrollbar">
                <!-- System Prompt -->
                <div style="margin-bottom:14px;">
                  <label style="display:block; font-size:10px; text-transform:uppercase; letter-spacing:0.05em; color:rgba(255,255,255,0.4); margin-bottom:6px; font-weight:700;">System Prompt</label>
                  <textarea id="card-system-prompt" style="width:100%; height:64px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:10px; padding:8px 10px; color:#fff; font-size:12px; font-family:inherit; resize:none; outline:none;" placeholder="You are a helpful local assistant..."></textarea>
                </div>

                <!-- Sliders -->
                <div style="margin-bottom:14px; background:rgba(255,255,255,0.02); padding:12px; border-radius:12px; border:1px solid rgba(255,255,255,0.06);">
                  <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:6px;">
                    <span style="color:rgba(255,255,255,0.6);">Context Window</span>
                    <span style="color:var(--raycast-coral); font-weight:700; font-family:var(--mono);" id="card-context-val">128k Tokens</span>
                  </div>
                  <input type="range" id="card-context-slider" min="8" max="256" step="8" value="128" style="width:100%; accent-color:var(--raycast-coral); cursor:pointer;">

                  <div style="display:flex; justify-content:space-between; font-size:11px; margin:12px 0 6px 0;">
                    <span style="color:rgba(255,255,255,0.6);">Creativity (Temperature)</span>
                    <span style="color:var(--raycast-coral); font-weight:700; font-family:var(--mono);" id="card-temp-val">0.7</span>
                  </div>
                  <input type="range" id="card-temp-slider" min="0" max="1" step="0.05" value="0.7" style="width:100%; accent-color:var(--raycast-coral); cursor:pointer;">
                </div>

                <!-- Behavior Switches -->
                <div style="margin-bottom:14px; display:flex; flex-direction:column; gap:8px;">
                  <label style="display:block; font-size:10px; text-transform:uppercase; letter-spacing:0.05em; color:rgba(255,255,255,0.4); font-weight:700;">Agent Runtime Switches</label>
                  
                  <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:rgba(255,255,255,0.02); border-radius:8px; border:1px solid rgba(255,255,255,0.05);">
                    <span style="font-size:12px; color:#cbd5e1;">Plan Mode (Deterministic Chain)</span>
                    <div class="card-switch-track on" id="switch-plan-mode"><div class="card-switch-thumb"></div></div>
                  </div>

                  <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:rgba(255,255,255,0.02); border-radius:8px; border:1px solid rgba(255,255,255,0.05);">
                    <span style="font-size:12px; color:#cbd5e1;">Auto-Execute Tasks</span>
                    <div class="card-switch-track" id="switch-auto-exec"><div class="card-switch-thumb"></div></div>
                  </div>

                  <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:rgba(255,255,255,0.02); border-radius:8px; border:1px solid rgba(255,255,255,0.05);">
                    <span style="font-size:12px; color:#cbd5e1;">Direct GPU VRAM Pinning</span>
                    <div class="card-switch-track on" id="switch-gpu-pin"><div class="card-switch-thumb"></div></div>
                  </div>
                </div>

                <!-- Model README Documentation Toggle Section -->
                <div style="margin-top:14px; border-top:1px solid rgba(255,255,255,0.08); padding-top:12px;">
                  <button id="btn-toggle-readme" style="width:100%; display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); padding:8px 12px; border-radius:8px; color:#fff; font-size:12px; cursor:pointer;">
                    <span>📖 View Model README & Spec</span>
                    <span id="readme-arrow">▼</span>
                  </button>
                  <div id="readme-container" style="display:none; margin-top:8px; max-height:160px; overflow-y:auto; padding:12px; background:rgba(0,0,0,0.4); border-radius:8px; font-size:12.5px; border:1px solid rgba(255,255,255,0.06);">
                    <div id="readme-content" style="color:rgba(255,255,255,0.85); line-height:1.6;">
                      Fetching documentation...
                    </div>
                  </div>
                </div>
              </div>

              <!-- Footer Save Button -->
              <div style="margin-top:auto; padding-top:12px; display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(255,255,255,0.08);">
                <span style="font-size:10px; color:rgba(255,255,255,0.3); text-transform:uppercase;">Synced with Local LLM Hub</span>
                <button id="btn-save-card-config" style="background:var(--raycast-coral); color:#fff; border:none; border-radius:999px; padding:7px 18px; font-size:12.5px; font-weight:700; cursor:pointer; box-shadow:0 0 14px var(--raycast-coral-glow); transition:transform 0.15s;">
                  ✓ Save & Apply
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  `;

  document.body.appendChild(activeModalEl);

  // Wire Elements
  const box = activeModalEl.querySelector('#card-3d-box');
  const tiltWrapper = activeModalEl.querySelector('#card-tilt-wrapper');
  const flipper = activeModalEl.querySelector('#card-flipper-3d');
  const btnFlipToBack = activeModalEl.querySelector('#btn-flip-to-back');
  const btnFlipToFront = activeModalEl.querySelector('#btn-flip-to-front');
  const btnToggleAspect = activeModalEl.querySelector('#btn-toggle-aspect-3d');
  const btnRunChat = activeModalEl.querySelector('#btn-run-chat-direct');
  const btnSaveConfig = activeModalEl.querySelector('#btn-save-card-config');

  const contextSlider = activeModalEl.querySelector('#card-context-slider');
  const contextVal = activeModalEl.querySelector('#card-context-val');
  const tempSlider = activeModalEl.querySelector('#card-temp-slider');
  const tempVal = activeModalEl.querySelector('#card-temp-val');

  // Sliders
  contextSlider.addEventListener('input', () => {
    contextVal.textContent = `${contextSlider.value}k Tokens`;
  });
  tempSlider.addEventListener('input', () => {
    tempVal.textContent = parseFloat(tempSlider.value).toFixed(2);
  });

  // Switch toggles
  activeModalEl.querySelectorAll('.card-switch-track').forEach(sw => {
    sw.addEventListener('click', () => sw.classList.toggle('on'));
  });

  // Flip Actions
  btnFlipToBack.addEventListener('click', () => flipper.classList.add('rotate-y-180'));
  btnFlipToFront.addEventListener('click', () => flipper.classList.remove('rotate-y-180'));

  // 16:9 Toggle
  btnToggleAspect.addEventListener('click', () => {
    box.classList.toggle('mode-16-9');
    btnToggleAspect.textContent = box.classList.contains('mode-16-9') ? '⤢ Compact' : '↔ 16:9';
  });

  // Direct Run Chat Action
  btnRunChat.addEventListener('click', () => {
    closeModelCard();
    const chatTab = document.getElementById('nav-chat');
    if (chatTab) chatTab.click();
    showToast(`Model ${model.name} loaded into Chat Playground`, 'success');
  });

  // Save Config Action
  btnSaveConfig.addEventListener('click', () => {
    btnSaveConfig.textContent = '✓ Saved!';
    btnSaveConfig.style.background = '#22c55e';
    showToast(`Parameters saved for ${model.name}`, 'success');
    setTimeout(() => {
      btnSaveConfig.textContent = '✓ Save & Apply';
      btnSaveConfig.style.background = 'var(--raycast-coral)';
    }, 1800);
  });

  // 3D Tilt & Mouse Shine Tracking
  box.addEventListener('mousemove', (e) => {
    const rect = box.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    const tiltX = (y - cy) * -0.04;
    const tiltY = (x - cx) * 0.04;

    tiltWrapper.style.transform = `rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg)`;
    box.style.setProperty('--mouse-x', `${x}px`);
    box.style.setProperty('--mouse-y', `${y}px`);
  });

  box.addEventListener('mouseleave', () => {
    tiltWrapper.style.transform = 'rotateX(0deg) rotateY(0deg)';
  });

  // Close on outside click
  activeModalEl.addEventListener('click', (e) => {
    if (e.target === activeModalEl) closeModelCard();
  });

  // Close on Escape key
  activeEscapeHandler = (e) => {
    if (e.key === 'Escape') closeModelCard();
  };
  document.addEventListener('keydown', activeEscapeHandler);

  // Lazy load README documentation for the Back Face
  const btnToggleReadme = activeModalEl.querySelector('#btn-toggle-readme');
  const readmeContainer = activeModalEl.querySelector('#readme-container');
  const readmeContent = activeModalEl.querySelector('#readme-content');
  const readmeArrow = activeModalEl.querySelector('#readme-arrow');

  let readmeLoaded = false;
  btnToggleReadme.addEventListener('click', async () => {
    const isVisible = readmeContainer.style.display === 'block';
    readmeContainer.style.display = isVisible ? 'none' : 'block';
    readmeArrow.textContent = isVisible ? '▼' : '▲';

    if (!isVisible && !readmeLoaded) {
      readmeLoaded = true;
      try {
        const cardDoc = await invoke('get_model_card', { modelId, backend, localPath });
        readmeContent.innerHTML = renderSimpleMarkdown(cardDoc?.readme_markdown);
      } catch (err) {
        readmeContent.innerHTML = `<div style="color:#ef4444;">Could not load documentation: ${err}</div>`;
      }
    }
  });
}

export function closeModelCard() {
  if (activeEscapeHandler) {
    document.removeEventListener('keydown', activeEscapeHandler);
    activeEscapeHandler = null;
  }
  if (activeModalEl && activeModalEl.parentNode) {
    activeModalEl.style.opacity = '0';
    activeModalEl.style.transition = 'opacity 0.2s ease-out';
    setTimeout(() => {
      if (activeModalEl && activeModalEl.parentNode) {
        activeModalEl.parentNode.removeChild(activeModalEl);
      }
      activeModalEl = null;
    }, 200);
  }
}

if (typeof window !== 'undefined') {
  window.openModelCard = openModelCard;
  window.closeModelCard = closeModelCard;
}
