# Workspace — 個人工作進度追蹤 PWA

Phase 1（v1.0.0）。純前端、無後端、資料存在瀏覽器 IndexedDB。

## 部署到 GitHub Pages

檔案必須維持這個結構，`start_url` 是 `./`，所以主檔名一定要是 `index.html`：

```
你的-repo/
├── index.html              ← 主程式（CSS + JS 全內嵌）
├── sw.js                   ← service worker
├── manifest.webmanifest
└── icons/
    ├── icon-180.png
    ├── icon-192.png
    ├── icon-512.png
    ├── icon-maskable-192.png
    └── icon-maskable-512.png
```

1. 建 repo，把上面五個項目全部推上去（`icons/` 是資料夾）
2. Settings → Pages → Source 選 `main` 分支、資料夾選 `/ (root)`
3. 開 `https://你的帳號.github.io/repo名稱/`
4. iPhone Safari 開啟 → 分享 → 加入主畫面

必須是 https，service worker 才會註冊（GitHub Pages 預設就是）。

## 改版時務必做的事

**每次改 `index.html` 都要同步調高 `sw.js` 裡的 `CACHE` 版本號**，例如
`workspace-v1.0.0` → `workspace-v1.0.1`。否則使用者的瀏覽器會一直吃舊快取，
你改了什麼他都看不到。

導覽請求走 network-first，所以有網路時通常會拿到新版；但版本號沒動的話，
離線狀態與部分快取情境仍會回舊檔。

## Phase 1 已完成

**Dashboard** — 時段問候、今日狀態句與進度條、四張指標卡（今日進度／近 7 天完成／
進行中專案／逾期）、今日任務清單、即將到期、快速新增、專案總覽進度條

**Tasks** — 清單／看板雙檢視（看板支援拖拉改狀態）、依專案與狀態篩選、
右側詳情面板即時編輯（標題、狀態、優先權、到期日、開始日、預估時數、
所屬專案、checklist、標籤、備註）

**Projects** — 專案網格、顏色與圖示自選、專案詳情頁分三個分頁（任務／Notes／統計）、
封存與取消封存、刪除時任務自動移到未分類

**Settings** — 深色／淺色／跟隨系統、匯出 JSON、匯入 JSON、清除所有資料

**其他** — 刪除任務與專案可復原（toast 上的「復原」按鈕，6 秒內有效）、
超過兩週沒備份會提醒、新版本偵測橫幅、鍵盤按 `N` 快速新增

## 資料結構

```
projects: { id, name, color, icon, description, notes, archived, createdAt }
tasks:    { id, projectId, title, status, priority, dueDate, startDate,
            estimate, checklist[], tags[], notes,
            createdAt, updatedAt, completedAt }
settings: { key, value }
```

`status` 是 `todo` / `doing` / `waiting` / `done`，`priority` 是 `high` / `mid` / `low`。

Phase 2 的行事曆、Timeline 都是讀同一份 `tasks`，不需要改 schema。

## 已知取捨

- 第一次開啟會塞 5 筆範例資料方便你看畫面。設定頁「清除所有資料」可以全部清掉，
  清掉後不會再自動產生
- Notes 目前是純文字，Markdown 渲染排在 Phase 4
- 沒有引入任何 CDN，斷網完全可用。Phase 3 加 Chart.js 時，
  **記得把它加進 `sw.js` 的 `ASSETS`**，否則離線狀態統計頁會空白

## 接下來

- **Phase 2** — 月曆檢視（拖拉排程）、專案 Timeline
- **Phase 3** — 統計頁（Chart.js）、完成熱力圖、Focus Tasks
- **Phase 4** — Markdown Notes、全域搜尋與 Command Palette（Ctrl+K）
