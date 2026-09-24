# 旅行手冊 Travel Handbook

離線也能用的旅行行程 PWA，主要給 iPhone 使用。規劃者可以編輯行程，家人透過分享連結看唯讀版本。

- **今日**：登機證風的「下一站」卡片，有倒數時間，並對照當地時間與台灣時間
- **行程**：按天分組、拖曳排序、每天可以自訂標題
- **看票模式**：票券截圖全螢幕顯示，並嘗試讓螢幕保持常亮（Wake Lock）
- **清單**：行李清單，可以套用範本，也可以把目前清單存成範本
- **分享**：產生唯讀連結給家人，訂位代號、附件、清單都不會上傳
- **開車車程**：行程之間自動顯示 Google 地圖車程、時間不夠會標紅；「開車」交通項目自動帶入抵達時間；今日頁建議出發時間
- **地圖**：行程頁、今日頁點「地圖」看整天路線（Google 地圖內嵌，免費）；行程詳細資訊有小地圖
- **每日摘要**：行程頁每天顯示開車總時數與距離，時間不夠／很趕的路段會標出來
- **天氣**：出發前 7 天起顯示每天的天氣、溫度、降雨機率（Open-Meteo，免費、不用金鑰）
- **行事曆**：匯出 .ics 加到手機行事曆，可設提醒
- **旅費統計**：依類別、天數加總，可填匯率換算台幣；項目可標「已付款」
- **行前待辦**：清單項目可設「出發前 N 天」，時間到出現在今日頁「該做的事」
- **複製**：複製一天到其他天、複製整趟旅程（家人也能把分享的行程複製成自己的）
- **文字版行程**：產生純文字，貼到 LINE 給沒裝 App 的人看
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

1. 註冊 Cloudflare 帳號，電腦要有 Node.js。（本專案已部署：`https://travel-handbook-share.cooperisbest0226.workers.dev`）
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
   - 填進 `index.html` 最上面的 `DEFAULT_API`，所有人的 App 都會自動使用（本專案已填好）。

> `worker/.wrangler/`（含 `wrangler-account.json`）是 wrangler 的本機暫存，已經列在 `.gitignore`，不要推上 GitHub。

免費額度：KV 每天可以寫入 1,000 次、讀取 100,000 次，家庭使用綽綽有餘。App 在你改完行程約 2.5 秒後才上傳一次，連續修改只會算一次寫入。

## 開車車程（Google 地圖金鑰）

車程是 Worker 代替 App 去問 Google 地圖，**金鑰只存在 Cloudflare，不會出現在網頁裡**。沒設定金鑰的話，App 其他功能照常，只是不會顯示車程。

### 1. 申請 Google 地圖金鑰

