// ========================================
// CloudMount – Accounts Manager
// ========================================

import { icons } from './icons.js';
import { login, logout, getAllTokens } from '../api/auth.js';
import { connectDrive, disconnectDrive } from '../api/drive.js';

export function renderAccounts(app) {
  const accounts = getAllTokens();

  return `
    <div class="app-header">
      <div class="header-inner">
        <h1 class="header-title">Accounts</h1>
      </div>
    </div>
    <div class="app-content">
      <div class="section-title">Connected Accounts</div>
      <div class="drives-grid">
        ${accounts.length > 0 ? accounts.map((acc, i) => renderAccountCard(acc, i)).join('') : '<div style="color: var(--text-muted); font-size: var(--font-sm);">No active accounts. Tap below to connect.</div>'}
      </div>

      <div class="section-title" style="margin-top: var(--space-2xl);">Add New Account</div>
      <div class="drives-grid">
        <div class="drive-card animate-in stagger-1" style="--drive-color: #cccccc;" data-action="add-gdrive">
          <div class="drive-card-header" style="margin-bottom: 0;">
            <div class="drive-info">
              <div class="drive-icon">🟦</div>
              <div>
                <div class="drive-name">Google Drive</div>
                <div class="drive-email" style="color: var(--text-muted);">Connect new account</div>
              </div>
            </div>
            <button class="icon-btn" aria-label="Add" style="pointer-events: none;">${icons.plus}</button>
          </div>
        </div>
        <div class="drive-card animate-in stagger-2" style="--drive-color: #d84545;" data-action="add-mega">
          <div class="drive-card-header" style="margin-bottom: 0;">
            <div class="drive-info">
              <div class="drive-icon">Ⓜ️</div>
              <div>
                <div class="drive-name">MEGA</div>
                <div class="drive-email" style="color: var(--text-muted);">Connect new account</div>
              </div>
            </div>
            <button class="icon-btn" aria-label="Add" style="pointer-events: none;">${icons.plus}</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderAccountCard(acc, index) {
  const safeEmail = String(acc.email || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const providerName = acc.provider === 'gdrive' ? 'Google Drive' : (acc.provider === 'mega' ? 'MEGA' : acc.provider);
  const icon = acc.provider === 'gdrive' ? '🟦' : (acc.provider === 'mega' ? 'Ⓜ️' : '☁️');
  const color = acc.provider === 'gdrive' ? '#cccccc' : '#d84545';

  return `
    <div class="drive-card animate-in stagger-${index + 1}" style="--drive-color: ${color};">
      <div class="drive-card-header" style="margin-bottom: 0;">
        <div class="drive-info">
          <div class="drive-icon">${icon}</div>
          <div>
            <div class="drive-name">${providerName}</div>
            <div class="drive-email">${safeEmail}</div>
          </div>
        </div>
        <button class="icon-btn account-logout-btn" aria-label="Logout" data-id="${acc.id}" title="Log out">${icons.logout}</button>
      </div>
    </div>
  `;
}

export function bindAccountsEvents(app) {
  // Add account buttons
  document.querySelectorAll('.drive-card[data-action]').forEach(card => {
    card.addEventListener('click', async () => {
      const action = card.dataset.action;
      const provider = action.replace('add-', '');
      
      card.style.opacity = '0.6';
      card.style.pointerEvents = 'none';
      app.showToast(`Connecting to ${provider}...`);

      try {
        const result = await login(provider);
        await connectDrive(result.id);
        app.render(); // Re-render accounts view to show the new account
        app.showToast(`Connected ${result.email}!`);
      } catch (err) {
        app.showToast(`Failed to connect: ${err.message}`);
        card.style.opacity = '1';
        card.style.pointerEvents = 'auto';
      }
    });
  });

  // Logout buttons
  document.querySelectorAll('.account-logout-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (confirm('Are you sure you want to log out of this account?')) {
        try {
          await logout(id);
          await disconnectDrive(id);
          app.render();
          app.showToast('Logged out successfully');
        } catch (err) {
          app.showToast(`Logout failed: ${err.message}`);
        }
      }
    });
  });
}
