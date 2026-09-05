/* 星座塔團隊 — 出場統計
   這個檔案是從原本的單一 index.html 拆出來的，載入順序有相依性，
   請維持 index.html 裡的 <script> 排列順序。
   （依賴 auction.js 的 bindFilterToggle 與 applyXPreset 的日期工具，所以排在它後面）*/
/* ══════════════════════════════════════════════════════════
   出場統計
   回答兩個問題：這段期間誰排得多／排得少，以及誰在的場次比較容易翻。
   「出場」與「成功」刻意分成兩欄：分潤只算成功場（見設定），
   但只看得到分潤金額的話，翻車多的人只會顯示「分得少」，
   看不出是排得少還是翻得多——那是兩件要處理的事。
   ══════════════════════════════════════════════════════════ */
let attFrom='', attTo='';

function attFilterText(){
  if(!attFrom && !attTo) return '全部日期';
  if(attFrom && attTo)   return attFrom===attTo ? fmtDate(attFrom) : `${fmtDate(attFrom)} — ${fmtDate(attTo)}`;
  return attFrom ? `${fmtDate(attFrom)} 起` : `至 ${fmtDate(attTo)}`;
}

/* ── 核心統計 ──────────────────────────────────────────────
   回傳 {rows, runs, wiped, days}。rows 是每個「在這段期間出現過」的成員一筆，
   沒排到的人不會出現在這裡——由呼叫端自己決定要不要補上缺席名單。 */
function attendanceStats(from,to){
  const map=new Map();
  let runs=0, wiped=0;
  const days=dates().filter(k=>(!from||k>=from)&&(!to||k<=to));
  days.forEach(k=>{
    ptsOf(k).forEach(pt=>{
      runs++;
      const w=isWipe(pt);
      if(w) wiped++;
      /* 同一個人在同一場佔到兩個位子（資料異常或手滑重複拖進去）只算一次。
         這裡不只是數字好看的問題：之後分潤是按人頭份數分的，
         重複計會讓他實際多拿一份錢。 */
      const seen=new Set();
      pt.slots.forEach(s=>{
        if(!s.memberId||seen.has(s.memberId)) return;
        seen.add(s.memberId);
        let r=map.get(s.memberId);
        if(!r){ r={memberId:s.memberId, runs:0, cleared:0, wiped:0}; map.set(s.memberId,r); }
        r.runs++;
        if(w) r.wiped++; else r.cleared++;
      });
    });
  });
  /* 排序看的是「成功場」而不是「出場」：那是分潤的基準，
     排行跟之後算出來的金額順序才會一致，不然兩頁對照起來會覺得哪裡不對。 */
  const rows=[...map.values()].sort((a,b)=>
    b.cleared-a.cleared || b.runs-a.runs ||
    (memberName(a.memberId)).localeCompare(memberName(b.memberId),'zh-Hant'));
  return {rows, runs, wiped, days:days.length};
}

/* 出場紀錄留著、成員被刪掉的情況：名字要還原得出來，
   不然統計會冒出一列空白，看的人不知道那是誰、也不敢刪。 */
function memberName(id){
  const m=memberById(id);
  return m?m.name:'（已刪除成員）';
}

