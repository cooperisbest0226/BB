# 車庫

車輛保養維護記錄管理 PWA。單一 HTML 檔、IndexedDB 儲存、離線優先、繁體中文介面。

沒有帳號、沒有伺服器、沒有任何資料上傳 —— 所有資料（含照片）都只存在使用者自己的手機或瀏覽器裡。

## 檔案結構

```
index.html               主程式（含 CSS/JS）
sw.js                     Service Worker（離線快取）
manifest.webmanifest      PWA 安裝設定
icons/
  icon-192.png
  icon-512.png
  icon-maskable-512.png
  apple-touch-icon-180.png
```

首次開啟是完全空白的狀態，沒有任何預設或示範資料 —— 第一步一定是「加第一台車」。

## 部署到 GitHub Pages

1. 建一個新的 GitHub repository（public 或 private 皆可，Pages 免費方案 public 較單純）。
2. 把上面這幾個檔案（保持資料夾結構）上傳到 repo 的根目錄（或 `docs/` 資料夾，看你等一下在設定裡選哪個）。
3. 到 repo 的 **Settings → Pages**：
   - Source 選 **Deploy from a branch**
   - Branch 選 `main`，資料夾選 `/ (root)`（或你放檔案的 `docs/`）
   - 存檔後等 1–2 分鐘，GitHub 會給一個網址，格式通常是：
     `https://<你的帳號>.github.io/<repo 名稱>/`
4. 用手機瀏覽器打開這個網址。GitHub Pages 本身就是 HTTPS，PWA 安裝條件已經滿足。
5. **加入主畫面**：
   - iOS Safari：分享 → 加入主畫面
   - Android Chrome：右上角選單 → 安裝應用程式（或瀏覽器會自動跳出安裝提示）

安裝後就是一個獨立的 App 圖示，離線也能開啟。

### 關於路徑

App 內所有路徑都是用相對路徑（`./`）寫的，所以不管部署在網域根目錄還是像
`username.github.io/garage/` 這種子路徑下都能正常運作，不需要另外改設定。

### 更新版本

之後如果我再幫你調整功能、重新給你 `index.html` / `sw.js`，你只要把新檔案覆蓋上傳、
push 到同一個 repo，GitHub Pages 會自動更新。使用者端因為有 Service Worker，
可能需要重新整理兩次（或關閉再打開）才會抓到最新版本 —— 這是 PWA 離線快取的正常機制，
不是 bug。

## 備份與還原（匯出／匯入）

設定 → 匯出備份：會下載一個 `車庫備份-YYYY-MM-DD.json`，內含所有車輛、里程紀錄、
保養項目設定、進廠紀錄與照片（照片會轉成 base64 存在同一個檔案裡，所以檔案可能有幾 MB，
視照片數量而定）。

設定 → 從備份匯入：選一個備份 JSON，會**完全覆蓋**目前車庫裡的所有資料，匯入前會跳出確認。

這個機制也是換手機、換瀏覽器搬資料的方法：在舊裝置匯出，在新裝置上打開這個 App 後匯入即可。
