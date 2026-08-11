/* 星座塔團隊 — 拍賣：售出試算、成交紀錄、走勢與單品行情
   這個檔案是從原本的單一 index.html 拆出來的，載入順序有相依性，
   請維持 index.html 裡的 <script> 排列順序。 */
/* ── 售出計算 ─────────────────────────────────────────────
   兩種模式：
   - 整組出售（set）：組數 × 每組台幣 = 總台幣
   - 單品出售（item）：每列 數量 × 單價，全部加總 = 總台幣
   兩者都再乘上遊戲 R 幣值換算成 R 幣。
   「單一材料的歷史均價」只從單品交易算 —— 整組賣的總價沒辦法誠實拆到個別材料上，
   硬分攤出來的單價是推算的假數字，長期拿它當基準會誤導。 */
function isItemSale(s){ return s.mode==='item'; }
function saleItems(s){ return Array.isArray(s.items)?s.items:[]; }
function itemAmount(it){ return (Number(it.qty)||0)*(Number(it.twd)||0); }
function saleAmounts(s){
  const twd = isItemSale(s)
    ? saleItems(s).reduce((a,it)=>a+itemAmount(it),0)
    : (Number(s.sets)||0)*(Number(s.twd)||0);
  return {twd, r:twd*(Number(s.rate)||0)};
}
/* 單品交易沒有「組數」的概念，累計組數只算整組交易 */
function saleSetCount(s){ return isItemSale(s) ? 0 : (Number(s.sets)||0); }
function saleItemQty(s){ return isItemSale(s) ? saleItems(s).reduce((a,it)=>a+(Number(it.qty)||0),0) : 0; }

/* 每組成交價（單價）。走勢圖與「高於／低於均價」都用這個值比，只對整組交易有意義。 */
function saleUnit(s){ return Number(s.twd)||0; }
function saleMonth(s){ return (s.date||'').slice(0,7); }
function fmtMonth(mk){ const [y,m]=mk.split('-'); return `${y} 年 ${Number(m)} 月`; }

/* 依日期排序的副本；使用者可以編輯日期，state.sales 的陣列順序不保證是時間順序。
   編號（拍賣品項號）是「當初第幾筆記錄的」，所以一律回 state.sales 查原始位置 ——
   若改用傳進來的陣列位置，套上日期篩選後編號就會整排重編。 */
function salesByDate(sales){
  const all=state.sales||[];
  return sales.map(s=>({s, lot:all.indexOf(s)+1}))
    .sort((a,b)=> (a.s.date||'').localeCompare(b.s.date||'') || a.lot-b.lot);
}

/* 迷你走勢圖。點數少於 2 就不畫（一條沒有起伏的線沒有意義）。
   用等比縮放的 viewBox，不做 preserveAspectRatio=none，免得線寬跟端點被拉扁。 */
