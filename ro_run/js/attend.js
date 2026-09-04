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
  const t=todayKey();
  if(p==='today'){ attFrom=t; attTo=t; }
  else if(p==='week'){ const d=parseYmd(t); const dow=(d.getDay()+6)%7; attFrom=shiftDate(t,-dow); attTo=shiftDate(t,6-dow); }
  else if(p==='month'){ attFrom=t.slice(0,8)+'01'; const d=parseYmd(t); attTo=shiftDate(attFrom,new Date(d.getFullYear(),d.getMonth()+1,0).getDate()-1); }
  else { attFrom=''; attTo=''; }
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
     3. 翻車場不分潤。翻車通常也沒有掉落所以沒有收入，
        但萬一真的有錢綁在翻車場上，它不會人間蒸發，會整筆進公基金並單獨列出來。
     4. 除不盡的零頭一律無條件捨去，餘額全部進公基金。
        不用四捨五入是因為那會讓「每人金額加總 ≠ 總收入」——
        這張圖是要貼到群組的，有人加一加對不上就很難解釋。

   金額全程用「分」（整數）計算，最後才換回元。
   浮點數在七位數金額除以六個人的時候會出現 5.999999999 這種值，
   直接無條件捨去會少一塊錢，而且錯得毫無規律、事後很難查。
   ══════════════════════════════════════════════════════════ */
const toCents=twd=>Math.round((Number(twd)||0)*100);

