/* 星座塔團隊 — 分頁延後渲染、日期列、陣容分配、待分配、成員與職業列表
   這個檔案是從原本的單一 index.html 拆出來的，載入順序有相依性，
   請維持 index.html 裡的 <script> 排列順序。 */
/* ══════════════════════════════════════════════════════════
   繪製
   ══════════════════════════════════════════════════════════ */
/* 開啟 App 預設停在「今天」；今天還沒建立排班時，退而求其次選離今天最近的一天（同距離優先選未來） */
function defaultDate(){
  const ks=dates(), tk=todayKey();
  if(!ks.length) return tk;
  if(ks.includes(tk)) return tk;
  const t=parseYmd(tk).getTime();
  return ks.slice().sort((a,b)=>{
    const da=parseYmd(a).getTime()-t, db=parseYmd(b).getTime()-t;
    const ad=Math.abs(da)-Math.abs(db);
    return ad!==0?ad:(db-da);
  })[0];
}
/* ── 分頁延後渲染 ─────────────────────────────────────────
   以前 render() 一律把日期列、陣容、待分配、成員、職業全部重畫一遍，
   不管使用者當下在哪個分頁 —— 在陣容裡拖一個人，成員列表跟職業列表也整包重建 DOM，
   純粹是白工。材料統計早就用「髒了才算」的做法（matDirty），這裡把同一套推廣到全部分頁：
   render() 只把所有分頁標記為髒，然後單獨重畫「目前看得到的那一個」，
   其他分頁等使用者切過去時才補畫。 */
let matDirty=true;
const VIEW_IDS=['board','calc','members','stats','auction'];
let viewDirty=Object.fromEntries(VIEW_IDS.map(v=>[v,true]));
/* 每個分頁各自的捲動位置，切回去時還原（初次進入是 0，所以會從最上面開始看） */
let viewScroll=Object.fromEntries(VIEW_IDS.map(v=>[v,0]));

function activeViewId(){
  const el=document.querySelector('.view.active');
  return el ? el.id.replace('view-','') : 'board';
}
/* 拍賣頁的「帶入目前組數」也是靠材料掃描算出來的 curSets，
   所以材料頁或拍賣頁其中一個開著就要算。 */
function statsVisible(){
  const v=activeViewId();
  return v==='stats'||v==='auction';
}
function ensureMaterials(){
  if(matDirty){ matDirty=false; renderMaterials(); return true; }
  return false;
}
function renderView(v){
  if(v==='board'){ renderDates(); renderBoard(); renderBench(); }
  else if(v==='members'){ renderMembers(); renderRoles(); }
  else if(v==='stats'){ ensureMaterials(); }
  /* 材料掃描的結尾會順便叫 renderSales()，所以沒重算時才需要自己補一次 */
  else if(v==='auction'){ if(!ensureMaterials()) renderSales(); }
  viewDirty[v]=false;
}
function renderActiveView(){
  const v=activeViewId();
  if(viewDirty[v]) renderView(v);
}
/* 保留舊名字：材料統計相關的呼叫點還是用這個語意 */
function renderMaterialsIfVisible(){
  if(statsVisible()) renderView(activeViewId());
  else matDirty=true;
}
function render(){
  const ks=dates();
  if(!ks.length){ ensureDate(todayKey()); persist(); }
  if(!curDate||!state.schedule[curDate]) curDate=defaultDate();
  VIEW_IDS.forEach(v=>viewDirty[v]=true);
  matDirty=true;
  renderActiveView();
  document.getElementById('brandSub').textContent=fmtDate(curDate)+' '+fmtDow(curDate);
}

/* 日期列的日期集合通常不會變（新增/刪除/改日期才會變），
   但只要陣容分配有任何異動，render() 就會呼叫這裡 —— 資料量一大（例如用了兩年、累積幾百天）
   整條日期列每次都重新產生 DOM 會變成明顯的效能負擔。
   改成：日期集合沒變的話，只更新「目前這天」那一顆的人數/RUN數跟 aria-current，不重建整條列。 */