1. 到 [Google Cloud Console](https://console.cloud.google.com/)，建立一個專案（例如 `travel-handbook`）。
2. 左上選單 →「帳單」→ 連結一張信用卡。Google 要求一定要綁卡，但在免費額度內不會扣款（見下方額度）。
3. 選單 →「API 和服務」→「程式庫」→ 搜尋 **Routes API** → 啟用。
4. 「API 和服務」→「憑證」→「建立憑證」→「API 金鑰」。
5. 點剛建立的金鑰 →「API 限制」選「限制金鑰」→ 只勾 **Routes API** → 儲存。
   - 「應用程式限制」維持「無」。Worker 是從 Cloudflare 伺服器呼叫的，沒有固定 IP 可以限制。

### 2. 設定上限，避免意外收費（建議一定要做）

- 「API 和服務」→ Routes API →「配額與系統限制」：把每天的要求上限調低，例如 **每天 300 次**。家庭使用一趟旅程通常只會用到幾十次。
- 「帳單」→「預算與快訊」：建一個預算（例如 NT$30），超過會寄信通知。

### 3. 限流（已寫在 wrangler.toml）

`Origin` 標頭可以被偽造，任何知道 Worker 網址的人都能冒充 App 來查車程。`wrangler.toml` 的 `[[ratelimits]]` 會限制：

- 同一個 IP 每分鐘最多 20 次
- 所有人加起來每分鐘最多 60 次

超過會回 `429 rate_limited`，App 會暫停一分鐘後自動恢復。家庭使用不會碰到這個上限。真正的每日上限還是要在 Google Cloud 設（上面第 2 步）。

### 4. 把金鑰放進 Worker

在 `worker/` 資料夾執行，貼上金鑰後按 Enter：

```bash
npx wrangler secret put GOOGLE_MAPS_KEY
npx wrangler deploy
```

### 額度與費用（2026 年 Google 公布的價格）

| 用途 | Google 計費類別 | 每月免費 | 超過後 |
|---|---|---|---|
| 景點之間的車程 | Compute Routes **Essentials**（不含路況） | 10,000 次 | US$5 / 1,000 次 |
| 「開車」項目，出發時間在未來 | Compute Routes **Pro**（含路況預估） | 5,000 次 | US$10 / 1,000 次 |

App 會盡量省額度：
- 同一段路算過就存在手機裡（90 天），重開 App、離線都不會再查。
- 查不到的路線一天內不會重試。
- 分享時把算好的車程一起傳給家人，家人的手機完全不會查詢。
- 「開車」項目只在你填好或修改出發地、目的地、時間時才查一次。

### 使用方式

- **景點間車程**：旅程設定裡「自動計算景點之間的車程」打開（新旅程預設打開）。行程頁和今日頁，每兩個有地點的項目中間會出現「開車 52 分 · 39 km · 可停留 2 小時 8 分」；時間排不下會變紅色「時間不夠，差 26 分」。點這一列會直接開啟開車導航。
- **開車項目**：新增「交通」→ 交通方式選「開車」→ 填出發地、目的地、出發時間，會自動算出車程並填好抵達時間。
- **建議出發時間**：今日頁的下一站會顯示「建議 11:55 出發」（車程 + 10 分鐘緩衝，無條件捨去到 5 分鐘）。出發地是前一個有地點的項目；如果是當天第一個行程，就用前一天最後的地點（通常是飯店）。
- 地點寫得越完整越準，例如「日月潭向山遊客中心」比「向山」好。App 會依旅程的時區優先在當地搜尋（日本的旅程會優先找日本的地名）。
- 全程搭大眾運輸的旅程（例如日本鐵路旅行），建議把開關關掉，免得出現用不到的開車時間。

### 車程算不出來時

| 錯誤 | 原因 | 處理 |
|---|---|---|
| `no_maps_key` | Worker 沒有金鑰 | 在 `worker/` 執行 `npx wrangler secret put GOOGLE_MAPS_KEY` 再 `npx wrangler deploy` |
| `maps_denied` | Google 拒絕（403） | 確認已啟用 **Routes API**、已綁帳單、金鑰的「應用程式限制」是「無」、「API 限制」有勾 Routes API。改完等幾分鐘 |
| `no_route` | Google 找不到路線 | 地點寫完整一點；或兩地之間無法開車（例如隔海） |
| `rate_limited` | 一分鐘內查太多次（Worker 限流） | App 會自動等一分鐘再試 |
| `maps_quota` | 超過每日上限 | 隔天再試，或調高 Google Cloud 的配額 |
| `Required Worker name missing` | 不在 `worker/` 資料夾執行 wrangler | 先 `cd worker`，或加 `--name travel-handbook-share` |

想看 Google 回的原始錯誤：在 `worker/` 執行 `npx wrangler tail`，再到 App 觸發一次車程計算。

用 Windows PowerShell 手動測試時，中文地址要先轉 UTF-8，否則會變成 `???` 而得到 `no_route`：

```powershell
$body = @{ from = "台北車站"; to = "台北101"; region = "tw" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "https://travel-handbook-share.cooperisbest0226.workers.dev/route" `
  -ContentType "application/json; charset=utf-8" -Body ([Text.Encoding]::UTF8.GetBytes($body)) `
  -Headers @{ Origin = "https://cooperisbest0226.github.io" }
```

### 分享 API

| 方法 | 路徑 | 說明 |
|---|---|---|
| POST | `/trips` | 建立分享，回傳 `{ id, key }` |
| GET | `/trips/:id` | 讀取（唯讀端使用） |
| PUT | `/trips/:id` | 更新，需要 `Authorization: Bearer key` |
| DELETE | `/trips/:id` | 停止分享，需要 key |
| POST | `/route` | 算開車車程 `{ from, to, region?, depart?, traffic? }` → `{ seconds, staticSeconds, meters, traffic }`，需要 `GOOGLE_MAPS_KEY`，只接受 `ALLOWED_ORIGINS` 來源 |

- `id` 是 16 碼隨機字元，放在分享連結裡，拿到連結的人都能讀。
- `key` 是 32 碼隨機字元，只存在規劃者手機，伺服器只保存它的 SHA-256。
- 單份行程上限 256 KB。

## 內嵌地圖（Google Maps Embed API，免費）

跟車程用的金鑰**分開**，另外建一把只給地圖用的金鑰。它會出現在網頁原始碼，所以一定要限制：

1. Google Cloud Console →「API 和服務」→「程式庫」→ 啟用 **Maps Embed API**。
2. 「憑證」→「建立憑證」→「API 金鑰」，點進去設定：
   - **應用程式限制**：「HTTP 參照網址（網站）」，新增 `https://cooperisbest0226.github.io/*`
   - **API 限制**：「限制金鑰」，只勾 **Maps Embed API**
3. 把金鑰貼到 `index.html` 最上面的 `MAPS_EMBED_KEY = ''` 引號裡，推上 GitHub。

設好限制後，別人拿到金鑰也只能在你的網站上顯示地圖；Maps Embed API 本身不收費。留空就不會顯示「地圖」按鈕。

- 一律畫開車路線。關掉「自動計算車程」的旅程，線條只用來看位置和順序（Google 的大眾運輸路線不能經過多個地點；步行路線遇到機場聯絡橋、高速公路會整張圖失敗）。
- 有飛機的日子只畫落地之後那段；最多 22 個地點（起點＋20 個中途點＋終點）。
- 地圖需要網路，離線時會顯示提示，導航按鈕照常可用。
- 地圖顯示「This page can't load Google Maps correctly」或空白：多半是 API 還沒啟用、參照網址沒填對，或剛改完設定還沒生效（等幾分鐘）。

## 資料模型（IndexedDB：`travel_handbook`）

| store | 內容 |
|---|---|
| `trips` | `{ id, role: 'owner'｜'viewer', name, start: 'YYYY-MM-DD', days, tz, currency, dayTitles, drive, share?, viewer? }` |
| `items` | `{ id, tripId, day, order, type, title, time: 'HH:MM', tz?, from, to, arrTime, vehicle, car, seat, mode?: 'drive', driveSec, driveM, driveTraffic, place, ref, cost, cur, url, note, done, deleted, updatedAt }` |
| `checks` | `{ id, tripId, group, text, done, order }` |
| `atts` | `{ id, tripId, itemId, name, type, blob }`（附件以 Blob 形式存本機） |
| `meta` | `settings`、`templates`、`currentTrip`、`seenVer`、`dismissed`、`routes`（車程快取，key 為 `地區碼|出發地|目的地`） |

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
  - 這個做法已在 iPhone 實機驗證可行。
- **Wake Lock 螢幕常亮**需要 iOS 16.4 以上。在部分 iOS 版本的主畫面模式下可能無效，這時看票模式會顯示「請手動調亮螢幕」。網頁沒辦法幫你調亮度。
- **系統可能清除資料**：iOS 在空間不足時可能清除網站資料。App 會呼叫 `navigator.storage.persist()` 請求保留，但出發前還是建議匯出一份完整備份。
- **附件大小**：圖片長邊超過 1800px 或檔案大於 1.5 MB，會自動壓縮成 JPEG。單一檔案上限 20 MB。
