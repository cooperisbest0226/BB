/* 車輛保養紀錄 — Service Worker */
const CACHE = 'vehicle-maint-v1.4.0';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './img/hero-car.webp',
  './img/hero-car@2x.webp',
  './img/hero-car.jpg',
  './img/hero-car@2x.jpg',
  './img/hero-plate.webp',
  './img/hero-plate@2x.webp',
  './img/hero-plate.jpg',
  './img/hero-plate@2x.jpg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      // 逐項加入：任何一個資源 404 都不該讓整個 SW 安裝失敗
      .then(c => Promise.all(ASSETS.map(u =>
        c.add(u).catch(err => console.warn('[SW] 快取失敗：', u, err))
      )))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* 導覽請求：網路優先，離線時回快取的 index.html
   靜態資源：快取優先，背景更新 */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req)
        .then(res => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
