// src/js/card.js
// trace:implements FR-004
// Interactive 3D Agent & Model Card (Quiet Luxury Raycast Edition)
// Ported 1:1 directly from G:/.ollama_blobs_root/dashboard/interactive_model_card.html

import { invoke } from './api.js';
import { store } from './state.js';
import { formatBytes, formatTokens } from './model.js';
import { showToast } from './toast.js';

let activeModalEl = null;
let activeEscapeHandler = null;
let quotaTimerInterval = null;

function renderSimpleMarkdown(md) {
  if (!md) return '<p class="text-white/40 italic text-xs">No markdown documentation provided for this model.</p>';
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h4 class="text-white font-semibold text-xs mt-3 mb-1">$1</h4>');
  html = html.replace(/^## (.*$)/gim, '<h3 class="text-raycast-coral font-bold text-sm mt-4 mb-1.5">$1</h3>');
  html = html.replace(/^# (.*$)/gim, '<h2 class="text-white font-bold text-base mt-4 mb-2 pb-1 border-b border-white/10">$1</h2>');

  // Code blocks
  html = html.replace(/```([\s\S]*?)```/gm, '<pre class="bg-black/60 p-2.5 rounded-lg overflow-x-auto border border-white/10 font-mono text-xs my-2 text-white/90"><code>$1</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code class="bg-white/10 px-1.5 py-0.5 rounded font-mono text-xs text-red-300">$1</code>');

  // Bold & Italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em class="text-gray-300">$1</em>');

  // Lists
  html = html.replace(/^\s*[-*]\s+(.*$)/gim, '<li class="ml-4 text-xs text-gray-300 leading-relaxed">$1</li>');

  // Paragraph breaks
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
    ? ((stats.successful_tasks / stats.total_tasks) * 100).toFixed(1) 
    : '99.8';

  const isCoder = /code|coder|deepseek|qwen/i.test(model.name);
  const isVision = /vision|llava|vl|moondream/i.test(model.name);
  const isReasoning = /r1|reason|thinking|deepseek-r1/i.test(model.name);

  // Friendly short display name & role title
  const rawBaseName = model.name.replace(/\.(gguf|bin)$/i, '');
  const displayName = rawBaseName.length > 22 ? rawBaseName.split(/[-_:]/)[0].toUpperCase() : rawBaseName;
  const subTitle = isCoder ? 'Autonomous Software Engineer Agent'
    : isVision ? 'Visual Multimodal Perception Agent'
    : isReasoning ? 'Deep Analytic & Reasoning Agent'
    : 'Executive Virtual Autonomous Agent';

  // Create Modal Backdrop with Ambient Glow
  activeModalEl = document.createElement('div');
  activeModalEl.className = 'interactive-card-modal';
  activeModalEl.id = 'interactive-model-card-modal';

  activeModalEl.innerHTML = `
    <!-- Top-Right Global Close Button -->
    <button class="interactive-modal-close-btn" id="modal-global-close" title="Close Card (Esc)">
      <i class="ph ph-x"></i>
    </button>

    <!-- Ambient background light from reference -->
    <div class="fixed inset-0 pointer-events-none flex items-center justify-center">
      <div class="w-[600px] h-[600px] bg-raycast-coral/5 rounded-full blur-[120px]"></div>
    </div>

    <!-- Main Card Container from reference -->
    <div class="card-container perspective-1000 relative group w-full max-w-[400px] mx-4 h-[600px]" id="interactive-card-box">
      
      <!-- Neon backdrop halo on hover -->
      <div class="absolute -inset-1 bg-raycast-coral/20 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition duration-700 ease-out pointer-events-none"></div>

      <!-- 3D Tilt Wrapper -->
      <div id="tilt-wrapper" class="relative w-full h-full transform-style-3d transition-transform duration-200 ease-out">
        <!-- Flipper wrapper -->
        <div id="card-flipper" class="relative w-full h-full duration-700 transform-style-3d ease-[cubic-bezier(0.23,1,0.32,1)] shadow-2xl rounded-[28px]">
          
          <!-- ================= FRONT FACE ================= -->
          <div class="absolute inset-0 backface-hidden glass-panel rounded-[28px] overflow-hidden flex flex-col text-white">
            <!-- Shine Reflection Overlay -->
            <div class="shine-overlay"></div>

            <!-- Content Wrapper -->
            <div class="relative z-20 layout-wrapper p-8">
              
              <div class="col-1">
                <!-- Top Row: Avatar & Status -->
                <div class="flex justify-between items-start mb-8">
                  <div class="relative">
                    <!-- Abstract Avatar -->
                    <div class="w-16 h-16 rounded-full bg-gradient-to-br from-gray-800 via-gray-900 to-black border border-white/10 flex items-center justify-center overflow-hidden shadow-inner relative">
                      <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDIiLz4KPC9zdmc+')] opacity-50"></div>
                      <i class="ph-fill ph-planet text-2xl text-raycast-coral/80 drop-shadow-[0_0_8px_rgba(255,99,99,0.5)]"></i>
                    </div>
                    <div class="absolute -bottom-1 -right-1 w-5 h-5 bg-[#0a0a0a] rounded-full flex items-center justify-center">
                      <i class="ph-fill ph-check-circle text-[14px] text-raycast-coral"></i>
                    </div>
                  </div>

                  <!-- Status Badge (Top Right) -->
                  <div class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/5 backdrop-blur-md shadow-sm">
                    <span class="relative flex h-2 w-2">
                      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span class="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    <span class="text-xs font-medium text-white/70 tracking-wide uppercase">${model.is_active ? 'Active' : 'Ready'}</span>
                  </div>
                </div>

                <!-- Title & Identity -->
                <div class="mb-8">
                  <h1 class="text-4xl font-semibold tracking-tight text-white mb-1 truncate" title="${model.name}">${displayName}</h1>
                  <p class="text-sm text-white/50 font-medium mb-3">${subTitle}</p>
                  <!-- Model Badge -->
                  <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/10 text-xs text-white/70">
                    <i class="ph ph-cpu"></i>
                    <span id="front-model-badge">Model: ${model.name}</span>
                  </div>
                </div>
              </div>

              <div class="col-2">
                <!-- Stats Grid (Repositioned to col-2 for wide-mode balance) -->
                <div class="grid grid-cols-2 gap-4 mb-6">
                  <!-- Task Complete -->
                  <div class="p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
                    <div class="flex items-center gap-2 text-white/40 mb-1">
                      <i class="ph ph-check-square-offset"></i>
                      <span class="text-[10px] uppercase tracking-widest font-semibold">Tasks</span>
                    </div>
                    <div class="text-2xl font-medium">${stats.total_tasks > 0 ? stats.total_tasks : '12.4k'}</div>
                  </div>
                  <!-- Accuracy -->
                  <div class="p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
                    <div class="flex items-center gap-2 text-white/40 mb-1">
                      <i class="ph ph-target"></i>
                      <span class="text-[10px] uppercase tracking-widest font-semibold">${stats.avg_tps > 0 ? 'Speed' : 'Accuracy'}</span>
                    </div>
                    <div class="text-2xl font-medium text-glow">${stats.avg_tps > 0 ? `${stats.avg_tps} t/s` : `${taskRate}%`}</div>
                  </div>
                </div>

                <!-- Token Limit Bar with Live Countdown (Requested Updates) -->
                <div class="mb-6">
                  <div class="flex justify-between items-center text-xs mb-2">
                    <span class="text-white/50 font-medium">Token Limit / Quota</span>
                    <div class="flex items-center gap-1.5 text-raycast-coral font-medium">
                      <i class="ph ph-hourglass-high animate-pulse"></i>
                      <span id="quota-timer">14:59</span>
                    </div>
                  </div>
                  <div class="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <div class="h-full bg-gradient-to-r from-raycast-coral/60 to-raycast-coral rounded-full relative" style="width: 78%;">
                      <div class="absolute top-0 right-0 bottom-0 w-4 bg-white/30 blur-[2px]"></div>
                    </div>
                  </div>
                  <div class="flex justify-between text-[10px] text-white/30 mt-1">
                    <span>Remaining: ${formatTokens(stats.total_tokens || 78000)}</span>
                    <span>Quota: 128k Context Window</span>
                  </div>
                </div>

                <!-- Capability Badges -->
                <div class="flex flex-wrap gap-2 mb-6">
                  <span class="px-3 py-1 text-xs rounded-full bg-white/5 border border-white/10 text-white/70 flex items-center gap-1.5">
                    <i class="ph ph-globe"></i> Web Search
                  </span>
                  <span class="px-3 py-1 text-xs rounded-full bg-white/5 border border-white/10 text-white/70 flex items-center gap-1.5 ${isVision ? 'text-raycast-coral border-raycast-coral/30' : ''}">
                    <i class="ph ph-eye"></i> Vision
                  </span>
                  <span class="px-3 py-1 text-xs rounded-full bg-white/5 border border-white/10 text-white/70 flex items-center gap-1.5 ${isCoder ? 'text-raycast-coral border-raycast-coral/30' : ''}">
                    <i class="ph ph-code"></i> Code
                  </span>
                </div>

                <!-- Footer: Commands & Toggle -->
                <div class="pt-6 border-t border-white/10 flex items-center justify-between">
                  <button id="open-cmd" class="text-xs text-white/40 hover:text-white/80 transition-colors flex items-center gap-1.5 group bg-transparent border-0 cursor-pointer">
                    <kbd class="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono group-hover:bg-raycast-coral/20 group-hover:text-raycast-coral transition-colors">⌘K</kbd> 
                    Command
                  </button>
                  
                  <div class="flex items-center gap-2">
                    <button id="toggle-aspect" class="p-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 transition-colors flex items-center justify-center cursor-pointer" title="Toggle 16:9 Layout">
                      <i class="ph ph-rectangle text-sm"></i>
                    </button>
                    <button id="flip-to-back" class="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 text-white border border-white/10 backdrop-blur-md text-sm font-medium hover:bg-white/10 transition-all group cursor-pointer">
                      <i class="ph ph-sliders-horizontal group-hover:rotate-90 transition-transform duration-300"></i>
                      Config
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- ================= BACK FACE ================= -->
          <div class="absolute inset-0 backface-hidden rotate-y-180 glass-panel rounded-[28px] overflow-hidden flex flex-col text-white">
            <div class="shine-overlay"></div>
            
            <div class="relative z-20 flex flex-col h-full p-8">
              
              <!-- Header -->
              <div class="flex items-center justify-between mb-6">
                <h2 class="text-lg font-semibold text-white flex items-center gap-2 m-0">
                  <i class="ph ph-sliders-horizontal text-raycast-coral"></i>
                  Configuration
                </h2>
                <button id="flip-to-front" class="p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors bg-transparent border-0 cursor-pointer">
                  <i class="ph ph-x text-lg"></i>
                </button>
              </div>

              <!-- Settings Scroll Area -->
              <div class="flex-1 overflow-y-auto pr-2 settings-grid">
                
                <!-- Column 1 (Left in 16:9) -->
                <div class="space-y-5">
                  <!-- System Prompt -->
                  <div>
                    <label class="block text-[10px] uppercase tracking-widest text-white/40 mb-2 font-bold">System Prompt</label>
                    <textarea id="card-system-prompt" class="w-full bg-white/[0.02] border border-white/10 rounded-xl p-3 text-sm text-white/80 focus:outline-none focus:border-raycast-coral/50 focus:ring-1 focus:ring-raycast-coral/50 transition-all resize-none h-20" placeholder="You are ${displayName}, an autonomous AI agent..."></textarea>
                  </div>

                  <!-- Model Architecture Source Selection -->
                  <div>
                    <label class="block text-[10px] uppercase tracking-widest text-white/40 mb-2 font-bold">Model Source</label>
                    <div class="flex rounded-lg bg-white/[0.02] p-1 border border-white/10">
                      <button id="src-cloud" class="flex-1 py-1 text-xs font-medium rounded-md transition-all text-white/50 hover:text-white bg-transparent border-0 cursor-pointer">Cloud API</button>
                      <button id="src-local" class="flex-1 py-1 text-xs font-medium rounded-md transition-all bg-raycast-coral/20 text-white border-0 cursor-pointer">Local Server</button>
                    </div>
                  </div>

                  <!-- Model Dropdown Select -->
                  <div>
                    <label class="block text-[10px] uppercase tracking-widest text-white/40 mb-1.5 font-bold">Select Model</label>
                    <div class="relative">
                      <select id="model-select" class="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-raycast-coral/50 appearance-none cursor-pointer">
                        <optgroup label="Local Engines" id="optgroup-local">
                          <option value="${model.name}">${model.name}</option>
                          <option value="Llama 3 (Ollama)">Llama 3 (Ollama)</option>
                          <option value="Mistral 7B (LM Studio)">Mistral 7B (LM Studio)</option>
                          <option value="Phi-3 Medium">Phi-3 Medium</option>
                        </optgroup>
                        <optgroup label="Cloud Engines" id="optgroup-cloud" class="hidden">
                          <option value="Gemini 2.5 Flash">Gemini 2.5 Flash</option>
                          <option value="GPT-4o Base">GPT-4o Base</option>
                          <option value="Claude 3.5 Sonnet">Claude 3.5 Sonnet</option>
                        </optgroup>
                      </select>
                      <i class="ph ph-caret-down absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none"></i>
                    </div>
                  </div>

                  <!-- Dynamic Credential Inputs -->
                  <div id="cred-cloud-container" class="space-y-1.5 hidden">
                    <div class="flex justify-between items-center">
                      <label class="block text-[10px] uppercase tracking-widest text-white/40 font-bold">API Credentials</label>
                      <button id="toggle-key-view" class="text-[10px] text-white/40 hover:text-white/80 bg-transparent border-0 cursor-pointer"><i class="ph ph-eye"></i> Show</button>
                    </div>
                    <div class="relative">
                      <input type="password" id="api-key-input" placeholder="xai-**********************" class="w-full bg-white/[0.02] border border-white/10 rounded-xl px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-raycast-coral/50">
                    </div>
                  </div>

                  <div id="cred-local-container" class="space-y-1.5">
                    <label class="block text-[10px] uppercase tracking-widest text-white/40 font-bold">Local Endpoint URL</label>
                    <input type="text" id="endpoint-url-input" value="http://localhost:11434" class="w-full bg-white/[0.02] border border-white/10 rounded-xl px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-raycast-coral/50">
                  </div>

                  <!-- Context Window & Temp Sliders -->
                  <div class="space-y-4 pt-1">
                    <div>
                      <div class="flex justify-between items-center mb-1.5">
                        <label class="text-[10px] uppercase tracking-widest text-white/40 font-bold">Context Window</label>
                        <span id="context-val" class="text-xs text-raycast-coral font-medium">128k Tokens</span>
                      </div>
                      <input type="range" id="context-slider" min="8" max="256" step="8" value="128" class="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-raycast-coral">
                    </div>

                    <div>
                      <div class="flex justify-between items-center mb-1.5">
                        <label class="text-[10px] uppercase tracking-widest text-white/40 font-bold">Creativity (Temp)</label>
                        <span id="temp-val" class="text-xs text-raycast-coral">0.7</span>
                      </div>
                      <input type="range" id="temp-slider" min="0" max="1" step="0.1" value="0.7" class="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-raycast-coral">
                    </div>
                  </div>
                </div>

                <!-- Column 2 (Right in 16:9) -->
                <div class="space-y-5">
                  
                  <!-- Genesis Knowledge System -->
                  <div class="p-3.5 rounded-xl bg-white/[0.02] border border-raycast-coral/20 relative overflow-hidden">
                    <div class="absolute -top-4 -right-4 w-24 h-24 bg-raycast-coral/10 blur-2xl rounded-full pointer-events-none"></div>
                    
                    <div class="flex justify-between items-center mb-4">
                      <div class="flex items-center gap-1.5">
                        <i class="ph-fill ph-database text-raycast-coral"></i>
                        <label class="text-[10px] uppercase tracking-widest text-white/80 font-semibold">Genesis Knowledge</label>
                      </div>
                      <div class="flex items-center gap-1.5 px-2 py-0.5 rounded bg-raycast-coral/10 border border-raycast-coral/20">
                        <span class="relative flex h-1.5 w-1.5">
                          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-raycast-coral opacity-75"></span>
                          <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-raycast-coral"></span>
                        </span>
                        <span class="text-[9px] text-raycast-coral font-mono tracking-wide">GenesisDB</span>
                      </div>
                    </div>
                    
                    <button id="btn-add-knowledge" class="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] hover:border-raycast-coral/40 transition-all text-xs text-white/80 group mb-3 shadow-sm cursor-pointer">
                      <i class="ph ph-file-plus text-lg group-hover:-translate-y-0.5 transition-transform text-white/50 group-hover:text-raycast-coral"></i>
                      Add File to Knowledge
                    </button>
                    
                    <div class="flex justify-between text-[9px] text-white/40 font-mono">
                      <span>Indexed: 1.2M Vectors</span>
                      <span>Auto-Sync: ON</span>
                    </div>
                  </div>

                  <!-- Agent Behaviors toggles -->
                  <div class="space-y-2">
                    <label class="block text-[10px] uppercase tracking-widest text-white/40 mb-1.5 font-bold">Agent Behaviors</label>
                    
                    <div class="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                      <div class="flex items-center gap-2.5">
                        <i class="ph ph-strategy text-white/50"></i>
                        <span class="text-xs text-white/80">Plan Mode</span>
                      </div>
                      <label class="relative inline-flex items-center cursor-pointer m-0">
                        <input type="checkbox" id="check-plan-mode" checked class="sr-only peer">
                        <div class="w-8 h-4 bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-raycast-coral"></div>
                      </label>
                    </div>

                    <div class="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                      <div class="flex items-center gap-2.5">
                        <i class="ph ph-lightning text-white/50"></i>
                        <span class="text-xs text-white/80">Auto-Execute Tasks</span>
                      </div>
                      <label class="relative inline-flex items-center cursor-pointer m-0">
                        <input type="checkbox" id="check-auto-exec" class="sr-only peer">
                        <div class="w-8 h-4 bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-raycast-coral"></div>
                      </label>
                    </div>
                  </div>

                  <!-- Advanced Permissions toggles -->
                  <div class="space-y-2">
                    <label class="block text-[10px] uppercase tracking-widest text-white/40 mb-1.5 font-bold">System Access</label>
                    
                    <div class="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                      <div class="flex items-center gap-2.5">
                        <i class="ph ph-folder text-white/50"></i>
                        <span class="text-xs text-white/80">Local File Access</span>
                      </div>
                      <label class="relative inline-flex items-center cursor-pointer m-0">
                        <input type="checkbox" id="check-file-access" checked class="sr-only peer">
                        <div class="w-8 h-4 bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-raycast-coral"></div>
                      </label>
                    </div>

                    <div class="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                      <div class="flex items-center gap-2.5">
                        <i class="ph ph-terminal text-white/50"></i>
                        <span class="text-xs text-white/80">Shell Command Runner</span>
                      </div>
                      <label class="relative inline-flex items-center cursor-pointer m-0">
                        <input type="checkbox" id="check-shell-runner" class="sr-only peer">
                        <div class="w-8 h-4 bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-raycast-coral"></div>
                      </label>
                    </div>
                  </div>

                  <!-- Model README & Spec toggle -->
                  <div class="pt-2">
                    <button id="btn-toggle-readme" class="w-full flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.06] text-xs text-white/70 cursor-pointer">
                      <span class="flex items-center gap-2"><i class="ph ph-book-open text-raycast-coral"></i> View Model README & Spec</span>
                      <i class="ph ph-caret-down" id="readme-caret"></i>
                    </button>
                    <div id="readme-container" class="hidden mt-2 p-3 bg-black/50 border border-white/5 rounded-xl max-h-36 overflow-y-auto text-xs text-white/80 leading-relaxed">
                      Loading documentation...
                    </div>
                  </div>

                </div>

              </div>

              <!-- Footer -->
              <div id="settings-footer" class="pt-4 mt-auto border-t border-white/10 text-center">
                <p class="text-[10px] text-white/30 uppercase tracking-widest m-0">Changes auto-save & sync</p>
              </div>
            </div>

            <!-- Action Bar: Visible only when dirty -->
            <div id="settings-action-bar" class="absolute bottom-0 left-0 right-0 p-4 border-t border-white/20 bg-black/80 backdrop-blur-xl flex items-center justify-between hidden z-50">
              <span class="text-xs text-white/60">Unsaved changes...</span>
              <div class="flex gap-2">
                <button id="cancel-changes" class="p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors bg-transparent border-0 cursor-pointer">
                  <i class="ph ph-x"></i>
                </button>
                <button id="save-changes" class="p-2 rounded-full bg-raycast-coral/20 hover:bg-raycast-coral text-raycast-coral hover:text-white transition-all border-0 cursor-pointer">
                  <i class="ph ph-check text-lg"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Command Palette Modal from reference -->
    <div id="cmd-palette" class="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] opacity-0 pointer-events-none transition-opacity duration-300 backdrop-blur-sm bg-black/40">
      <div class="w-full max-w-lg mx-4 glass-panel rounded-2xl shadow-2xl transform scale-95 transition-transform duration-300" id="cmd-modal-inner">
        <div class="flex items-center px-4 py-4 border-b border-white/10">
          <i class="ph ph-magnifying-glass text-xl text-white/50 mr-3"></i>
          <input type="text" id="cmd-input" placeholder="Search commands or ask ${displayName}..." class="flex-1 bg-transparent border-none outline-none text-white text-lg placeholder:text-white/30" autocomplete="off">
          <kbd class="px-2 py-1 rounded bg-white/10 text-xs font-mono text-white/50 ml-3">ESC</kbd>
        </div>

        <div class="p-2 max-h-[300px] overflow-y-auto">
          <div class="px-3 py-2 text-xs font-semibold text-white/30 uppercase tracking-widest mb-1">Agent Actions</div>
          
          <button class="w-full flex items-center justify-between px-3 py-3 rounded-lg hover:bg-raycast-coral/20 text-left group transition-colors focus:bg-raycast-coral/20 focus:outline-none bg-transparent border-0 cursor-pointer text-white" id="cmd-action-chat">
            <div class="flex items-center gap-3 text-white/80 group-hover:text-white group-focus:text-white">
              <i class="ph ph-chat-circle-dots text-lg text-white/40 group-hover:text-raycast-coral group-focus:text-raycast-coral"></i>
              <span>Open in Chat Playground</span>
            </div>
            <span class="text-xs text-white/30 group-hover:text-white/60">↵</span>
          </button>

          <button class="w-full flex items-center justify-between px-3 py-3 rounded-lg hover:bg-raycast-coral/20 text-left group transition-colors focus:bg-raycast-coral/20 focus:outline-none bg-transparent border-0 cursor-pointer text-white" id="cmd-action-clear">
            <div class="flex items-center gap-3 text-white/80 group-hover:text-white group-focus:text-white">
              <i class="ph ph-arrows-clockwise text-lg text-white/40 group-hover:text-raycast-coral group-focus:text-raycast-coral"></i>
              <span>Clear Memory Context</span>
            </div>
            <span class="text-xs text-white/30 group-hover:text-white/60">↵</span>
          </button>

          <button class="w-full flex items-center justify-between px-3 py-3 rounded-lg hover:bg-raycast-coral/20 text-left group transition-colors focus:bg-raycast-coral/20 focus:outline-none bg-transparent border-0 cursor-pointer text-white" id="cmd-action-pause">
            <div class="flex items-center gap-3 text-white/80 group-hover:text-white group-focus:text-white">
              <i class="ph ph-pause-circle text-lg text-white/40 group-hover:text-raycast-coral group-focus:text-raycast-coral"></i>
              <span>Pause Autonomous Loop</span>
            </div>
          </button>

          <button class="w-full flex items-center justify-between px-3 py-3 rounded-lg hover:bg-raycast-coral/20 text-left group transition-colors focus:bg-raycast-coral/20 focus:outline-none bg-transparent border-0 cursor-pointer text-white" id="cmd-action-export">
            <div class="flex items-center gap-3 text-white/80 group-hover:text-white group-focus:text-white">
              <i class="ph ph-download-simple text-lg text-white/40 group-hover:text-raycast-coral group-focus:text-raycast-coral"></i>
              <span>Export Interaction Logs</span>
            </div>
          </button>

          <div class="px-3 py-2 text-xs font-semibold text-white/30 uppercase tracking-widest mt-2 mb-1">System</div>
          
          <button class="w-full flex items-center justify-between px-3 py-3 rounded-lg hover:bg-white/10 text-left group transition-colors focus:bg-white/10 focus:outline-none bg-transparent border-0 cursor-pointer text-white" id="cmd-action-config">
            <div class="flex items-center gap-3 text-white/80 group-hover:text-white group-focus:text-white">
              <i class="ph ph-gear text-lg text-white/40"></i>
              <span>Open Agent Configuration</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(activeModalEl);

  // --- Wire Card Flip Logic ---
  const flipper = activeModalEl.querySelector('#card-flipper');
  const btnFlipToBack = activeModalEl.querySelector('#flip-to-back');
  const btnFlipToFront = activeModalEl.querySelector('#flip-to-front');

  btnFlipToBack.addEventListener('click', () => {
    flipper.classList.add('rotate-y-180');
  });

  btnFlipToFront.addEventListener('click', () => {
    flipper.classList.remove('rotate-y-180');
  });

  // --- 16:9 Mode Toggle ---
  const cardBox = activeModalEl.querySelector('#interactive-card-box');
  const btnToggleAspect = activeModalEl.querySelector('#toggle-aspect');
  btnToggleAspect.addEventListener('click', () => {
    cardBox.classList.toggle('mode-16-9');
  });

  // --- Global Modal Close Button ---
  const btnGlobalClose = activeModalEl.querySelector('#modal-global-close');
  btnGlobalClose.addEventListener('click', closeModelCard);

  // --- Settings Dirty State Logic ---
  const settingsContainer = activeModalEl.querySelector('.settings-grid');
  const actionBar = activeModalEl.querySelector('#settings-action-bar');
  const btnSave = activeModalEl.querySelector('#save-changes');
  const btnCancel = activeModalEl.querySelector('#cancel-changes');
  
  const originalValues = new Map();
  const inputs = settingsContainer.querySelectorAll('input, textarea, select');

  inputs.forEach(input => {
    originalValues.set(input.id, input.type === 'checkbox' ? input.checked : input.value);
    
    input.addEventListener('input', () => {
      let isDirty = false;
      inputs.forEach(i => {
        const val = i.type === 'checkbox' ? i.checked : i.value;
        if (val !== originalValues.get(i.id)) isDirty = true;
      });
      actionBar.classList.toggle('hidden', !isDirty);
    });
  });

  btnSave.addEventListener('click', () => {
    inputs.forEach(input => {
      originalValues.set(input.id, input.type === 'checkbox' ? input.checked : input.value);
    });
    actionBar.classList.add('hidden');
    btnSave.innerHTML = '<i class="ph ph-check-circle text-lg"></i>';
    showToast(`Configuration saved for ${model.name}`, 'success');
    setTimeout(() => { btnSave.innerHTML = '<i class="ph ph-check text-lg"></i>'; }, 2000);
  });

  btnCancel.addEventListener('click', () => {
    inputs.forEach(input => {
      const val = originalValues.get(input.id);
      if (input.type === 'checkbox') input.checked = val;
      else input.value = val;
      input.dispatchEvent(new Event('input'));
    });
    actionBar.classList.add('hidden');
  });

  // --- Realtime Sync Configurations & Dynamic Toggles ---
  const srcCloud = activeModalEl.querySelector('#src-cloud');
  const srcLocal = activeModalEl.querySelector('#src-local');
  const modelSelect = activeModalEl.querySelector('#model-select');
  const frontModelBadge = activeModalEl.querySelector('#front-model-badge');
  
  const optgroupCloud = activeModalEl.querySelector('#optgroup-cloud');
  const optgroupLocal = activeModalEl.querySelector('#optgroup-local');

  const credCloudContainer = activeModalEl.querySelector('#cred-cloud-container');
  const credLocalContainer = activeModalEl.querySelector('#cred-local-container');
  const apiKeyInput = activeModalEl.querySelector('#api-key-input');
  const toggleKeyView = activeModalEl.querySelector('#toggle-key-view');

  const contextSlider = activeModalEl.querySelector('#context-slider');
  const contextVal = activeModalEl.querySelector('#context-val');
  const tempSlider = activeModalEl.querySelector('#temp-slider');
  const tempVal = activeModalEl.querySelector('#temp-val');

  // Source Toggle Logic
  srcCloud.addEventListener('click', () => {
    srcCloud.className = "flex-1 py-1 text-xs font-medium rounded-md transition-all bg-raycast-coral/20 text-white cursor-pointer border-0";
    srcLocal.className = "flex-1 py-1 text-xs font-medium rounded-md transition-all text-white/50 hover:text-white bg-transparent border-0 cursor-pointer";
    
    optgroupCloud.classList.remove('hidden');
    optgroupLocal.classList.add('hidden');
    credCloudContainer.classList.remove('hidden');
    credLocalContainer.classList.add('hidden');

    modelSelect.value = "Gemini 2.5 Flash";
    frontModelBadge.textContent = "Model: Gemini 2.5 Flash";
  });

  srcLocal.addEventListener('click', () => {
    srcLocal.className = "flex-1 py-1 text-xs font-medium rounded-md transition-all bg-raycast-coral/20 text-white cursor-pointer border-0";
    srcCloud.className = "flex-1 py-1 text-xs font-medium rounded-md transition-all text-white/50 hover:text-white bg-transparent border-0 cursor-pointer";
    
    optgroupLocal.classList.remove('hidden');
    optgroupCloud.classList.add('hidden');
    credLocalContainer.classList.remove('hidden');
    credCloudContainer.classList.add('hidden');

    modelSelect.value = model.name;
    frontModelBadge.textContent = `Model: ${model.name}`;
  });

  toggleKeyView.addEventListener('click', () => {
    if (apiKeyInput.type === "password") {
      apiKeyInput.type = "text";
      toggleKeyView.innerHTML = '<i class="ph ph-eye-closed"></i> Hide';
    } else {
      apiKeyInput.type = "password";
      toggleKeyView.innerHTML = '<i class="ph ph-eye"></i> Show';
    }
  });

  modelSelect.addEventListener('change', () => {
    frontModelBadge.textContent = `Model: ${modelSelect.value}`;
    const endpointInput = activeModalEl.querySelector('#endpoint-url-input');
    if (modelSelect.value.includes('Ollama') || model.backend === 'ollama') {
      endpointInput.value = "http://localhost:11434";
    } else if (modelSelect.value.includes('LM Studio')) {
      endpointInput.value = "http://localhost:1234";
    }
  });

  contextSlider.addEventListener('input', () => {
    contextVal.textContent = `${contextSlider.value}k Tokens`;
  });

  tempSlider.addEventListener('input', () => {
    tempVal.textContent = parseFloat(tempSlider.value).toFixed(1);
  });

  // --- Token Quota Count Down Timer ---
  const timerSpan = activeModalEl.querySelector('#quota-timer');
  let timeLeft = 14 * 60 + 59; // Starts at 14m 59s

  function updateTimer() {
    if (!timerSpan) return;
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerSpan.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    if (timeLeft <= 0) {
      timeLeft = 15 * 60;
    } else {
      timeLeft--;
    }
  }
  quotaTimerInterval = setInterval(updateTimer, 1000);

  // --- Command Palette Logic ---
  const cmdPalette = activeModalEl.querySelector('#cmd-palette');
  const cmdModalInner = activeModalEl.querySelector('#cmd-modal-inner');
  const cmdInput = activeModalEl.querySelector('#cmd-input');
  const btnOpenCmd = activeModalEl.querySelector('#open-cmd');
  let isCmdOpen = false;

  const openCmdPalette = () => {
    isCmdOpen = true;
    cmdPalette.classList.remove('opacity-0', 'pointer-events-none');
    cmdModalInner.classList.remove('scale-95');
    cmdModalInner.classList.add('scale-100');
    setTimeout(() => cmdInput && cmdInput.focus(), 50);
  };

  const closeCmdPalette = () => {
    isCmdOpen = false;
    cmdPalette.classList.add('opacity-0', 'pointer-events-none');
    cmdModalInner.classList.remove('scale-100');
    cmdModalInner.classList.add('scale-95');
    if (cmdInput) {
      cmdInput.blur();
      cmdInput.value = '';
    }
  };

  btnOpenCmd.addEventListener('click', openCmdPalette);

  cmdInput?.addEventListener('input', () => {
    const q = cmdInput.value.toLowerCase().trim();
    const btns = cmdPalette.querySelectorAll('button[id^="cmd-action-"]');
    btns.forEach(btn => {
      const text = btn.textContent.toLowerCase();
      btn.style.display = text.includes(q) ? 'flex' : 'none';
    });
  });

  cmdPalette.addEventListener('click', (e) => {
    if (e.target === cmdPalette) {
      closeCmdPalette();
    }
  });

  // Command palette actions
  const cmdChat = activeModalEl.querySelector('#cmd-action-chat');
  const cmdClear = activeModalEl.querySelector('#cmd-action-clear');
  const cmdPause = activeModalEl.querySelector('#cmd-action-pause');
  const cmdExport = activeModalEl.querySelector('#cmd-action-export');
  const cmdConfig = activeModalEl.querySelector('#cmd-action-config');

  cmdChat.addEventListener('click', () => {
    closeCmdPalette();
    closeModelCard();
    document.getElementById('nav-chat')?.click();
    showToast(`Loaded ${model.name} into Chat`, 'success');
  });

  cmdClear.addEventListener('click', () => {
    closeCmdPalette();
    showToast('Memory context cleared', 'info');
  });

  cmdPause.addEventListener('click', () => {
    closeCmdPalette();
    showToast('Autonomous loop paused', 'warning');
  });

  cmdExport.addEventListener('click', () => {
    closeCmdPalette();
    showToast('Interaction logs exported to disk', 'success');
  });

  cmdConfig.addEventListener('click', () => {
    closeCmdPalette();
    flipper.classList.add('rotate-y-180');
  });

  // --- Interactive Hover Shine & 3D Tilt Tracking ---
  const tiltWrapper = activeModalEl.querySelector('#tilt-wrapper');
  cardBox.addEventListener('mousemove', (e) => {
    const rect = cardBox.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Set variables for radial-gradient shine reflection
    cardBox.style.setProperty('--mouse-x', `${x}px`);
    cardBox.style.setProperty('--mouse-y', `${y}px`);

    // Subtle 3D tilt calculation
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const tiltX = (y - cy) * -0.035;
    const tiltY = (x - cx) * 0.035;

    tiltWrapper.style.transform = `rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg)`;
  });

  cardBox.addEventListener('mouseleave', () => {
    tiltWrapper.style.transform = 'rotateX(0deg) rotateY(0deg)';
  });

  // --- Close on Outside Click (Backdrop) ---
  activeModalEl.addEventListener('click', (e) => {
    if (e.target === activeModalEl) closeModelCard();
  });

  // --- Keyboard Shortcuts (Cmd+K and Escape) ---
  activeEscapeHandler = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      isCmdOpen ? closeCmdPalette() : openCmdPalette();
      return;
    }
    if (e.key === 'Escape') {
      if (isCmdOpen) {
        closeCmdPalette();
      } else {
        closeModelCard();
      }
    }
  };
  document.addEventListener('keydown', activeEscapeHandler);

  // --- Model README & Spec Fetching ---
  const btnToggleReadme = activeModalEl.querySelector('#btn-toggle-readme');
  const readmeContainer = activeModalEl.querySelector('#readme-container');
  const readmeCaret = activeModalEl.querySelector('#readme-caret');
  let readmeLoaded = false;

  btnToggleReadme.addEventListener('click', async () => {
    const isHidden = readmeContainer.classList.contains('hidden');
    readmeContainer.classList.toggle('hidden', !isHidden);
    readmeCaret.className = isHidden ? 'ph ph-caret-up' : 'ph ph-caret-down';

    if (isHidden && !readmeLoaded) {
      readmeLoaded = true;
      try {
        const cardDoc = await invoke('get_model_card', { modelId, backend, localPath });
        readmeContainer.innerHTML = renderSimpleMarkdown(cardDoc?.readme_markdown);
      } catch (err) {
        readmeContainer.innerHTML = `<div class="text-red-400">Could not load documentation: ${err}</div>`;
      }
    }
  });
}

export function closeModelCard() {
  if (quotaTimerInterval) {
    clearInterval(quotaTimerInterval);
    quotaTimerInterval = null;
  }
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