function renderAttend(){
  setInputValue(document.getElementById('attFrom'), attFrom);
  setInputValue(document.getElementById('attTo'), attTo);
  document.getElementById('attFiltText').textContent=attFilterText();
  const filtering=!!(attFrom||attTo);
  document.getElementById('attFiltBtn').classList.toggle('on',filtering);
  document.getElementById('attFiltClear').hidden=!filtering;
  paintPresets('#attFiltBody', attFrom, attTo, 'preset');

  const {rows,runs,wiped,days}=attendanceStats(attFrom,attTo);
  const cleared=runs-wiped;
  const rate=runs?Math.round(cleared/runs*100):0;

  /* 摘要卡：場次規模先講，成功率才有分母可以解讀。
     只有 3 場的 100% 跟 40 場的 92% 是完全不同的訊息。 */
  document.getElementById('attCard').innerHTML = runs
    ? `<div class="attsum">
        <div class="attsum-h">
          <span class="attsum-t">${days} 天 · ${runs} 場</span>
          <span class="attsum-r ${rate>=90?'good':rate>=70?'mid':'bad'} num">${rate}%</span>
        </div>
        <div class="attsum-b">
          <span class="attsum-k"><b class="num">${cleared}</b> 通關</span>
          <span class="attsum-k ${wiped?'bad':''}"><b class="num">${wiped}</b> 翻車</span>
          <span class="attsum-k"><b class="num">${rows.length}</b> 人出場</span>
        </div>
      </div>`
    : '';

  const host=document.getElementById('attList');
  if(!runs){
    host.innerHTML=`<div class="emptystate"><b>這個範圍沒有場次</b>換一個日期區間，或先在陣容頁排幾場。</div>`;
    return;
  }

  /* 長條是兩層的：軌道長度＝出場次數（相對於出場最多的人），填滿的部分＝通關。
     露出來的那截尾巴就是翻車，不用另外畫第二條。
     一開始只畫「出場」，但排行與大字都是看通關，兩個視覺編碼對不起來——
     全勤但翻很多的人長條最長，看起來卻像貢獻最多。

     基準用「出場最多的人」而不是總場次：沒有人全勤的時候，
     拿總場次當分母會讓整排長條都很短，彼此的差距反而看不出來。 */
  const max=rows.reduce((a,r)=>Math.max(a,r.runs),0)||1;
  const list=rows.map((r,i)=>{
    const rt=r.runs?Math.round(r.cleared/r.runs*100):0;
    return `<div class="attrow">
      <span class="attrow-i num">${i+1}</span>
      <div class="attrow-m">
        <div class="attrow-top">
          <span class="attrow-n">${esc(memberName(r.memberId))}</span>
          <span class="attrow-v num"><b>${r.cleared}</b><span>/${r.runs} 場</span></span>
        </div>
        <div class="attrow-bar" style="width:${r.runs/max*100}%">
          <div class="attrow-fill" style="width:${r.runs?r.cleared/r.runs*100:0}%"></div>
        </div>
        <div class="attrow-sub">
          <span class="attpill">通關 ${r.cleared}</span>
          ${r.wiped?`<span class="attpill bad">翻車 ${r.wiped}</span>`:''}
          <span class="attrow-rt num">${rt}%</span>
        </div>
      </div>
    </div>`;
  }).join('');

  /* 缺席名單：統計頁只列有出場的人的話，「這段期間誰完全沒排到」
     反而變成最難看出來的資訊——那通常正是要處理的事。 */
  const seen=new Set(rows.map(r=>r.memberId));
  const absent=state.members.filter(m=>!seen.has(m.id));
  const absentLine=absent.length
    ? `<div class="attabs"><b>${absent.length} 人這段期間沒有出場</b>${
        absent.map(m=>`<span>${esc(m.name)}</span>`).join('')}</div>`
    : '';
  host.innerHTML=list+absentLine;
}

/* ── 日期區間篩選 ───────────────────────────────────────── */
function applyAttPreset(p){
  [attFrom,attTo]=presetRange(p);
  renderAttend();
}
document.getElementById('attFrom').onchange=e=>{ attFrom=e.target.value; renderAttend(); };
document.getElementById('attTo').onchange  =e=>{ attTo=e.target.value;   renderAttend(); };
document.querySelectorAll('#attFiltBody [data-preset]').forEach(b=>b.onclick=()=>applyAttPreset(b.dataset.preset));
document.getElementById('attFiltClear').onclick=()=>{
  attFrom=''; attTo=''; renderAttend();
};
bindFilterToggle('attFiltBtn','attFiltBody');

/* ══════════════════════════════════════════════════════════
   分潤試算
   規則（跟 Henry 逐條確認過的，改動前請先確認，因為每一條都會改到金額）：
     1. 每筆交易的錢歸屬到「一場 RUN」。沒指定的舊紀錄，平均分攤給那天的所有場次。
     2. 一場的錢只分給那場的出場成員，不是丟進大水池按總出場比例分——
        同一天兩場成員不一樣的時候，後者會讓沒參加的人也拿到那場的錢。
     3. 翻車場不分潤，而且不是「先扣起來」——翻車就是沒打成功、沒有掉落物，
        根本沒有東西可以分。所以翻車場不會進入分配，也不會產生任何待處理的餘額。
        沒指定歸屬又找不到可分潤場次的交易，會單獨列出來提醒使用者去指定。
     4. 收入全數分完，沒有公基金。除不盡的部分用最大餘額法一元一元發完，
        每人金額加總精確等於總收入 —— 這張圖是要貼到群組的，
        有人加一加對不上就很難解釋。

   金額全程用「分」（整數）計算，最後才換回元。
   浮點數在七位數金額除以六個人的時候會出現 5.999999999 這種值，
   直接無條件捨去會少一塊錢，而且錯得毫無規律、事後很難查。
   ══════════════════════════════════════════════════════════ */
