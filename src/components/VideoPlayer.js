// ========================================
// CloudMount – Video Player
// ========================================

import { getStreamUrl } from '../api/drive.js';
import { icons } from './icons.js';

let videoElement = null;
let controlsTimeout = null;
let controlsVisible = true;

export function renderVideoPlayer(app) {
  const { fileName } = app.state.params;

  // If loading, show a loading state
  if (app.state.videoLoading) {
    return `
      <div class="video-player-wrapper" id="videoWrapper">
        <div class="video-player-header" id="videoHeader">
          <button class="video-btn" id="videoClose">${icons.close}</button>
          <div class="video-title">${fileName}</div>
          <div></div>
        </div>
        <div class="video-container" id="videoContainer">
          <div class="loading-container">
            <div class="loading-spinner"></div>
            <div class="loading-text">Fetching stream...</div>
          </div>
        </div>
      </div>
    `;
  }

  const videoUrl = app.state.params.streamUrl || '';

  return `
    <div class="video-player-wrapper" id="videoWrapper">
      <div class="video-player-header" id="videoHeader">
        <button class="video-btn" id="videoClose">${icons.close}</button>
        <div class="video-title">${fileName}</div>
        <button class="video-btn" id="videoPip">${icons.pip}</button>
      </div>

      <div class="video-container" id="videoContainer">
        <video id="videoEl" preload="metadata" playsinline>
          <source src="${videoUrl}" type="video/mp4">
          Your browser doesn't support video playback.
        </video>
      </div>

      <div class="video-controls" id="videoControls">
        <div class="video-progress">
          <span class="video-time" id="currentTime">0:00</span>
          <div class="progress-bar-container" id="progressBar">
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" id="progressFill" style="width: 0%;"></div>
            </div>
          </div>
          <span class="video-time" id="totalTime">0:00</span>
        </div>
        <div class="video-buttons">
          <button class="video-btn" id="skipBackBtn">${icons.skipBack}</button>
          <button class="video-btn play-btn" id="playPauseBtn">${icons.play}</button>
          <button class="video-btn" id="skipFwdBtn">${icons.skipForward}</button>
        </div>
      </div>
    </div>
  `;
}

export function bindVideoEvents(app) {
  // If in loading state, only bind close
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

  videoElement = document.getElementById('videoEl');
  if (!videoElement) return;

  const playPauseBtn = document.getElementById('playPauseBtn');
  const progressFill = document.getElementById('progressFill');
  const progressBar = document.getElementById('progressBar');
  const currentTimeEl = document.getElementById('currentTime');
  const totalTimeEl = document.getElementById('totalTime');
  const closeBtn = document.getElementById('videoClose');
  const skipBackBtn = document.getElementById('skipBackBtn');
  const skipFwdBtn = document.getElementById('skipFwdBtn');
  const pipBtn = document.getElementById('videoPip');
  const header = document.getElementById('videoHeader');
  const controls = document.getElementById('videoControls');
  const container = document.getElementById('videoContainer');

  // Auto-play
  videoElement.play().catch(() => {});

  // Play/pause toggle
  playPauseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePlayPause();
  });

  function togglePlayPause() {
    if (videoElement.paused) {
      videoElement.play();
    } else {
      videoElement.pause();
    }
  }

  videoElement.addEventListener('play', () => {
    playPauseBtn.innerHTML = icons.pause;
    startAutoHide();
  });

  videoElement.addEventListener('pause', () => {
    playPauseBtn.innerHTML = icons.play;
    showControls();
  });

  // Time update
  videoElement.addEventListener('timeupdate', () => {
    if (videoElement.duration) {
      const pct = (videoElement.currentTime / videoElement.duration) * 100;
      progressFill.style.width = `${pct}%`;
      currentTimeEl.textContent = formatTime(videoElement.currentTime);
    }
  });

  videoElement.addEventListener('loadedmetadata', () => {
    totalTimeEl.textContent = formatTime(videoElement.duration);
  });

  // Seek
  progressBar.addEventListener('click', (e) => {
    const rect = progressBar.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    videoElement.currentTime = pct * videoElement.duration;
  });

  // Touch seek
  let seeking = false;
  progressBar.addEventListener('touchstart', (e) => {
    seeking = true;
    const rect = progressBar.getBoundingClientRect();
    const touch = e.touches[0];
    const pct = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
    videoElement.currentTime = pct * videoElement.duration;
  }, { passive: true });

  progressBar.addEventListener('touchmove', (e) => {
    if (!seeking) return;
    const rect = progressBar.getBoundingClientRect();
    const touch = e.touches[0];
    const pct = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
    videoElement.currentTime = pct * videoElement.duration;
  }, { passive: true });

  progressBar.addEventListener('touchend', () => { seeking = false; });

  // Skip buttons
  skipBackBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    videoElement.currentTime = Math.max(0, videoElement.currentTime - 10);
  });

  skipFwdBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    videoElement.currentTime = Math.min(videoElement.duration, videoElement.currentTime + 10);
  });

  // Close
  closeBtn.addEventListener('click', () => {
    if (videoElement) {
      videoElement.pause();
      videoElement.src = '';
    }
    app.navigate('files', { 
      driveId: app.state.params.driveId 
    });
  });

  // PiP
  if (document.pictureInPictureEnabled) {
    pipBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          await videoElement.requestPictureInPicture();
        }
      } catch (err) {
        console.log('PiP error:', err);
      }
    });
  } else {
    pipBtn.style.display = 'none';
  }

  // Tap to show/hide controls
  container.addEventListener('click', () => {
    if (controlsVisible) {
      hideControls();
    } else {
      showControls();
      startAutoHide();
    }
  });

  function showControls() {
    controlsVisible = true;
    header.style.opacity = '1';
    controls.style.opacity = '1';
    header.style.pointerEvents = 'auto';
    controls.style.pointerEvents = 'auto';
  }

  function hideControls() {
    controlsVisible = false;
    header.style.opacity = '0';
    controls.style.opacity = '0';
    header.style.pointerEvents = 'none';
    controls.style.pointerEvents = 'none';
  }

  function startAutoHide() {
    clearTimeout(controlsTimeout);
    controlsTimeout = setTimeout(() => {
      if (!videoElement.paused) hideControls();
    }, 3000);
  }

  showControls();
  startAutoHide();
}

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function cleanupVideoPlayer() {
  if (videoElement) {
    videoElement.pause();
    videoElement.src = '';
    videoElement = null;
  }
  clearTimeout(controlsTimeout);
}
