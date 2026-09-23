/* 星座塔團隊 — 指派 / 移動，以及全螢幕排序編輯器
   這個檔案是從原本的單一 index.html 拆出來的，載入順序有相依性，
   請維持 index.html 裡的 <script> 排列順序。 */
/* ══════════════════════════════════════════════════════════
   指派 / 移動
   ══════════════════════════════════════════════════════════ */
function assign(memberId, ptId){
  /* 翻車的場次已經定案，不收人。擋在這裡而不是各個入口，是因為拖曳與點選
     最後都走這個函式；擋在入口就得記得每加一個入口都要再擋一次。 */
  const target=ptsOf(curDate).find(p=>p.id===ptId);
  if(target&&isWipe(target)){ toast(`${target.name} 已標記翻車，要改先點回通關`); picked=null; renderBench(); return; }
  /* 選取要在重繪「之前」清掉：commit() 裡的 render() 會順便畫底部的放置列，
     晚一步清的話，人已經放進去了、放置列卻還開著 */
  picked=null; pickedFrom=null;
  commit(()=>{
    const pt=ptsOf(curDate).find(p=>p.id===ptId); if(!pt) return;
    if(pt.slots.length>=pt.capacity){ toast(`${pt.name} 已滿`); return; }
    const m=memberById(memberId);
    pt.slots.push({memberId, roleId:m?.defaultRoleId||null});
  });
}
/* 把某場的某一格整格搬到另一場：職業與便當標記一起帶走。
   以前跨 RUN 拖曳走的是 assign()，等於「複製」—— 原場次還留著這個人，
   而且新位子的職業被重設成他的預設職業，手動指定過的職業就不見了。
   現在從 RUN 拿起來放到另一個 RUN 是「移動」；要讓同一個人跑兩場，從上方成員列拖。
   si 是位子的 index（同一人可能在同一場佔兩格），memberId 用來確認那一格沒有被換掉。 */
function moveSlot(fromPtId, si, toPtId, memberId){
  const pts=ptsOf(curDate);
  const src=pts.find(p=>p.id===fromPtId), dst=pts.find(p=>p.id===toPtId);
  const i=+si, slot=src&&src.slots[i];
  const drop=()=>{ picked=null; pickedFrom=null; renderBench(); renderBoard(); };
  if(!src||!dst||!slot||(memberId&&slot.memberId!==memberId)) return drop();
  if(fromPtId===toPtId) return drop();
  /* 翻車的場次已經定案：拿不出來，也放不進去 */
  const locked=[src,dst].find(isWipe);
  if(locked){ toast(`${locked.name} 已標記翻車，要改先點回通關`); return drop(); }
  if(dst.slots.length>=dst.capacity){ toast(`${dst.name} 已滿`); return drop(); }
  picked=null; pickedFrom=null;   // 同 assign()：先清再重繪
  commit(()=>{
    const [s]=src.slots.splice(i,1);
    dst.slots.push(s);
  });
}
/* 依「拖曳來源那一個 slot 的 index」移除，不是依 memberId —
   同一人可以在同一場 RUN 裡重複出現（雙開/多開），用 index 才不會一次把全部重複的都移掉 */
function unassign(ptId, si){
  commit(()=>{
    const pt=ptsOf(curDate).find(p=>p.id===ptId); if(!pt) return;
    const i=+si;
    if(Number.isInteger(i)&&pt.slots[i]!==undefined) pt.slots.splice(i,1);
  });
  picked=null;
}