const toCents=twd=>Math.round((Number(twd)||0)*100);

/* 全部場次的 id 索引。歸屬場次可以跨天之後，就不能再靠 ptsOf(交易日期) 去找了。 */
function runIndex(){
  const m=new Map();
  dates().forEach(k=>ptsOf(k).forEach(pt=>m.set(pt.id,{pt,date:k})));
  return m;
}

/* 一筆交易屬不屬於某段「場次期間」。
   跟分潤用同一套判準：認的是歸屬場次的日期，沒指定歸屬才退回交易日期。
   材料頁扣除已售組數也吃這個函式 —— 兩邊各判各的話，
   材料頁說還能組 5 組、分潤說那筆錢不在這段期間，數字就對不起來了。 */
function saleInDateRange(s,from,to){
  const inR=d=>(!from||d>=from)&&(!to||d<=to);
  const idx=runIndex();
  const dts=(Array.isArray(s.runIds)?s.runIds:[])
    .map(id=>idx.get(id)).filter(Boolean).map(e=>e.date);
  return dts.length ? dts.some(inR) : inR(s.date||'');
}

function splitStats(from,to,cur){
  cur=cur||'TWD';
  const idx=runIndex();
  /* 幣別是硬條件：台幣跟 R 幣沒有共同單位，丟進同一個池子分出來的金額毫無意義。
     兩種幣別各自成池、各自平帳，頁面一次只呈現一種。 */
  const sales=(state.sales||[]).filter(s=>saleCur(s)===cur);
  const inRange=d=>(!from||d>=from)&&(!to||d<=to);

  /* 能收錢的場次：通關，而且真的有人出場。
     翻車就是沒打成功、沒有掉落物，沒有東西可以分；有錢卻沒有出場成員的場次
     也一樣沒有分潤對象。這兩種都不是「先扣起來放公基金」，
     而是根本不該進入分配 —— 錢會留在原本的交易上，由使用者自己去指定歸屬。 */
  const eligible=pt=>isCleared(pt)&&pt.slots.some(x=>x.memberId);

  /* 第一步：把每一筆錢攤到場次上（單位：分）。
     這裡「不」先套日期區間 —— 區間要篩的是場次，不是交易。
     九月賣掉八月打的材料，那筆錢屬於八月那幾場；材料什麼時候掛上拍賣場
     是記帳的時間點，不該決定它算哪個月的分潤。 */
  const runPool=new Map();          // ptId -> 分
  const runSales=new Map();         // ptId -> Set(交易 id)，用來算區間內有幾筆交易
  /* 掛不到任何可分潤場次的交易。單獨列出來提醒使用者回去指定歸屬，
     不併進任何區間的總額，也不會變成某個期間裡莫名多出來的一筆錢。 */
  let unassignedCents=0, unassignedCount=0;
  const addPool=(id,c,sid)=>{
    runPool.set(id,(runPool.get(id)||0)+c);
    if(!runSales.has(id)) runSales.set(id,new Set());
    runSales.get(id).add(sid);
  };

  sales.forEach(s=>{
    const cents=toCents(saleAmounts(s).amt);
    if(cents<=0) return;
    /* 指定的場次可以跨天、可以多場：材料本來就是累積好幾場才一次賣掉的。
       已刪除與翻車的場次都要濾掉，前者會讓錢攤給不存在的 id 然後消失，
       後者根本沒有分潤。 */
    let targets=(Array.isArray(s.runIds)?s.runIds:[])
      .map(id=>idx.get(id)).filter(Boolean).map(e=>e.pt).filter(eligible);
    /* 沒指定就退回「當天平均分攤」，同樣只攤給打得成功的場次。
       五場裡翻一場，那一場不該吃掉五分之一。 */
    if(!targets.length) targets=ptsOf(s.date||'').filter(eligible);
    if(!targets.length){ unassignedCents+=cents; unassignedCount++; return; }
    /* 除不盡的分一分一分發給前幾場，每一分都落在某一場身上，不會有零頭沒去處 */
    const base=Math.floor(cents/targets.length);
    let rem=cents-base*targets.length;
    targets.forEach(p=>{ addPool(p.id, base+(rem-->0?1:0), s.id); });
  });

  /* 第二步：只取「區間內的場次」，各自分給那場的人。
     走到這裡的場次一定通關、一定有人，所以不會有「沒人可分」的殘料。 */
  const per=new Map();              // memberId -> 分
  const runsPer=new Map();          // memberId -> 實際分到錢的場次數
  const saleIds=new Set();
  let totalCents=0, sharedRuns=0;
  runPool.forEach((pool,ptId)=>{
    const e=idx.get(ptId);
    if(!e || !inRange(e.date)) return;
    (runSales.get(ptId)||[]).forEach(id=>saleIds.add(id));
    totalCents+=pool;
    if(pool<=0) return;
    const ids=[...new Set(e.pt.slots.map(x=>x.memberId).filter(Boolean))];
    sharedRuns++;
    const base=Math.floor(pool/ids.length);
    let rem=pool-base*ids.length;
    ids.forEach(id=>{
      per.set(id,(per.get(id)||0)+base+(rem-->0?1:0));
      runsPer.set(id,(runsPer.get(id)||0)+1);
    });
  });

  /* 第三步：換算成整數元。
     沒有公基金可以擺零頭了，所以用「最大餘額法」——先每人取整數元，
     剩下的差額一元一元發給小數部分最大的人。這樣每個人拿到的都是整數，
     而且加總精確等於總收入，不會有一筆錢不知道去哪了。 */
  const rows=[...per.entries()].map(([memberId,cents])=>({memberId, cents}));
  const totalWhole=Math.floor(totalCents/100);
  let assigned=0;
  rows.forEach(r=>{ r.twd=Math.floor(r.cents/100); assigned+=r.twd; });
  rows.sort((a,b)=>(b.cents%100)-(a.cents%100) || b.cents-a.cents ||
      memberName(a.memberId).localeCompare(memberName(b.memberId),'zh-Hant'));
  for(let i=0, left=totalWhole-assigned; left>0 && i<rows.length; i++, left--) rows[i].twd++;

  rows.sort((a,b)=>b.twd-a.twd ||
      memberName(a.memberId).localeCompare(memberName(b.memberId),'zh-Hant'));
  /* 價格帶小數時才會出現的不足一元零頭，併給金額最高的人，維持加總相等。
     實務上價格都是整數，這條幾乎不會走到。 */
  const sub=totalCents-totalWhole*100;
  if(sub>0 && rows.length) rows[0].twd+=sub/100;
  rows.forEach(r=>delete r.cents);

  /* 場次數是「實際分到錢的場次」，不是「這段期間的通關場次」。
     兩者會不一樣：有些場次的材料還沒賣掉，有些場次跨在區間外但材料是這段期間賣的。
     顯示前者才跟旁邊的金額對得起來——看到「分潤 3 場」卻拿到四場的錢會讓人以為算錯。 */
  rows.forEach(r=>r.shares=runsPer.get(r.memberId)||0);

  return {
    rows,
    cur,
    totalTwd:totalCents/100,
    saleCount:saleIds.size,
    unassignedTwd:unassignedCents/100,
    unassignedCount,
    sharedRuns,
    /* 帳一定要平：每人金額加總 === 總收入。沒有公基金這個緩衝，這條更嚴格了。 */
    balanced:Math.round(rows.reduce((a,r)=>a+r.twd*100,0))===totalCents,
  };
}

