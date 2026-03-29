// ========================================
// CloudMount – Rich Video Player (Plyr)
// ========================================

import Plyr from 'plyr';
import 'plyr/dist/plyr.css';
import Hls from 'hls.js';
import { icons } from './icons.js';
import { getStreamUrl } from '../api/drive.js';

let player = null;
let hlsInstance = null;
let currentRotation = 0;

// ---------------------------------------------------------------------------
// MIME type map – lets the browser skip unsupported formats instantly instead
// of downloading the first few bytes and then failing silently.
// ---------------------------------------------------------------------------
const MIME_TYPES = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/mp4',          // QuickTime – Chrome/Edge accept it as mp4
  webm: 'video/webm',
  ogg: 'video/ogg',
  ogv: 'video/ogg',
  mkv: 'video/x-matroska',  // rarely native; triggers fallback quickly
  avi: 'video/x-msvideo',
  wmv: 'video/x-ms-wmv',
  flv: 'video/x-flv',
  '3gp': 'video/3gpp',
  ts:  'video/mp2t',
  m3u8: 'application/x-mpegURL',
};

function getMimeType(fileName = '') {
  const ext = fileName.split('.').pop().toLowerCase();
  return MIME_TYPES[ext] || 'video/mp4';
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
export function renderVideoPlayer(app) {
  const { fileName } = app.state.params;

  // Loading state – shown while getStreamUrl() is in flight
  if (app.state.videoLoading) {
    return `
      <div class="video-player-wrapper loading-state" id="videoWrapper"
           style="position:fixed;inset:0;background:black;z-index:100;display:flex;flex-direction:column;">
        <div class="video-player-header" id="videoHeader"
             style="padding:16px;display:flex;align-items:center;">
          <button class="video-btn" id="videoClose" title="Exit Player"
                  style="background:rgba(255,255,255,0.1);border:none;color:white;border-radius:50%;
                         width:40px;height:40px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
            ${icons.close || '<svg width="24" height="24" stroke="currentColor" fill="none" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>'}
          </button>
          <div class="video-title" style="color:white;flex:1;padding-left:16px;">${fileName}</div>
        </div>
        <div class="loading-container"
             style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;">
          <div class="loading-spinner"></div>
          <div class="loading-text" style="color:white;margin-top:16px;">Fetching stream…</div>
        </div>
      </div>
    `;
  }

  const videoUrl  = app.state.params.streamUrl || '';
  const mimeType  = getMimeType(fileName);

  return `
    <div class="video-player-wrapper" id="videoWrapper"
         style="position:fixed;inset:0;background:black;z-index:100;display:flex;flex-direction:column;">

      <div class="video-player-header" id="videoHeader"
           style="position:absolute;top:0;left:0;right:0;padding:16px;display:flex;align-items:center;
                  z-index:10;background:linear-gradient(to bottom,rgba(0,0,0,0.8),transparent);
                  transition:opacity 0.3s ease;">
        <button class="video-btn" id="videoClose" title="Exit Player"
                style="background:rgba(255,255,255,0.2);border:none;color:white;border-radius:50%;
                       width:40px;height:40px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
          ${icons.close || '<svg width="24" height="24" stroke="currentColor" fill="none" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>'}
        </button>
        <div class="video-title"
             style="color:white;flex:1;padding:0 16px;overflow:hidden;text-overflow:ellipsis;
                    white-space:nowrap;font-weight:500;">${fileName}</div>
        <button class="video-btn" id="videoRotate" title="Rotate Video"
                style="background:rgba(255,255,255,0.2);border:none;color:white;border-radius:50%;
                       width:40px;height:40px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
          </svg>
        </button>
      </div>

      <div class="video-container" id="videoContainer"
           style="flex:1;display:flex;justify-content:center;align-items:center;
                  position:relative;overflow:hidden;">
        <div id="videoTransformWrapper"
             style="transition:transform 0.3s ease;display:flex;justify-content:center;
                    align-items:center;width:100%;height:100%;">
          <video id="videoEl" playsinline crossorigin="anonymous" style="max-width:100%;max-height:100%;">
          </video>
        </div>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// FIX: Central stream-URL fetcher.
// Call this before navigating to the video view so the URL is always fresh.
// ---------------------------------------------------------------------------
export async function loadAndPlayVideo(app, fileId, fileName) {
  // Set loading state and re-render
  app.state.videoLoading = true;
  app.state.params = { ...app.state.params, fileName, fileId };
  app.render();                  // shows the spinner

  try {
    const streamUrl = await getStreamUrl(fileId);
    if (!streamUrl) throw new Error('Empty stream URL returned');

    app.state.params.streamUrl = streamUrl;
    app.state.videoLoading = false;
    app.navigate('video', { fileId, fileName, streamUrl, driveId: app.state.params.driveId });
  } catch (err) {
    app.state.videoLoading = false;
    app.showToast(`Could not load video: ${err.message}`);
    app.navigate('files', { driveId: app.state.params.driveId });
  }
}

// ---------------------------------------------------------------------------
// Bind events
// ---------------------------------------------------------------------------
export function bindVideoEvents(app) {
  // ── Loading state: only wire up the close button ──────────────────────────
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

  const closeBtn  = document.getElementById('videoClose');
  const rotateBtn = document.getElementById('videoRotate');
  const wrapper   = document.getElementById('videoTransformWrapper');
  const header    = document.getElementById('videoHeader');
  const container = document.getElementById('videoContainer');

  const plyrOptions = {
    controls: [
      'play-large', 'play', 'progress', 'current-time', 'duration',
      'mute', 'volume', 'captions', 'settings', 'pip', 'airplay', 'fullscreen',
    ],
    settings: ['captions', 'quality', 'speed'],
    speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
    autoplay: true,
    keyboard: { focused: true, global: false },
  };

  const initPlayerEvents = () => {
    player.on('ready', () => {
      player.play().catch((err) => {
        console.info('[VideoPlayer] Autoplay blocked:', err.message);
      });
    });

    player.on('error', () => {
      const mediaErr = player.media && player.media.error;
      const code = mediaErr ? mediaErr.code : 0;
      if (code === 4) {
        _handleUnsupportedFormat(app);
      } else {
        _tryRefreshAndReload(app).catch(() => {
          app.showToast('Error loading video. Please try again.');
        });
      }
    });

    let headerTimeout;
    const showHeader = () => {
      header.style.opacity = '1';
      header.style.pointerEvents = 'auto';
    };
    const hideHeader = () => {
      header.style.opacity = '0';
      header.style.pointerEvents = 'none';
    };
    const resetHeaderTimeout = () => {
      showHeader();
      clearTimeout(headerTimeout);
      headerTimeout = setTimeout(() => {
        if (player && !player.paused) hideHeader();
      }, 3000);
    };

    container.addEventListener('mousemove', resetHeaderTimeout);
    container.addEventListener('touchstart', resetHeaderTimeout, { passive: true });

    player.on('play',  resetHeaderTimeout);
    player.on('pause', () => {
      clearTimeout(headerTimeout);
      showHeader();
    });
    player.on('controlshidden', () => {
      if (player && !player.paused) hideHeader();
    });
    player.on('controlsshown', resetHeaderTimeout);
  };

  const streamUrl = app.state.params.streamUrl;

  if (Hls.isSupported()) {
    hlsInstance = new Hls();
    hlsInstance.loadSource(streamUrl);
    hlsInstance.attachMedia(videoEl);

    hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
      player = new Plyr(videoEl, plyrOptions);
      initPlayerEvents();
    });

    hlsInstance.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            hlsInstance.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hlsInstance.recoverMediaError();
            break;
          default:
            hlsInstance.destroy();
            _tryRefreshAndReload(app).catch(() => app.showToast('Error loading video.'));
            break;
        }
      }
    });
  } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
    // Fallback for native HLS (e.g. Safari)
    videoEl.src = streamUrl;
    player = new Plyr(videoEl, plyrOptions);
    initPlayerEvents();
  } else {
    // Fallback? Will likely fail if not HLS compatible and serving m3u8.
    videoEl.src = streamUrl;
    player = new Plyr(videoEl, plyrOptions);
    initPlayerEvents();
  }

  // ── Close ─────────────────────────────────────────────────────────────────
  closeBtn.addEventListener('click', () => {
    cleanupVideoPlayer();
    app.navigate('files', { driveId: app.state.params.driveId });
  });

  // ── Rotate ────────────────────────────────────────────────────────────────
  currentRotation = 0;  // always reset on fresh bind
  rotateBtn.addEventListener('click', () => {
    currentRotation = (currentRotation + 90) % 360;
    const isPortrait = currentRotation === 90 || currentRotation === 270;
    const scale = isPortrait ? 0.75 : 1;
    wrapper.style.transform = `rotate(${currentRotation}deg) scale(${scale})`;
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Punt to the OS native player when the codec is unsupported in-browser */
function _handleUnsupportedFormat(app) {
  const url = app.state.params.streamUrl;
  app.showToast('Format unsupported by browser – opening in native player…');

  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => {
    cleanupVideoPlayer();
    app.navigate('files', { driveId: app.state.params.driveId });
  }, 800);
}

/**
 * FIX: Refresh the drive stream URL (tokens expire) and reload the player.
 * Covers the case where playback was working but the signed URL expired mid-session.
 */
async function _tryRefreshAndReload(app) {
  const { fileId, driveId } = app.state.params;
  if (!fileId) throw new Error('No fileId to refresh');

  app.showToast('Stream URL expired – refreshing…');

  const freshUrl = await getStreamUrl(fileId);
  if (!freshUrl) throw new Error('Refresh returned empty URL');

  app.state.params.streamUrl = freshUrl;

  // Update the <source> and reload via Plyr
  if (player && player.media) {
    const source = player.media.querySelector('source');
    if (source) source.src = freshUrl;
    player.media.load();
    player.play().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------
export function cleanupVideoPlayer() {
  if (player) {
    player.destroy();
    player = null;
  }
  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }
  currentRotation = 0;   // FIX: reset so re-opening starts upright
}