/* ── 拖曳（滑鼠與觸控通用，用 pointer events） ─────────── */
let drag=null;
document.addEventListener('pointerdown',e=>{
  const chip=e.target.closest('[data-chip]');
  if(!chip||e.target.closest('button[data-act]')) return;
  drag={id:chip.dataset.chip, from:chip.dataset.from, si:chip.dataset.si, x:e.clientX, y:e.clientY, el:chip, moved:false, ghost:null};
});
document.addEventListener('pointermove',e=>{
  if(!drag) return;
  if(!drag.moved){
    const dx=e.clientX-drag.x, dy=e.clientY-drag.y;
    if(Math.hypot(dx,dy)<7) return;
    /* 從 bench 橫向捲動列拿起的 chip：如果這一動主要是左右方向，
       判斷成使用者只是想橫向捲動找人，不是要拖曳指派 —— 放手讓瀏覽器原生橫向捲動接手，
       這樣成員一多、bench 要左右捲才能找到人時，捲動才不會被誤判成拖曳。 */
    if(drag.from==='bench' && Math.abs(dx)>Math.abs(dy)*1.2){ drag=null; return; }
    drag.moved=true; drag.el.classList.add('dragging');
    const m=memberById(drag.id);
    const g=document.createElement('div'); g.className='drag-ghost'; g.textContent=m?m.name:'';
    document.body.appendChild(g); drag.ghost=g;
  }
  drag.ghost.style.left=e.clientX+'px'; drag.ghost.style.top=e.clientY+'px';
  document.querySelectorAll('.drop-on').forEach(el=>el.classList.remove('drop-on'));
  const t=dropTargetAt(e.clientX,e.clientY);
  if(t) t.classList.add('drop-on');
});
document.addEventListener('pointerup',e=>{
  if(!drag) return;
  const d=drag; drag=null;
  document.querySelectorAll('.drop-on').forEach(el=>el.classList.remove('drop-on'));
  d.el.classList.remove('dragging');
  if(d.ghost) d.ghost.remove();
  if(!d.moved){ tapChip(d.id, d.from, d.si); return; }
  const t=dropTargetAt(e.clientX,e.clientY);
  if(!t) return;
  if(t.dataset.drop==='bench'){ if(d.from!=='bench') unassign(d.from,d.si); }
  else if(d.from==='bench') assign(d.id,t.dataset.pt);          // 從成員列拖進來：加入
  else if(t.dataset.pt!==d.from) moveSlot(d.from,d.si,t.dataset.pt,d.id);  // 從別場拖過來：移動
});
document.addEventListener('pointercancel',()=>{
  if(!drag) return;
  drag.el.classList.remove('dragging'); if(drag.ghost) drag.ghost.remove();
  document.querySelectorAll('.drop-on').forEach(el=>el.classList.remove('drop-on'));
  drag=null;
});
/* 把某個 RUN 裡的 slot 從 fromIndex 移到「hoverIndex 那格的前面/後面」——供下面的全螢幕排序編輯器使用 */
function reorderSlot(ptId, fromIndex, hoverIndex, before){
  commit(()=>{
    const p=ptsOf(curDate).find(x=>x.id===ptId); if(!p) return;
    if(!Number.isInteger(fromIndex)||!p.slots[fromIndex]) return;
    let insertBefore=before?hoverIndex:hoverIndex+1;
    if(insertBefore>fromIndex) insertBefore--;
    const [s]=p.slots.splice(fromIndex,1);
    p.slots.splice(insertBefore,0,s);
  });
}

/* ══════════════════════════════════════════════════════════
   全螢幕排序編輯器 —— 陣容分配清單裡的把手太小不好按，
   改成獨立的全螢幕畫面，大按鈕、按住直接拖到任意位子；
   便當也只有在這裡才能切換，平時清單不會一排都寫著「便當」。
   ══════════════════════════════════════════════════════════ */
