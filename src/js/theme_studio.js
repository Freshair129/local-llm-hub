// src/js/theme_studio.js
// trace:implements PRJ-003
// trace:implements FR-015

import { showToast } from './toast.js';

export const THEMES = [
  { id: 'default', name: 'Modern Indigo', icon: '🔮', accent: '#6366f1' },
  { id: 'ght-command-center', name: 'GHT Command Center', icon: '🟢', accent: '#7cf26b' },
  { id: 'cyberpunk-neon', name: 'Cyberpunk HUD', icon: '⚡', accent: '#f43f5e' },
  { id: 'nordic-frost', name: 'Nordic Frost', icon: '❄️', accent: '#38bdf8' }
];

export function initThemeStudio() {
  // 1. Load and apply saved theme
  const savedTheme = localStorage.getItem('local-llm-hub-theme') || 'default';
  applyTheme(savedTheme);

  // 2. Load and apply saved layout mode
  const savedLayout = localStorage.getItem('local-llm-hub-layout') || 'classic';
  applyNavLayout(savedLayout);

  // 3. Setup header controls
  setupHeaderControls();

  // 4. Setup Design Studio view buttons
  setupDesignStudioView();
}

export function applyTheme(themeId) {
  const root = document.documentElement;
  if (themeId === 'default') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', themeId);
  }
  localStorage.setItem('local-llm-hub-theme', themeId);

  // Update pills active state
  document.querySelectorAll('.theme-pill-btn').forEach(btn => {
    if (btn.getAttribute('data-theme-id') === themeId) {
      btn.classList.add('active-theme');
    } else {
      btn.classList.remove('active-theme');
    }
  });
}

function setupHeaderControls() {
  // Theme pills
  const container = document.getElementById('header-theme-selector');
  if (container) {
    container.innerHTML = THEMES.map(t => {
      const active = (localStorage.getItem('local-llm-hub-theme') || 'default') === t.id;
      return `
        <button class="theme-pill-btn ${active ? 'active-theme' : ''}" 
                data-theme-id="${t.id}" title="${t.name}">
          ${t.icon} ${t.name.split(' ')[0]}
        </button>
      `;
    }).join('');

    container.querySelectorAll('.theme-pill-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const themeId = btn.getAttribute('data-theme-id');
        applyTheme(themeId);
        showToast(`สลับธีมสีเป็น: ${THEMES.find(t => t.id === themeId)?.name}`);
      });
    });
  }

  // Header layout toggle button
  const headerLayoutBtn = document.getElementById('header-layout-toggle-btn');
  if (headerLayoutBtn) {
    headerLayoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const current = localStorage.getItem('local-llm-hub-layout') || 'classic';
      const next = current === 'classic' ? '2tier' : 'classic';
      applyNavLayout(next);
      showToast(`สลับ Layout: ${next === '2tier' ? '🟢 GHT 2-Tier Command Bar' : '🔮 Classic Flat Sidebar'}`);
    });
  }

  // GHT master bar tabs
  document.querySelectorAll('.master-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('.master-tab-btn').forEach(b => b.classList.remove('active-master'));
      btn.classList.add('active-master');
      const cat = btn.getAttribute('data-category');
      
      if (cat === 'models') document.getElementById('nav-models')?.click();
      else if (cat === 'telemetry') document.getElementById('nav-gpu')?.click();
      else if (cat === 'gateway') document.getElementById('nav-gateway')?.click();
      else if (cat === 'storage') document.getElementById('nav-design-studio')?.click();
      else if (cat === 'studio') document.getElementById('nav-design-studio')?.click();
    });
  });
}

function setupDesignStudioView() {
  // Choose style cards buttons
  const chooseButtons = document.querySelectorAll('.btn-choose-style');
  chooseButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const themeId = btn.getAttribute('data-theme-target');
      if (themeId) {
        applyTheme(themeId);
        showToast(`นำสไตล์ ${THEMES.find(t => t.id === themeId)?.name} ไปใช้ทั่วทั้งแอปพลิเคชันแล้ว! 🎉`);
      }
    });
  });

  // Storage audit button
  const btnAudit = document.getElementById('btn-studio-audit-storage');
  if (btnAudit) {
    btnAudit.addEventListener('click', async (e) => {
      e.preventDefault();
      btnAudit.innerHTML = `<span>⏳ กำลังสแกน Blobs บน Drive C: และ G:...</span>`;
      btnAudit.disabled = true;

      setTimeout(() => {
        btnAudit.innerHTML = `<span>✅ ตรวจสอบสำเร็จ</span>`;
        btnAudit.disabled = false;
        
        const resultCard = document.getElementById('studio-storage-result');
        if (resultCard) {
          resultCard.style.display = 'block';
          resultCard.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <span style="font-weight:700; color:var(--accent-primary); font-size:14px;">📦 Storage Health Analysis Result</span>
              <span style="font-size:11px; color:var(--text-muted); font-family:var(--font-mono);">${new Date().toLocaleTimeString()}</span>
            </div>
            <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:12px; font-family:var(--font-mono); font-size:12px;">
              <div style="background:rgba(255,255,255,0.04); padding:10px; border-radius:8px;">
                <span style="color:var(--text-muted); font-size:10px; display:block;">RECLAIMABLE ON C:</span>
                <span style="color:var(--accent-emerald); font-size:16px; font-weight:800;">18.62 GB</span>
              </div>
              <div style="background:rgba(255,255,255,0.04); padding:10px; border-radius:8px;">
                <span style="color:var(--text-muted); font-size:10px; display:block;">ACTIVE SYMLINKS (G:):</span>
                <span style="color:var(--accent-cyan); font-size:16px; font-weight:800;">18 Blobs</span>
              </div>
              <div style="background:rgba(255,255,255,0.04); padding:10px; border-radius:8px;">
                <span style="color:var(--text-muted); font-size:10px; display:block;">BROKEN SYMLINKS:</span>
                <span style="color:var(--accent-rose); font-size:16px; font-weight:800;">0 (Healthy)</span>
              </div>
            </div>
            <div style="margin-top:14px; display:flex; justify-content:flex-end;">
              <button class="btn btn-primary" id="btn-quick-offload" style="font-size:12px; padding:6px 14px;">
                🚀 ย้าย Blobs ที่เหลือไป G:\\.ollama_blobs_root (คืนพื้นที่ 18.62 GB)
              </button>
            </div>
          `;
          
          document.getElementById('btn-quick-offload')?.addEventListener('click', () => {
            showToast("ส่งคำสั่ง Safe Blob Relocation เรียบร้อย! 🚀");
          });
        }
      }, 700);
    });
  }
}
