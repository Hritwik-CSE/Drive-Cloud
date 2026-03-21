// ========================================
// CloudMount – Drive API Service
// ========================================
// Unified API layer for all cloud providers.
// Currently uses simulated data. Replace each provider's
// methods with real fetch() calls when you have API credentials.

import { config } from '../config.js';
import { getToken, isAuthenticated, getAllTokens } from './auth.js';
import { drives as mockDrives, fileSystems as mockFileSystems, storageBreakdown as mockStorageBreakdown, getVideoUrl as mockGetVideoUrl } from '../data/mockData.js';

// ── Helpers ────────────────────────────────────────────

function simulateDelay() {
  const { min, max } = config.simulatedLatency;
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, ms));
}

function requireAuth(provider) {
  const token = getToken(provider);
  if (!token) {
    throw new Error(`Not authenticated with ${provider}. Please connect first.`);
  }
  return token;
}

// ── Drive Metadata ─────────────────────────────────────

export async function fetchDrives() {
  if (config.useSimulatedApi) {
    await simulateDelay();
    const tokens = getAllTokens();
    const drives = tokens.map(t => ({
      id: t.id,
      name: t.provider === 'gdrive' ? 'Google Drive' : (t.provider === 'mega' ? 'MEGA' : t.provider),
      email: t.email,
      icon: t.provider === 'gdrive' ? '🟦' : (t.provider === 'mega' ? 'Ⓜ️' : '☁️'),
      color: t.provider === 'gdrive' ? '#cccccc' : '#d84545',
      connected: true,
      usedGB: 4.5,
      totalGB: 15.0,
    }));
    return drives;
  } else {
    // Inside the else branch of fetchDrives()
    const drives = [];
    const tokens = getAllTokens().filter(t => t.provider === 'gdrive');

    for (const tokenObj of tokens) {
      if (isAuthenticated(tokenObj.id)) {
        try {
          const res = await fetch(
            'https://www.googleapis.com/drive/v3/about?fields=storageQuota',
            { headers: { Authorization: `Bearer ${getToken(tokenObj.id)}` } }
          );
          const data = await res.json();
          drives.push({
            id: tokenObj.id,
            name: 'Google Drive',
            email: tokenObj.email,
            icon: '🟦',
            color: '#cccccc',
            connected: true,
            usedGB: Number(data.storageQuota.usage) / 1e9,
            totalGB: Number(data.storageQuota.limit) / 1e9,
          });
        } catch (err) {
          console.error('Failed to fetch storage for', tokenObj.email, err);
        }
      }
    }

    return drives;

  }
}

export async function fetchStorageBreakdown(driveId) {
  if (config.useSimulatedApi) {
    await simulateDelay();
    return mockStorageBreakdown[driveId] || [];
  }

  // Real implementation for Google Drive
  const token = requireAuth(driveId);
  if (driveId === 'gdrive') {
    const res = await fetch(
      'https://www.googleapis.com/drive/v3/files?pageSize=1000&fields=files(mimeType,size)',
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const { files } = await res.json();
    
    const stats = files.reduce((acc, f) => {
      const type = mapMimeType(f.mimeType);
      const size = Number(f.size || 0);
      acc[type] = (acc[type] || 0) + size;
      acc.total = (acc.total || 0) + size;
      return acc;
    }, { total: 0 });

    const colors = { video: '#e0e0e0', image: '#b0b0b0', document: '#808080', archive: '#707070', audio: '#606060', other: '#505050' };
    
    return Object.keys(stats).filter(k => k !== 'total').map(type => ({
      label: type.charAt(0).toUpperCase() + type.slice(1),
      size: formatBytes(stats[type]),
      percentage: Math.round((stats[type] / stats.total) * 100),
      color: colors[type] || '#404040'
    }));
  }
  return [];
}

// ── File Browsing ──────────────────────────────────────

export async function fetchContents(driveId, path = []) {
  const provider = driveId.split('_')[0]; // Extract provider from id, e.g. gdrive
  if (config.useSimulatedApi) {
    await simulateDelay();
    let items = mockFileSystems[provider] || [];
    for (const p of path) {
      const found = items.find(item => item.isFolder && item.name === p);
      if (found && found.children) {
        items = found.children;
      } else {
        return [];
      }
    }
    return [...items];
  } else {
    // Google Drive example (inside the else branch)
    const token = requireAuth(driveId);
    // For root: folderId = 'root', for subfolders: resolve path to get folder ID
    const folderId = path.length === 0 ? 'root' : await resolveFolderId(driveId, path);

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?` +
      `q='${folderId}'+in+parents+and+trashed=false` +
      `&fields=files(id,name,mimeType,size,modifiedTime)` +
      `&orderBy=folder,name` +
      `&pageSize=100`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();

    return data.files.map(f => ({
      id: f.id,
      name: f.name,
      type: mapMimeType(f.mimeType),
      size: formatBytes(Number(f.size || 0)),
      modified: new Date(f.modifiedTime).toLocaleDateString(),
      isFolder: f.mimeType === 'application/vnd.google-apps.folder',
      children: [],
    }));

  }
}

// ── File Operations ────────────────────────────────────

export async function renameItem(driveId, path, oldName, newName) {
  if (config.useSimulatedApi) {
    await simulateDelay();
    const items = getItemsRef(driveId, path);
    const item = items.find(i => i.name === oldName);
    if (item) {
      item.name = newName;
      return true;
    }
    return false;
  } else {
    // Note: In real use, we'd need the file ID. We'll find it by name for now (inefficient) or pass it.
    const token = requireAuth(driveId);
    const parentId = path.length === 0 ? 'root' : await resolveFolderId(driveId, path);
    const item = await findItemByName(token, parentId, oldName);
    
    if (!item) throw new Error('File not found');

    await fetch(`https://www.googleapis.com/drive/v3/files/${item.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: newName }),
    });
  }
}

