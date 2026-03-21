// ========================================
// CloudMount – File Browser
// ========================================

import { icons, getFileIcon } from './icons.js';
import { fetchDrives } from '../api/drive.js';

// Cache for currently displayed items
let cachedItems = [];
let cachedDrive = null;

function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

export function renderFileBrowser(app) {
  const { driveId } = app.state.params;

  // Show loading state
  if (app.state.filesLoading) {
    return `
      <div class="app-header">
        <div class="header-inner">
          <button class="back-btn" id="backBtn">
            ${icons.back} <span>Back</span>
          </button>
          <div class="header-actions">
            <button class="icon-btn" id="searchFilesBtn" aria-label="Search files">${icons.search}</button>
          </div>
        </div>
      </div>
      <div class="app-content">
        <div class="loading-container animate-in">
          <div class="loading-spinner"></div>
          <div class="loading-text">Loading files...</div>
        </div>
      </div>
    `;
  }

  const drive = cachedDrive;
  if (!drive) return '<p>Drive not found</p>';

  const path = app.state.path || [];
  const items = cachedItems;

  return `
    <div class="app-header">
      <div class="header-inner">
        <button class="back-btn" id="backBtn">
          ${icons.back} <span>${path.length > 0 ? 'Back' : 'Drives'}</span>
        </button>
        <div class="header-actions">
          <button class="icon-btn" id="searchFilesBtn" aria-label="Search files">${icons.search}</button>
        </div>
      </div>
    </div>
    <div class="app-content">
      <div class="breadcrumbs">
        <button class="breadcrumb-item ${path.length === 0 ? 'active' : ''}" data-path-index="-1">
          ${drive.icon} ${escapeHTML(drive.name)}
        </button>
        ${path.map((p, i) => `
          <span class="breadcrumb-sep">›</span>
          <button class="breadcrumb-item ${i === path.length - 1 ? 'active' : ''}" data-path-index="${i}">${escapeHTML(p)}</button>
        `).join('')}
      </div>

      <div class="browser-toolbar">
        <span class="file-count">${items.length} item${items.length !== 1 ? 's' : ''}</span>
        <div class="view-toggle">
          <button class="${app.state.viewMode === 'grid' ? 'active' : ''}" id="viewGrid">${icons.grid}</button>
          <button class="${app.state.viewMode === 'list' ? 'active' : ''}" id="viewList">${icons.list}</button>
        </div>
      </div>

      ${items.length === 0 ? `
        <div class="empty-state">
          ${icons.emptyFolder}
          <div class="empty-state-title">Empty folder</div>
          <div class="empty-state-text">Tap + to add files here</div>
        </div>
      ` : app.state.viewMode === 'grid' ? renderGridView(items) : renderListView(items)}
    </div>

    <button class="fab" id="fabBtn" aria-label="Add files">${icons.plus}</button>
  `;
}