/* ── 分潤試算畫面 ───────────────────────────────────────── */
let splFrom='', splTo='';

function splFilterText(){
  if(!splFrom && !splTo) return '全部日期';
  if(splFrom && splTo)   return splFrom===splTo ? fmtDate(splFrom) : `${fmtDate(splFrom)} — ${fmtDate(splTo)}`;
  return splFrom ? `${fmtDate(splFrom)} 起` : `至 ${fmtDate(splTo)}`;
}

function renderSplit(){
  setInputValue(document.getElementById('splFrom'), splFrom);
  setInputValue(document.getElementById('splTo'), splTo);
  document.getElementById('splFiltText').textContent=splFilterText();
  const filtering=!!(splFrom||splTo);
  document.getElementById('splFiltBtn').classList.toggle('on',filtering);
  document.getElementById('splFiltClear').hidden=!filtering;
  paintPresets('#splFiltBody', splFrom, splTo, 'splpreset');

  const st=splitStats(splFrom,splTo,aucCur);
  const card=document.getElementById('splCard'), host=document.getElementById('splList');
  document.getElementById('splShare').hidden=!st.rows.length;

  /* 沒指定歸屬、當天又沒有通關場次的交易，掛不到任何一段期間上。
     這種錢最容易被漏掉：畫面只會顯示「沒有交易」，但錢其實躺在那裡。
     一定要主動講出來，而且要講清楚怎麼修。 */
  const warn = st.unassignedCount
    ? `<div class="splwarn"><b>${st.unassignedCount} 筆交易還沒指定歸屬場次</b>
        共 ${nf(st.unassignedTwd)}，因為找不到對應的場次，不會出現在任何期間的分潤裡。
        到「成交紀錄」點那幾筆的編輯鈕，把歸屬場次選起來就會納入計算。</div>`
    : '';

  if(!st.saleCount){
    card.innerHTML='';
    host.innerHTML=warn+`<div class="emptystate"><b>這個場次期間沒有${curLabel(aucCur)}收入</b>換一個期間或幣別，或先到「成交紀錄」記幾筆。</div>`;
    return;
  }

  /* 沒有公基金了：收入全數分完，加總精確等於總收入。
     所以摘要改成講「幾場有收入、幾人分潤」，那才是使用者要確認的事。 */
  /* 領取進度放在摘要裡：發錢發到一半關掉 App 再打開，
     第一眼要看得到「還有幾個人沒領」，而不是自己一列一列數。 */
  const paidSum=st.rows.reduce((a,r)=>a+paidAmount(r.memberId,splFrom,splTo,aucCur),0);
  const cleared=st.rows.filter(r=>
    r.twd-paidAmount(r.memberId,splFrom,splTo,aucCur)<=0);
  const paid={length:cleared.length};
  card.innerHTML=`<div class="attsum">
    <div class="attsum-h">
      <span class="attsum-t">${st.saleCount} 筆${curLabel(aucCur)}交易 · ${st.sharedRuns} 場有收入</span>
      <span class="attsum-r num">${nf(st.totalTwd)}</span>
    </div>
    <div class="attsum-b">
      <span class="attsum-k"><b class="num">${paid.length}/${st.rows.length}</b> 人領完</span>
      <span class="attsum-k"><b class="num">${nf(Math.max(0,st.totalTwd-paidSum))}</b> 待發</span>
    </div>
    ${st.rows.length&&paid.length===st.rows.length
      ? `<div class="splnote done">這段期間的分潤都發完了</div>`:''}
    ${paidSum>0&&paid.length<st.rows.length
      ? `<div class="splnote">已發出 ${nf(paidSum)}，下方金額都是扣掉已領之後的待領數字</div>`:''}
  </div>`;

  /* 主要數字是「待領」而不是「應得」：發錢的人要看的是還差多少。
     應得與已領放在下面一行，對帳時才追得回來這個數字怎麼來的。 */
  host.innerHTML=warn+st.rows.map((r,i)=>{
    const got=paidAmount(r.memberId,splFrom,splTo,aucCur);
    const due=r.twd-got;
    const done=due<=0;
    const exact=exactPayout(r.memberId,splFrom,splTo,aucCur);
    const partial=partialPayouts(r.memberId,splFrom,splTo,aucCur);
    return `<div class="attrow splrow${done?' paid':''}">
      <span class="attrow-i num">${i+1}</span>
      <div class="attrow-m">
        <div class="attrow-top">
          <span class="attrow-n">${esc(memberName(r.memberId))}</span>
          <span class="splamt num">${nf(due)}</span>
        </div>
        <div class="attrow-sub">
          <span class="attpill">分潤 ${r.shares} 場</span>
          ${got?`<span class="attpill">應得 ${nf(r.twd)} · 已領 ${nf(got)}</span>`:''}
          ${partial.length?`<span class="attpill bad">另有 ${partial.length} 筆跨期間的結算未扣除</span>`:''}
          ${done&&!exact
            ? `<span class="paidbtn on" aria-disabled="true"
                 title="這是在別段期間結算掉的，要取消請回那段期間">✓ 已領</span>`
            : `<button class="paidbtn${done?' on':''}" data-pay="${r.memberId}" data-due="${due}"
                 aria-pressed="${!!exact}">${exact?'✓ 已領':'標記已領'}</button>`}
        </div>
      </div>
    </div>`;
  }).join('');
  host.querySelectorAll('[data-pay]').forEach(b=>b.onclick=()=>
    togglePayout(b.dataset.pay, Number(b.dataset.due)||0));
}

