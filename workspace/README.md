# Workspace — 個人工作進度追蹤 PWA

Phase 4（v1.3.0，功能完成）。純前端、無後端、資料存在瀏覽器 IndexedDB。

## 部署到 GitHub Pages

檔案必須維持這個結構，`start_url` 是 `./`，所以主檔名一定要是 `index.html`：

```
你的-repo/
├── index.html              ← 主程式（CSS + JS 全內嵌）
├── sw.js                   ← service worker
├── manifest.webmanifest
├── vendor/
│   └── chart.umd.min.js    ← Chart.js 4.5.1（放在 repo 裡，不走 CDN）
└── icons/
    ├── icon-180.png
    ├── icon-192.png
    ├── icon-512.png
    ├── icon-maskable-192.png
    └── icon-maskable-512.png
```

1. 建 repo，把上面全部項目推上去（`icons/` 與 `vendor/` 是資料夾）
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

## Phase 4 新增（v1.3.0）

**搜尋與指令面板** — `⌘/Ctrl + K` 或點右上角搜尋鈕開啟。
搜尋範圍涵蓋任務標題、備註內文、標籤、checklist 項目、專案名稱與專案筆記，
命中的字會高亮。同時內建指令（新增任務／新增專案／切換外觀／匯出備份）
與各頁面的快速前往。`↑` `↓` 移動、`Enter` 開啟、`Esc` 關閉。

**Markdown 筆記** — 專案筆記頁多了「編輯／預覽」切換。
支援標題、粗體、斜體、刪除線、行內程式碼、圍欄程式碼區塊、引用、
有序／無序清單、待辦清單（`- [ ]` / `- [x]`）、表格、分隔線、連結與裸網址。
任務詳情的備註也可以切換預覽。

**鍵盤快捷鍵** — 設定頁列出完整清單。

## Phase 3 新增（v1.2.0）

**Statistics** — 新的頂層頁面。四張總覽卡（總完成率／近 7 天完成／平均每日完成／
連續完成天數），加上四張 Chart.js 圖表：近 12 週完成趨勢、未完成任務的專案分布、
狀態 × 優先權堆疊、工時預估 vs 實際。最後是專案健康度列表，逾期越多排越前面。

**完成熱力圖** — 近半年每天完成幾項，深淺分四級（自繪，非 Chart.js）。
同時顯示目前連續完成天數。

**今日焦點** — 任務列右側多了釘選鈕，釘起來的任務會出現在儀表板最上方，最多 3 項。

**近期動態** — 儀表板顯示最近 5 筆新增／更新／完成，點了直接跳到該任務。

**實際時數** — 任務詳情多一欄，跟預估時數一起餵給統計頁的工時圖。

## Phase 2 新增（v1.1.0）

**Calendar** — 月曆檢視，任務依到期日落在格子上；上/下月與「今天」切換。
右側是「未排程」托盤：把任務拖到某一天就排進去，拖回托盤則清掉日期。
點格子上的任務會跳到 Tasks 頁並開啟該筆詳情。
手機版格子會把任務收成彩色圓點，點某天在下方展開當天清單。

**Timeline** — 專案詳情多了 Timeline 分頁，甘特式長條圖。
有開始日的任務畫成橫條，只有到期日的畫成菱形里程碑；
綠色是已完成、紅色是逾期，其餘用專案顏色。有今日垂直指示線，
可切換「兩週」與「月」兩種尺度，沒排日期的任務列在下方。

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
            estimate, actual, pinned, checklist[], tags[], notes,
            createdAt, updatedAt, completedAt }
settings: { key, value }
```

`status` 是 `todo` / `doing` / `waiting` / `done`，`priority` 是 `high` / `mid` / `low`。

Phase 3 追加了兩個欄位：`actual`（實際時數）與 `pinned`（今日焦點）。
兩者都是可選的，舊的備份 JSON 匯入後會自動補上預設值，不用轉檔。

Phase 2 的行事曆與 Timeline 完全沒有改動 schema —— 它們只是把同一份 `tasks`
換個方式排列。Timeline 的長條用 `startDate` → `dueDate`；只有 `dueDate`
的任務畫成單日里程碑。

## 已知取捨

- 第一次開啟會塞 5 筆範例資料方便你看畫面。設定頁「清除所有資料」可以全部清掉，
  清掉後不會再自動產生
- Markdown 渲染器是自己寫的（約 80 行），沒有引入 marked.js 之類的套件，
  維持零外部依賴。作法是**先把整份原始碼跳脫成純文字，再還原 Markdown 語法**，
  所以筆記裡寫 HTML 標籤只會顯示成文字、不會執行；連結只允許
  `http` / `https` / `mailto`。測試有針對這點做 XSS 驗證
- 支援的語法不含巢狀清單與腳註，日常筆記夠用
- **Chart.js 沒有走 CDN**，而是把檔案放在 `vendor/`。原本規劃是用 CDN，
  但那會讓斷網時統計頁整頁掛掉，而且 service worker 快取跨網域資源拿到的是
  opaque response，無法確認到底有沒有成功快取。放在 repo 裡是同源資源，
  快取行為明確、離線保證成立，代價是多 204KB。已列入 `sw.js` 的 `ASSETS`
- 整個 App 零外部請求，斷網完全可用（含統計頁圖表），測試有驗證這點

## 接下來

規劃的四個階段都完成了。之後想加什麼再說，一些可能的方向：

- 任務之間的相依關係（Timeline 上畫連線）
- 重複性任務（每週一自動產生）
- 專案里程碑（目前里程碑是從單日到期任務推導出來的）
- 筆記內嵌圖片（需要處理 IndexedDB 的 Blob 儲存）