function orderSheet(ptId){
  sheet('編輯順序', `<div class="order-hint">按住左邊的把手拖曳排序；按「便當」可標記只領材料的人員。</div><div class="order-list" id="orderList"></div>`, s=>{
    s.classList.add('sheet-full');
    const t=s.querySelector('.sheet-t');
    t.style.cssText='display:flex; align-items:center; justify-content:space-between';
    t.insertAdjacentHTML('beforeend','<button class="gbtn accent" style="padding:7px 16px;font-size:13.5px;flex:0 0 auto" id="orderDoneBtn">完成</button>');
    t.querySelector('#orderDoneBtn').onclick=closeSheet;
    renderOrderList(ptId);
  });
}
function renderOrderList(ptId){
  const host=document.getElementById('orderList'); if(!host) return;
  const pt=ptsOf(curDate).find(x=>x.id===ptId);
  if(!pt||!pt.slots.length){ closeSheet(); return; }
  host.innerHTML=pt.slots.map((s,si)=>{
    const m=memberById(s.memberId); if(!m) return '';
    return `<div class="order-row ${s.bento?'bento':''}" data-si="${si}">
      <div class="order-grip" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="9" cy="6" r="1.8"/><circle cx="15" cy="6" r="1.8"/><circle cx="9" cy="12" r="1.8"/><circle cx="15" cy="12" r="1.8"/><circle cx="9" cy="18" r="1.8"/><circle cx="15" cy="18" r="1.8"/></svg></div>
      <span class="order-name">${esc(m.name)}</span>
      <button class="order-bento" data-oact="bento" data-i="${si}">便當</button>
    </div>`;
  }).join('');
  bindOrderDrag(ptId);
}
let orderDrag=null;
function bindOrderDrag(ptId){
  const host=document.getElementById('orderList'); if(!host) return;
  host.onclick=e=>{
    const b=e.target.closest('[data-oact="bento"]'); if(!b) return;
    const i=+b.dataset.i;
    commit(()=>{ const p=ptsOf(curDate).find(x=>x.id===ptId); if(p&&p.slots[i]) p.slots[i].bento=!p.slots[i].bento; });
    renderOrderList(ptId);
  };
  host.querySelectorAll('.order-grip').forEach(grip=>{
    grip.onpointerdown=e=>{
      e.preventDefault();
      const row=grip.closest('.order-row');
      orderDrag={ptId, fromSi:+row.dataset.si, row, hoverSi:null, before:false, startY:e.clientY};
      row.classList.add('dragging');
    };
  });
}
document.addEventListener('pointermove',e=>{
  if(!orderDrag) return;
  const host=document.getElementById('orderList'); if(!host){ orderDrag=null; return; }
  orderDrag.row.style.transform=`translateY(${e.clientY-orderDrag.startY}px)`;
  host.querySelectorAll('.order-row.drop-before,.order-row.drop-after').forEach(el=>el.classList.remove('drop-before','drop-after'));
  const el=document.elementFromPoint(e.clientX,e.clientY)?.closest('.order-row');
  if(el && el!==orderDrag.row && el.closest('#orderList')===host){
    const rect=el.getBoundingClientRect();
    const before=e.clientY<rect.top+rect.height/2;
    el.classList.add(before?'drop-before':'drop-after');
    orderDrag.hoverSi=+el.dataset.si; orderDrag.before=before;
  } else { orderDrag.hoverSi=null; }
});
document.addEventListener('pointerup',()=>{
  if(!orderDrag) return;
  const d=orderDrag; orderDrag=null;
  d.row.classList.remove('dragging');
  d.row.style.transform='';
  document.querySelectorAll('.order-row.drop-before,.order-row.drop-after').forEach(el=>el.classList.remove('drop-before','drop-after'));
  if(d.hoverSi!=null && d.hoverSi!==d.fromSi) reorderSlot(d.ptId, d.fromSi, d.hoverSi, d.before);
  renderOrderList(d.ptId);
});
document.addEventListener('pointercancel',()=>{
  if(!orderDrag) return;
  orderDrag.row.classList.remove('dragging');
  orderDrag.row.style.transform='';
  document.querySelectorAll('.order-row.drop-before,.order-row.drop-after').forEach(el=>el.classList.remove('drop-before','drop-after'));
  orderDrag=null;
});

/* ── 職業列表拖曳排序 ─────────────────────────────────────
   以前每列一組上下箭頭，把第 13 個職業移到最上面要按 12 次。
   改成跟排序編輯器同一套：按住右邊的把手直接拖到位。 */