function applySplPreset(p){
  [splFrom,splTo]=presetRange(p);
  renderSplit();
}
document.getElementById('splFrom').onchange=e=>{ splFrom=e.target.value; renderSplit(); };
document.getElementById('splTo').onchange  =e=>{ splTo=e.target.value;   renderSplit(); };
document.querySelectorAll('#splFiltBody [data-splpreset]').forEach(b=>b.onclick=()=>applySplPreset(b.dataset.splpreset));
document.getElementById('splFiltClear').onclick=()=>{ splFrom=''; splTo=''; renderSplit(); };
bindFilterToggle('splFiltBtn','splFiltBody');

/* ── 歸屬場次選擇器 ─────────────────────────────────────
   一開始做成「只列今天場次」的下拉，那是錯的：材料是累積好幾場、好幾天
   才一次賣掉的，賣出當天常常根本沒排場次，下拉整個是空的。
   改成可跨天複選的核取清單。不用 <select multiple> 是因為它在手機上
   要長按拖曳，實際上按不動。 */
let saleRunIds=[];        // 新增交易表單目前選中的場次

function runPickSummary(ids){
  if(!ids.length) return '未指定（當天平均分攤）';
  const idx=runIndex();
  if(ids.length===1){
    const e=idx.get(ids[0]);
    return e ? `${fmtDate(e.date)} ${e.pt.name}` : '已選 1 場';
  }
  const days=new Set(ids.map(id=>idx.get(id)).filter(Boolean).map(e=>e.date));
  return `已選 ${ids.length} 場${days.size>1?` · 跨 ${days.size} 天`:''}`;
}

