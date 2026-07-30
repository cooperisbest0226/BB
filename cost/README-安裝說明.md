# COST — PWA 圖示與安裝說明

## 檔案結構（必須照這個層級擺）

```
你的網站目錄/
├── index.html                      ← 主程式（原 費用管理.html）
├── sw.js                           ← Service Worker
├── manifest.webmanifest
└── icons/
    ├── apple-touch-icon.png        180×180  ← iPhone 主畫面用這個
    ├── apple-touch-icon-167.png    167×167  ← iPad Pro
    ├── apple-touch-icon-152.png    152×152  ← 舊 iPad
    ├── icon-192.png                192×192  ← manifest（any）
    ├── icon-512.png                512×512  ← manifest（any）
    ├── icon-maskable-192.png       192×192  ← manifest（maskable）
    ├── icon-maskable-512.png       512×512  ← manifest（maskable）
    └── favicon-32.png              32×32    ← 瀏覽器分頁
```

**檔名不能改。** 主程式一定要叫 `index.html` —— manifest 的 `start_url` 是 `./`，
靠目錄索引找到它。三個檔案（`index.html`／`sw.js`／`manifest.webmanifest`）必須
同一層，Service Worker 的作用範圍才涵蓋整個 app。

必須用 **https**（或 `localhost`）提供。Service Worker 在 http 下不會註冊，
離線與安裝都不會生效。

---

## 名稱已固定為 COST

iOS 決定主畫面名稱的優先序是：`apple-mobile-web-app-title` → manifest 的
`short_name` → `<title>`。三個都設成 `COST`，所以不管哪個系統挑哪一個，
顯示出來都一樣：

| 位置 | 值 |
|---|---|
| `<meta name="apple-mobile-web-app-title">` | COST |
| `<title>` | COST |
| manifest `name` / `short_name` | COST |
| 設定頁的應用程式資訊 | COST |

App 介面本身仍是繁體中文，只有名稱換掉。

---

## iPhone 安裝步驟

1. **Safari**（不能用 Chrome —— iOS 上只有 Safari 能加到主畫面並套用這些圖示）
2. 開啟你的網址
3. 分享鈕 → **加入主畫面**
4. 名稱欄應該已經自動填入 `COST`

### ⚠️ 如果你之前已經加過舊版

iOS 會把圖示和名稱**快取得非常死**，重新整理沒有用。必須：

1. 長按主畫面上的舊圖示 → 移除 App
2. Safari → 設定 → 清除瀏覽記錄及網站資料（或至少關掉所有該站分頁）
3. 重新開啟網址 → 重新加入主畫面

---

## 圖示是怎麼處理的

來源插圖本身就是一張「已經畫好圓角」的 app icon，四周有白色留白。
直接拿去當 `apple-touch-icon` 會有兩個問題：

1. **iOS 會再套一次自己的圓角遮罩** → 白色留白變成圖示邊緣的白邊
2. **帶 alpha 的圖示 iOS 會用黑底合成** → 出現黑角

所以做了三件事：

- **補成滿版**：從四個角落 flood fill 找出白色背景，填成外框的米色
  （`#FDF0DB`）。原本嘗試「量圓角半徑再畫 rounded_rectangle 當遮罩」失敗了
  —— 這張圖用的是 squircle（超橢圓，iOS 自己那種），側邊更平、轉角更漸進，
  固定半徑套不準，左右上角仍漏白。改成從圖片本身推導遮罩就完全精準，
  而且內部那兩顆米白色星星因為連不到邊界，不會被誤判成背景。
- **一律存成不含透明度的 RGB**
- **maskable 版本另外處理**：內容縮到中央 78%，疊在暖棕底色上。Android 的
  圓形／水滴形遮罩會吃掉角落連同一部分邊緣，不縮的話狗的耳朵和錢包邊緣會被切掉。

驗證方式：模擬 iOS 的 squircle 遮罩（半徑 22.37%），檢查遮罩邊界上的可見像素
—— 560 個像素**全部**是插圖的暖色系，中性近白（會看起來像白邊的）**0 個**。

---

## 已知限制

- **沒有做 iOS 啟動畫面**（`apple-touch-startup-image`）。iOS PWA 啟動時會先閃
  一下白畫面。要補的話每個機型尺寸都要一張，數量不少，看你要不要。
- **Android maskable 的裁切比例是估的**（78% 安全區符合規範，但不同 launcher
  的遮罩形狀不同）。裝到 Android 上如果覺得留白太多可以把 `make_icons.py`
  的 `safe` 調到 0.82 左右重跑。
- **趨勢圖在有網路時的實際繪製沒有被自動測到** —— 沙箱擋掉了 jsdelivr CDN，
  測試環境裡 `Chart` 一直是 undefined。這反而驗證了離線降級路徑，但有網路
  時的繪製結果請在真機上確認一次。
