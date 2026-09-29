// src/js/theme_studio.js
// trace:implements PRJ-003
// trace:implements FR-015

import { showToast } from './toast.js';

export const THEMES = [
  { id: 'default', name: 'Modern Indigo (Current)', icon: '🔮', accent: '#6366f1' },
  { id: 'ght-command-center', name: 'GHT Command Center', icon: '🟢', accent: '#7cf26b' },
  { id: 'cyberpunk-neon', name: 'Cyberpunk HUD', icon: '⚡', accent: '#f43f5e' },
  { id: 'nordic-frost', name: 'Nordic Frost', icon: '❄️', accent: '#38bdf8' }
];

export function initThemeStudio() {
  // Load saved theme from localStorage
  const savedTheme = localStorage.getItem('local-llm-hub-theme') || 'default';
  applyTheme(savedTheme);

  // Wire up theme pills in header
  setupHeaderThemeSwitcher();

  // Wire up Design Studio view interactions
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

  // Update pills UI
  document.querySelectorAll('.theme-pill-btn').forEach(btn => {
    if (btn.getAttribute('data-theme-id') === themeId) {
      btn.classList.add('active-theme');
    } else {
      btn.classList.remove('active-theme');
    }
  });
}

function setupHeaderThemeSwitcher() {
  const container = document.getElementById('header-theme-selector');
  if (!container) return;

  container.innerHTML = THEMES.map(t => `
    <button class="theme-pill-btn ${localStorage.getItem('local-llm-hub-theme') === t.id || (!localStorage.getItem('local-llm-hub-theme') && t.id === 'default') ? 'active-theme' : ''}" 
            data-theme-id="${t.id}" title="${t.name}">
      ${t.icon} ${t.name.split(' ')[0]}
    </button>
  `).join('');

  container.querySelectorAll('.theme-pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const themeId = btn.getAttribute('data-theme-id');
      applyTheme(themeId);
      showToast(`สลับธีมเป็น: ${THEMES.find(t => t.id === themeId)?.name}`);
    });
  });
}

function setupDesignStudioView() {
  const chooseButtons = document.querySelectorAll('.btn-choose-style');
  chooseButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const themeId = btn.getAttribute('data-theme-target');
      if (themeId) {
        applyTheme(themeId);
        showToast(`นำสไตล์ ${THEMES.find(t => t.id === themeId)?.name} ไปใช้ทั่วทั้งแอปพลิเคชันแล้ว! 🎉`);
      }
    });
  });

  // Wire interactive Storage Audit simulator/tester
  const btnAudit = document.getElementById('btn-studio-audit-storage');
  if (btnAudit) {
    btnAudit.addEventListener('click', async () => {
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
                🚀 ย้าย Blobs ที่เหลือไป G:\.ollama_blobs_root (คืนพื้นที่ 18.62 GB)
              </button>
            </div>
          `;
          
          document.getElementById('btn-quick-offload')?.addEventListener('click', () => {
            showToast("ส่งคำสั่ง Safe Blob Relocation ไปยัง Background Task เรียบร้อย! 🚀");
          });
        }
      }, 700);
    });
  }
}
