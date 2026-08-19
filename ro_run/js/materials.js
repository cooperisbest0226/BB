/* 星座塔團隊 — 材料統計：系列分色、總計、組數試算、場次明細
   這個檔案是從原本的單一 index.html 拆出來的，載入順序有相依性，
   請維持 index.html 裡的 <script> 排列順序。 */
/* ══════════════════════════════════════════════════════════
   材料統計
   ══════════════════════════════════════════════════════════ */
let matFrom='', matTo='', matRunName='';
/* 售出計算：curSets 由組數試算算出，用來「帶入目前組數」；台幣與 R 幣值記住上次輸入省得每次重打 */
let curSets=0, saleSets=null, saleTwd=null, saleRate=null;
/* 記錄中的交易草稿：模式與單品明細列。明細列在按下「記錄這筆交易」前都只是試算，不進 state。 */
let saleMode='set', saleDraftItems=[];
/* 成交紀錄的日期區間篩選（空字串＝不限） */
let aucFrom='', aucTo='';
/* 千分位；小數最多兩位，整數就不補小數點 */
const nf=n=>(Number(n)||0).toLocaleString('en-US',{maximumFractionDigits:2});

/* ── 材料系列分色 ─────────────────────────────────────────
   分成四類各自給色：碎片（藍）／浮塵（綠）／未知（紫）／稀微（桃紅），
   加一個「其餘」灰色接住使用者自訂的材料。
   四個色相在可用色環上平均分配，任兩類都相距 64 度：
   綠 142° → 藍 206° → 紫 270° → 桃紅 334°。
   可用範圍刻意從 140 起跳到 335 為止，把紅與琥珀那一段讓出來 ——
   那兩色是 --danger（刪除）與 --warn（瓶頸）的語意，材料借用會蓋掉真正該注意的東西。
   顏色能不能區分靠的是色相距離，不是色名不同：先前試過「藍／青／紫／綠」，
   青跟綠只差 30 度，在細長條上就是同一個顏色。
   「未知的隕石碎片」與「稀微魔力符文石」以前都被歸進同一個「其餘」灰色堆裡，
   兩種完全不同的東西長得一樣；現在各自有色。

   色相刻意拉開讓四類一眼分得出來，但避開紅色與琥珀色 ——
   那兩個色在這個 App 裡有固定語意（--danger 刪除、--warn 瓶頸），
   材料色借用會讓真正該注意的東西失去辨識度。

   這裡的字面色值只給「匯出圖片」用（匯出一律白底，不跟著深色模式走）；
   畫面上的元素改吃 CSS 變數（見 msVars），深色模式才有辦法各自調亮。 */
/* 名字裡雖然有「碎片」，但不屬於六屬性系列的材料，要排除在碎片系列之外 */
const SERIES_EXCEPT=['未知的隕石碎片'];
const MAT_SERIES=[
  {key:'shard',label:'碎片',test:n=>!SERIES_EXCEPT.includes(n)&&n.includes('碎片'),
   color:'#207ec5', ink:'#1765a1', soft:'rgba(32,126,197,.11)', line:'rgba(32,126,197,.30)'},
  {key:'dust', label:'浮塵',test:n=>!SERIES_EXCEPT.includes(n)&&n.includes('浮塵'),
   color:'#20c55d', ink:'#17a149', soft:'rgba(32,197,93,.13)', line:'rgba(32,197,93,.32)'},
  {key:'unknown',label:'未知',test:n=>n==='未知的隕石碎片',
   color:'#7320c5', ink:'#5c17a1', soft:'rgba(115,32,197,.11)', line:'rgba(115,32,197,.30)'},
  {key:'rune', label:'稀微',test:n=>n==='稀微魔力符文石',
   color:'#c52068', ink:'#a11753', soft:'rgba(197,32,104,.11)', line:'rgba(197,32,104,.30)'},
  {key:'other',label:'其餘',test:()=>true,
   color:'#8a8f9c', ink:'#63697a', soft:'rgba(138,143,156,.12)', line:'rgba(138,143,156,.28)'},
];
/* 找不到時退回最後一項（「其餘」）。這裡不能寫死索引 —— 系列數量會變。 */
function matSeries(name){ return MAT_SERIES.find(s=>s.test(name||'')) || MAT_SERIES[MAT_SERIES.length-1]; }
/* 給畫面上的元素用：指向 CSS 變數而不是寫死色碼，深色模式才調得動。
   元素只要吃 --ms / --ms-ink / --ms-soft / --ms-line 就自動變成該系列的顏色。 */