/* 清單是懶建的：資料用久了會累積幾百天，每次渲染拍賣頁都重建一次
   幾百組 DOM 是實打實的負擔，所以只有展開時才產生。 */
function runPickBodyHTML(ids){
  const ks=dates().filter(k=>ptsOf(k).length).reverse();   // 新的在上面
  if(!ks.length) return `<div class="bench-empty" style="padding:12px">還沒有任何場次</div>`;
  return ks.map(k=>`<div class="rp-day">
    <div class="rp-d">${fmtDate(k)} ${fmtDow(k)}</div>
    ${ptsOf(k).map(p=>`<label class="rp-r${isWipe(p)?' wiped':''}">
      <input type="checkbox" value="${p.id}"${ids.includes(p.id)?' checked':''}>
      <span class="rp-n">${esc(p.name)}${isWipe(p)?' · 翻車':''}</span>
      <em class="rp-c">${p.slots.length} 人</em>
    </label>`).join('')}
  </div>`).join('');
}

/* 把一組「按鈕 + 收合清單」接起來。新增表單與編輯 sheet 共用，
   免得兩邊各寫一份、之後只改到其中一邊。 */
function bindRunPicker(root, getIds, setIds){
  const btn=root.querySelector('[data-rp="btn"]');
  const body=root.querySelector('[data-rp="body"]');
  const paint=()=>{ btn.textContent=runPickSummary(getIds()); };
  btn.onclick=()=>{
    const open=btn.getAttribute('aria-expanded')==='true';
    if(open){ btn.setAttribute('aria-expanded','false'); body.hidden=true; return; }
    body.innerHTML=runPickBodyHTML(getIds())+
      `<button type="button" class="minibtn rp-clear" data-rp="clear">清除選擇</button>`;
    body.querySelectorAll('input[type="checkbox"]').forEach(cb=>cb.onchange=()=>{
      const cur=getIds().filter(x=>x!==cb.value);
      if(cb.checked) cur.push(cb.value);
      setIds(cur); paint();
    });
    body.querySelector('[data-rp="clear"]').onclick=()=>{
      setIds([]); paint();
      body.querySelectorAll('input[type="checkbox"]').forEach(cb=>cb.checked=false);
    };
    btn.setAttribute('aria-expanded','true'); body.hidden=false;
  };
  paint();
}

