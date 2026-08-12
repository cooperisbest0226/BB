/* 星座塔團隊 — Service Worker
   策略：
   - App shell（index.html / styles.css / html2canvas / manifest / icons）：install 時全部預先快取，離線可完整運作
   - 導覽請求（開啟 App）：stale-while-revalidate，先用快取秒開，背景抓新版
   - 同網域其他資源：cache-first
   - 外部資源（Google Fonts）：stale-while-revalidate

   更新流程刻意不自動接管：install 不呼叫 skipWaiting，新版會停在 waiting 等使用者確認。
   使用者按下更新提示後，頁面才 postMessage({type:'SKIP_WAITING'}) 讓新版上線並重新整理。
   這樣才不會在使用者編輯到一半時，把舊的 index.html 配上新的 styles.css。 */
const CACHE_NAME = 'star-tower-team-v44';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './js/data.js',
  './js/render.js',
  './js/materials.js',
  './js/auction.js',
  './js/assign.js',
  './js/sheets.js',
  './js/export.js',
  './js/events.js',
  './js/calc.js',
  './js/main.js',
  './vendor/html2canvas.min.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('install', (event) => {
  // 這裡沒有 skipWaiting()：新版要等使用者確認才接管
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

/* 只快取真正成功的回應。以前沒判斷，404 或伺服器錯誤頁也會被存進快取，
   之後 cache-first 就會一直回那份壞掉的內容，只能靠換 CACHE_NAME 才救得回來。 */
function isCacheable(res) {
  return res && res.status === 200 && (res.type === 'basic' || res.type === 'cors');
}
function putIfOk(cache, req, res) {
  if (isCacheable(res)) cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  /* 導覽（開啟／切回 App）：stale-while-revalidate。
     以前是 network-first，訊號差的時候每次冷開都要等 fetch 逾時才退回快取，體感很慢。
     現在先回快取讓 App 秒開，同時在背景抓新版存起來，下次啟動就是新的。 */
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match('./index.html').then((cached) => {
          const fresh = fetch(req)
            .then((res) => putIfOk(cache, './index.html', res))
            .catch(() => cached);
          return cached || fresh;
        })
      )
    );
    return;
  }

  const url = new URL(req.url);

  // 同網域的靜態資源：cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) =>
        caches.open(CACHE_NAME).then((cache) => putIfOk(cache, req, res))
      ))
    );
    return;
  }

  // 外部資源（字型）：stale-while-revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(req).then((cached) => {
        const fetchPromise = fetch(req)
          .then((res) => putIfOk(cache, req, res))
          .catch(() => cached);
        return cached || fetchPromise;
      })
    )
  );
});
