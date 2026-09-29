// src/js/toast.js
// trace:implements NFR-003
// Non-blocking Dark Glassmorphic Toast Notification System

export function showToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-notification-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-notification-container';
    container.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
    `;
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const borderColors = {
    info: '#38bdf8',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444'
  };

  const icons = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌'
  };

  toast.style.cssText = `
    background: rgba(15, 23, 42, 0.88);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid ${borderColors[type] || borderColors.info};
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
    border-radius: 8px;
    padding: 12px 18px;
    color: #fff;
    font-size: 13px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    display: flex;
    align-items: center;
    gap: 10px;
    pointer-events: auto;
    opacity: 0;
    transform: translateY(12px);
    transition: opacity 0.25s ease, transform 0.25s ease;
    max-width: 380px;
  `;

  toast.innerHTML = `
    <span style="font-size:16px;">${icons[type] || 'ℹ️'}</span>
    <span style="flex:1; line-height:1.4;">${message}</span>
  `;

  container.appendChild(toast);

  // Trigger smooth enter animation
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  // Auto dismiss
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 250);
  }, duration);
}
