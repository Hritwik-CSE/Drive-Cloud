// ========================================
// CloudMount – Rich Video Player (FIXED)
// ========================================

import Plyr from 'plyr';
import 'plyr/dist/plyr.css';
import { icons } from './icons.js';
import { getStreamUrl } from '../api/drive.js';

let player = null;
let currentRotation = 0;

export function renderVideoPlayer(app) {
  const { fileName } = app.state.params;

  if (app.state.videoLoading) {
    return `
      <div class="video-player-wrapper loading-state" style="position:fixed; inset:0; background:black; z-index:100; display:flex; flex-direction:column;">
        <div style="padding:16px; display:flex; align-items:center;">
          <button id="videoClose" style="background:rgba(255,255,255,0.1); border:none; color:white; border-radius:50%; width:40px; height:40px;">
            ${icons.close || '✕'}
          </button>
          <div style="color:white; flex:1; padding-left:16px;">${fileName}</div>
        </div>

        <div style="flex:1; display:flex; justify-content:center; align-items:center; color:white;">
          Fetching video...
        </div>
      </div>
    `;
  }

  return `
    <div class="video-player-wrapper" style="position:fixed; inset:0; background:black; z-index:100; display:flex; flex-direction:column;">
      
      <div id="videoHeader" style="position:absolute; top:0; left:0; right:0; padding:16px; display:flex; align-items:center; z-index:10;">
        <button id="videoClose" style="background:rgba(255,255,255,0.2); border:none; color:white; border-radius:50%; width:40px; height:40px;">✕</button>
        <div style="color:white; flex:1; padding:0 16px;">${fileName}</div>
        <button id="videoRotate" style="background:rgba(255,255,255,0.2); border:none; color:white; border-radius:50%; width:40px; height:40px;">⟳</button>
      </div>

      <div style="flex:1; display:flex; justify-content:center; align-items:center;">
        <div id="videoTransformWrapper" style="transition:transform 0.3s ease;">
          
          <!-- IMPORTANT FIX: NO <source> -->
          <video id="videoEl" playsinline controls crossorigin="anonymous"
            style="max-width:100%; max-height:100%;">
          </video>

        </div>
      </div>
    </div>
  `;
}

export async function bindVideoEvents(app) {
  const videoEl = document.getElementById('videoEl');
  const closeBtn = document.getElementById('videoClose');
  const rotateBtn = document.getElementById('videoRotate');
  const wrapper = document.getElementById('videoTransformWrapper');

  if (!videoEl) return;

  try {
    // 🔥 FETCH STREAM URL PROPERLY
    app.state.videoLoading = true;

    let videoUrl = app.state.params.streamUrl;

    if (!videoUrl) {
      videoUrl = await getStreamUrl(app.state.params.fileId);
    }

    if (!videoUrl) throw new Error('No stream URL');

    // 🔥 GOOGLE DRIVE FIX
    videoUrl = normalizeDriveUrl(videoUrl);

    // ✅ SET SOURCE DYNAMICALLY
    videoEl.src = videoUrl;
    videoEl.load();

    app.state.videoLoading = false;

  } catch (err) {
    console.error(err);
    videoEl.outerHTML = `<div style="color:white;">Failed to load video</div>`;
    return;
  }

  // ✅ INIT PLAYER
  player = new Plyr(videoEl, {
    autoplay: true,
    muted: true, // required for autoplay
    controls: [
      'play-large', 'play', 'progress', 'current-time', 'duration',
      'mute', 'volume', 'fullscreen'
    ]
  });

  player.on('ready', () => {
    player.play().catch(() => {});
  });

  // ❌ HANDLE ERRORS
  videoEl.addEventListener('error', () => {
    videoEl.outerHTML = `<div style="color:white;">Video failed to load (Drive restriction)</div>`;
  });

  // 🔄 ROTATION
  currentRotation = 0;
  rotateBtn?.addEventListener('click', () => {
    currentRotation = (currentRotation + 90) % 360;
    const scale = (currentRotation === 90 || currentRotation === 270) ? 0.75 : 1;
    wrapper.style.transform = `rotate(${currentRotation}deg) scale(${scale})`;
  });

  // ❌ CLOSE
  closeBtn?.addEventListener('click', () => {
    cleanupVideoPlayer();
    app.navigate('files', { driveId: app.state.params.driveId });
  });
}

// ========================================
// 🔥 GOOGLE DRIVE URL FIXER
// ========================================
function normalizeDriveUrl(url) {
  if (!url) return url;

  // Already direct
  if (url.includes('googleapis.com')) return url;

  // Extract file ID
  const match = url.match(/[-\w]{25,}/);
  if (!match) return url;

  const fileId = match[0];

  // Convert to streamable format
  return `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
}

// ========================================

export function cleanupVideoPlayer() {
  if (player) {
    player.destroy();
    player = null;
  }
}
