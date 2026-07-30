/* ==========================================================
   sw.js — Service Worker
   重點：所有路徑都是相對於 sw.js 所在目錄，
   因此同一份程式碼可以部署在網域根目錄或 GitHub Pages 子路徑。
   改版時只要動 VERSION，舊快取會在 activate 階段自動清掉。
   ========================================================== */

const VERSION = '1.0.0';
const CACHE = `garage-${VERSION}`;

/* App Shell：離線時要能完整開啟的最小檔案集合 */
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/tokens.css',
  './css/base.css',
  './css/components.css',
  './js/app.js',
  './js/config.js',
  './js/db.js',
  './js/store.js',
  './js/health.js',
  './js/ui.js',
  './js/icons.js',
  './js/charts.js',
  './js/utils.js',
  './js/views/dashboard.js',
  './js/views/garage.js',
  './js/views/vehicle.js',
  './js/views/settings.js',
  './js/views/editors.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // 個別加入，單一檔案失敗不會讓整個安裝失敗
    await Promise.all(PRECACHE.map((url) =>
      cache.add(new Request(url, { cache: 'reload' })).catch((err) => console.warn('[sw] 略過', url, err))
    ));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // 跨網域交給瀏覽器

  // 頁面導覽：先走網路（拿最新版），失敗就用快取的 index.html（離線可開）
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(CACHE);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch {
        const cache = await caches.open(CACHE);
        return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
      }
    })());
    return;
  }

  // 靜態資源：stale-while-revalidate，開啟速度優先，背景更新
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    const network = fetch(request).then((res) => {
      if (res && res.ok && res.type === 'basic') cache.put(request, res.clone());
      return res;
    }).catch(() => null);
    return cached || (await network) || Response.error();
  })());
});
