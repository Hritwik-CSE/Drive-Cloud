// ========================================
// CloudMount – Main Application
// ========================================

import { renderDriveManager, bindDriveEvents, loadDrives } from './components/DriveManager.js';
import { renderFileBrowser, bindFileBrowserEvents, loadFiles } from './components/FileBrowser.js';
import { renderVideoPlayer, bindVideoEvents, cleanupVideoPlayer } from './components/VideoPlayer.js';
import { renderStorageDashboard, bindStorageEvents, loadStorage } from './components/StorageDashboard.js';
import { renderSettings, bindSettingsEvents } from './components/Settings.js';
import { icons } from './components/icons.js';
import { renameItem, deleteItem, createFolder, uploadFiles, getStreamUrl } from './api/drive.js';

function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

const app = {
  isInitialLoad: true,

  state: {
    currentView: 'drives',
    params: {},
    path: [],
    viewMode: 'grid',
    drivesLoading: false,
    filesLoading: false,
    storageLoading: false,
    videoLoading: false,
    operationLoading: false,
    settings: {
      autoSync: true,
      wifiOnly: false,
      gridDefault: true,
      thumbnails: true,
      autoPlay: true,
      pipEnabled: true,
    },
  },

  async navigate(view, params = {}) {
    if (this.state.currentView === 'video') {
      cleanupVideoPlayer();
    }
    this.state.currentView = view;
    this.state.params = params;
    if (view === 'files' && !params.preservePath) {
      this.state.path = params.path || [];
    }

    // Trigger async data loading for views that need it
    switch (view) {
      case 'drives':
        await loadDrives(this);
        break;
      case 'files':
        await loadFiles(this);
        break;
      case 'storage':
        await loadStorage(this);
        break;
      case 'video':
        await this.loadVideo(params);
        break;
      default:
        this.render();
    }
  },

  async loadVideo(params) {
    this.state.videoLoading = true;
    this.render();

    try {
      const streamUrl = await getStreamUrl(params.driveId, params.fileName);
      this.state.params.streamUrl = streamUrl;
    } catch (err) {
      this.showToast(`Error loading video: ${err.message}`);
    }

    this.state.videoLoading = false;
    this.render();
  },

  render() {
    const root = document.getElementById('app');
    const isVideo = this.state.currentView === 'video';
    let content = '';

    switch (this.state.currentView) {
      case 'drives': content = renderDriveManager(this); break;
      case 'files': content = renderFileBrowser(this); break;
      case 'video': content = renderVideoPlayer(this); break;
      case 'storage': content = renderStorageDashboard(this); break;
      case 'settings': content = renderSettings(this); break;
    }

    if (isVideo) {
      root.innerHTML = content;
      bindVideoEvents(this);
      return;
    }

    const shellClass = this.isInitialLoad ? 'app-shell initial-load' : 'app-shell';
    root.innerHTML = `
      <div class="${shellClass}">
        ${content}
      </div>
      ${this.renderBottomNav()}
      <div class="toast" id="toast"></div>
    `;
    this.isInitialLoad = false;

    this.bindEvents();
  },

  renderBottomNav() {
    const tabs = [
      { id: 'drives', icon: icons.drives, label: 'Drives' },
      { id: 'files', icon: icons.files, label: 'Files' },
      { id: 'storage', icon: icons.storage, label: 'Storage' },
      { id: 'settings', icon: icons.settings, label: 'Settings' },
    ];

    return `
      <nav class="bottom-nav">
        <div class="nav-items">
          ${tabs.map(tab => `
            <button class="nav-item ${this.state.currentView === tab.id ? 'active' : ''}" 
                    data-tab="${tab.id}" id="nav-${tab.id}">
              ${tab.icon}
              <span>${tab.label}</span>
            </button>
          `).join('')}
        </div>
      </nav>
    `;
  },

  bindEvents() {
    // Bottom nav
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (tab === 'files') {
          const driveId = this.state.params.driveId || 'gdrive';
          this.navigate('files', { driveId });
        } else {
          this.navigate(tab);
        }
      });
    });

    // Bind view-specific events
    switch (this.state.currentView) {
      case 'drives': bindDriveEvents(this); break;
      case 'files': bindFileBrowserEvents(this); break;
      case 'storage': bindStorageEvents(this); break;
      case 'settings': bindSettingsEvents(this); break;
    }
  },

  showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  },

  showFileSheet(fileName, fileType) {
    const existing = document.querySelector('.sheet-overlay');
    if (existing) existing.remove();
    const existingSheet = document.querySelector('.bottom-sheet');
    if (existingSheet) existingSheet.remove();

    const overlay = document.createElement('div');
    overlay.className = 'sheet-overlay';
    
    const sheet = document.createElement('div');
    sheet.className = 'bottom-sheet';
    sheet.innerHTML = `
      <div class="sheet-handle"></div>
      <div class="sheet-header">
        <div class="sheet-file-icon file-icon ${fileType}">
          ${icons[fileType] || icons.files}
        </div>
        <div>
          <div class="sheet-file-name">${escapeHTML(fileName)}</div>
          <div class="sheet-file-meta">${fileType}</div>
        </div>
      </div>
      <div class="sheet-actions">
        <button class="sheet-action" data-action="download">
          ${icons.download} <span>Download</span>
        </button>
        <button class="sheet-action" data-action="share">
          ${icons.share} <span>Share</span>
        </button>
        <button class="sheet-action" data-action="copy">
          ${icons.copy} <span>Copy to...</span>
        </button>
        <button class="sheet-action" data-action="move">
          ${icons.move} <span>Move to...</span>
        </button>
        <button class="sheet-action" data-action="rename">
          ${icons.rename} <span>Rename</span>
        </button>
        <button class="sheet-action" data-action="info">
          ${icons.info} <span>Details</span>
        </button>
        <button class="sheet-action danger" data-action="delete">
          ${icons.trash} <span>Delete</span>
        </button>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(sheet);

    const closeSheet = () => {
      overlay.remove();
      sheet.remove();
    };

    overlay.addEventListener('click', closeSheet);

    sheet.querySelectorAll('.sheet-action').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        closeSheet();
        if (action === 'rename') {
          this.showRenameDialog(fileName);
        } else if (action === 'delete') {
          this.handleDeleteFile(fileName);
        } else {
          this.showToast(`${action} — ${fileName}`);
        }
      });
    });
  },

  showUploadSheet() {
    const existing = document.querySelector('.sheet-overlay');
    if (existing) existing.remove();
    const existingSheet = document.querySelector('.bottom-sheet');
    if (existingSheet) existingSheet.remove();

    const overlay = document.createElement('div');
    overlay.className = 'sheet-overlay';

    const sheet = document.createElement('div');
    sheet.className = 'bottom-sheet';
    sheet.innerHTML = `
      <div class="sheet-handle"></div>
      <div class="sheet-actions">
        <button class="sheet-action" data-action="upload">
          ${icons.upload} <span>Upload file</span>
        </button>
        <button class="sheet-action" data-action="newfolder">
          ${icons.folderPlus} <span>New folder</span>
        </button>
      </div>
      <div class="upload-area" id="uploadArea">
        ${icons.upload}
        <div class="upload-area-text">Tap to select files</div>
        <div class="upload-area-sub">or drag and drop</div>
        <input type="file" id="fileInput" multiple hidden>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(sheet);

    const closeSheet = () => { overlay.remove(); sheet.remove(); };
    overlay.addEventListener('click', closeSheet);

    const uploadArea = sheet.querySelector('#uploadArea');
    const fileInput = sheet.querySelector('#fileInput');

    uploadArea.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
      if (e.target.files.length > 0) {
        closeSheet();
        this.showToast(`Uploading ${e.target.files.length} file(s)...`);

        try {
          const driveId = this.state.params.driveId;
          await uploadFiles(driveId, this.state.path, e.target.files);
          this.showToast('Upload complete!');
          await loadFiles(this);
        } catch (err) {
          this.showToast(`Upload failed: ${err.message}`);
        }
      }
    });

    sheet.querySelector('[data-action="newfolder"]').addEventListener('click', () => {
      closeSheet();
      this.showNewFolderDialog();
    });

    sheet.querySelector('[data-action="upload"]').addEventListener('click', () => {
      fileInput.click();
    });
  },

  showRenameDialog(oldName) {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="dialog">
        <div class="dialog-title">Rename</div>
        <input type="text" class="dialog-input" id="renameInput" value="${escapeHTML(oldName)}">
        <div class="dialog-actions">
          <button class="dialog-btn cancel" id="renameCancel">Cancel</button>
          <button class="dialog-btn confirm" id="renameConfirm">Rename</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const input = document.getElementById('renameInput');
    input.focus();
    input.select();

    const close = () => overlay.remove();
    document.getElementById('renameCancel').addEventListener('click', close);
    document.getElementById('renameConfirm').addEventListener('click', async () => {
      const newName = input.value.trim();
      if (newName && newName !== oldName) {
        close();
        await this.handleRenameFile(oldName, newName);
      } else {
        close();
      }
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
  },

  showNewFolderDialog() {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="dialog">
        <div class="dialog-title">New Folder</div>
        <input type="text" class="dialog-input" id="folderInput" placeholder="Folder name">
        <div class="dialog-actions">
          <button class="dialog-btn cancel" id="folderCancel">Cancel</button>
          <button class="dialog-btn confirm" id="folderConfirm">Create</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const input = document.getElementById('folderInput');
    input.focus();

    const close = () => overlay.remove();
    document.getElementById('folderCancel').addEventListener('click', close);
    document.getElementById('folderConfirm').addEventListener('click', async () => {
      const name = input.value.trim();
      if (name) {
        close();
        await this.handleCreateFolder(name);
      } else {
        close();
      }
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
  },

  // ── Async File Operations ────────────────────────

  async handleRenameFile(oldName, newName) {
    const driveId = this.state.params.driveId;
    this.showToast(`Renaming "${oldName}"...`);

    try {
      await renameItem(driveId, this.state.path, oldName, newName);
      this.showToast(`Renamed to "${newName}"`);
      await loadFiles(this);
    } catch (err) {
      this.showToast(`Rename failed: ${err.message}`);
    }
  },

  async handleDeleteFile(fileName) {
    const driveId = this.state.params.driveId;
    this.showToast(`Deleting "${fileName}"...`);

    try {
      await deleteItem(driveId, this.state.path, fileName);
      this.showToast(`"${fileName}" deleted`);
      await loadFiles(this);
    } catch (err) {
      this.showToast(`Delete failed: ${err.message}`);
    }
  },

  async handleCreateFolder(name) {
    const driveId = this.state.params.driveId;
    this.showToast(`Creating folder "${name}"...`);

    try {
      await createFolder(driveId, this.state.path, name);
      this.showToast(`Folder "${name}" created`);
      await loadFiles(this);
    } catch (err) {
      this.showToast(`Create folder failed: ${err.message}`);
    }
  },
};

// Initialize – load drives after splash
setTimeout(() => {
  app.navigate('drives');
}, 1600);

// Clean up splash
setTimeout(() => {
  const splash = document.getElementById('splash');
  if (splash) splash.remove();
}, 2200);