async function findItemByName(token, parentId, name) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q='${parentId}'+in+parents+and+name='${name}'+and+trashed=false&fields=files(id)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  return data.files[0];
}

export async function deleteItem(driveId, path, fileName) {
  if (config.useSimulatedApi) {
    await simulateDelay();
    const items = getItemsRef(driveId, path);
    const idx = items.findIndex(i => i.name === fileName);
    if (idx !== -1) {
      items.splice(idx, 1);
      return true;
    }
    return false;
  } else {
    const token = requireAuth(driveId);
    const parentId = path.length === 0 ? 'root' : await resolveFolderId(driveId, path);
    const item = await findItemByName(token, parentId, fileName);
    if (!item) throw new Error('File not found');

    await fetch(`https://www.googleapis.com/drive/v3/files/${item.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  }
}

export async function createFolder(driveId, path, folderName) {
  if (config.useSimulatedApi) {
    await simulateDelay();
    const items = getItemsRef(driveId, path);
    items.push({
      name: folderName,
      type: 'folder',
      size: null,
      modified: 'Just now',
      isFolder: true,
      children: [],
    });
    return true;
  } else {
    const token = requireAuth(driveId);
    const parentId = path.length === 0 ? 'root' : await resolveFolderId(driveId, path);

    await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      }),
    });
  }
}

export async function uploadFiles(driveId, path, fileList) {
  if (config.useSimulatedApi) {
    await simulateDelay();
    // Simulate successful upload
    return { success: true, count: fileList.length };
  }

  // Real implementation for Google Drive
  const token = requireAuth(driveId);
  const parentId = path.length === 0 ? 'root' : await resolveFolderId(driveId, path);

  for (const file of fileList) {
    const metadata = {
      name: file.name,
      parents: [parentId]
    };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form
    });
  }
  return { success: true, count: fileList.length };
}

// ── Video Streaming ────────────────────────────────────

export async function getStreamUrl(driveId, fileName) {
  if (config.useSimulatedApi) {
    await simulateDelay();
    // Map to sample video URLs
    const videoIndex = fileName.toLowerCase().includes('bunny') ? 0
      : fileName.toLowerCase().includes('elephant') ? 1
        : fileName.toLowerCase().includes('blaze') ? 2 : 0;
    return mockGetVideoUrl(videoIndex);
  } else {
    const token = requireAuth(driveId);
    const parentId = path.length === 0 ? 'root' : await resolveFolderId(driveId, path);
    const item = await findItemByName(token, parentId, fileName);
    if (!item) throw new Error('File not found');

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${item.id}?fields=webContentLink`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    return data.webContentLink;
  }
}

// ── Drive Connection ───────────────────────────────────

export async function connectDrive(driveId) {
  if (config.useSimulatedApi) {
    await simulateDelay();
    return { id: driveId, connected: true };
  }

  // In real use, this is handled by the auth flow
  return { id: driveId, connected: true };
}

export async function disconnectDrive(driveId) {
  if (config.useSimulatedApi) {
    await simulateDelay();
    return { id: driveId, connected: false };
  }

  // In real use, we just forget the token (already handled in auth.js logout)
  return { id: driveId, connected: false };
}

// ── Internal helper to get mutable reference to mock items ──

function getItemsRef(driveId, path) {
  const provider = driveId.split('_')[0];
  let items = mockFileSystems[provider] || [];
  for (const p of path) {
    const found = items.find(item => item.isFolder && item.name === p);
    if (found && found.children) items = found.children;
    else return [];
  }
  return items;
}

// Convert MIME types to your app's file types
function mapMimeType(mime) {
  if (mime === 'application/vnd.google-apps.folder') return 'folder';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.includes('zip') || mime.includes('compressed')) return 'archive';
  if (mime.includes('pdf') || mime.includes('document') || mime.includes('text')
    || mime.includes('sheet') || mime.includes('presentation')) return 'document';
  return 'other';
}

// Format bytes to human-readable
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Walk a path to resolve to a Google Drive folder ID
async function resolveFolderId(driveId, path) {
  let folderId = 'root';
  const token = getToken(driveId);
  for (const folderName of path) {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?` +
      `q='${folderId}'+in+parents+and+name='${folderName}'+and+mimeType='application/vnd.google-apps.folder'` +
      `&fields=files(id)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    if (data.files.length === 0) throw new Error(`Folder "${folderName}" not found`);
    folderId = data.files[0].id;
  }
  return folderId;
}