let dateRailKeysCache=null, dateRailTodayCache=null;
function dateChipHTML(k, tk){
  const pts=ptsOf(k), used=assignedIds(k).size;
  return `<button class="datechip ${k===tk?'today':''}" data-date="${k}" aria-current="${k===curDate}">
    <div class="dc-dow">${k===tk?'今天':fmtDow(k)}</div>
    <div class="dc-md num">${fmtDate(k)}</div>
    <div class="dc-meta num">${pts.length}R · ${used}人</div>
  </button>`;
}
function renderDates(){
  const rail=document.getElementById('dateRail'), tk=todayKey();
  const ks=dates(), keysStr=ks.join(',');
  if(keysStr!==dateRailKeysCache||tk!==dateRailTodayCache){
    rail.innerHTML=ks.map(k=>dateChipHTML(k,tk)).join('');
    dateRailKeysCache=keysStr; dateRailTodayCache=tk;
  }else{
    /* 日期集合沒變：唯一可能變動內容的只有「目前這天」（使用者一次只能編輯 curDate），
       其餘日期的 chip 沿用上次畫好的 DOM，省掉整條重繪的成本 */
    rail.querySelectorAll('.datechip[aria-current="true"]').forEach(el=>{
      if(el.dataset.date!==curDate) el.setAttribute('aria-current','false');
    });
    const btn=rail.querySelector(`[data-date="${curDate}"]`);
    if(btn){
      btn.setAttribute('aria-current','true');
      const meta=btn.querySelector('.dc-meta');
      if(meta) meta.textContent=`${ptsOf(curDate).length}R · ${assignedIds(curDate).size}人`;
    }
  }
  /* 這裡故意不用 cur.scrollIntoView() —— 日期列在 sticky 頂部列裡面，
     scrollIntoView 為了「把日期列本身捲進可視範圍」，會連帶把整個頁面往上捲到頂，
     每次指派人員都會跳頁，很煩。改成只算日期列「自己」要橫向捲多少，不去動整頁的垂直捲動位置。 */
  const cur=rail.querySelector('[aria-current="true"]');
  if(cur){
    const rRect=rail.getBoundingClientRect(), cRect=cur.getBoundingClientRect();
    const delta=(cRect.left+cRect.width/2)-(rRect.left+rRect.width/2);
    if(Math.abs(delta)>1) rail.scrollTo({left:rail.scrollLeft+delta, behavior:dateRailReady?'smooth':'auto'});
  }
  dateRailReady=true;
}

