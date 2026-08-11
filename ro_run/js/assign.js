/* 星座塔團隊 — 指派 / 移動，以及全螢幕排序編輯器
   這個檔案是從原本的單一 index.html 拆出來的，載入順序有相依性，
   請維持 index.html 裡的 <script> 排列順序。 */
/* ══════════════════════════════════════════════════════════
   指派 / 移動
   ══════════════════════════════════════════════════════════ */
function assign(memberId, ptId){
  commit(()=>{
    const pt=ptsOf(curDate).find(p=>p.id===ptId); if(!pt) return;
    if(pt.slots.length>=pt.capacity){ toast(`${pt.name} 已滿`); return; }
    const m=memberById(memberId);
    pt.slots.push({memberId, roleId:m?.defaultRoleId||null});
  });
  picked=null;
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
  if(!d.moved){ tapChip(d.id); return; }
  const t=dropTargetAt(e.clientX,e.clientY);
  if(!t) return;
  if(t.dataset.drop==='bench'){ if(d.from!=='bench') unassign(d.from,d.si); }
  else if(t.dataset.pt!==d.from) assign(d.id,t.dataset.pt);
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

function dropTargetAt(x,y){
  const el=document.elementFromPoint(x,y);
  return el?el.closest('[data-drop]'):null;
}
/* 點一下＝選取，再點隊伍卡片＝加入 */
function tapChip(id){
  if(picked===id){ picked=null; }
  else if(picked===null){ picked=id; toast('已選取 — 點一下 RUN 加入'); }
  else { picked=id; }
  renderBench();
}
document.addEventListener('click',e=>{
  if(!picked) return;
  if(e.target.closest('[data-chip]')) return; // 這個點擊已經由 pointerup 的 tapChip() 處理過，不要再重複指派
  const card=e.target.closest('[data-drop="pt"]');
  if(card&&!e.target.closest('button[data-act]')) assign(picked,card.dataset.pt);
});

