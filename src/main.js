// ========================================
// CloudMount – Drive Manager (Home Screen)
// ========================================

import { icons } from './icons.js';
import { fetchDrives } from '../api/drive.js';

// Cache drives so we can re-render without re-fetching
let cachedDrives = [];

export function renderDriveManager(app) {
  // If we're in a loading state, show skeleton
  if (app.state.drivesLoading) {
    return `
      <div class="app-header">
        <div class="header-inner">
          <h1 class="header-title"><span>Cloud</span>Mount</h1>
          <div class="header-actions">
            <button class="icon-btn" id="searchBtn" aria-label="Search">${icons.search}</button>
          </div>
        </div>
      </div>
      <div class="app-content">
        <div class="loading-container animate-in">
          <div class="loading-spinner"></div>
          <div class="loading-text">Loading drives...</div>
        </div>
      </div>
    `;
  }

  const drives = cachedDrives;
  const totalUsed = drives.filter(d => d.connected).reduce((s, d) => s + d.usedGB, 0);
  const totalSpace = drives.filter(d => d.connected).reduce((s, d) => s + d.totalGB, 0);
  const connectedCount = drives.filter(d => d.connected).length;

  return `
    <div class="app-header">
      <div class="header-inner">
        <h1 class="header-title"><span>Cloud</span>Mount</h1>
        <div class="header-actions">
          <button class="icon-btn" id="searchBtn" aria-label="Search">${icons.search}</button>
        </div>
      </div>
    </div>
    <div class="app-content">
      <div class="quick-stats animate-in">
        <div class="stat-card">
          <div class="stat-value">${connectedCount}</div>
          <div class="stat-label">Drives</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${totalUsed.toFixed(1)}</div>
          <div class="stat-label">GB Used</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${(totalSpace - totalUsed).toFixed(1)}</div>
          <div class="stat-label">GB Free</div>
        </div>
      </div>

      <div class="section-title">Connected Drives</div>
      <div class="drives-grid">
        ${drives.length > 0 ? drives.map((drive, i) => renderDriveCard(drive, i)).join('') : '<div style="color: var(--text-muted); font-size: var(--font-sm);">No drives connected. Go to Accounts to add one.</div>'}
      </div>
    </div>
  `;
}

function renderDriveCard(drive, index) {
  const pct = drive.totalGB > 0 ? ((drive.usedGB / drive.totalGB) * 100) : 0;
  const statusClass = drive.connected ? 'connected' : 'disconnected';
  const statusText = drive.connected ? 'Connected' : 'Disconnected';
  const safeName = String(drive.name || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const safeEmail = String(drive.email || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  return `
    <div class="drive-card animate-in stagger-${index + 1}" 
         style="--drive-color: ${drive.color};"
         data-drive-id="${drive.id}"
         id="drive-card-${drive.id}">
      <span class="usb-badge">USB</span>
      <div class="drive-card-header">
        <div class="drive-info">
          <div class="drive-icon">${drive.icon}</div>
          <div>
            <div class="drive-name">${safeName}</div>
            <div class="drive-email">${safeEmail}</div>
          </div>
        </div>
      </div>
      <div class="drive-status ${statusClass}">
        <span class="status-dot ${statusClass}"></span>
        ${statusText}
      </div>
      ${drive.connected ? `
        <div class="drive-storage">
          <div class="storage-bar-bg">
            <div class="storage-bar-fill" style="width: ${pct}%; background: ${drive.color};"></div>
          </div>
          <div class="storage-text">
            <span>${drive.usedGB} GB used</span>
            <span>${drive.totalGB} GB total</span>
          </div>
        </div>
      ` : `
        <div class="drive-storage">
          <div style="font-size: var(--font-sm); color: var(--text-muted); margin-top: var(--space-sm);">
            Tap to connect
          </div>
        </div>
      `}
    </div>
  `;
}

export function bindDriveEvents(app) {
  document.querySelectorAll('.drive-card').forEach(card => {
    card.addEventListener('click', async (e) => {
      const driveId = card.dataset.driveId;
      const drive = cachedDrives.find(d => d.id === driveId);
      if (!drive) return;

      if (drive.connected) {
        // Navigate to file browser
        app.navigate('files', { driveId });
      }
    });
  });
}

// Load drives asynchronously when the view is first shown
export async function loadDrives(app) {
  app.state.drivesLoading = true;
  app.render();
  try {
    cachedDrives = await fetchDrives();
  } catch (err) {
    app.showToast(`Error loading drives: ${err.message}`);
    cachedDrives = [];
  }
  app.state.drivesLoading = false;
  app.render();
}
