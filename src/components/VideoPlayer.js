// ========================================
// CloudMount – Rich Video Player (Plyr)
// ========================================

import Plyr from 'plyr';
import 'plyr/dist/plyr.css';
import { icons } from './icons.js';
import { getStreamUrl } from '../api/drive.js';

let player = null;
let currentRotation = 0;

export function renderVideoPlayer(app) {
  const { fileName } = app.state.params;

  // Show loading state if fetching stream url
  if (app.state.videoLoading) {
    return `
      <div class="video-player-wrapper loading-state" id="videoWrapper" style="position:fixed; inset:0; background:black; z-index:100; display:flex; flex-direction:column;">
        <div class="video-player-header" id="videoHeader" style="padding:16px; display:flex; align-items:center;">
          <button class="video-btn" id="videoClose" style="background:rgba(255,255,255,0.1); border:none; color:white; border-radius:50%; width:40px; height:40px; display:flex; align-items:center; justify-content:center;">${icons.back || '<svg width="24" height="24" stroke="currentColor" fill="none" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>'}</button>
          <div class="video-title" style="color:white; flex:1; padding-left:16px;">${fileName}</div>
        </div>
        <div class="loading-container" style="flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center;">
          <div class="loading-spinner"></div>
          <div class="loading-text" style="color:white; margin-top:16px;">Fetching stream...</div>
        </div>
      </div>
    `;
  }

  const videoUrl = app.state.params.streamUrl || '';

  return `
    <div class="video-player-wrapper" id="videoWrapper" style="position:fixed; inset:0; background:black; z-index:100; display:flex; flex-direction:column;">
      <div class="video-player-header" id="videoHeader" style="position:absolute; top:0; left:0; right:0; padding:16px; display:flex; align-items:center; z-index:10; background:linear-gradient(to bottom, rgba(0,0,0,0.8), transparent);">
        <button class="video-btn" id="videoClose" style="background:rgba(255,255,255,0.2); border:none; color:white; border-radius:50%; width:40px; height:40px; display:flex; align-items:center; justify-content:center; cursor:pointer;">${icons.back || '<svg width="24" height="24" stroke="currentColor" fill="none" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>'}</button>
        <div class="video-title" style="color:white; flex:1; padding:0 16px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:500;">${fileName}</div>
        <button class="video-btn" id="videoRotate" title="Rotate Video" style="background:rgba(255,255,255,0.2); border:none; color:white; border-radius:50%; width:40px; height:40px; display:flex; align-items:center; justify-content:center; cursor:pointer;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        </button>
      </div>

      <div class="video-container" id="videoContainer" style="flex:1; display:flex; justify-content:center; align-items:center; position:relative; overflow:hidden;">
        <div id="videoTransformWrapper" style="transition:transform 0.3s ease; display:flex; justify-content:center; align-items:center; width:100%; height:100%;">
          <video id="videoEl" playsinline controls style="max-width:100%; max-height:100%;">
            <source src="${videoUrl}" type="video/mp4" />
          </video>
        </div>
      </div>
    </div>
  `;
}

export function bindVideoEvents(app) {
  if (app.state.videoLoading) {
    const closeBtn = document.getElementById('videoClose');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        app.state.videoLoading = false;
        app.navigate('files', { driveId: app.state.params.driveId });
      });
    }
    return;
  }

  const videoEl = document.getElementById('videoEl');
  if (!videoEl) return;

  const closeBtn = document.getElementById('videoClose');
  const rotateBtn = document.getElementById('videoRotate');
  const wrapper = document.getElementById('videoTransformWrapper');
  const header = document.getElementById('videoHeader');

  player = new Plyr(videoEl, {
    controls: [
      'play-large', 'play', 'progress', 'current-time', 'duration',
      'mute', 'volume', 'captions', 'settings', 'pip', 'airplay', 'fullscreen'
    ],
    settings: ['captions', 'quality', 'speed'],
    speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
    autoplay: true,
  });

  player.on('ready', () => {
    player.play().catch(() => {});
  });

  // Simple auto-hide for our custom header (Plyr handles its own controls)
  let headerTimeout;
  const resetHeaderTimeout = () => {
    header.style.opacity = '1';
    header.style.pointerEvents = 'auto';
    clearTimeout(headerTimeout);
    headerTimeout = setTimeout(() => {
      if (!player.paused) {
        header.style.opacity = '0';
        header.style.pointerEvents = 'none';
      }
    }, 3000);
  };

  player.on('play', resetHeaderTimeout);
  player.on('pause', () => {
    clearTimeout(headerTimeout);
    header.style.opacity = '1';
    header.style.pointerEvents = 'auto';
  });
  player.on('controlshidden', () => {
    if (!player.paused) {
      header.style.opacity = '0';
      header.style.pointerEvents = 'none';
    }
  });
  player.on('controlsshown', resetHeaderTimeout);

  closeBtn.addEventListener('click', () => {
    cleanupVideoPlayer();
    app.navigate('files', { driveId: app.state.params.driveId });
  });

  currentRotation = 0;
  rotateBtn.addEventListener('click', () => {
    currentRotation = (currentRotation + 90) % 360;
    // Scale down a bit when rotating 90/270 to prevent cutting off in portrait device
    const isRotated = currentRotation === 90 || currentRotation === 270;
    const scale = isRotated ? 0.75 : 1;
    wrapper.style.transform = `rotate(${currentRotation}deg) scale(${scale})`;
  });
}

export function cleanupVideoPlayer() {
  if (player) {
    player.destroy();
    player = null;
  }
}
