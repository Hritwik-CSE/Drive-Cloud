const CACHE_NAME = 'cloudmount-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/src/main.js',
  '/src/config.js',
  '/src/styles/index.css',
  '/src/components/icons.js',
  '/src/components/DriveManager.js',
  '/src/components/FileBrowser.js',
  '/src/components/VideoPlayer.js',
  '/src/components/StorageDashboard.js',
  '/src/components/Settings.js',
  '/src/api/auth.js',
  '/src/api/drive.js',
  '/src/data/mockData.js',
  '/public/manifest.json',
  '/public/favicon.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Only cache GET requests for our assets
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then(response => {
      return response || fetch(e.request).then(fetchResponse => {
        // Optionally cache new assets here
        return fetchResponse;
      });
    }).catch(() => {
      // Return offline fallback if needed
    })
  );
});
