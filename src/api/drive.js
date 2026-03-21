// ========================================
// CloudMount – Drive API Service (FIXED)
// ========================================

import { config } from '../config.js';
import { getToken, isAuthenticated, getAllTokens } from './auth.js';
import {
  drives as mockDrives,
  fileSystems as mockFileSystems,
  storageBreakdown as mockStorageBreakdown,
  getVideoUrl as mockGetVideoUrl
} from '../data/mockData.js';

// ── Helpers ─────────────────────────────

function simulateDelay() {
  const { min, max } = config.simulatedLatency;
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, ms));
}

function requireAuth(provider) {
  const token = getToken(provider);
  if (!token) {
    throw new Error(`Not authenticated with ${provider}`);
  }
  return token;
}

// ── Drive Metadata ──────────────────────

export async function fetchDrives() {
  if (config.useSimulatedApi) {
    await simulateDelay();
    const tokens = getAllTokens();
    return tokens.map(t => ({
      id: t.id,
      name: 'Google Drive',
      email: t.email,
      icon: '🟦',
      color: '#cccccc',
      connected: true,
      usedGB: 4.5,
      totalGB: 15.0,
    }));
  }

  const drives = [];
  const tokens = getAllTokens().filter(t => t.provider === 'gdrive');

  for (const tokenObj of tokens) {
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
      console.error(err);
    }
  }

  return drives;
}

// ── File Browsing ───────────────────────

export async function fetchContents(driveId, path = []) {
  if (config.useSimulatedApi) {
    await simulateDelay();

    let items = mockFileSystems['gdrive'] || [];

    for (const p of path) {
      const found = items.find(i => i.name === p && i.isFolder);
      if (found) items = found.children;
    }

    return items;
  }

  const token = requireAuth(driveId);
  const folderId = path.length === 0 ? 'root' : await resolveFolderId(driveId, path);

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents and trashed=false&fields=files(id,name,mimeType,size,modifiedTime)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const data = await res.json();

  return (data.files || []).map(f => ({
    id: f.id,
    name: f.name,
    type: mapMimeType(f.mimeType),
    size: formatBytes(Number(f.size || 0)),
    modified: new Date(f.modifiedTime).toLocaleDateString(),
    isFolder: f.mimeType.includes('folder')
  }));
}

// ── Video Streaming (FIXED) ─────────────

export async function getStreamUrl(driveId, fileName, path = []) {
  if (config.useSimulatedApi) {
    await simulateDelay();
    return mockGetVideoUrl(0);
  }

  const token = requireAuth(driveId);
  const parentId = path.length === 0 ? 'root' : await resolveFolderId(driveId, path);
  const item = await findItemByName(token, parentId, fileName);

  if (!item) throw new Error('File not found');

  // ✅ DIRECT STREAMABLE URL (IMPORTANT FIX)
  return `https://www.googleapis.com/drive/v3/files/${item.id}?alt=media&access_token=${token}`;
}

// ── File Ops ───────────────────────────

async function findItemByName(token, parentId, name) {
  const query = `'${parentId}' in parents and name='${name}' and trashed=false`;

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  const data = await res.json();
  return data.files?.[0];
}

// ── Helpers ────────────────────────────

function mapMimeType(mime) {
  if (mime.includes('folder')) return 'folder';
  if (mime.startsWith('video')) return 'video';
  if (mime.startsWith('image')) return 'image';
  if (mime.startsWith('audio')) return 'audio';
  return 'other';
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
}

async function resolveFolderId(driveId, path) {
  let folderId = 'root';
  const token = getToken(driveId);

  for (const name of path) {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents and name='${name}' and mimeType='application/vnd.google-apps.folder'`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const data = await res.json();

    if (!data.files?.length) throw new Error('Folder not found');

    folderId = data.files[0].id;
  }

  return folderId;
}
