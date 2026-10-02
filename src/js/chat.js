// src/js/chat.js
// trace:implements FR-007
// Interactive Chat Playground Frontend Component

import { recordTaskExecution } from './stats.js';
import { invoke } from './api.js';

let conversationHistory = [];
let currentModel = '';
let currentBackend = 'ollama';

export function initChat(models = []) {
  const modelSelect = document.getElementById('chat-model-select');
  if (modelSelect && models.length > 0) {
    if (!currentModel) {
      currentModel = models[0].name;
      currentBackend = models[0].backend || 'ollama';
    }
    modelSelect.innerHTML = models
      .map(m => `<option value="${m.name}" data-backend="${m.backend}">${m.name} (${m.backend})</option>`)
      .join('');

    modelSelect.addEventListener('change', (e) => {
      currentModel = e.target.value;
      const opt = e.target.selectedOptions[0];
      currentBackend = opt ? opt.getAttribute('data-backend') : 'ollama';
    });
  }

  const sendBtn = document.getElementById('chat-send-btn');
  const chatInput = document.getElementById('chat-user-input');

  if (sendBtn && chatInput) {
    sendBtn.onclick = () => sendMessage();
    chatInput.onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    };
    // trace:implements FEAT-023
    chatInput.addEventListener('input', (e) => {
      updateTokenPreflight(e.target.value);
    });
  }
}

// trace:implements FEAT-023
/**
 * Real-time preflight token estimation with Hybrid BPE Heuristic & Overflow Guard
 */
let debounceTimer = null;
export async function updateTokenPreflight(promptText) {
  const badgeEl = document.getElementById('chat-token-badge');
  const labelEl = document.getElementById('chat-token-count-label');
  const barEl = document.getElementById('chat-token-progress-bar');
  const warningEl = document.getElementById('chat-token-overflow-warning');
  if (!badgeEl || !labelEl || !barEl) return;

  const maxCtx = 8192;
  const text = promptText || '';

  // 1. Instant 0ms Client-Side BPE Heuristic (Option C)
  let asciiCount = 0;
  let unicodeCount = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) < 128) asciiCount++;
    else unicodeCount++;
  }
  const estimated = Math.ceil(asciiCount / 3.8) + Math.ceil(unicodeCount / 1.7);
  const ratio = Math.min(1.0, estimated / maxCtx);
  const pct = Math.round(ratio * 100);

  renderPreflightGauge(estimated, maxCtx, pct);

  // 2. Debounced Backend IPC verification for exact parity
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    try {
      const res = await invoke('estimate_chat_tokens', {
        prompt: text,
        maxContextLength: maxCtx
      });
      if (res) {
        renderPreflightGauge(res.estimated_tokens, res.max_context_length, res.usage_percentage);
      }
    } catch (e) {
      // Keep heuristic estimate on any error
    }
  }, 250);
}

function renderPreflightGauge(tokens, maxTokens, pct) {
  const badgeEl = document.getElementById('chat-token-badge');
  const labelEl = document.getElementById('chat-token-count-label');
  const barEl = document.getElementById('chat-token-progress-bar');
  const warningEl = document.getElementById('chat-token-overflow-warning');
  if (!badgeEl || !labelEl || !barEl) return;

  labelEl.textContent = `Estimated: ${tokens.toLocaleString()} / ${maxTokens.toLocaleString()} tokens (${pct}%)`;
  barEl.style.width = `${Math.min(100, pct)}%`;

  if (pct > 90) {
    badgeEl.style.background = 'rgba(239, 68, 68, 0.2)';
    badgeEl.style.color = '#ef4444';
    badgeEl.textContent = '🔴 Overflow Danger (>90%)';
    barEl.style.backgroundColor = '#ef4444';
    if (warningEl) warningEl.style.display = 'inline-block';
  } else if (pct > 70) {
    badgeEl.style.background = 'rgba(245, 158, 11, 0.2)';
    badgeEl.style.color = '#f59e0b';
    badgeEl.textContent = '🟡 Warning (70-90%)';
    barEl.style.backgroundColor = '#f59e0b';
    if (warningEl) warningEl.style.display = 'none';
  } else {
    badgeEl.style.background = 'rgba(52, 211, 153, 0.15)';
    badgeEl.style.color = '#34d399';
    badgeEl.textContent = '🟢 Safe (<70%)';
    barEl.style.backgroundColor = '#34d399';
    if (warningEl) warningEl.style.display = 'none';
  }
}


export async function sendMessage() {
  const inputEl = document.getElementById('chat-user-input');
  const messagesContainer = document.getElementById('chat-messages-container');
  if (!inputEl || !messagesContainer) return;

  const text = inputEl.value.trim();
  if (!text) return;

  // Add User Message
  conversationHistory.push({ role: 'user', content: text });
  inputEl.value = '';

  renderChatMessage('user', text);

  // Add Loading Bubble
  const loadingId = 'loading-' + Date.now();
  const loadingDiv = document.createElement('div');
  loadingDiv.id = loadingId;
  loadingDiv.className = 'chat-message message-assistant loading';
  loadingDiv.innerHTML = `
    <div class="message-sender">🤖 ${currentModel}</div>
    <div class="message-body"><span class="spinner">⏳</span> Generating response...</div>
  `;
  messagesContainer.appendChild(loadingDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  try {
    const res = await invoke('send_chat_message', {
      request: {
        model: currentModel,
        messages: conversationHistory,
        backend: currentBackend,
        temperature: 0.7,
        max_tokens: 2048
      }
    });

    // Remove loading bubble
    const lEl = document.getElementById(loadingId);
    if (lEl) lEl.remove();

    conversationHistory.push({ role: 'assistant', content: res.content });
    renderChatMessage('assistant', res.content, res);

    // Record into Model Execution Analytics
    recordTaskExecution(currentModel, {
      success: true,
      tokens: (res.prompt_tokens || 0) + (res.completion_tokens || 0),
      tps: res.tps || 0,
      vram: 'CUDA Active'
    });

  } catch (err) {
    const lEl = document.getElementById(loadingId);
    if (lEl) {
      lEl.className = 'chat-message message-assistant error';
      lEl.innerHTML = `<div class="message-body" style="color:#ef4444;">Error: ${err}</div>`;
    }

    recordTaskExecution(currentModel, {
      success: false,
      tokens: 0,
      tps: 0,
      vram: 'CUDA Error'
    });
  }
}

function renderChatMessage(role, content, stats = null) {
  const container = document.getElementById('chat-messages-container');
  if (!container) return;

  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-message message-${role}`;

  const statsHtml = stats ? `
    <div class="message-meta" style="font-size:11px; margin-top:6px; color:rgba(255,255,255,0.4); display:flex; gap:12px;">
      <span>⚡ ${stats.tps} t/s</span>
      <span>⏱️ ${(stats.duration_ms/1000).toFixed(2)}s</span>
      <span>📊 ${stats.completion_tokens} tokens</span>
    </div>
  ` : '';

  msgDiv.innerHTML = `
    <div class="message-sender" style="font-size:12px; font-weight:600; margin-bottom:4px; color:${role === 'user' ? '#60a5fa' : '#34d399'};">
      ${role === 'user' ? '👤 You' : '🤖 ' + currentModel}
    </div>
    <div class="message-body" style="line-height:1.5;">${escapeHtml(content)}</div>
    ${statsHtml}
  `;

  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