function renderBoard(){
  const grid=document.getElementById('ptGrid'), pts=ptsOf(curDate);
  document.getElementById('boardLabel').textContent=`${fmtDate(curDate)} ${fmtDow(curDate)} · ${pts.length} RUN`;
  if(!pts.length){
    grid.innerHTML=`<div class="emptystate"><b>這天還沒有 RUN</b>先建一個 RUN，再把待分配的成員拖進來。</div>`;
    return;
  }
  grid.innerHTML=pts.map((pt,i)=>{
    const n=pt.slots.length, full=n>=pt.capacity;
    const pips=Array.from({length:pt.capacity},(_,j)=>{
      const on=j<n;
      /* 已填的波利依序錯開跳動時間，看起來像一隻接一隻跳過去，而不是整排同時彈 */
      const delay=on?` style="animation-delay:${(j%12)*110}ms"`:'';
      return `<span class="pip ${on?(full?'full':'on'):''}"${delay} aria-hidden="true">
        <svg viewBox="0 0 24 24"><use href="#ic-poring"/></svg>
      </span>`;
    }).join('');
    const rows=pt.slots.length ? pt.slots.map((s,si)=>{
      const m=memberById(s.memberId), r=roleById(s.roleId);
      if(!m) return '';
      const pill=r
        ? `<button class="rolepill" data-act="role" data-pt="${pt.id}" data-i="${si}"
             style="color:${r.color};border-color:${hexA(r.color,.4)};background:${hexA(r.color,.09)}">${esc(r.icon||'')}${esc(r.name)}</button>`
        : `<button class="rolepill empty" data-act="role" data-pt="${pt.id}" data-i="${si}">指定職業</button>`;
      const bf=buffFor(m,r), own=hasBuffOverride(m,r&&r.id);
      const buffTag = r
        ? `<button class="slot-buff ${own?'own':''} ${bf?'':'none'}" data-act="slotBuff"
             data-pt="${pt.id}" data-i="${si}" title="${own?'這個人自己的 BUFF':'套用職業預設 BUFF'}"
           >${bf?esc(bf):'＋ BUFF'}</button>`
        : '';
      return `<div class="slot ${s.bento?'bento':''}" data-chip="${m.id}" data-from="${pt.id}" data-si="${si}">
        <div class="slot-nm">
          <span class="slot-name">${esc(m.name)}</span>
          ${buffTag}
        </div>${pill}
        <button class="slot-x" data-act="unassign" data-pt="${pt.id}" data-i="${si}" aria-label="移出">×</button>
      </div>`;
    }).join('') : `<div class="slot-empty">還沒有人 — 從下方拖曳或點選成員加入</div>`;
    return `<div class="ptcard" data-drop="pt" data-pt="${pt.id}" style="animation-delay:${i*45}ms">
      <div class="pt-head">
        <div class="pt-id">
          <div class="pt-name">${esc(pt.name)}</div>
          <div class="pt-time num">${esc(pt.time||'未設定時間')}</div>
        </div>
        <div class="pt-count num ${full?'full':''}"><b>${n}</b><span>/${pt.capacity}</span></div>
      </div>
      <div class="meter">${pips}</div>
      <div class="slots">${rows}</div>
      <div class="dropsec">
        <div class="dropsec-head">
          <span class="dropsec-t">掉落物</span>
          <button class="gbtn" data-act="addDrop" data-pt="${pt.id}" style="padding:5px 10px;font-size:12px">${(pt.drops&&pt.drops.length)?'編輯掉落':'＋ 記錄掉落'}</button>
        </div>
        <div class="dropgrid">${(pt.drops&&pt.drops.length) ? [...pt.drops].sort((a,b)=>
          MAT_SERIES.findIndex(s=>s.key===matSeries(a.name).key)-MAT_SERIES.findIndex(s=>s.key===matSeries(b.name).key)).map(d=>
          `<button class="droppill" data-act="editDrop" data-pt="${pt.id}" data-d="${d.id}" style="${msVars(matSeries(d.name))}">${esc(d.name)}<span class="drop-qty">×${d.qty}</span></button>`).join('')
          : `<span class="bench-empty" style="padding:0">還沒有記錄</span>`}</div>
      </div>
      <div class="pt-foot">
        <button class="gbtn" data-act="editPt" data-pt="${pt.id}">編輯</button>
        <button class="gbtn" data-act="orderPt" data-pt="${pt.id}" ${n?'':'disabled'}>排序 / 便當</button>
        <button class="gbtn" data-act="dupPt" data-pt="${pt.id}">複製</button>
        <button class="gbtn warn" data-act="delPt" data-pt="${pt.id}" style="margin-left:auto">刪除</button>
      </div>
    </div>`;
  }).join('');
}

function renderBench(){
  const host=document.getElementById('benchList');
  let list=benchMembers(curDate);
  document.getElementById('benchTitle').textContent=`成員 ${list.length}`;
  if(!list.length){
    host.innerHTML=`<div class="bench-empty">還沒有啟用中的成員</div>`;
    return;
  }
  host.innerHTML=list.map(m=>{
    const r=roleById(m.defaultRoleId), n=countRuns(curDate,m.id);
    return `<button class="chip ${picked===m.id?'picked':''}" data-chip="${m.id}" data-from="bench">
      ${r?`<span class="chip-dot" style="background:${r.color}"></span>`:''}${esc(m.name)}${n?`<span class="chip-n">${n}</span>`:''}
    </button>`;
  }).join('');
}