function sparkline(vals, w=320, h=56, pad=7){
  if(vals.length<2) return '';
  const min=Math.min(...vals), max=Math.max(...vals), span=(max-min)||1;
  const X=i=>pad+i*(w-pad*2)/(vals.length-1);
  const Y=v=>pad+(1-(v-min)/span)*(h-pad*2);
  const pts=vals.map((v,i)=>[X(i),Y(v)]);
  const line=pts.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area=`${line} L${pts[pts.length-1][0].toFixed(1)} ${h-pad} L${pad} ${h-pad} Z`;
  const last=pts[pts.length-1];
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" role="img" aria-label="每組成交價走勢">
    <path class="spark-a" d="${area}"/>
    <path class="spark-l" d="${line}"/>
    <circle class="spark-d" cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3.2"/>
  </svg>`;
}

/* 與均價的落差：回傳 [樣式, 文字]。差距不到 1% 視為持平，免得每筆都在跳箭頭。 */
function vsAvg(unit, avg){
  if(!avg) return ['flat','—'];
  const pct=(unit-avg)/avg*100;
  if(Math.abs(pct)<1) return ['flat','持平均價'];
  return pct>0 ? ['up',`高於均價 ${pct.toFixed(0)}%`] : ['down',`低於均價 ${Math.abs(pct).toFixed(0)}%`];
}

/* 日期區間篩選：空字串代表那一端不設限 */
function aucMatches(s){
  const d=s.date||'';
  if(aucFrom && d<aucFrom) return false;
  if(aucTo   && d>aucTo)   return false;
  return true;
}
function aucFilterLabel(){
  if(!aucFrom && !aucTo) return '全部日期';
  if(aucFrom && aucTo)   return aucFrom===aucTo ? fmtDate(aucFrom) : `${fmtDate(aucFrom)} — ${fmtDate(aucTo)}`;
  return aucFrom ? `${fmtDate(aucFrom)} 起` : `至 ${fmtDate(aucTo)}`;
}

/* 單品明細列的編輯器（記錄新交易用）。名稱走 datalist 自動建議，沿用掉落物那份材料清單。

   只有「列數變了」才重建 DOM。以前每次 render 都整塊換 innerHTML，
   使用者打字打到一半就會被抽掉重建，只能靠 activeElement 判斷繞過；
   改成列數沒變時只更新小計與系列色，輸入框本身完全不動。 */
let itemRowsCount=-1;
function renderSaleItemRows(force){
  const host=document.getElementById('saleItemRows');
  if(!force && itemRowsCount===saleDraftItems.length){ paintItemRowTotals(); return; }
  itemRowsCount=saleDraftItems.length;
  document.getElementById('matNameList').innerHTML=
    allMaterialNames().map(n=>`<option value="${esc(n)}"></option>`).join('');
  if(!saleDraftItems.length){
    host.innerHTML=`<div class="bench-empty" style="padding:12px 0">還沒有明細，按「＋ 新增一列」開始</div>`;
    return;
  }
  host.innerHTML=saleDraftItems.map((it,i)=>`
    <div class="itemrow" style="${msVars(matSeries(it.name||''))}">
      <input class="itemrow-n" list="matNameList" data-f="name" data-i="${i}"
             placeholder="材料名稱" value="${esc(it.name||'')}">
      <input class="itemrow-q num" type="number" min="0" step="1" inputmode="numeric"
             data-f="qty" data-i="${i}" placeholder="數量" value="${esc(String(it.qty??''))}">
      <input class="itemrow-p num" type="number" min="0" step="any" inputmode="decimal"
             data-f="twd" data-i="${i}" placeholder="單價" value="${esc(String(it.twd??''))}">
      <span class="itemrow-s num">${nf(itemAmount(it))}</span>
      <button class="salerow-x" data-itemdel="${i}" aria-label="刪除這一列">×</button>
    </div>`).join('');

  host.querySelectorAll('[data-f]').forEach(el=>el.oninput=e=>{
    const i=+e.target.dataset.i, f=e.target.dataset.f;
    saleDraftItems[i][f] = f==='name' ? e.target.value : e.target.value;
    /* 只重畫小計與總額，不重建整列 —— 重建會把游標踢出輸入框 */
    const row=e.target.closest('.itemrow');
    row.querySelector('.itemrow-s').textContent=nf(itemAmount(saleDraftItems[i]));
    if(f==='name') row.setAttribute('style', msVars(matSeries(saleDraftItems[i].name||'')));
    paintSaleOut();
  });
  host.querySelectorAll('[data-itemdel]').forEach(b=>b.onclick=()=>{
    saleDraftItems.splice(+b.dataset.itemdel,1);
    renderSaleItemRows(true); paintSaleOut();
  });
}

/* 列數沒變時的輕量更新：只改小計數字與系列色，不碰輸入框 */
function paintItemRowTotals(){
  const host=document.getElementById('saleItemRows');
  host.querySelectorAll('.itemrow').forEach((row,i)=>{
    const it=saleDraftItems[i]; if(!it) return;
    const sub=row.querySelector('.itemrow-s'), txt=nf(itemAmount(it));
    if(sub && sub.textContent!==txt) sub.textContent=txt;
    const vars=msVars(matSeries(it.name||''));
    if(row.getAttribute('style')!==vars) row.setAttribute('style',vars);
  });
}

/* 目前草稿的試算輸出（兩種模式共用） */
function paintSaleOut(){
  const draft = saleMode==='item'
    ? {mode:'item', items:saleDraftItems, rate:saleRate}
    : {mode:'set', sets:saleSets, twd:saleTwd, rate:saleRate};
  const a=saleAmounts(draft);
  const src = saleMode==='item'
    ? `${saleDraftItems.filter(it=>itemAmount(it)>0).length} 項明細`
    : `${nf(saleSets)} 組 × ${nf(saleTwd)}`;
  document.getElementById('saleOut').innerHTML=`
    <div class="calcline">總台幣 <em>${src}</em><b>${nf(a.twd)}</b></div>
    <div class="calcline r">總遊戲 R 幣 <em>${nf(a.twd)} × ${nf(saleRate)}</em><b>${nf(a.r)}</b></div>`;
}

function renderSales(){
  const all=state.sales||[];
  const last=all[all.length-1];
  /* 沒動過的欄位：組數跟著目前可組成的組數走，台幣／R 幣值沿用上一筆。
     「每組台幣」要沿用上一筆「整組」交易 —— 單品交易的 twd 是 0，抓到它會讓欄位變成 0。 */
  const lastSet=[...all].reverse().find(x=>!isItemSale(x));
  if(saleSets===null) saleSets=curSets;
  if(saleTwd===null)  saleTwd = lastSet ? lastSet.twd : '';
  if(saleRate===null) saleRate= last ? last.rate : '';

  const setsEl=document.getElementById('saleSets');
  const twdEl=document.getElementById('saleTwd');
  const rateEl=document.getElementById('saleRate');
  setInputValue(setsEl, saleSets);
  setInputValue(twdEl,  saleTwd);
  setInputValue(rateEl, saleRate);
  document.getElementById('saleLoad').textContent=`帶入目前組數 ${curSets}`;

  document.querySelectorAll('#saleModeSeg [data-mode]').forEach(b=>
    b.setAttribute('aria-selected',String(b.dataset.mode===saleMode)));
  document.getElementById('saleSetFields').hidden  = saleMode!=='set';
  document.getElementById('saleItemFields').hidden = saleMode!=='item';
  if(saleMode==='item') renderSaleItemRows();
  paintSaleOut();

  /* 以下都吃日期區間篩選 */
  setInputValue(document.getElementById('aucFrom'), aucFrom);
  setInputValue(document.getElementById('aucTo'), aucTo);
  document.getElementById('aucFiltText').textContent=aucFilterLabel();
  const sales=all.filter(aucMatches);

  /* 累計。平均每組台幣用「加權」算（總台幣 ÷ 總組數），不是把每筆單價直接平均 ——
     賣 100 組跟賣 1 組對均價的影響本來就不該一樣。 */
  const sum=sales.reduce((o,s)=>{ const x=saleAmounts(s);
    o.sets+=saleSetCount(s); o.qty+=saleItemQty(s); o.twd+=x.twd; o.r+=x.r; return o; },{sets:0,qty:0,twd:0,r:0});
  const setSales=sales.filter(s=>!isItemSale(s));
  const setTwd=setSales.reduce((a,s)=>a+saleAmounts(s).twd,0);
  const avgUnit = sum.sets ? setTwd/sum.sets : 0;
  document.getElementById('saleCards').innerHTML=[
    ['交易次數', nf(sales.length)],
    ['累計售出組數', nf(sum.sets)],
    ['累計售出單品', nf(sum.qty)],
    ['累計總台幣', nf(sum.twd)],
    ['累計總 R 幣', nf(sum.r)],
    ['平均每組台幣', nf(Math.round(avgUnit))],
  ].map(([k,v])=>`<div class="stat"><div class="stat-k">${k}</div><div class="stat-v num">${v}</div></div>`).join('');

  renderSaleTrend(sales, setSales, avgUnit);
  renderSaleQuotes(sales);
  renderSaleLedger(sales, avgUnit);
}

/* 成交走勢：上卡是每組成交價的折線（只看整組交易），下卡是近 6 個月的成交額長條（兩種模式都算）。 */
function renderSaleTrend(sales, setSales, avgUnit){
  const host=document.getElementById('saleTrend');
  if(sales.length<2){
    host.innerHTML=`<div class="bench-empty">這個範圍累積兩筆以上的成交紀錄後，這裡會顯示每組成交價的走勢與月度成交額</div>`;
    return;
  }
  let lineCard='';
  if(setSales.length>=2){
    const ordered=salesByDate(setSales);
    const units=ordered.map(({s})=>saleUnit(s));
    const first=ordered[0].s, latest=ordered[ordered.length-1].s;
    const [cls,txt]=vsAvg(saleUnit(latest), avgUnit);
    lineCard=`
      <div class="trendcard">
        <div class="trend-h">
          <div class="trend-hm">
            <div class="trend-k">最近一次整組成交價</div>
            <div class="trend-v num">${nf(saleUnit(latest))}<small>台幣 / 組</small></div>
          </div>
          <span class="trend-badge ${cls}">${txt}</span>
        </div>
        ${sparkline(units)}
        <div class="trend-x">
          <span>${fmtDate(first.date)}</span>
          <span class="trend-hl">最高 ${nf(Math.max(...units))} · 最低 ${nf(Math.min(...units))}</span>
          <span>${fmtDate(latest.date)}</span>
        </div>
      </div>`;
  } else {
    lineCard=`<div class="bench-empty">整組出售累積兩筆以上才畫得出每組成交價的走勢</div>`;
  }

  /* 月度成交額：只看最近 6 個月，太長在手機上會擠成一團 */
  const byMon={};
  sales.forEach(s=>{ const k=saleMonth(s); if(!k) return;
    const x=saleAmounts(s);
    byMon[k]=byMon[k]||{twd:0,n:0};
    byMon[k].twd+=x.twd; byMon[k].n++; });
  const mons=Object.keys(byMon).sort().slice(-6);
  const mmax=Math.max(1,...mons.map(k=>byMon[k].twd));

  host.innerHTML=lineCard+`
    <div class="trendcard" style="margin-top:11px">
      <div class="trend-k">近 ${mons.length} 個月成交額</div>
      <div class="mbars">${mons.map(k=>{
        const m=byMon[k];
        return `<div class="mbar">
          <div class="mbar-v num">${nf(m.twd)}</div>
          <div class="mbar-track"><div class="mbar-fill" style="height:${Math.max(3,m.twd/mmax*100)}%"></div></div>
          <div class="mbar-l">${Number(k.slice(5))} 月</div>
          <div class="mbar-n">${m.n} 筆</div>
        </div>`;
      }).join('')}</div>
    </div>`;
}

/* 單品行情：把所有單品交易攤平，依材料統計加權均價、最近成交價與累計數量。 */
function materialQuotes(sales){
  const q={};
  salesByDate(sales.filter(isItemSale)).forEach(({s})=>{
    saleItems(s).forEach(it=>{
      const name=(it.name||'').trim();
      const qty=Number(it.qty)||0, unit=Number(it.twd)||0;
      if(!name||qty<=0) return;
      const e=q[name]=q[name]||{name,qty:0,twd:0,n:0,lastUnit:0,lastDate:''};
      e.qty+=qty; e.twd+=qty*unit; e.n++;
      e.lastUnit=unit; e.lastDate=s.date;      // salesByDate 是舊到新，最後寫入的就是最近一次
    });
  });
  return Object.values(q).map(e=>({...e, avg:e.qty?e.twd/e.qty:0}))
    .sort((a,b)=>b.twd-a.twd);
}

function renderSaleQuotes(sales){
  const host=document.getElementById('saleQuotes');
  const list=materialQuotes(sales);
  if(!list.length){
    host.innerHTML=`<div class="bench-empty">用「單品出售」記錄交易後，這裡會依材料統計歷史均價與最近成交價</div>`;
    return;
  }
  host.innerHTML=`<div class="quotelist">${list.map(e=>{
    const [cls,txt]=vsAvg(e.lastUnit, e.avg);
    return `<div class="quoterow" style="${msVars(matSeries(e.name))}">
      <span class="quote-dot"></span>
      <div class="quote-m">
        <div class="quote-n">${esc(e.name)}</div>
        <div class="quote-s">累計 ${nf(e.qty)} 個 · ${e.n} 次成交 · ${fmtDate(e.lastDate)}</div>
      </div>
      <div class="quote-p">
        <div class="quote-avg num">${nf(Math.round(e.avg*10)/10)}<small>均價</small></div>
        <span class="auc-badge ${cls}">最近 ${nf(e.lastUnit)}</span>
      </div>
    </div>`;
  }).join('')}</div>`;
}

/* 成交紀錄：依月份分堆，每堆一個小結列，底下是一張張落槌卡片。 */
function renderSaleLedger(sales, avgUnit){
  const host=document.getElementById('saleList');
  if(!sales.length){
    host.innerHTML=`<div class="bench-empty">${(state.sales||[]).length
      ? '這個日期區間沒有成交紀錄'
      : '還沒有成交紀錄，填好上面的欄位後按「記錄這筆交易」'}</div>`;
    return;
  }
  const groups={};
  salesByDate(sales).forEach(e=>{ const k=saleMonth(e.s)||'—'; (groups[k]=groups[k]||[]).push(e); });
  const keys=Object.keys(groups).sort().reverse();      // 新的月份在最上面

  host.innerHTML=keys.map(k=>{
    const rows=groups[k].slice().reverse();             // 月份內也是新的在前
    const mt=rows.reduce((o,{s})=>{ const x=saleAmounts(s);
      o.twd+=x.twd; o.sets+=saleSetCount(s); o.qty+=saleItemQty(s); return o; },{twd:0,sets:0,qty:0});
    const bits=[`${rows.length} 筆`];
    if(mt.sets) bits.push(`${nf(mt.sets)} 組`);
    if(mt.qty)  bits.push(`${nf(mt.qty)} 個單品`);
    return `<div class="aucmon">
      <div class="aucmon-h">
        <span class="aucmon-t">${fmtMonth(k)}</span>
        <span class="aucmon-k">${bits.join(' · ')}</span>
        <span class="aucmon-v num">${nf(mt.twd)}</span>
      </div>
      <div class="auclist">${rows.map(({s,lot})=>{
        const x=saleAmounts(s), item=isItemSale(s);
        const [cls,txt]= item ? ['flat',`單品 ${saleItems(s).filter(i=>Number(i.qty)>0).length} 項`]
                              : vsAvg(saleUnit(s), avgUnit);
        const chips = item
          ? saleItems(s).filter(i=>(i.name||'').trim()&&Number(i.qty)>0)
              .map(i=>`<span class="auc-chip" style="${msVars(matSeries(i.name))}">${esc(i.name)} ×${nf(i.qty)} @${nf(i.twd)}</span>`)
          : [`<span class="auc-chip">${nf(s.sets)} 組</span>`,
             `<span class="auc-chip">每組 ${nf(s.twd)}</span>`];
        chips.push(`<span class="auc-chip">幣值 ${nf(s.rate)}</span>`);
        return `<div class="auccard">
          <div class="auc-top">
            <span class="auc-lot num ${item?'item':''}">#${lot}</span>
            <span class="auc-date">${fmtDate(s.date)} ${fmtDow(s.date)}</span>
            <span class="auc-badge ${cls}">${txt}</span>
            <button class="salerow-edit" data-act="editSale" data-id="${s.id}" aria-label="編輯這筆交易" title="編輯"><svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
            <button class="salerow-x" data-act="delSale" data-id="${s.id}" aria-label="刪除這筆交易">×</button>
          </div>
          <div class="auc-mid">
            <span class="auc-t num">${nf(x.twd)}</span><span class="auc-u">台幣</span>
            <span class="auc-r num">${nf(x.r)} R</span>
          </div>
          <div class="auc-foot">${chips.join('')}</div>
        </div>`;
      }).join('')}</div>
    </div>`;
  }).join('');
}
function applyMatPreset(p){
  const t=todayKey();
  if(p==='today'){ matFrom=t; matTo=t; }
  else if(p==='week'){ const d=parseYmd(t); const dow=(d.getDay()+6)%7; matFrom=shiftDate(t,-dow); matTo=shiftDate(t,6-dow); }
  else if(p==='month'){ matFrom=t.slice(0,8)+'01'; const d=parseYmd(t); matTo=shiftDate(matFrom,new Date(d.getFullYear(),d.getMonth()+1,0).getDate()-1); }
  else { matFrom=''; matTo=''; }
  renderMaterials();
}
document.getElementById('matFrom').onchange=e=>{ matFrom=e.target.value; renderMaterials(); };document.getElementById('matTo').onchange=e=>{ matTo=e.target.value; renderMaterials(); };
document.getElementById('matRun').onchange=e=>{ matRunName=e.target.value; renderMaterials(); };
document.getElementById('matPerSet').oninput=e=>{ matPerSet=Math.max(1,parseInt(e.target.value)||1); renderMaterials(); };
/* 只綁材料篩選裡的那四顆。原本用全域 [data-preset]，會連 PT 計算的星數快捷鈕
   （data-preset="0,5,5,3,5"）一起綁上，按 825PT 會順手把材料篩選重設成「全部」。 */
document.querySelectorAll('#matFiltBody [data-preset]').forEach(b=>b.onclick=()=>applyMatPreset(b.dataset.preset));

/* 篩選展開／收合 */
function bindFilterToggle(btnId, bodyId){
  const btn=document.getElementById(btnId), body=document.getElementById(bodyId);
  btn.onclick=()=>{
    const open=btn.getAttribute('aria-expanded')==='true';
    btn.setAttribute('aria-expanded',String(!open));
    body.hidden=open;
  };
}
bindFilterToggle('matFiltBtn','matFiltBody');
bindFilterToggle('aucFiltBtn','aucFiltBody');

/* 成交紀錄的日期區間篩選 */
function applyAucPreset(p){
  const t=todayKey();
  if(p==='today'){ aucFrom=t; aucTo=t; }
  else if(p==='week'){ const d=parseYmd(t); const dow=(d.getDay()+6)%7; aucFrom=shiftDate(t,-dow); aucTo=shiftDate(t,6-dow); }
  else if(p==='month'){ aucFrom=t.slice(0,8)+'01'; const d=parseYmd(t); aucTo=shiftDate(aucFrom,new Date(d.getFullYear(),d.getMonth()+1,0).getDate()-1); }
  else { aucFrom=''; aucTo=''; }
  renderSales();
}
document.querySelectorAll('#aucFiltBody [data-aucpreset]').forEach(b=>b.onclick=()=>applyAucPreset(b.dataset.aucpreset));
document.getElementById('aucFrom').onchange=e=>{ aucFrom=e.target.value; renderSales(); };
document.getElementById('aucTo').onchange  =e=>{ aucTo=e.target.value;   renderSales(); };

/* 售出計算：欄位即時重算，不進 undo 堆疊（還沒按記錄的都只是試算） */
const saleLive=(id,set)=>document.getElementById(id).oninput=e=>{ set(e.target.value); renderSales(); };
saleLive('saleSets', v=>saleSets=v);
saleLive('saleTwd',  v=>saleTwd=v);
saleLive('saleRate', v=>saleRate=v);
document.getElementById('saleLoad').onclick=()=>{ saleSets=curSets; renderSales(); };

/* 整組 / 單品模式切換 */
document.querySelectorAll('#saleModeSeg [data-mode]').forEach(b=>b.onclick=()=>{
  saleMode=b.dataset.mode;
  if(saleMode==='item'&&!saleDraftItems.length) saleDraftItems=[{name:'',qty:'',twd:''}];
  renderSaleItemRows(true);
  renderSales();
});
document.getElementById('saleItemAdd').onclick=()=>{
  saleDraftItems.push({name:'',qty:'',twd:''});
  renderSaleItemRows(true); paintSaleOut();
};

document.getElementById('saleAdd').onclick=()=>{
  const rate=Number(saleRate)||0;
  if(saleMode==='item'){
    const items=saleDraftItems
      .map(it=>({name:(it.name||'').trim(), qty:Number(it.qty)||0, twd:Number(it.twd)||0}))
      .filter(it=>it.name&&it.qty>0);
    if(!items.length)                    return toast('請至少填一列有名稱與數量的材料');
    if(items.some(it=>it.twd<=0))        return toast('每一列都要填單價');
    commit(()=>{ (state.sales=state.sales||[]).push({id:uid(),date:todayKey(),mode:'item',sets:0,twd:0,rate,items}); });
    saleDraftItems=[{name:'',qty:'',twd:''}];
    renderSaleItemRows(true);
  } else {
    const sets=Number(saleSets)||0, twd=Number(saleTwd)||0;
    if(sets<=0)  return toast('請先填組數');
    if(twd<=0)   return toast('請先填每組台幣');
    commit(()=>{ (state.sales=state.sales||[]).push({id:uid(),date:todayKey(),mode:'set',sets,twd,rate,items:[]}); });
  }
  toast('已記錄這筆交易');
};

/* 編輯一筆已記錄的交易明細（日期／組數／台幣／R 幣值都能改），或從這裡直接刪除 */
function saleSheet(id){
  const s=(state.sales||[]).find(x=>x.id===id); if(!s) return;
  const item=isItemSale(s);
  /* 在暫存副本上編輯，按取消就整份丟掉，不會動到已存的紀錄 */
  const work=saleItems(s).map(it=>({name:it.name||'',qty:it.qty??'',twd:it.twd??''}));

  const body = item
    ? `<div class="itemhead"><span>材料明細</span>
         <button class="minibtn" data-s="addRow" type="button">＋ 新增一列</button></div>
       <div id="editItemRows"></div>
       <datalist id="editMatList">${allMaterialNames().map(n=>`<option value="${esc(n)}"></option>`).join('')}</datalist>`
    : `<div class="field"><label>組數</label><input name="sets" type="number" min="0" step="1" inputmode="numeric" value="${esc(String(s.sets))}"></div>
       <div class="field"><label>台幣（每組）</label><input name="twd" type="number" min="0" step="any" inputmode="decimal" value="${esc(String(s.twd))}"></div>`;

  sheet(item?'編輯單品交易':'編輯整組交易',`
    <div class="field"><label>日期</label><input name="date" type="date" value="${esc(s.date)}"></div>
    ${body}
    <div class="field"><label>遊戲 R 幣值（1 台幣 = ? R）</label><input name="rate" type="number" min="0" step="any" inputmode="decimal" value="${esc(String(s.rate))}"></div>
    <div class="sheet-foot">
      <button class="gbtn warn" data-s="del">刪除</button>
      <button class="gbtn" data-s="cancel">取消</button>
      <button class="gbtn accent" data-s="save">儲存</button>
    </div>`, sh=>{
    const rowHost=sh.querySelector('#editItemRows');
    function paintRows(){
      if(!rowHost) return;
      rowHost.innerHTML=work.length ? work.map((it,i)=>`
        <div class="itemrow" style="${msVars(matSeries(it.name||''))}">
          <input class="itemrow-n" list="editMatList" data-f="name" data-i="${i}" placeholder="材料名稱" value="${esc(it.name)}">
          <input class="itemrow-q num" type="number" min="0" step="1" inputmode="numeric" data-f="qty" data-i="${i}" placeholder="數量" value="${esc(String(it.qty))}">
          <input class="itemrow-p num" type="number" min="0" step="any" inputmode="decimal" data-f="twd" data-i="${i}" placeholder="單價" value="${esc(String(it.twd))}">
          <span class="itemrow-s num">${nf(itemAmount(it))}</span>
          <button class="salerow-x" data-del="${i}" aria-label="刪除這一列">×</button>
        </div>`).join('')
        : `<div class="bench-empty" style="padding:12px 0">還沒有明細，按「＋ 新增一列」開始</div>`;
      rowHost.querySelectorAll('[data-f]').forEach(el=>el.oninput=e=>{
        const i=+e.target.dataset.i;
        work[i][e.target.dataset.f]=e.target.value;
        const row=e.target.closest('.itemrow');
        row.querySelector('.itemrow-s').textContent=nf(itemAmount(work[i]));
        if(e.target.dataset.f==='name') row.setAttribute('style', msVars(matSeries(work[i].name||'')));
      });
      rowHost.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{ work.splice(+b.dataset.del,1); paintRows(); });
    }
    paintRows();
    const addBtn=sh.querySelector('[data-s="addRow"]');
    if(addBtn) addBtn.onclick=()=>{ work.push({name:'',qty:'',twd:''}); paintRows(); };

    sh.querySelector('[data-s="save"]').onclick=()=>{
      const date=sh.querySelector('[name="date"]').value||s.date;
      const rate=Number(val(sh,'rate'))||0;
      if(item){
        const items=work.map(it=>({name:(it.name||'').trim(), qty:Number(it.qty)||0, twd:Number(it.twd)||0}))
                        .filter(it=>it.name&&it.qty>0);
        if(!items.length)             return toast('請至少填一列有名稱與數量的材料');
        if(items.some(it=>it.twd<=0)) return toast('每一列都要填單價');
        commit(()=>{ Object.assign(s,{date,rate,items}); });
      } else {
        const sets=Number(val(sh,'sets'))||0, twd=Number(val(sh,'twd'))||0;
        if(sets<=0) return toast('請先填組數');
        if(twd<=0)  return toast('請先填每組台幣');
        commit(()=>{ Object.assign(s,{date,sets,twd,rate}); });
      }
      closeSheet();
      toast('已更新交易明細');
    };
    sh.querySelector('[data-s="cancel"]').onclick=closeSheet;
    sh.querySelector('[data-s="del"]').onclick=()=>{
      confirmSheet('確定要刪除這筆交易紀錄嗎？',()=>{
        commit(()=>{ state.sales=(state.sales||[]).filter(x=>x.id!==id); });
        toast('已刪除交易紀錄');
      });
    };
  });
}

/* 子分頁切換：.subview 現在有兩組（材料、成員），一定要限定在自己那一段裡切，
   不然按材料的子分頁會把成員頁的子分頁一起關掉。 */
function bindSeg(segId, viewHost){
  const seg=document.getElementById(segId), host=document.getElementById(viewHost);
  if(!seg||!host) return;
  seg.querySelectorAll('[data-sub]').forEach(b=>b.onclick=()=>{
    seg.querySelectorAll('[data-sub]').forEach(x=>x.setAttribute('aria-selected',String(x===b)));
    host.querySelectorAll(':scope > .subview').forEach(v=>v.classList.toggle('active',v.id==='sub-'+b.dataset.sub));
    /* 子分頁的內容整個換掉了，停在原本的捲動位置沒有意義，回到最上面 */
    window.scrollTo(0,0);
  });
}
bindSeg('matSeg','view-stats');      // 材料總計 / 組數試算 / 場次明細
bindSeg('memberSeg','view-members'); // 成員列表 / 職業設定


