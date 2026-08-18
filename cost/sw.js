/* ══════════════════════════════════════════════════════════════════
   費用管理 — Service Worker
   ------------------------------------------------------------------
   這個檔案原本不存在。index.html 一直在呼叫 register('./sw.js')，
   註冊每次都以 404 失敗，錯誤被 try/catch 吞掉 —— 所以「離線可用」
   從頭到尾都沒有生效過。

   快取策略刻意分成三種，因為三類資源的取捨完全不同：

     文件（HTML）  → network-first：帳務工具改版後不能讓使用者停在舊版，
                     但斷線時一定要拿得到畫面。
     同源靜態檔    → cache-first：圖示這類東西不會偷偷變動。
     跨源 CDN      → stale-while-revalidate：Chart.js 與字型即使過期一天
                     也無所謂，但絕不能讓它們擋住開啟速度。

   所有資料都在 IndexedDB，Service Worker 一律不碰。
   ══════════════════════════════════════════════════════════════════ */

const VERSION      = 'v4.14.0';
const SHELL_CACHE  = `expense-shell-${VERSION}`;
const RUNTIME_CACHE= `expense-runtime-${VERSION}`;

// App shell。圖示放在這裡是刻意的：安裝畫面拿不到圖示會顯示空白方塊。
const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/favicon-32.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/apple-touch-icon-152.png',
  './icons/apple-touch-icon-167.png'
];

// ── Install：預先抓下 app shell ────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // 逐一 add：cache.addAll 只要有一個 404 就整批失敗，於是少一個圖示
    // 就會讓整個 Service Worker 裝不起來，離線功能一起陪葬。
    await Promise.all(SHELL_ASSETS.map(url =>
      cache.add(new Request(url, { cache: 'reload' }))
           .catch(err => console.warn('[sw] 略過無法快取的資源：', url, err))
    ));
  })());
  // 不自動 skipWaiting：新版本等使用者按下「立即更新」再接手，
  // 避免正在填表單時畫面被抽換掉。
});

// ── Activate：清掉舊版本快取 ───────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => k !== SHELL_CACHE && k !== RUNTIME_CACHE)
          .map(k => caches.delete(k))
    );
    // 導覽預載：有支援的瀏覽器可以在 SW 啟動的同時就發出請求
    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.enable().catch(() => {});
    }
    await self.clients.claim();
  })());
});

// ── 由頁面觸發的立即更新 ───────────────────────────────────────────
// index.html 的 applyUpdate() 會送這個訊息。
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// ── Fetch ─────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;

  // 只處理 GET。匯出下載、range 請求等一律放行。
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 導覽請求 → network-first，斷線時退回快取的 index.html
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstDocument(event));
    return;
  }

  // 跨源（Chart.js CDN、Google Fonts）→ stale-while-revalidate
  if (url.origin !== self.location.origin) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // 同源靜態資源 → cache-first
  event.respondWith(cacheFirst(request));
});

async function networkFirstDocument(event) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const preload = await event.preloadResponse;
    const fresh = preload || await fetch(event.request);
    if (fresh && fresh.ok) cache.put('./index.html', fresh.clone());
    return fresh;
  } catch {
    // 離線：先找這個網址，再退回 app shell
    return (await cache.match(event.request))
        || (await cache.match('./index.html'))
        || new Response(
             '<!doctype html><meta charset="utf-8"><title>離線</title>' +
             '<body style="font-family:system-ui;padding:40px;text-align:center;background:#EDE8DF">' +
             '<h1 style="font-size:18px">目前離線</h1>' +
             '<p style="color:#6B6762;font-size:14px">請連上網路後重新開啟一次，之後即可離線使用。</p>',
             { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 200 }
           );
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch (err) {
    return cached || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request).then(res => {
    // opaque 回應（no-cors 的 CDN）status 是 0，照樣要存，
    // 不然離線時 Chart.js 與字型永遠拿不到。
    if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
    return res;
  }).catch(() => null);

  return cached || (await network) || Response.error();
}
