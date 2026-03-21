// ========================================
// CloudMount – Settings
// ========================================

import { icons } from './icons.js';

export function renderSettings(app) {
  const settingsHTML = [
    { group: 'General', items: [
      { icon: icons.cloud, label: 'Auto-sync', desc: 'Sync files automatically', key: 'autoSync' },
      { icon: icons.download, label: 'Wi-Fi Only', desc: 'Only sync on Wi-Fi', key: 'wifiOnly' },
    ]},
    { group: 'Display', items: [
      { icon: icons.grid, label: 'Grid View Default', desc: 'Show files as grid', key: 'gridDefault' },
      { icon: icons.image, label: 'Show Thumbnails', desc: 'Image previews in browser', key: 'thumbnails' },
    ]},
    { group: 'Playback', items: [
      { icon: icons.video, label: 'Auto-play Videos', desc: 'Play when opened', key: 'autoPlay' },
      { icon: icons.pip, label: 'Picture-in-Picture', desc: 'Enable PiP', key: 'pipEnabled' },
    ]},
  ];

  let html = `<div class="app-header"><div class="header-inner">
    <h1 class="header-title">Settings</h1></div></div><div class="app-content">`;

  settingsHTML.forEach((group, gi) => {
    html += `<div class="settings-group animate-in stagger-${gi + 1}">
      <div class="settings-group-title">${group.group}</div>`;
    group.items.forEach(item => {
      const active = app.state.settings[item.key] ? 'active' : '';
      html += `<div class="setting-item"><div class="setting-info">
        <div class="setting-icon">${item.icon}</div>
        <div><div class="setting-label">${item.label}</div>
        <div class="setting-desc">${item.desc}</div></div></div>
        <div class="toggle ${active}" data-setting="${item.key}"></div></div>`;
    });
    html += `</div>`;
  });

  html += `<div class="settings-group animate-in stagger-4">
    <div class="settings-group-title">About</div>
    <div class="setting-item" style="cursor:default"><div class="setting-info">
    <div class="setting-icon">${icons.info}</div>
    <div><div class="setting-label">CloudMount</div>
    <div class="setting-desc">Version 1.0.0 • Built with ❤️</div>
    </div></div></div></div></div>`;

  return html;
}

export function bindSettingsEvents(app) {
  document.querySelectorAll('.toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const key = toggle.dataset.setting;
      if (key && key in app.state.settings) {
        app.state.settings[key] = !app.state.settings[key];
        toggle.classList.toggle('active');
        app.showToast(`${key} ${app.state.settings[key] ? 'enabled' : 'disabled'}`);
      }
    });
  });
}
