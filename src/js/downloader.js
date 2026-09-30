// src/js/downloader.js
// trace:implements FR-012
//! In-App Model Downloader & Ollama/HF Registry Pull Interface

import { showToast } from './toast.js';
import { syncAllModels } from './model.js';

import { invoke } from './api.js';

export function initDownloader() {
  const container = document.getElementById('view-downloader');
  if (!container) return;

  renderDownloaderSkeleton(container);
  setupDownloaderEvents();
}

function renderDownloaderSkeleton(container) {
  container.innerHTML = `
    <div class="view-header">
      <div class="header-title-group">
        <h2>📥 In-App Model Downloader</h2>
        <p class="subtitle">Search, pull, and stream GGUF and Ollama weights directly into RTX 3060 local storage</p>
      </div>
    </div>

    <!-- Downloader Input Box -->
    <div class="glass-panel download-input-card">
      <div class="download-form">
        <div class="input-group">
          <label for="download-model-name">Model Identifier or HuggingFace Repo:</label>
          <div class="input-with-button">
            <input type="text" id="download-model-name" class="glass-input" placeholder="e.g. qwen2.5-coder:7b, llama3.2:3b, or hf.co/org/model" />
            <button id="btn-start-download" class="btn btn-primary">
              <span>⬇️ Pull Model</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Quick Preset Recommendation Tags -->
      <div class="quick-download-tags">
        <span class="tag-heading">🔥 Recommended Local Candidates (12GB CUDA):</span>
        <div class="tag-list">
          <button class="dl-tag" data-model="qwen2.5-coder:7b">qwen2.5-coder:7b (4.7 GB)</button>
          <button class="dl-tag" data-model="llama3.2:3b">llama3.2:3b (2.0 GB)</button>
          <button class="dl-tag" data-model="deepseek-r1:8b">deepseek-r1:8b (4.9 GB)</button>
          <button class="dl-tag" data-model="gemma2:9b">gemma2:9b (5.5 GB)</button>
          <button class="dl-tag" data-model="mistral-nemo:12b">mistral-nemo:12b (7.1 GB)</button>
        </div>
      </div>

      <!-- Active Download Progress Indicator -->
      <div id="download-progress-container" class="download-progress-container" style="display: none;">
        <div class="progress-info">
          <span id="dl-status-text">Pulling manifest...</span>
          <span id="dl-percent-text">0%</span>
        </div>
        <div class="progress-bar-track">
          <div id="dl-progress-bar" class="progress-bar-fill" style="width: 0%;"></div>
        </div>
      </div>
    </div>

    <!-- Storage Info Card -->
    <div class="glass-panel storage-info-card">
      <div class="storage-stats-row">
        <div class="storage-item">
          <span class="storage-icon">💾</span>
          <div>
            <div class="storage-label">Local Storage Path</div>
            <div class="storage-val">O:\\.ollama\\models</div>
          </div>
        </div>
        <div class="storage-item">
          <span class="storage-icon">⚡</span>
          <div>
            <div class="storage-label">Target Hardware</div>
            <div class="storage-val">NVIDIA GeForce RTX 3060 (12GB VRAM)</div>
          </div>
        </div>
        <div class="storage-item">
          <span class="storage-icon">🛡️</span>
          <div>
            <div class="storage-label">Network Protocol</div>
            <div class="storage-val">HTTP/2 Range Streaming & Resume Support</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function setupDownloaderEvents() {
  const btnDownload = document.getElementById('btn-start-download');
  const inputModel = document.getElementById('download-model-name');

  if (btnDownload) {
    btnDownload.addEventListener('click', handleDownload);
  }

  // Quick tag selection
  document.querySelectorAll('.dl-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      const model = tag.getAttribute('data-model');
      if (inputModel && model) {
        inputModel.value = model;
        inputModel.focus();
      }
    });
  });
}

async function handleDownload() {
  const inputModel = document.getElementById('download-model-name');
  const btnDownload = document.getElementById('btn-start-download');
  const progressContainer = document.getElementById('download-progress-container');
  const progressBar = document.getElementById('dl-progress-bar');
  const statusText = document.getElementById('dl-status-text');
  const percentText = document.getElementById('dl-percent-text');

  const modelName = inputModel?.value?.trim();
  if (!modelName) {
    showToast('Please enter a model name to pull', 'warning');
    return;
  }

  if (btnDownload) {
    btnDownload.disabled = true;
    btnDownload.innerHTML = '<span>⏳ Pulling...</span>';
  }

  if (progressContainer) {
    progressContainer.style.display = 'block';
  }

  // Animate progress simulation while Ollama downloads
  let progress = 5;
  const interval = setInterval(() => {
    progress = Math.min(95, progress + Math.floor(Math.random() * 8) + 2);
    if (progressBar) progressBar.style.width = `${progress}%`;
    if (percentText) percentText.textContent = `${progress}%`;
    if (statusText) statusText.textContent = `Downloading layers for ${modelName}...`;
  }, 600);

  try {
    const res = await invoke('pull_model', { modelName });
    clearInterval(interval);

    if (progressBar) progressBar.style.width = '100%';
    if (percentText) percentText.textContent = '100%';
    if (statusText) statusText.textContent = `Completed: ${modelName} ready in local library!`;

    showToast(`Model '${modelName}' downloaded successfully!`, 'success');

    // Trigger full model sync
    await syncAllModels();
  } catch (err) {
    clearInterval(interval);
    if (statusText) statusText.textContent = `Download failed: ${err}`;
    showToast(`Pull error: ${err}`, 'error');
  } finally {
    if (btnDownload) {
      btnDownload.disabled = false;
      btnDownload.innerHTML = '<span>⬇️ Pull Model</span>';
    }
  }
}
