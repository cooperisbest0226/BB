/* 星座塔團隊 — 啟動
   所有模組載入完成後才執行，必須是最後一個 <script>。 */
render();
/* 每天第一次開啟留一份快照。放在 render() 之後，不擋畫面顯示。 */
autoSnapshot();

/* 向瀏覽器要求持久化儲存。沒要求的話，裝置空間吃緊時 localStorage 與
   IndexedDB 快照可能被一起清掉——那是這個 App 唯一的資料所在地。 */
ensurePersistentStorage();

/* 離線狀態列：離線功能本身是完整的（App shell 全部預先快取），
   但使用者不知道自己在離線，只會覺得「YouTube 縮圖怎麼壞了」。 */
function syncOnlineBar(){
  document.getElementById('offlinebar').classList.toggle('in', !navigator.onLine);
}
addEventListener('online', syncOnlineBar);
addEventListener('offline', syncOnlineBar);
syncOnlineBar();

/* 桌面捷徑（manifest shortcuts）帶進來的分頁參數，例如 ./?tab=stats */
function applyTabParam(){
  const tab=new URLSearchParams(location.search).get('tab');
  if(!tab) return false;
  const el=document.querySelector(`.tab[data-view="${CSS.escape(tab)}"]`);
  if(el) el.click();
  return true;
}

/* ── 分享目標 ─────────────────────────────────────────────
   manifest 註冊了 share_target，所以從 YouTube App 按分享時，
   選單裡會出現「星座塔團隊」。分享過來的內容以查詢參數送到這裡。

   YouTube 在不同平台會把網址塞在不同欄位（Android 常放 text、有時混在標題後面），
   所以三個欄位一起掃，抓出第一個看得懂的 YouTube 網址。 */
function handleShareTarget(){
  const q=new URLSearchParams(location.search);
  if(!q.has('url')&&!q.has('text')&&!q.has('title')) return false;
  const raw=[q.get('url'),q.get('text'),q.get('title')].filter(Boolean).join(' ');
  let parsed=null;
  for(const u of (raw.match(/https?:\/\/\S+/g)||[])){ parsed=ytParse(u); if(parsed) break; }
  if(!parsed) { toast('分享過來的內容裡沒有看得懂的 YouTube 網址'); return true; }
  shareVideoSheet(parsed);
  return true;
}

/* 處理完就把查詢字串清掉，否則重新整理會再跳一次同樣的面板，
   而且使用者把這個網址加到主畫面時會把參數一起帶著。 */
handleShareTarget();
applyTabParam();
if(location.search) history.replaceState(null,'',location.pathname+location.hash);
