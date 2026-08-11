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
   碎片系列＝紅、浮塵系列＝藍、其餘（未知的隕石碎片、符文石之類）＝綠。
   同一套顏色貫穿：統計頁長條圖、掉落標籤、批次編輯面板、匯出圖片。 */
/* 名字裡雖然有「碎片／浮塵」，但不屬於六屬性系列的材料，一律歸到「其餘」 */
const SERIES_EXCEPT=['未知的隕石碎片'];
const MAT_SERIES=[
  {key:'shard',label:'碎片',test:n=>!SERIES_EXCEPT.includes(n)&&n.includes('碎片'),
   color:'#dc2626', ink:'#991b1b', soft:'rgba(220,38,38,.09)', line:'rgba(220,38,38,.26)'},
  {key:'dust', label:'浮塵',test:n=>!SERIES_EXCEPT.includes(n)&&n.includes('浮塵'),
   color:'#1d4ed8', ink:'#1e3a8a', soft:'rgba(29,78,216,.09)', line:'rgba(29,78,216,.26)'},
  {key:'other',label:'其餘',test:()=>true,
   color:'#0f9d76', ink:'#065f46', soft:'rgba(15,157,118,.10)', line:'rgba(15,157,118,.28)'},
];
function matSeries(name){ return MAT_SERIES.find(s=>s.test(name||'')) || MAT_SERIES[2]; }
/* 給 CSS 變數用，元素只要吃 --ms / --ms-ink / --ms-soft / --ms-line 就自動變成該系列的顏色 */
function msVars(s){ return `--ms:${s.color};--ms-ink:${s.ink};--ms-soft:${s.soft};--ms-line:${s.line}`; }
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
let matPerSet=5;

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

function renderMaterials(){
  const runSel=document.getElementById('matRun');
  runSel.innerHTML=`<option value="">全部</option>`+allRunNames().map(n=>
    `<option value="${esc(n)}" ${n===matRunName?'selected':''}>${esc(n)}</option>`).join('');
  setInputValue(document.getElementById('matFrom'), matFrom);
  setInputValue(document.getElementById('matTo'), matTo);
  document.getElementById('matFiltText').textContent=matFilterText();

  const entries=[];
  Object.keys(state.schedule).sort().forEach(k=>{
    ptsOf(k).forEach(pt=>{ if(matMatches(k,pt)) entries.push({date:k,pt}); });
  });

  const totals={}; let dropSum=0, runsWithDrops=0;
  entries.forEach(({pt})=>{
    if(pt.drops&&pt.drops.length){
      runsWithDrops++;
      pt.drops.forEach(d=>{ totals[d.name]=(totals[d.name]||0)+d.qty; dropSum+=d.qty; });
    }
  });
  const matNames=Object.keys(totals).sort((a,b)=>totals[b]-totals[a]);

  document.getElementById('matCards').innerHTML=[
    ['符合場次', entries.length],
    ['有掉落的場次', runsWithDrops],
    ['材料種類', matNames.length],
    ['掉落總數量', dropSum],
  ].map(([k,v])=>`<div class="stat"><div class="stat-k">${k}</div><div class="stat-v num">${v}</div></div>`).join('');

  /* 材料總計：分成 碎片／浮塵／其餘 三張卡，各自小計，長條圖用系列色 */
  const max=Math.max(1,...matNames.map(n=>totals[n]));
  document.getElementById('matBars').innerHTML = matNames.length
    ? groupBySeries(matNames).map(({s,names})=>{
        const sum=names.reduce((a,n)=>a+totals[n],0);
        return `<div class="matgrp" style="${msVars(s)}">
          <div class="matgrp-h"><span class="matgrp-t">${s.label}</span>
            <span class="matgrp-k">${names.length} 種</span>
            <span class="matgrp-v num">${sum}</span></div>
          <div class="bars">${names.map(n=>`<div class="bar-row"><span class="bar-l">${esc(n)}</span>
            <div class="bar-track"><div class="bar-fill" style="width:${totals[n]/max*100}%"></div></div>
            <span class="bar-n num">${totals[n]}</span></div>`).join('')}</div>
        </div>`;
      }).join('')
    : `<div class="bench-empty">這個範圍還沒有掉落紀錄</div>`;

  /* ── 組數試算 ───────────────────────────────────────── */
  const per=Math.max(1,matPerSet);
  setInputValue(document.getElementById('matPerSet'), per);
  const sets=Math.min(...SET_RECIPE.map(n=>Math.floor((totals[n]||0)/per)));
  const nextNeed=(sets+1)*per;                      // 要湊到下一組，每種材料需累積到的量
  const shortTotal=SET_RECIPE.reduce((a,n)=>a+Math.max(0,nextNeed-(totals[n]||0)),0);
  curSets=sets;                                     // 給售出計算「帶入目前組數」用

  document.getElementById('setCards').innerHTML=[
    ['可組成組數', sets],
    ['湊下一組還缺', shortTotal],
  ].map(([k,v])=>`<div class="stat"><div class="stat-k">${k}</div><div class="stat-v num">${v}</div></div>`).join('');

  document.getElementById('setDetail').innerHTML=groupBySeries(SET_RECIPE).map(({s,names})=>
    `<div class="matgrp" style="${msVars(s)}">
      <div class="matgrp-h"><span class="matgrp-t">${s.label}</span>
        <span class="matgrp-k">${names.length} 種</span>
        <span class="matgrp-v num">${names.reduce((a,n)=>a+(totals[n]||0),0)}</span></div>
      <div class="bars">${names.map(n=>{
        const q=totals[n]||0, own=Math.floor(q/per), lack=Math.max(0,nextNeed-q);
        /* 卡住整體組數的那幾種（木桶效應的短板）標成琥珀色，一眼看出瓶頸 */
        return `<div class="setrow ${own===sets?'short':''}">
          <span class="setrow-n">${esc(n)}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100,q/nextNeed*100)}%${own===sets?';background:#b45309':''}"></div></div>
          <span class="setrow-v"><b>${q}</b> · ${lack?`缺 ${lack}`:'已足'}</span>
        </div>`;
      }).join('')}</div>
    </div>`).join('');

  const withDrops=entries.filter(e=>e.pt.drops&&e.pt.drops.length).sort((a,b)=>b.date.localeCompare(a.date));
  document.getElementById('matDetail').innerHTML = withDrops.length
    ? withDrops.map(({date,pt})=>`<div class="ex-pt">
        <div class="ex-pt-h"><span class="ex-pt-n">${fmtDate(date)} ${fmtDow(date)} · ${esc(pt.name)}</span>
          <span class="ex-pt-t">${esc(pt.time||'')}</span></div>
        <div class="dropgrid" style="padding:11px 14px">${sortDrops(pt.drops).map(d=>
          `<span class="droppill" style="${msVars(matSeries(d.name))}">${esc(d.name)}<span class="drop-qty">×${d.qty}</span></span>`).join('')}</div>
      </div>`).join('')
    : `<div class="bench-empty">這個範圍還沒有掉落紀錄</div>`;

  renderSales();
}

