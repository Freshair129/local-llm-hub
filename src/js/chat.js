// src/js/chat.js
// trace:implements FR-007
// Interactive Chat Playground Frontend Component

import { recordTaskExecution } from './stats.js';

const invoke = window.__TAURI__?.core?.invoke || (async () => ({
  role: "assistant",
  content: "Hello! I am your local model running directly on your GPU.",
  prompt_tokens: 15,
  completion_tokens: 32,
  duration_ms: 220,
  tps: 145.5
}));

let conversationHistory = [];
let currentModel = 'hf.co/JetBrains/Mellum2-12B-A2.5B-Instruct-GGUF-Q4_K_M:Q4_K_M';
let currentBackend = 'ollama';

export function initChat(models = []) {
  const modelSelect = document.getElementById('chat-model-select');
  if (modelSelect && models.length > 0) {
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
