# 保養里程尺

以**里程**為單一時間軸的汽車保養紀錄 PWA。單一 HTML 檔、離線可用、資料存在自己的裝置上。

作者：Henry

---

## 為什麼是里程，不是日期

機油是「每 5,000 公里換一次」，不是「每三個月換一次」。市面上的保養 App 多半用日曆思維一筆一筆列紀錄，但真正決定何時該進廠的變數是里程。

所以這個 App 把里程當成唯一的軸：每個項目從**上次更換的里程**起算，走完週期就到期。

### 里程尺

首頁那條橫向刻度是核心。所有項目的到期里程畫在同一條尺上，「現在」是固定的白線。

一眼就能看出「50,000 這裡擠了三項」，因此下方會自動提示：*再開 1,750 km 之內有 3 項要換，同一趟做完比較省*。這是表格式介面給不出的資訊。

已經超過週期的項目不畫在尺上（會滑出畫面外看不到），改成尺上方獨立的紅色標籤帶。

---

## 功能

| 分頁 | 內容 |
|------|------|
| **保養** | 目前里程、里程尺、下一件該做的、全部項目健康條 |
| **歷程** | 保養紀錄時間軸（依里程排序）、花費統計 |
| **項目** | 新增／編輯保養項目與更換週期、還原預設 |
| **更多** | JSON 備份匯出匯入、清除資料、連線狀態與檢查更新、更新紀錄 |

- 內建 12 個常見保養項目，可自由新增、修改週期、刪除
- 新增紀錄時里程若大於目前里程，會順手更新總里程
- 剩下不到 1,000 km 轉黃色、超過週期轉紅色（絕對里程門檻，不看週期百分比 —— 剩 800 km 的機油和剩 800 km 的煞車皮，急迫度是一樣的）
- 首次使用只填了里程、還沒填起算點時，會顯示設定引導而不是滿江紅
- 更新版本後首頁會出現「已更新到 vX.Y.Z」提示，點開看更新紀錄
- 「更多 → 檢查更新」會向伺服器比對版本；離線時會明講目前沒有網路，App 本身照常可用

---

## 部署到 GitHub Pages

1. 在 GitHub 建一個 repo（例如 `car-maintenance-ruler`）
2. 把這個資料夾裡的**所有檔案**（含 `icons/` 與 `.nojekyll`）推上去，維持同一層結構
3. Repo → **Settings** → **Pages** → Source 選 **Deploy from a branch**，branch 選 `main`、資料夾選 `/ (root)`
4. 等一兩分鐘，網址會是 `https://<你的帳號>.github.io/<repo 名稱>/`
5. 用 iPhone Safari 開啟 → 分享 → **加入主畫面**

```bash
git init
git add .
git commit -m "保養里程尺 v1.3.0"
git branch -M main
git remote add origin https://github.com/<你的帳號>/<repo 名稱>.git
git push -u origin main
```

### 注意事項

- **必須是 https**。Service Worker 只在 https 或 localhost 下運作，GitHub Pages 本身就是 https，沒問題。
- **主檔名必須是 `index.html`**。`manifest.webmanifest` 的 `start_url` 是 `./index.html`、`scope` 是 `./`，都是相對路徑，所以放在 repo 子目錄底下也能正常運作。
- **`.nojekyll` 不要刪**。它讓 GitHub Pages 跳過 Jekyll 處理，避免底線開頭的檔案被忽略。
- 更新後如果手機上還是舊版，把 PWA 從主畫面移除再重新加入，或等 Service Worker 自己換代（`sw.js` 的 `CACHE_NAME` 一改就會觸發）。

---

## 檔案結構

```
.
├── index.html              App 本體（HTML + CSS + JS 全部內嵌，離線可用）
├── manifest.webmanifest    PWA 設定：名稱、圖示、start_url、顯示模式
├── sw.js                   Service Worker：導覽用 network-first，靜態資源 cache-first
├── .nojekyll               告訴 GitHub Pages 不要跑 Jekyll
├── README.md               這份文件
└── icons/
    ├── icon-192.png
    ├── icon-512.png
    └── icon-maskable-512.png   Android 自適應圖示（四周留了安全邊距）
```

單一 HTML 是刻意的：沒有建置流程、沒有外部相依、沒有 CDN，離線完全可用，改一個檔案就能發版。

---

## 發新版的流程

改完程式後，**三個地方要一起改**，少改一個就會出現版本對不上或使用者拿不到新版的狀況：

| 檔案 | 位置 | 動作 |
|------|------|------|
| `index.html` | `APP_VERSION` | 升版號（語意化：主版本.次版本.修訂） |
| `index.html` | `CHANGELOG` 陣列 | 最前面加一筆 |
| `sw.js` | `CACHE_NAME` | 尾巴的數字 +1 |

`CHANGELOG` 每筆異動要帶分類標籤：

```js
{v:'1.3.0', date:'2026-08-15', changes:[
  {t:'add', s:'新增了什麼'},   // 綠色
  {t:'fix', s:'修了什麼'},     // 紅色
  {t:'imp', s:'優化了什麼'},   // 琥珀色
  {t:'chg', s:'調整了什麼'},   // 藍色
]},
```

版本比較用 `cmpVer()` 逐段數字比對，所以 `1.10.0` 會正確地大於 `1.9.0`。使用者看過的版本存在 localStorage 的 `car-maint-seen-ver`。

---

## 資料與備份

所有資料存在瀏覽器的 `localStorage`，key 是 `car-maint-v1`。

**這代表：清掉瀏覽器資料、換手機、移除 PWA 都會遺失。** 定期到「更多 → 匯出 JSON 備份」存一份。

匯入會**整包覆蓋**目前資料，不是合併。

資料結構：

```js
{
  v: 1,
  odo: 117000,            // 目前里程
  odoAt: '2026-08-08',    // 里程更新日期
  items: [{ id, name, icon, interval, base, sort }],
  records: [{ id, km, date, items: [itemId], cost, shop, note }]
}
```

- `interval`：更換週期（km）
- `base`：手動填的上次更換里程。與紀錄取里程較大者，項目清單上會用 `*` 標示目前採用的是 `base`
- 每個項目的到期里程 = `max(有勾到它的紀錄里程, base)` + `interval`
  —— 兩者取里程較大者，所以手動填一個比紀錄更新的起算點可以蓋過紀錄

備份檔如果含有真實的保養歷史，**不要放進公開的 repo**，那等於把你的行車里程和進廠紀錄公開。

---

## 開發與測試

沒有建置流程，直接開 `index.html` 就能改。要測 Service Worker 的話需要跑在 server 上：

```bash
python3 -m http.server 8000
# 開 http://localhost:8000
```

改完 `sw.js` 記得在 DevTools → Application → Service Workers 勾 **Update on reload**，否則會一直吃到舊的快取。

### iOS 上的兩個坑（已處理，改動時別踩回去）

1. **輸入框字級必須 ≥ 16px**。低於 16px 時 Safari 會自動放大頁面，在 standalone 模式下會整個跑版。CSS 裡 `input, select, textarea` 的 `font-size:16px` 不要改小。
2. **鍵盤彈出時 layout viewport 不會縮**。彈窗用 `--vvh` / `--vvtop`（由 `visualViewport` 動態計算）而不是 `100vh`，開啟彈窗時把 `body` 鎖成 `position:fixed`，並且**只在** `visualViewport` 真的 resize 之後才用 `block:'nearest'` 校正一次 —— 不要自己加 `setTimeout` + `scrollIntoView({block:'center'})`，會跟 iOS 原生的聚焦捲動打架、疊加捲過頭。