function splitStats(from,to,cur){
  cur=cur||'TWD';
  /* 幣別是硬條件：台幣跟 R 幣沒有共同單位，丟進同一個池子分出來的金額毫無意義。
     兩種幣別各自成池、各自平帳，頁面一次只呈現一種。 */
  const inRange=s=>{ const d=s.date||'';
    return saleCur(s)===cur && (!from||d>=from) && (!to||d<=to); };
  const sales=(state.sales||[]).filter(inRange);

  let totalCents=0;
  sales.forEach(s=>{ totalCents+=toCents(saleAmounts(s).amt); });

  /* 第一步：把每一筆錢攤到場次上（單位：分） */
  const runPool=new Map();          // ptId -> 分
  let orphanCents=0;                // 那天根本沒有場次，沒有人可以歸屬
  const addPool=(id,c)=>runPool.set(id,(runPool.get(id)||0)+c);

  sales.forEach(s=>{
    const cents=toCents(saleAmounts(s).amt);
    if(cents<=0) return;
    const pts=ptsOf(s.date||'');
    const bound=s.runId&&pts.find(p=>p.id===s.runId);
    if(bound){ addPool(bound.id,cents); return; }
    /* 未指定：平均分攤給那天的場次。場次本身也除不盡的話，
       零頭直接進公基金，不要偷偷塞給第一場。 */
    if(!pts.length){ orphanCents+=cents; return; }
    const each=Math.floor(cents/pts.length);
    pts.forEach(p=>addPool(p.id,each));
    orphanCents+=cents-each*pts.length;
  });

  /* 第二步：每一場各自分給那場的人 */
  const per=new Map();              // memberId -> 分
  let fundCents=orphanCents, wipedCents=0, sharedRuns=0;
  dates().filter(k=>(!from||k>=from)&&(!to||k<=to)).forEach(k=>{
    ptsOf(k).forEach(pt=>{
      const pool=runPool.get(pt.id)||0;
      if(pool<=0) return;
      if(isWipe(pt)){ wipedCents+=pool; fundCents+=pool; return; }
      const ids=[...new Set(pt.slots.map(x=>x.memberId).filter(Boolean))];
      if(!ids.length){ fundCents+=pool; return; }   // 有錢沒人，只能進公基金
      sharedRuns++;
      const each=Math.floor(pool/ids.length);
      ids.forEach(id=>per.set(id,(per.get(id)||0)+each));
      fundCents+=pool-each*ids.length;
    });
  });

  /* 第三步：每人無條件捨去到整數元，被捨掉的角分進公基金 */
  const rows=[...per.entries()].map(([memberId,cents])=>{
    const twd=Math.floor(cents/100);
    fundCents+=cents-twd*100;
    return {memberId, twd};
  }).sort((a,b)=>b.twd-a.twd ||
      memberName(a.memberId).localeCompare(memberName(b.memberId),'zh-Hant'));

  /* 份數（成功場數）只是拿來顯示的，金額不是用它算出來的——
     一場的單價會因為那場有幾個人而不同，用「總額 ÷ 總份數」回推對不起來。 */
  const att=attendanceStats(from,to);
  const clearedBy=new Map(att.rows.map(r=>[r.memberId,r.cleared]));
  rows.forEach(r=>r.shares=clearedBy.get(r.memberId)||0);

  return {
    rows,
    cur,
    totalTwd:totalCents/100,
    fundTwd:fundCents/100,
    wipedTwd:wipedCents/100,
    orphanTwd:orphanCents/100,
    saleCount:sales.length,
    sharedRuns,
    /* 帳一定要平：每人金額加總 + 公基金 === 總收入。測試盯著這條。 */
    balanced:rows.reduce((a,r)=>a+r.twd*100,0)+fundCents===totalCents,
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

  const st=splitStats(splFrom,splTo,aucCur);
  const card=document.getElementById('splCard'), host=document.getElementById('splList');
  document.getElementById('splShare').hidden=!st.rows.length;

  if(!st.saleCount){
    card.innerHTML='';
    host.innerHTML=`<div class="emptystate"><b>這個範圍沒有${curLabel(aucCur)}交易</b>換一個期間或幣別，或先到「成交紀錄」記幾筆。</div>`;
    return;
  }

  /* 公基金那一行永遠印出來，就算是 0。
     這是「加總對不對得起來」的證據，貼到群組讓人自己驗算；
     只有零頭時才顯示的話，反而會讓人以為那筆錢是憑空多出來的。 */
  card.innerHTML=`<div class="attsum">
    <div class="attsum-h">
      <span class="attsum-t">${st.saleCount} 筆${curLabel(aucCur)}交易 · ${st.rows.length} 人可分</span>
      <span class="attsum-r num">${nf(st.totalTwd)}</span>
    </div>
    <div class="attsum-b">
      <span class="attsum-k"><b class="num">${nf(st.totalTwd-st.fundTwd)}</b> 已分配</span>
      <span class="attsum-k"><b class="num">${nf(st.fundTwd)}</b> 公基金</span>
    </div>
    ${st.wipedTwd>0?`<div class="splnote">其中 ${nf(st.wipedTwd)} 來自翻車場，依規則不分潤，已計入公基金</div>`:''}
    ${st.orphanTwd>0?`<div class="splnote">其中 ${nf(st.orphanTwd)} 那天沒有任何場次可歸屬，已計入公基金</div>`:''}
  </div>`;

  host.innerHTML=st.rows.map((r,i)=>`<div class="attrow splrow">
    <span class="attrow-i num">${i+1}</span>
    <div class="attrow-m">
      <div class="attrow-top">
        <span class="attrow-n">${esc(memberName(r.memberId))}</span>
        <span class="splamt num">${nf(r.twd)}</span>
      </div>
      <div class="attrow-sub"><span class="attpill">通關 ${r.shares} 場</span></div>
    </div>
  </div>`).join('');
}

function applySplPreset(p){
  const t=todayKey();
  if(p==='today'){ splFrom=t; splTo=t; }
  else if(p==='week'){ const d=parseYmd(t); const dow=(d.getDay()+6)%7; splFrom=shiftDate(t,-dow); splTo=shiftDate(t,6-dow); }
  else if(p==='month'){ splFrom=t.slice(0,8)+'01'; const d=parseYmd(t); splTo=shiftDate(splFrom,new Date(d.getFullYear(),d.getMonth()+1,0).getDate()-1); }
  else { splFrom=''; splTo=''; }
  renderSplit();
}
document.getElementById('splFrom').onchange=e=>{ splFrom=e.target.value; renderSplit(); };
document.getElementById('splTo').onchange  =e=>{ splTo=e.target.value;   renderSplit(); };
document.querySelectorAll('#splFiltBody [data-splpreset]').forEach(b=>b.onclick=()=>applySplPreset(b.dataset.splpreset));
document.getElementById('splFiltClear').onclick=()=>{ splFrom=''; splTo=''; renderSplit(); };
bindFilterToggle('splFiltBtn','splFiltBody');

/* 記錄交易時的「歸屬場次」下拉：只列今天的場次。
   交易是當下記的，跨日的情況去成交紀錄裡改日期時再一起改。 */
function renderSaleRunOptions(){
  const sel=document.getElementById('saleRun');
  const keep=sel.value;
  const pts=ptsOf(todayKey());
  sel.innerHTML=`<option value="">未指定（當天平均分攤）</option>`+
    pts.map(p=>`<option value="${p.id}">${esc(p.name)}${isWipe(p)?'（翻車）':''}</option>`).join('');
  sel.value=pts.some(p=>p.id===keep)?keep:'';
}
document.getElementById('splShare').onclick=()=>exportSplitImage();
