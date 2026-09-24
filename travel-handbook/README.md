# 旅行手冊 Travel Handbook

離線也能用的旅行行程 PWA，主要給 iPhone 使用。規劃者可以編輯行程，家人透過分享連結看唯讀版本。

- **今日**：登機證風的「下一站」卡片，有倒數時間，並對照當地時間與台灣時間
- **行程**：按天分組、拖曳排序、每天可以自訂標題
- **看票模式**：票券截圖全螢幕顯示，並嘗試讓螢幕保持常亮（Wake Lock）
- **清單**：行李清單，可以套用範本，也可以把目前清單存成範本
- **分享**：產生唯讀連結給家人，訂位代號、附件、清單都不會上傳
- **其他**：離線就緒檢查、JSON 備份匯出入、深色模式、檢查更新、更新紀錄

## 檔案結構

```
travel-handbook/
├── index.html            主程式（HTML + CSS + JS 單檔）
├── sw.js                 Service Worker（離線快取）
├── manifest.webmanifest
├── icons/                App 圖示（180 / 192 / 512 / maskable / favicon）
├── worker/               分享後端（Cloudflare Worker），不是必要的
│   ├── worker.js
│   └── wrangler.toml
├── .nojekyll
└── README.md
```

## 部署 App（GitHub Pages）

1. 建一個 repo，把整個資料夾推上去。`worker/` 放在同一個 repo 也沒關係。
2. 到 repo 的 **Settings → Pages**，Source 選 `main` 分支的根目錄。
3. 等 1～2 分鐘，網址會是 `https://你的帳號.github.io/repo名稱/`。
4. 在 iPhone 用 **Safari** 打開這個網址，點「分享 → 加入主畫面」。

> 一定要用 https，GitHub Pages 預設就是。`start_url` 是 `./`，所以主檔名必須是 `index.html`。

## 部署分享後端（Cloudflare Worker，免費）

只有要分享給家人時才需要這一步。沒部署的話，App 其他功能都能正常使用。

1. 註冊 Cloudflare 帳號，電腦要有 Node.js。
2. 進入 `worker/` 資料夾：
   ```bash
   npx wrangler login
   npx wrangler kv namespace create TRIPS
   ```
3. 把第 2 步印出的 `id` 貼到 `wrangler.toml` 的 `id = "..."`。
4. 把 `ALLOWED_ORIGINS` 改成你的 Pages 網域，例如 `https://你的帳號.github.io`。
5. 部署：
   ```bash
   npx wrangler deploy
   ```
   會得到一個網址，例如 `https://travel-handbook-share.你的帳號.workers.dev`。
6. 讓 App 知道這個網址，擇一即可：
   - 在 App 的「更多 → 分享給家人」貼上網址（只存在這支手機），或
   - 填進 `index.html` 最上面的 `DEFAULT_API`，所有人的 App 都會自動使用。

免費額度：KV 每天可以寫入 1,000 次、讀取 100,000 次，家庭使用綽綽有餘。App 在你改完行程約 2.5 秒後才上傳一次，連續修改只會算一次寫入。

### 分享 API

| 方法 | 路徑 | 說明 |
|---|---|---|
| POST | `/trips` | 建立分享，回傳 `{ id, key }` |
| GET | `/trips/:id` | 讀取（唯讀端使用） |
| PUT | `/trips/:id` | 更新，需要 `Authorization: Bearer key` |
| DELETE | `/trips/:id` | 停止分享，需要 key |

- `id` 是 16 碼隨機字元，放在分享連結裡，拿到連結的人都能讀。
- `key` 是 32 碼隨機字元，只存在規劃者手機，伺服器只保存它的 SHA-256。
- 單份行程上限 256 KB。

## 資料模型（IndexedDB：`travel_handbook`）

| store | 內容 |
|---|---|
| `trips` | `{ id, role: 'owner'｜'viewer', name, start: 'YYYY-MM-DD', days, tz, currency, dayTitles, share?, viewer? }` |
| `items` | `{ id, tripId, day, order, type, title, time: 'HH:MM', tz?, from, to, arrTime, vehicle, car, seat, place, ref, cost, cur, url, note, done, deleted, updatedAt }` |
| `checks` | `{ id, tripId, group, text, done, order }` |
| `atts` | `{ id, tripId, itemId, name, type, blob }`（附件以 Blob 形式存本機） |
| `meta` | `settings`、`templates`、`currentTrip`、`seenVer`、`dismissed` |

**時間的存法**：行程時間一律存「當地時間字串 + 時區」，不存 `Date`。這樣手機落地切換時區後，行程時間不會整批偏移。
- 交通項目可以把出發時間標成「台灣時間」（`tz: 'Asia/Taipei'`），例如從桃園出發的航班。
- 倒數時間和「下一站」判斷，會先換算成絕對時間再比較。

**分享時的資料處理**：
- 分享內容是整份快照，家人端每次都以整份取代。
- 項目仍然保留 `updatedAt` 和 `deleted` 欄位，將來如果要升級成多人共同編輯，不用重寫資料層。

## 發新版檢查表（三處一起改）

1. `index.html` 的 `APP_VERSION`
2. `index.html` 的 `CHANGELOG`：在最前面加一筆，tag 用 `add` / `fix` / `imp` / `chg`
3. `sw.js` 的 `CACHE_NAME`

舊版使用者打開 App 時：
- 如果 Service Worker 已經下載好新版，會跳出「有新版本」提示。
- 更新之後，首頁頂端會出現「已更新到 vX」的橫幅。
- 也可以到「更多 → 檢查更新」手動觸發。

## iOS 注意事項

- **Safari 和主畫面 App 的資料是分開的。** 在 Safari 裡建立的行程，加入主畫面之後看不到。所以請先加入主畫面，再開始使用。
- **家人加入主畫面**：
  - 用分享連結打開時，App 會在 Safari 裡移除 manifest，讓 iOS 用「含分享碼的網址」當作主畫面的啟動網址。
  - 如果加入後還是看不到行程，首頁提示條上有分享碼，可以到「加入分享給我的行程」貼上。
  - ⚠ 移除 manifest 這個做法還沒在實機上驗證過。
- **Wake Lock 螢幕常亮**需要 iOS 16.4 以上。在部分 iOS 版本的主畫面模式下可能無效，這時看票模式會顯示「請手動調亮螢幕」。網頁沒辦法幫你調亮度。
- **系統可能清除資料**：iOS 在空間不足時可能清除網站資料。App 會呼叫 `navigator.storage.persist()` 請求保留，但出發前還是建議匯出一份完整備份。
- **附件大小**：圖片長邊超過 1800px 或檔案大於 1.5 MB，會自動壓縮成 JPEG。單一檔案上限 20 MB。
