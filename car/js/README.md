# 車庫 — 車輛管理平台

個人車輛管理 PWA。追蹤車輛健康分數、關鍵到期日與持有成本。
純前端（HTML + CSS + Vanilla JS ES2023）、IndexedDB 儲存、offline-first、無任何外部套件。

版本：1.0.0 — Foundation + Garage + Dashboard

---

## 部署到 GitHub Pages

1. 建一個 repo（例如 `car`），把這個資料夾的**內容**放到 repo 根目錄
   （`index.html` 必須在最上層，不要多包一層資料夾）。
2. Settings → Pages → Source 選 `main` branch、`/ (root)`。
3. 開啟 `https://<帳號>.github.io/car/`。

**必要條件**

- 必須是 **https**（Service Worker 與 IndexedDB 都要求安全來源）。
- 主檔名必須是 `index.html`，因為 `start_url` 是 `./`。
- 專案內所有路徑都是相對路徑，所以放在子路徑（`/car/`）或網域根目錄都能運作。

**加到 iPhone 主畫面**：Safari → 分享 → 加入主畫面。之後即為全螢幕、離線可用。

**改版**：修改 `sw.js` 最上方的 `VERSION` 與 `js/config.js` 的 `APP_VERSION`，
舊快取會在下次啟動時自動清除。

---

## 檔案結構

```
index.html              App Shell（導覽列 / 內容區 / 分頁列 / 覆蓋層）
manifest.webmanifest    start_url 與 scope 皆為 './'
sw.js                   版本化快取；導覽 network-first、靜態資源 SWR

css/
  tokens.css            設計系統單一來源：顏色、字級、間距、動畫曲線、深色模式
  base.css              版面骨架、Large Title 收合、分頁列
  components.css        卡片、清單、按鈕、Sheet、表單、Toast、開關

js/
  config.js             版本與名稱
  app.js                啟動、hash 路由、主題／強調色、開啟時提醒、SW 註冊
  db.js                 IndexedDB（所有 store 在 v1 一次建好）、備份匯出入
  store.js              記憶體快取 + 發佈訂閱、車輛與里程 CRUD、示範資料
  health.js             健康評分引擎（核心邏輯）
  ui.js                 共用元件：Sheet、Toast、清單、表單欄位、導覽列
  icons.js              自繪 SVG 圖示（SF Symbols 風格，無外部字型）
  charts.js             健康環、微型量表、折線圖、直條圖
  utils.js              日期／數字／金額格式化、圖片壓縮
  views/
    dashboard.js        總覽
    garage.js           車庫
    vehicle.js          車輛詳情
    settings.js         設定（備份／還原／主題／提醒）
    editors.js          三個編輯 Sheet：車輛資料、健康基準、更新里程

icons/                  192 / 512 / maskable / apple-touch
```

---

## 健康評分怎麼算

`js/health.js` 定義六個項目，每個算出 0~1 的剩餘壽命係數再加權平均：

| 項目 | 權重 | 判定依據 |
|---|---|---|
| 引擎機油 | 26 | 里程週期與時間週期，先到者為準 |
| 保險 | 18 | 距到期日天數 |
| 電瓶 | 16 | 已使用月數 ÷ 預估壽命 |
| 輪胎 | 16 | 里程與月數，先到者為準 |
| 定期驗車 | 14 | 距到期日天數 |
| 稅金 | 10 | 牌照稅與燃料稅取較近者 |

**只有已設定的項目會計入**，權重會重新正規化 — 否則新建立的車永遠是低分，
數字就沒有參考價值。未設定的項目會在明細列顯示「設定」，引導補資料。

---

## 加新模組時

1. `js/db.js` 的 store 已經預先建好（`maintenance` / `fuel` / `records` /
   `expenses` / `blobs`），**不需要升 DB 版本**。
2. 在 `js/views/` 新增一個 view，export `show(root, { navigate, params })`。
3. 在 `js/app.js` 的 `ROUTES` 加一筆；需要分頁入口就加進 `TABS`。
4. UI 一律重用 `js/ui.js` 的 `section` / `listGroup` / `listRow` / `openSheet` /
   `fieldGroup`，顏色與間距一律用 `css/tokens.css` 的變數 — 這是視覺一致的保證。
5. 把新模組加進 `sw.js` 的 `PRECACHE`，並更新 `VERSION`。
6. `js/views/vehicle.js` 內有 `MODULE SLOT` 註解，標示新區塊該插入的位置。

**健康引擎的接續點**：目前六個項目讀 `vehicle.lifecycle` 的手動輸入值。
Maintenance 模組上線後，把 `health.js` 中 `oil.compute()` 的資料來源改成
「該車 category=Oil 的最新一筆保養紀錄」即可，UI 與評分邏輯都不用動。

---

## 資料與隱私

所有資料只存在裝置的 IndexedDB，不會上傳。
設定 → 資料 → 匯出備份 會產生含照片的 JSON 檔，可完整還原。
未來接上 Cloudflare（Workers / D1 / R2）時，同步層會加在 `store.js` 之下，
view 層不需要改動。
