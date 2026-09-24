/* 旅行手冊 Service Worker
 * 發新版時：CACHE_NAME 要跟 index.html 的 APP_VERSION 一起改。
 */
const CACHE_NAME = 'travel-handbook-v1.5.0';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/favicon-32.png',
  './vendor/qrcode.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL.map((u) => new Request(u, { cache: 'reload' }))))
  );
  // cache: 'reload' 繞過瀏覽器 HTTP 快取（GitHub Pages 預設快取 10 分鐘），確保抓到新版檔案
  // 不自動 skipWaiting：讓 App 顯示「有新版本」後由使用者決定何時更新
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 只處理同源請求；分享後端 API 等跨網域請求一律走網路，不快取
  if (url.origin !== self.location.origin) return;
  // 帶查詢字串的 index.html?_=... 是「檢查更新」用的，直接走網路
  if (url.searchParams.has('_')) return;

  // 導覽請求（含 ?s=分享碼）：cache-first 回傳 App 殼，離線也能開
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then((cached) => cached || fetch(req))
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(req, { ignoreSearch: false }).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