function msVars(s){
  return `--ms:var(--ms-${s.key});--ms-ink:var(--ms-${s.key}-ink);`+
         `--ms-soft:var(--ms-${s.key}-soft);--ms-line:var(--ms-${s.key}-line)`;
}
/* 掉落標籤一律照系列排（碎片 → 浮塵 → 其餘），同系列內維持記錄順序 */
function sortDrops(drops){
  const rank=n=>MAT_SERIES.findIndex(s=>s.key===matSeries(n).key);
  return [...drops].sort((a,b)=>rank(a.name)-rank(b.name));
}
/* 把材料名稱依系列分堆，順序固定：碎片 → 浮塵 → 其餘 */
function groupBySeries(names){
  return MAT_SERIES.map(s=>({s,names:names.filter(n=>matSeries(n).key===s.key)})).filter(g=>g.names.length);
}

function allRunNames(){
  const set=new Set();
  Object.values(state.schedule).forEach(pts=>pts.forEach(pt=>set.add(pt.name)));
  return [...set].sort((a,b)=>a.localeCompare(b,'zh-Hant'));
}
function matMatches(k,pt){
  if(matFrom && k<matFrom) return false;
  if(matTo && k>matTo) return false;
  if(matRunName && pt.name!==matRunName) return false;
  return true;
}
/* 組數試算：以下 12 種材料「每種各 N 個」算 1 組（預設 N=5）。
   未知的隕石碎片、稀微魔力符文石不算在組合裡。組數取決於最少的那一種（木桶效應）。 */
const SET_RECIPE=[
  '威力隕石浮塵','耐力隕石浮塵','專注隕石浮塵','創造隕石浮塵','咒數隕石浮塵','智慧隕石浮塵',
  '威力隕石碎片','耐力隕石碎片','專注隕石碎片','創造隕石碎片','咒數隕石碎片','智慧隕石碎片',
];
let matPerSet=1;

/* 篩選摘要（收合狀態下那一行字） */
function matFilterText(){
  const range = (!matFrom&&!matTo) ? '全部日期'
    : (matFrom&&matTo&&matFrom===matTo) ? fmtDate(matFrom)
    : `${matFrom?fmtDate(matFrom):'最早'} – ${matTo?fmtDate(matTo):'最新'}`;
  return `${range} · ${matRunName||'全部場次'}`;
}

/* 寫入輸入框的統一入口：正在被使用者操作的欄位不要碰（會把游標／選字彈掉、
   在數字框上還會讓「1.」「-」這種打到一半的內容被吃掉），值沒變也不要寫。 */
function setInputValue(el, v){
  if(!el) return;
  if(document.activeElement===el) return;
  const next=v===null||v===undefined?'':String(v);
  if(el.value!==next) el.value=next;
}

/* 場次明細預設只展開最近幾天，其餘收合成一行。
   實測 28 天 56 場會產生一萬六千像素的頁面，全部攤開沒人滑得完。 */
const MAT_DETAIL_OPEN=3;
let matOpenDays=null;   // Set；null 代表還沒動過，套用預設