function renderGridView(items) {
  const sorted = sortItems(items);
  return `
    <div class="files-grid">
      ${sorted.map((item, i) => `
        <div class="file-card animate-in stagger-${(i % 5) + 1}" 
             data-file-name="${item.name}" 
             data-file-type="${item.type}"
             data-is-folder="${item.isFolder}">
          <div class="file-icon ${item.type}">
            ${getFileIcon(item.type)}
          </div>
          <div class="file-name">${escapeHTML(item.name)}</div>
          <div class="file-meta">${item.isFolder ? `${item.children ? item.children.length : 0} items` : item.size}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderListView(items) {
  const sorted = sortItems(items);
  return `
    <div class="files-list">
      ${sorted.map((item, i) => `
        <div class="file-row animate-in stagger-${(i % 5) + 1}"
             data-file-name="${item.name}"
             data-file-type="${item.type}"
             data-is-folder="${item.isFolder}">
          <div class="file-icon ${item.type}">
            ${getFileIcon(item.type)}
          </div>
          <div class="file-row-info">
            <div class="file-row-name">${escapeHTML(item.name)}</div>
            <div class="file-row-meta">
              <span>${item.isFolder ? `${item.children ? item.children.length : 0} items` : item.size}</span>
              <span>•</span>
              <span>${item.modified}</span>
            </div>
          </div>
          <button class="file-row-action" data-action="more" data-file-name="${item.name}">
            ${icons.more}
          </button>
        </div>
      `).join('')}
    </div>
  `;
}

function sortItems(items) {
  return [...items].sort((a, b) => {
    if (a.isFolder && !b.isFolder) return -1;
    if (!a.isFolder && b.isFolder) return 1;
    return a.name.localeCompare(b.name);
  });
}

export function bindFileBrowserEvents(app) {
  const backBtn = document.getElementById('backBtn');
  if (backBtn) {
    backBtn.addEventListener('click', async () => {
      const path = app.state.path || [];
      if (path.length > 0) {
        app.state.path = path.slice(0, -1);
        await loadFiles(app);
      } else {
        app.navigate('drives');
      }
    });
  }

  // Breadcrumb navigation
  document.querySelectorAll('.breadcrumb-item').forEach(crumb => {
    crumb.addEventListener('click', async () => {
      const idx = parseInt(crumb.dataset.pathIndex);
      if (idx === -1) {
        app.state.path = [];
      } else {
        app.state.path = (app.state.path || []).slice(0, idx + 1);
      }
      await loadFiles(app);
    });
  });

  // View toggle
  const viewGrid = document.getElementById('viewGrid');
  const viewList = document.getElementById('viewList');
  if (viewGrid) viewGrid.addEventListener('click', () => { app.state.viewMode = 'grid'; app.render(); });
  if (viewList) viewList.addEventListener('click', () => { app.state.viewMode = 'list'; app.render(); });

  // File/folder click
  document.querySelectorAll('.file-card, .file-row').forEach(el => {
    let pressTimer;
    
    el.addEventListener('click', async (e) => {
      if (e.target.closest('.file-row-action')) return;
      const name = el.dataset.fileName;
      const isFolder = el.dataset.isFolder === 'true';
      const type = el.dataset.fileType;
      
      if (isFolder) {
        app.state.path = [...(app.state.path || []), name];
        await loadFiles(app);
      } else if (type === 'video') {
        app.showToast('Fetching video stream...');
        app.state.filesLoading = true;
        app.render();
        import('../api/drive.js').then(async ({ getStreamUrl }) => {
          try {
            const url = await getStreamUrl(app.state.params.driveId, name, app.state.path);
            const a = document.createElement('a');
            a.href = url;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.click();
          } catch (err) {
            app.showToast('Failed to play video');
            console.error(err);
          } finally {
            app.state.filesLoading = false;
            app.render();
          }
        });
      } else {
        app.showFileSheet(name, type);
      }
    });

    // Long press for context menu
    el.addEventListener('touchstart', (e) => {
      pressTimer = setTimeout(() => {
        const name = el.dataset.fileName;
        const type = el.dataset.fileType;
        app.showFileSheet(name, type);
      }, 600);
    }, { passive: true });

    el.addEventListener('touchend', () => clearTimeout(pressTimer));
    el.addEventListener('touchmove', () => clearTimeout(pressTimer));
  });

  // More button in list view
  document.querySelectorAll('.file-row-action').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const name = btn.dataset.fileName;
      const row = btn.closest('.file-row');
      const type = row ? row.dataset.fileType : 'other';
      app.showFileSheet(name, type);
    });
  });

  // FAB
  const fab = document.getElementById('fabBtn');
  if (fab) {
    fab.addEventListener('click', () => app.showUploadSheet());
  }
}

// Load files asynchronously from the API layer
export async function loadFiles(app) {
  const { driveId } = app.state.params;
  const path = app.state.path || [];

  app.state.filesLoading = true;
  app.render();

  try {
    const { fetchContents } = await import('../api/drive.js');
    const allDrives = await fetchDrives();
    cachedDrive = allDrives.find(d => d.id === driveId) || null;
    cachedItems = await fetchContents(driveId, path);
  } catch (err) {
    app.showToast(`Error loading files: ${err.message}`);
    cachedItems = [];
  }

  app.state.filesLoading = false;
  app.render();
}
