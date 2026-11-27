importScripts('version.js');
const CACHE = 'giohoc-' + self.APP_VERSION;
const SHELL = ['./', 'index.html', 'app.css', 'app.js', 'setup.js', 'ux.js', 'core.js', 'demo.js', 'config.js', 'version.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-180.png'];
const CDN = /unpkg\.com|cdnjs\.cloudflare\.com/;
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))));
self.addEventListener('activate', e => e.waitUntil(caches.keys()
  .then(ks => Promise.all(ks.filter(k => k.startsWith('giohoc-') && k !== CACHE).map(k => caches.delete(k))))
  .then(() => self.clients.claim())));
self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || /script\.google(usercontent)?\.com/.test(u.host)) return;   // API: luôn qua mạng
  if (/\/download\/|app-version\.json/.test(u.pathname)) return;                       // APK & thông tin phiên bản: luôn mới
  if (/tile\.openstreetmap\.org/.test(u.host)) return;                                 // bản đồ nền: qua mạng
  if (u.origin === location.origin || CDN.test(u.host)) {
    e.respondWith(caches.match(r, { ignoreSearch: u.origin === location.origin }).then(hit => hit || fetch(r).then(res => {
      if (res.ok || res.type === 'opaque') { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); }
      return res;
    }).catch(() => r.mode === 'navigate' ? caches.match('index.html') : Response.error())));
  }
});