function renderMembers(){
  const q=(document.getElementById('memberSearch').value||'').trim().toLowerCase();
  const host=document.getElementById('memberList');
  const list=state.members.filter(m=>!q||m.name.toLowerCase().includes(q));
  if(!list.length){
    host.innerHTML=`<div class="emptystate"><b>${q?'找不到符合的成員':'還沒有成員'}</b>${q?'換個關鍵字試試。':'新增成員後就能開始排班。'}</div>`;
    return;
  }
  host.innerHTML=`<div class="list">`+list.map(m=>{
    const r=roleById(m.defaultRoleId);
    const meta=[r?r.name:'', buffFor(m,r), m.notes].filter(Boolean).join(' · ');
    return `<div class="row" data-act="editMember" data-id="${m.id}">
      <div class="row-main">
        <div class="row-t">${esc(m.name)}${m.active?'':'<span class="badge off">停用</span>'}</div>
        ${meta?`<div class="row-s">${esc(meta)}</div>`:''}
      </div>
      ${r?`<span class="rolepill" style="color:${r.color};border-color:${hexA(r.color,.4)};background:${hexA(r.color,.09)}">${esc(r.name)}</span>`:''}
    </div>`;
  }).join('')+`</div>`;
}

let roleSelectMode=false, roleSelected=new Set();
function renderRoles(){
  const rs=sortedRoles();
  document.getElementById('roleHeaderActions').innerHTML = roleSelectMode
    ? `<button class="gbtn" id="roleSelCancel">取消</button>
       <button class="gbtn warn" id="roleSelDelete" ${roleSelected.size?'':'disabled'}
         style="${roleSelected.size?'color:#fff;background:var(--danger);border-color:var(--danger)':''}">刪除${roleSelected.size?` (${roleSelected.size})`:''}</button>`
    : `<button class="gbtn" id="roleSelStart" ${rs.length?'':'disabled'}>勾選管理</button>
       <button class="gbtn" data-act="addExpansionRole">＋ 擴充職業</button>
       <button class="gbtn accent" data-act="addRole">＋ 新增職業</button>`;

  const host=document.getElementById('roleList');
  if(!rs.length){ host.innerHTML=`<div class="emptystate"><b>還沒有職業</b>先建立職業，排班時才能指定。</div>`; return; }
  host.innerHTML=`<div class="list">`+rs.map((r,i)=>{
    const checked=roleSelected.has(r.id);
    return `
    <div class="row ${roleSelectMode?'row-selectable':''}" ${roleSelectMode?`data-act="toggleRoleSel" data-id="${r.id}"`:''}>
      ${roleSelectMode?`<span class="checkbox ${checked?'on':''}"></span>`:`<span class="swatch" style="background:${r.color}"></span>`}
      <div class="row-main" ${roleSelectMode?'':`data-act="editRole" data-id="${r.id}"`}>
        <div class="row-t">${esc(r.icon||'')}${esc(r.name)}</div>
        <div class="row-s">${r.buff?esc(r.buff):`排序 ${i+1}`}</div>
      </div>
      ${roleSelectMode?'':`
      <button class="icon-btn" data-act="roleUp" data-id="${r.id}" ${i===0?'disabled':''} aria-label="上移">
        <svg viewBox="0 0 24 24"><path d="M18 15l-6-6-6 6"/></svg></button>
      <button class="icon-btn" data-act="roleDown" data-id="${r.id}" ${i===rs.length-1?'disabled':''} aria-label="下移">
        <svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></button>`}
    </div>`;
  }).join('')+`</div>`;

  const start=document.getElementById('roleSelStart');
  if(start) start.onclick=()=>{ roleSelectMode=true; roleSelected=new Set(); renderRoles(); };
  const cancel=document.getElementById('roleSelCancel');
  if(cancel) cancel.onclick=()=>{ roleSelectMode=false; roleSelected=new Set(); renderRoles(); };
  const del=document.getElementById('roleSelDelete');
  if(del) del.onclick=()=>{
    if(!roleSelected.size) return;
    const ids=[...roleSelected], names=ids.map(id=>roleById(id)?.name).filter(Boolean).join('、');
    confirmSheet(`刪除「${names}」共 ${ids.length} 個職業？已指定這些職業的人會變成未指定。`, ()=>{
      commit(()=>{
        state.roles=state.roles.filter(x=>!ids.includes(x.id));
        Object.values(state.schedule).forEach(ps=>ps.forEach(p=>p.slots.forEach(sl=>{ if(ids.includes(sl.roleId)) sl.roleId=null; })));
        state.members.forEach(m=>{ if(ids.includes(m.defaultRoleId)) m.defaultRoleId=null; });
      });
      roleSelectMode=false; roleSelected=new Set(); render();
    });
  };
}

