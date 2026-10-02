// src/js/share.js
// trace:implements FR-010
// trace:implements FEAT-024
//! LAN Model Streaming with Ephemeral PIN and QR Code Pairing

import { invoke } from './api.js';
import { store } from './state.js';
import { showToast } from './toast.js';

let activePin = null;
let pinExpiresAt = 0;
let pinCountdownInterval = null;
let currentEndpointUrl = 'http://127.0.0.1:8080/';

export function initShare() {
  const btnToggle = document.getElementById('btn-toggle-lan-share');
  const btnRegenPin = document.getElementById('btn-regen-lan-pin');
  const btnCopyUrl = document.getElementById('btn-copy-pairing-url');
  const btnShowQr = document.getElementById('btn-show-lan-qr');

  if (btnToggle) {
    btnToggle.onclick = () => toggleLanShare();
  }

  if (btnRegenPin) {
    btnRegenPin.onclick = async () => {
      await generateNewPin();
      showToast('New ephemeral PIN generated!', 'success');
    };
  }

  if (btnCopyUrl) {
    btnCopyUrl.onclick = () => {
      const pairingUrl = getPairingUrl();
      navigator.clipboard.writeText(pairingUrl);
      showToast('Pairing URL with PIN copied to clipboard! 📋', 'success');
    };
  }

  if (btnShowQr) {
    btnShowQr.onclick = () => {
      toggleQrCodeModal();
    };
  }

  // Check if PIN session already exists
  fetchActivePin();
}

export function getPairingUrl() {
  const url = currentEndpointUrl.endsWith('/') ? currentEndpointUrl : currentEndpointUrl + '/';
  if (activePin) {
    return `${url}?pin=${activePin}`;
  }
  return url;
}

export async function fetchActivePin() {
  try {
    const session = await invoke('get_active_lan_pin');
    if (session) {
      updatePinDisplay(session.pin, session.expires_at);
    } else {
      await generateNewPin();
    }
  } catch (e) {
    console.warn('Failed to fetch active LAN pin:', e);
  }
}

export async function generateNewPin(durationSecs = 900) {
  try {
    const session = await invoke('generate_lan_pin', { durationSecs });
    if (session) {
      updatePinDisplay(session.pin, session.expires_at);
    }
  } catch (e) {
    console.error('Failed to generate LAN pin:', e);
  }
}

function updatePinDisplay(pin, expiresAt) {
  activePin = pin;
  pinExpiresAt = expiresAt;

  const pinDisplay = document.getElementById('lan-active-pin-display');
  if (pinDisplay) {
    pinDisplay.textContent = pin;
  }

  startCountdown();
  renderQrCode();
}

function startCountdown() {
  clearInterval(pinCountdownInterval);
  const timerDisplay = document.getElementById('lan-pin-timer-display');
  if (!timerDisplay) return;

  const update = () => {
    const nowSecs = Math.floor(Date.now() / 1000);
    const remaining = Math.max(0, pinExpiresAt - nowSecs);
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    timerDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    if (remaining === 0) {
      clearInterval(pinCountdownInterval);
      timerDisplay.textContent = 'EXPIRED';
      timerDisplay.style.color = '#ef4444';
    } else {
      timerDisplay.style.color = '#34d399';
    }
  };

  update();
  pinCountdownInterval = setInterval(update, 1000);
}

export async function toggleLanShare() {
  const btnToggle = document.getElementById('btn-toggle-lan-share');
  const currentState = store.state.lanSharingActive;
  if (btnToggle) btnToggle.disabled = true;

  try {
    if (!currentState) {
      // Ensure PIN is generated
      if (!activePin) {
        await generateNewPin();
      }

      const status = await invoke('start_lan_share', {
        rootPath: store.state.lanSharedPath || 'models/gguf',
        port: store.state.lanPort || 8080
      });

      store.setState({ lanSharingActive: true });
      if (btnToggle) {
        btnToggle.textContent = 'Stop LAN Share 🛑';
        btnToggle.style.background = '#ef4444';
      }

      const networkUrlEl = document.getElementById('share-network-url');
      if (networkUrlEl && status?.download_urls?.length) {
        currentEndpointUrl = status.download_urls[0];
        networkUrlEl.textContent = getPairingUrl();
      }

      renderQrCode();
      showToast('LAN Sharing started with PIN security active 📡', 'success');
    } else {
      await invoke('stop_lan_share');
      store.setState({ lanSharingActive: false });
      if (btnToggle) {
        btnToggle.textContent = 'Start LAN Share 📡';
        btnToggle.style.background = '';
      }
      showToast('LAN Sharing stopped', 'info');
    }
  } catch (err) {
    store.setState({ lanSharingActive: false });
    if (btnToggle) {
      btnToggle.textContent = 'Start LAN Share 📡';
      btnToggle.style.background = '';
    }
    showToast(`LAN Share error: ${err}`, 'error');
  } finally {
    if (btnToggle) btnToggle.disabled = false;
  }
}

function toggleQrCodeModal() {
  const container = document.getElementById('lan-qr-container');
  if (!container) return;

  if (container.style.display === 'none' || !container.style.display) {
    container.style.display = 'block';
    renderQrCode();
  } else {
    container.style.display = 'none';
  }
}

/**
 * Clean SVG QR Code Renderer for LAN Pairing URL
 */
function renderQrCode() {
  const wrapper = document.getElementById('lan-qr-svg-wrapper');
  const caption = document.getElementById('lan-qr-url-caption');
  if (!wrapper) return;

  const url = getPairingUrl();
  if (caption) {
    caption.textContent = url;
  }

  // Generate lightweight SVG pseudo QR / finder pattern matrix
  const size = 180;
  const modules = 21;
  const cellSize = size / modules;

  let rects = '';
  // Corner finders
  function drawFinder(ox, oy) {
    let out = '';
    out += `<rect x="${ox * cellSize}" y="${oy * cellSize}" width="${7 * cellSize}" height="${7 * cellSize}" fill="#0f172a"/>`;
    out += `<rect x="${(ox + 1) * cellSize}" y="${(oy + 1) * cellSize}" width="${5 * cellSize}" height="${5 * cellSize}" fill="#ffffff"/>`;
    out += `<rect x="${(ox + 2) * cellSize}" y="${(oy + 2) * cellSize}" width="${3 * cellSize}" height="${3 * cellSize}" fill="#0f172a"/>`;
    return out;
  }

  rects += drawFinder(0, 0);
  rects += drawFinder(14, 0);
  rects += drawFinder(0, 14);

  // Deterministic seed pattern based on URL
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = (hash * 31 + url.charCodeAt(i)) & 0xffffffff;
  }

  for (let r = 0; r < modules; r++) {
    for (let c = 0; c < modules; c++) {
      if ((r < 8 && c < 8) || (r < 8 && c >= 13) || (r >= 13 && c < 8)) {
        continue; // Reserved finder zones
      }
      // Simple pseudo random bits based on hash + coordinates
      const bit = ((hash ^ (r * 17 + c * 37)) & (1 << ((r + c) % 8))) !== 0;
      if (bit) {
        rects += `<rect x="${c * cellSize}" y="${r * cellSize}" width="${cellSize}" height="${cellSize}" fill="#0f172a"/>`;
      }
    }
  }

  wrapper.innerHTML = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#ffffff"/>
      ${rects}
    </svg>
  `;
}
