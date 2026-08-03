# 車輛保養紀錄 PWA

依《車輛保養紀錄 PWA — UI/UX 設計規格書》實作。深色為主場、實拍英雄圖 + 健康環、四宮格分類入口、底部五分頁。

目前版本 **v1.2.0**。

## 檔案結構

部署時**必須維持這個結構**，`start_url` 是 `./`，所以主檔名一定要是 `index.html`：

```
/
├── index.html              主程式（HTML + CSS + JS 全內嵌）
├── sw.js                   Service Worker（離線快取）
├── manifest.webmanifest    PWA 設定
├── img/
│   ├── hero-car.webp       首頁英雄圖（WebP，主要）
│   ├── hero-car@2x.webp
│   ├── hero-car.jpg        JPEG 後備（舊瀏覽器）
│   └── hero-car@2x.jpg
└── icons/
    ├── icon-192.png
    ├── icon-512.png
    ├── maskable-512.png
    └── apple-touch-icon.png
```

## 上架 GitHub Pages

1. 在 GitHub 建一個新的 repository（public）。
2. 把上面三個檔案 + `img/` 與 `icons/` 兩個資料夾整包上傳到 repo 根目錄。

   ```bash
   git init
   git add .
   git commit -m "第一版：車輛保養紀錄 PWA"
   git branch -M main
   git remote add origin https://github.com/<你的帳號>/<repo 名稱>.git
   git push -u origin main
   ```

3. 進 repo 的 **Settings → Pages**，Source 選 `Deploy from a branch`，Branch 選 `main` / `(root)`，按 Save。
4. 等 1–2 分鐘，網址會是 `https://<你的帳號>.github.io/<repo 名稱>/`。

GitHub Pages 本身就是 HTTPS，Service Worker 與 PWA 安裝都能正常運作。

## 安裝到 iPhone 主畫面

用 **Safari** 開上面的網址 → 分享鈕 → 加入主畫面。之後從主畫面開啟就是全螢幕、無網址列的 standalone 模式，離線也能開。

> 只有 Safari 能安裝 PWA，Chrome/Firefox on iOS 不行。

## 資料存在哪裡

全部存在你手機瀏覽器的 **IndexedDB**（資料庫名 `vehicle_maint_v1`），不會上傳到任何伺服器。

因此要注意：

- 換手機、清除 Safari 資料、或刪除主畫面圖示都可能讓資料消失。
- 「我的 → 匯出備份」會下載一份 JSON，建議定期存到 iCloud 雲碟。
- 「我的 → 匯入備份」可以還原。

## 更新版本

改完 `index.html` 之後，**記得同時把 `sw.js` 裡的 `CACHE` 版本號往上加**（例如 `vehicle-maint-v1.0.1`），否則舊的快取會一直被沿用，使用者看不到新版：

```js
const CACHE = 'vehicle-maint-v1.2.1';
```

App 內建更新偵測：偵測到新版時，畫面頂端會出現藍色橫幅提示「有新版本可用」，按下重新載入即可套用。

## 這一版有的功能

- **首頁**：英雄圖（內建車輛插畫，隨主題自動搭配光暈）、車輛健康度環、四宮格快速入口、近期提醒
- **時間軸**：依月份分組的完整紀錄，可依保養／維修／保險／其他篩選；點任一筆可直接編輯或刪除
- **統計**：年度／近 12 個月花費長條圖可切換、今年花費、累計花費、平均每公里養車成本、分類佔比
- **我的**：車輛資料、更新里程、保養週期設定、深淺色切換、匯出／匯入備份、清除所有資料

健康度是依「保養週期設定」裡各項目的剩餘里程與剩餘天數，取兩者較急迫的一項換算後平均而得；保險到期日也一併納入計算。

項目比對採**關鍵字模糊比對**（機油／濾芯／輪胎／煞車等），所以紀錄名稱不必跟內建規則完全一樣，像「機油保養＋煞車＋輪胎」這種組合式標題也能正確對應。

## 已知限制

- 目前只支援一台車。
- 提醒是開啟 App 時計算並顯示，不是背景推播（iOS 的 PWA 對推播支援有限）。