function renderMaterials(){
  const runSel=document.getElementById('matRun');
  runSel.innerHTML=`<option value="">全部</option>`+allRunNames().map(n=>
    `<option value="${esc(n)}" ${n===matRunName?'selected':''}>${esc(n)}</option>`).join('');
  setInputValue(document.getElementById('matFrom'), matFrom);
  setInputValue(document.getElementById('matTo'), matTo);
  document.getElementById('matFiltText').textContent=matFilterText();
  /* 篩選生效時要看得出來 —— 以前收合狀態下有沒有篩選長得一模一樣，
     很容易看到一半忘了自己還開著篩選，把局部數字當成全部。 */
  const filtering=!!(matFrom||matTo||matRunName);
  document.getElementById('matFiltBtn').classList.toggle('on',filtering);
  document.getElementById('matFiltClear').hidden=!filtering;

  const entries=[];
  Object.keys(state.schedule).sort().forEach(k=>{
    ptsOf(k).forEach(pt=>{ if(matMatches(k,pt)) entries.push({date:k,pt}); });
  });

  const totals={}; let dropSum=0, runsWithDrops=0;
  const byDay={};
  entries.forEach(({date,pt})=>{
    if(pt.drops&&pt.drops.length){
      runsWithDrops++;
      pt.drops.forEach(d=>{
        totals[d.name]=(totals[d.name]||0)+d.qty;
        dropSum+=d.qty;
        byDay[date]=(byDay[date]||0)+d.qty;
      });
    }
  });
  const matNames=Object.keys(totals).sort((a,b)=>totals[b]-totals[a]);

  /* ── 組數與瓶頸：這是打開這頁最想知道的事，所以算在最前面、擺在最上面 ── */
  const per=Math.max(1,matPerSet);
  setInputValue(document.getElementById('matPerSet'), per);
  const sets=Math.min(...SET_RECIPE.map(n=>Math.floor((totals[n]||0)/per)));
  const nextNeed=(sets+1)*per;                      // 要湊到下一組，每種材料需累積到的量
  curSets=sets;                                     // 給售出計算「帶入目前組數」用
  /* 瓶頸：撐得起的組數等於整體組數的那幾種。可能不只一種，列出缺最多的那個當代表。 */
  const necks=SET_RECIPE.filter(n=>Math.floor((totals[n]||0)/per)===sets)
    .sort((a,b)=>(totals[a]||0)-(totals[b]||0));
  const neck=necks[0], neckLack=neck?Math.max(0,nextNeed-(totals[neck]||0)):0;
  const avgPerRun=runsWithDrops?dropSum/runsWithDrops:0;

  /* 每日掉落量走勢：材料頁原本只有單一時間點的快照，看不出「這週是不是掉得比較差」。
     只有兩天以上才畫，一個點的折線沒有意義。 */
  const dayKeys=Object.keys(byDay).sort();
  const trend=dayKeys.length>=2
    ? `<div class="mres-trend">
         ${sparkline(dayKeys.map(k=>byDay[k]),320,44,6)}
         <div class="mres-x"><span>${fmtDate(dayKeys[0])}</span>
           <span class="mres-hl">每日掉落量 · 最多 ${Math.max(...dayKeys.map(k=>byDay[k]))} · 最少 ${Math.min(...dayKeys.map(k=>byDay[k]))}</span>
           <span>${fmtDate(dayKeys[dayKeys.length-1])}</span></div>
       </div>`
    : '';

  document.getElementById('matCards').innerHTML = matNames.length
    ? `<div class="mres">
        <div class="mres-top">
          <div class="mres-main">
            <div class="mres-k">可組成</div>
            <div class="mres-v num">${sets}<small>組</small></div>
          </div>
          <div class="mres-meta num">${entries.length} 場 · ${dropSum} 個<br>
            <span>每場平均 ${avgPerRun.toFixed(1)} 個</span></div>
        </div>
        ${neck?`<div class="mres-neck">
          <span class="mres-nk">瓶頸</span>
          <span class="mres-nn">${esc(neck)}</span>
          <span class="mres-nv num">${totals[neck]||0} 個${neckLack?` · 再 ${neckLack} 個進下一組`:''}</span>
        </div>`:''}
        ${trend}
      </div>`
    : `<div class="bench-empty">這個範圍還沒有掉落紀錄</div>`;

  /* ── 材料總計 ───────────────────────────────────────────
     長條的基準維持「相對於最大量」—— 這是誠實的：各材料掉落量本來就接近，
     硬換成「距離下一組」的進度基準反而更糟（瓶頸算出來是 96%，跟其他人一樣滿）。

     真正的問題不在基準而在視覺層級：原本 12 條同樣粗、同樣飽和的紅藍長條全部接近滿格，
     眼睛沒有落點，圖看起來很滿卻讀不出東西。改成夠用的材料一律壓成細的、低透明度的
     中性色往後站，只有卡住組數的那一種用琥珀色加粗跳出來 —— 這樣一眼就看到異常值。 */
  const gmax=Math.max(1,...matNames.map(n=>totals[n]));
  document.getElementById('matBars').innerHTML = matNames.length
    ? groupBySeries(matNames).map(({s,names})=>{
        const sum=names.reduce((a,n)=>a+totals[n],0);
        return `<div class="matgrp" style="${msVars(s)}">
          <div class="matgrp-h"><span class="matgrp-t">${s.label}</span>
            <span class="matgrp-k">${names.length} 種</span>
            <span class="matgrp-v num">${sum}</span></div>
          <div class="bars">${names.map(n=>{
            const q=totals[n], inRecipe=SET_RECIPE.includes(n);
            const isNeck=inRecipe&&Math.floor(q/per)===sets;
            return `<div class="bar-row ${isNeck?'short':''}">
              <span class="bar-l">${esc(n)}</span>
              <div class="bar-track"><div class="bar-fill" style="width:${q/gmax*100}%"></div></div>
              <span class="bar-n num">${q}</span></div>`;
          }).join('')}</div>
        </div>`;
      }).join('')
    : `<div class="bench-empty">這個範圍還沒有掉落紀錄</div>`;

  /* ── 組數試算：每種材料撐得起幾組 ─────────────────────
     頂部原本那兩張「可組成組數／湊下一組還缺」統計卡已經移到主結果卡，這裡不再重複。 */
  document.getElementById('setDetail').innerHTML=groupBySeries(SET_RECIPE).map(({s,names})=>
    `<div class="matgrp" style="${msVars(s)}">
      <div class="matgrp-h"><span class="matgrp-t">${s.label}</span>
        <span class="matgrp-k">${names.length} 種</span>
        <span class="matgrp-v num">${names.reduce((a,n)=>a+(totals[n]||0),0)}</span></div>
      <div class="bars">${names.map(n=>{
        const q=totals[n]||0, own=Math.floor(q/per), lack=Math.max(0,nextNeed-q);
        /* 卡住整體組數的那幾種（木桶效應的短板）標成琥珀色，一眼看出瓶頸。

           這裡寫「可組 N 組」而不是「缺 N／已足」：lack 算的是「湊到下一組還差多少」，
           但寫成「缺」會讓人以為現有的組數還少了東西 —— 瓶頸材料剛好夠 7 組時
           顯示「7 · 缺 1」，看起來就像那 7 組沒湊齊。改成直接講這種材料撐得起幾組，
           跟上方「可組成組數」對得起來；差多少才進下一組另外用小字標在瓶頸那幾列。 */
        return `<div class="setrow ${own===sets?'short':''}">
          <span class="setrow-n">${esc(n)}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100,q/nextNeed*100)}%${own===sets?';background:var(--warn)':''}"></div></div>
          <span class="setrow-v"><b>${q}</b> · 可組 ${own} 組${own===sets&&lack?`<i>再 ${lack}</i>`:''}</span>
        </div>`;
      }).join('')}</div>
    </div>`).join('');

  /* ── 場次明細：按日期分組，預設只展開最近幾天 ───────── */
  const withDrops=entries.filter(e=>e.pt.drops&&e.pt.drops.length);
  const days=[...new Set(withDrops.map(e=>e.date))].sort((a,b)=>b.localeCompare(a));
  if(matOpenDays===null) matOpenDays=new Set(days.slice(0,MAT_DETAIL_OPEN));
  /* 只算「目前這個範圍裡」的展開數 —— 換篩選之後 matOpenDays 可能還留著
     不在範圍內的日期，拿整個 Set 的大小去比會判斷錯按鈕該顯示展開還是收合。 */
  const openCount=days.filter(k=>matOpenDays.has(k)).length;
  const allOpen=days.length>0&&openCount===days.length;
  document.getElementById('matDetail').innerHTML = days.length
    ? `<div class="mday-bar">
        <span class="mday-bar-t num">${days.length} 天 · ${withDrops.length} 場</span>
        <button class="gbtn" data-act="matDayAll" data-all="${allOpen?'close':'open'}">
          ${allOpen?'全部收合':'全部展開'}</button>
      </div>`+
      days.map(k=>{
        const list=withDrops.filter(e=>e.date===k);
        const qty=list.reduce((a,e)=>a+e.pt.drops.reduce((b,d)=>b+d.qty,0),0);
        const open=matOpenDays.has(k);
        return `<div class="mday ${open?'open':''}">
          <button class="mday-h" data-act="matDay" data-day="${k}" aria-expanded="${open}">
            <span class="mday-d">${fmtDate(k)} ${fmtDow(k)}</span>
            <span class="mday-s num">${list.length} 場 · ${qty} 個</span>
            <svg class="mday-c" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          ${open?list.map(({date,pt})=>`<div class="mrun">
            <button class="mrun-h" data-act="editRunDrops" data-pt="${pt.id}" data-day="${date}">
              <span class="mrun-n">${esc(pt.name)}</span>
              <span class="mrun-t num">${esc(pt.time||'')}</span>
              <span class="mrun-e">編輯</span>
            </button>
            <div class="dropgrid mrun-g">${sortDrops(pt.drops).map(d=>
              `<span class="droppill" style="${msVars(matSeries(d.name))}">${esc(d.name)}<span class="drop-qty">×${d.qty}</span></span>`).join('')}</div>
          </div>`).join(''):''}
        </div>`;
      }).join('')
    : `<div class="bench-empty">這個範圍還沒有掉落紀錄</div>`;

  renderSales();
}