let roleDrag=null;
function bindRoleDrag(host){
  host.querySelectorAll('.role-grip').forEach(g=>{
    g.onpointerdown=e=>{
      e.preventDefault();
      const row=g.closest('[data-role-row]');
      roleDrag={id:row.dataset.roleRow, row, hover:null, before:false, startY:e.clientY};
      row.classList.add('dragging');
    };
  });
}
/* 把 id 這個職業移到 hoverId 的前面／後面，然後把 order 重新編成 0,1,2… */
function reorderRole(id, hoverId, before){
  commit(()=>{
    const rs=sortedRoles();
    const from=rs.findIndex(r=>r.id===id); if(from<0) return;
    const [moved]=rs.splice(from,1);
    let to=rs.findIndex(r=>r.id===hoverId); if(to<0) return;
    if(!before) to++;
    rs.splice(to,0,moved);
    rs.forEach((r,i)=>{ r.order=i; });
  });
}
document.addEventListener('pointermove',e=>{
  if(!roleDrag) return;
  const host=document.getElementById('roleList');
  roleDrag.row.style.transform=`translateY(${e.clientY-roleDrag.startY}px)`;
  host.querySelectorAll('.drop-before,.drop-after').forEach(el=>el.classList.remove('drop-before','drop-after'));
  const el=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-role-row]');
  if(el && el!==roleDrag.row && host.contains(el)){
    const rect=el.getBoundingClientRect(), before=e.clientY<rect.top+rect.height/2;
    el.classList.add(before?'drop-before':'drop-after');
    roleDrag.hover=el.dataset.roleRow; roleDrag.before=before;
  } else roleDrag.hover=null;
});
function endRoleDrag(commitIt){
  if(!roleDrag) return;
  const d=roleDrag; roleDrag=null;
  d.row.classList.remove('dragging'); d.row.style.transform='';
  document.querySelectorAll('#roleList .drop-before,#roleList .drop-after').forEach(el=>el.classList.remove('drop-before','drop-after'));
  if(commitIt && d.hover && d.hover!==d.id) reorderRole(d.id, d.hover, d.before);
}
document.addEventListener('pointerup',()=>endRoleDrag(true));
document.addEventListener('pointercancel',()=>endRoleDrag(false));

function dropTargetAt(x,y){
  const el=document.elementFromPoint(x,y);
  return el?el.closest('[data-drop]'):null;
}
/* 點一下＝選取，再點隊伍卡片＝加入（從成員列選的）或移過去（從某場 RUN 裡選的）。
   手機上拖曳 RUN 裡的人會變成捲動頁面，點選才是主要的操作方式，
   所以兩條路的語意要一樣：從 RUN 裡拿起來的，放到別場就是移動。 */
let pickedFrom=null;   // null＝從成員列選的；{pt, si}＝從某場 RUN 的某一格選的
function tapChip(id, from, si){
  const fromRun = from && from!=='bench' ? {pt:from, si:+si} : null;
  const same = picked===id &&
    (fromRun ? (pickedFrom&&pickedFrom.pt===fromRun.pt&&pickedFrom.si===fromRun.si) : !pickedFrom);
  if(same){ picked=null; pickedFrom=null; }
  else {
    /* 以前選取後跳一個 toast 教你「點一下 RUN 加入」；現在底部放置列本身就講清楚了 */
    picked=id; pickedFrom=fromRun;
  }
  renderBench(); renderBoard();
}
document.addEventListener('click',e=>{
  if(!picked) return;
  if(e.target.closest('[data-chip]')) return; // 這個點擊已經由 pointerup 的 tapChip() 處理過，不要再重複指派
  const card=e.target.closest('[data-drop="pt"]');
  if(!card||e.target.closest('button[data-act]')) return;
  if(pickedFrom) moveSlot(pickedFrom.pt, pickedFrom.si, card.dataset.pt, picked);
  else assign(picked,card.dataset.pt);
});

