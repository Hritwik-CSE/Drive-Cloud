// ========================================
// CloudMount – Storage Dashboard
// ========================================

import { icons } from './icons.js';
import { fetchDrives, fetchStorageBreakdown } from '../api/drive.js';

let cachedDrives = [];
let cachedBreakdowns = {};

export function renderStorageDashboard(app) {
  if (app.state.storageLoading) {
    return `
      <div class="app-header">
        <div class="header-inner">
          <h1 class="header-title">Storage</h1>
        </div>
      </div>
      <div class="app-content">
        <div class="loading-container animate-in">
          <div class="loading-spinner"></div>
          <div class="loading-text">Loading storage info...</div>
        </div>
      </div>
    `;
  }

  const connectedDrives = cachedDrives.filter(d => d.connected);
  const totalUsed = connectedDrives.reduce((s, d) => s + d.usedGB, 0);
  const totalSpace = connectedDrives.reduce((s, d) => s + d.totalGB, 0);

  return `
    <div class="app-header">
      <div class="header-inner">
        <h1 class="header-title">Storage</h1>
      </div>
    </div>
    <div class="app-content">
      <div class="storage-card storage-hero animate-in">
        <div class="storage-header">
          <div class="storage-title">Total Usage</div>
          <div class="storage-subtitle">${totalUsed.toFixed(1)} GB / ${totalSpace} GB</div>
        </div>
        <div class="storage-multi-bar">
          <div class="multi-bar-segment" style="width: ${totalSpace > 0 ? (totalUsed / totalSpace) * 100 : 0}%; background: var(--accent-gradient);"></div>
        </div>
      </div>

      ${connectedDrives.map((drive, i) => {
        const breakdown = cachedBreakdowns[drive.id] || [];
        const usedPct = drive.totalGB > 0 ? (drive.usedGB / drive.totalGB) * 100 : 0;
        
        return `
        <div class="storage-card animate-in stagger-${i + 1}">
          <div class="storage-header">
            <div class="storage-title">${drive.icon} ${drive.name}</div>
            <div class="storage-subtitle">${drive.usedGB.toFixed(1)} GB of ${drive.totalGB} GB</div>
          </div>
          
          <div class="storage-multi-bar">
            ${breakdown.length > 0 ? breakdown.map(item => `
              <div class="multi-bar-segment" style="width: ${item.percentage}%; background: ${item.color};" title="${item.label}"></div>
            `).join('') : `
              <div class="multi-bar-segment" style="width: ${usedPct}%; background: ${drive.color};"></div>
            `}
          </div>

          ${breakdown.length > 0 ? `
            <div class="storage-breakdown">
              ${breakdown.map(item => `
                <div class="breakdown-item">
                  <div class="breakdown-color" style="background: ${item.color};"></div>
                  <div class="breakdown-info">
                    <div class="breakdown-label">${item.label}</div>
                    <div class="breakdown-size">${item.size}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `}).join('')}
    </div>
  `;
}

function renderDonut(used, total, color) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const r = 80;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;

  return `
    <svg width="180" height="180" viewBox="0 0 180 180">
      <circle cx="90" cy="90" r="${r}" 
              fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="14"/>
      <circle cx="90" cy="90" r="${r}" 
              fill="none" stroke="${color}" stroke-width="14"
              stroke-dasharray="${circumference}" 
              stroke-dashoffset="${offset}"
              stroke-linecap="round"
              style="transition: stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1);">
        <animate attributeName="stroke-dashoffset" 
                 from="${circumference}" to="${offset}" 
                 dur="1.2s" fill="freeze"
                 calcMode="spline" keySplines="0.4 0 0.2 1"/>
      </circle>
    </svg>
  `;
}

export function bindStorageEvents(app) {
  // No special events needed for storage dashboard
}

// Load storage data asynchronously
export async function loadStorage(app) {
  app.state.storageLoading = true;
  app.render();

  try {
    cachedDrives = await fetchDrives();
    // Fetch breakdowns for each connected drive
    const connected = cachedDrives.filter(d => d.connected);
    const breakdownPromises = connected.map(async (d) => {
      const breakdown = await fetchStorageBreakdown(d.id);
      return { id: d.id, breakdown };
    });
    const results = await Promise.all(breakdownPromises);
    cachedBreakdowns = {};
    results.forEach(r => { cachedBreakdowns[r.id] = r.breakdown; });
  } catch (err) {
    app.showToast(`Error loading storage: ${err.message}`);
    cachedDrives = [];
    cachedBreakdowns = {};
  }

  app.state.storageLoading = false;
  app.render();
}