function renderSaleRunOptions(collapse){
  /* 已經被刪掉的場次要濾掉，不然摘要會顯示一個對不到東西的數字 */
  const idx=runIndex();
  saleRunIds=saleRunIds.filter(id=>idx.has(id));
  const root=document.getElementById('saleRunPick');
  /* 記完一筆之後要把展開中的勾選一起收掉。只清 saleRunIds 而不收面板的話，
     畫面上那些勾還在，看起來像是「還沒清掉」。 */
  if(collapse){
    const btn=root.querySelector('[data-rp="btn"]'), body=root.querySelector('[data-rp="body"]');
    btn.setAttribute('aria-expanded','false'); body.hidden=true; body.innerHTML='';
  }
  bindRunPicker(root, ()=>saleRunIds, v=>{ saleRunIds=v; });
}
document.getElementById('splShare').onclick=()=>exportSplitImage();

/* ── 領取紀錄 ─────────────────────────────────────────────
   分潤算出來只是第一步，錢還要一個一個發。中間最常斷掉的就是「我發到誰了」。

   關鍵在於「已領」是累積的，不是某一段期間的旗標。實際的用法是這樣的：
   9/1 當天先結一次、發了 5000W，之後再選 9/1–9/10 或「全部日期」時，
   要馬上看到「這個人還差多少」，而不是重新看到一次全額。
   所以每一列的主要數字是「待領」＝ 應得 − 期間內已領。

   一筆領取紀錄綁住「誰 + 哪一段期間 + 哪種幣別 + 發了多少」。
   金額存下來是刻意的：之後若補記了那段期間的交易，應得會變動，
   但「當初實際發出去多少」不該被改寫——差額會自動變成新的待領。

   扣除的條件是「那次結算的期間完整落在目前選的期間裡」。
   部分重疊不扣，因為無法判斷該扣多少，硬扣會算錯錢；這種情況會另外提示。 */
function payoutsOf(memberId,cur){
  return (state.payouts||[]).filter(p=>p.memberId===memberId&&p.cur===cur);
}
/* a 這段期間是否完整包含在 b 裡（空字串代表那一端不設限） */
function rangeContains(bFrom,bTo,aFrom,aTo){
  if(bFrom && (!aFrom || aFrom<bFrom)) return false;
  if(bTo   && (!aTo   || aTo  >bTo))   return false;
  return true;
}
/* 目前期間內，這個人已經領走多少 */
function paidAmount(memberId,from,to,cur){
  return payoutsOf(memberId,cur)
    .filter(p=>rangeContains(from,to,p.from,p.to))
    .reduce((a,p)=>a+(Number(p.twd)||0),0);
}
/* 跟目前期間部分重疊、但不完整落在裡面的結算。這種無法判斷該扣多少，
   所以不扣，但一定要講——不講的話待領金額會莫名其妙偏高。 */
function partialPayouts(memberId,from,to,cur){
  return payoutsOf(memberId,cur).filter(p=>{
    if(rangeContains(from,to,p.from,p.to)) return false;
    const aF=p.from||'0000-00-00', aT=p.to||'9999-99-99';
    const bF=from||'0000-00-00',   bT=to||'9999-99-99';
    return aF<=bT && bF<=aT;                       // 有交集但不完整包含
  });
}
function exactPayout(memberId,from,to,cur){
  return (state.payouts||[]).find(p=>p.memberId===memberId&&p.cur===cur
    &&(p.from||'')===(from||'')&&(p.to||'')===(to||''))||null;
}
/* 標記已領＝把「目前還差的金額」記成一筆發放。再點一次撤銷這一段期間的紀錄。 */
function togglePayout(memberId,due){
  const from=splFrom, to=splTo, cur=aucCur;
  const hit=exactPayout(memberId,from,to,cur);
  commit(()=>{
    state.payouts=state.payouts||[];
    if(hit) state.payouts=state.payouts.filter(x=>x!==hit);
    else state.payouts.push({id:uid(), memberId, from:from||'', to:to||'', cur, twd:due, ts:Date.now()});
  });
  renderSplit();
  toast(hit?`${memberName(memberId)} 已取消這段期間的領取紀錄`
           :`${memberName(memberId)} 標記已領 ${nf(due)}`);
}
