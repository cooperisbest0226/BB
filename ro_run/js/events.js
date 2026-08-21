/* 星座塔團隊 — 全域事件綁定與 PWA 更新流程
   這個檔案是從原本的單一 index.html 拆出來的，載入順序有相依性，
   請維持 index.html 裡的 <script> 排列順序。 */
/* ══════════════════════════════════════════════════════════
   事件綁定
   ══════════════════════════════════════════════════════════ */
document.addEventListener('click',e=>{
  const chip=e.target.closest('[data-date]');
  if(chip){ curDate=chip.dataset.date; picked=null; render(); return; }
  const t=e.target.closest('.tab');
  if(t){
    const from=activeViewId(), to=t.dataset.view, moved=from!==to;
    /* 各分頁記住自己的捲動位置。以前切分頁時整頁的捲動位置是共用的，
       在陣容往下捲之後切到成員，畫面會停在半空中，最上面的子分頁按鈕看不到。
       點目前這一頁不算切換，位置不動（也不要吃掉重畫）。 */
    if(moved) viewScroll[from]=window.scrollY;
    document.querySelectorAll('.tab').forEach(x=>x.setAttribute('aria-selected',x===t));
    document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+t.dataset.view));
    const onBoard=to==='board';
    document.getElementById('bench').classList.toggle('hidden',!onBoard);
    /* 切過去的分頁如果在背景時有資料異動，這時才補畫（見 renderActiveView 的說明） */
    renderActiveView();
    /* 等這一輪版面完成再捲，不然高度還沒定，捲過去會被夾到錯的位置 */
    if(moved) requestAnimationFrame(()=>window.scrollTo(0, viewScroll[to]||0));
    return;
  }
  const btn=e.target.closest('[data-act]'); if(!btn) return;
  const a=btn.dataset.act, id=btn.dataset.id, ptId=btn.dataset.pt, i=+btn.dataset.i;
  if(a==='role')      rolePickSheet(ptId,i);
  if(a==='slotBuff'){
    const p=ptsOf(curDate).find(x=>x.id===ptId), sl=p&&p.slots[i];
    if(sl){
      if(!sl.roleId) toast('請先指定職業');
      else memberBuffSheet(sl.memberId, sl.roleId);
    }
  }
  if(a==='unassign')  commit(()=>{ const p=ptsOf(curDate).find(x=>x.id===ptId); p.slots.splice(i,1); });
  if(a==='toggleBento') commit(()=>{ const p=ptsOf(curDate).find(x=>x.id===ptId); const s=p.slots[i]; s.bento=!s.bento; });
  if(a==='orderPt')   orderSheet(ptId);
  if(a==='addDrop')   dropsSheet(ptId);
  if(a==='editDrop')  dropsSheet(ptId);
  if(a==='review')    reviewSheet(ptId,0);
  /* 材料頁的場次明細：展開／收合某一天 */
  if(a==='matDay'){
    const k=btn.dataset.day;
    if(matOpenDays.has(k)) matOpenDays.delete(k); else matOpenDays.add(k);
    renderMaterials();
  }
  /* 一次展開／收合全部日期。展開時只加入「目前範圍內」的日期，
     不去動範圍外的既有狀態，切回其他篩選時原本開著的那幾天還在。 */
  if(a==='matDayAll'){
    const keys=[...document.querySelectorAll('#matDetail .mday-h')].map(x=>x.dataset.day);
    if(btn.dataset.all==='close') keys.forEach(k=>matOpenDays.delete(k));
    else keys.forEach(k=>matOpenDays.add(k));
    renderMaterials();
  }
  /* 在明細發現數字記錯時直接改，不用自己切回陣容頁翻到那天那場。
     這裡的場次可能不是「目前這天」，所以要把日期一起帶進去。 */
  if(a==='editRunDrops') dropsSheet(ptId, btn.dataset.day);
  if(a==='delSale')   confirmSheet('確定要刪除這筆交易紀錄嗎？',()=>{
    commitUndoable('交易紀錄',()=>{ state.sales=(state.sales||[]).filter(s=>s.id!==id); });
  });
  if(a==='editSale')  saleSheet(id);
  if(a==='editPt')    ptSheet(ptId);
  if(a==='dupPt'){
    /* 複製 RUN：成員、職業、便當標記都要帶過去；
       掉落物與錄影連結是「這一場實際發生了什麼」的紀錄，複本不該憑空多出一份，所以清空。 */
    commit(()=>{ const p=ptsOf(curDate).find(x=>x.id===ptId); if(!p) return;
      const copy=JSON.parse(JSON.stringify(p));
      copy.id=uid();
      copy.name=p.name+' 複本';
      copy.slots=(p.slots||[]).map(s=>({memberId:s.memberId,roleId:s.roleId??null,bento:!!s.bento}));
      copy.drops=[]; copy.videos=[];
      state.schedule[curDate].push(copy); });
  }
  if(a==='delPt'){
    const p=ptsOf(curDate).find(x=>x.id===ptId);
    /* 只寫「刪除 RUN 1？」看不出裡面有什麼會一起消失——掉落紀錄會連帶影響材料統計，
       錄影連結刪了也救不回來，所以在確認訊息裡直接列出來。 */
    const inside=[
      p.slots.length?`${p.slots.length} 個排班位子`:'',
      (p.drops&&p.drops.length)?`${p.drops.length} 筆掉落紀錄`:'',
      (p.videos&&p.videos.length)?`${p.videos.length} 個錄影連結`:'',
    ].filter(Boolean).join('、');
    confirmSheet(`刪除「${p.name}」？${inside?`\n含 ${inside}。`:''}`, ()=>{
      commitUndoable(`「${p.name}」`,()=>{ state.schedule[curDate]=ptsOf(curDate).filter(x=>x.id!==ptId); });
    });
  }
  if(a==='editMember') memberSheet(id);
  if(a==='editRole')   roleSheet(id);
  if(a==='addRole')    roleSheet(null);
  if(a==='addExpansionRole') expansionRoleSheet();
  if(a==='toggleRoleSel'){
    if(roleSelected.has(id)) roleSelected.delete(id); else roleSelected.add(id);
    renderRoles();
  }
  if(a==='roleUp'||a==='roleDown'){
    commit(()=>{
      const rs=sortedRoles(), i2=rs.findIndex(r=>r.id===id), j=a==='roleUp'?i2-1:i2+1;
      if(j<0||j>=rs.length) return;
      [rs[i2].order,rs[j].order]=[rs[j].order,rs[i2].order];
    });
  }
});

document.getElementById('btnMore').onclick=moreSheet;
document.getElementById('btnAddDate').onclick=dateSheet;
document.getElementById('btnEditDate').onclick=editDateSheet;
document.getElementById('btnToday').onclick=()=>{
  const tk=todayKey();
  if(!state.schedule[tk]) return toast('今天還沒有建立排班，可以點「＋ 新增日期」建立');
  curDate=tk; picked=null; render();
};
document.getElementById('btnDelDate').onclick=()=>{
  if(dates().length<=1) return toast('至少要保留一天');
  const target=curDate;
  const pts=ptsOf(target);
  const slotCount=pts.reduce((a,p)=>a+p.slots.length,0);
  const dropCount=pts.reduce((a,p)=>a+((p.drops&&p.drops.length)||0),0);
  const vidCount=pts.reduce((a,p)=>a+((p.videos&&p.videos.length)||0),0);
  confirmSheet(
    `刪除 ${fmtDate(target)}（${fmtDow(target)}）這天的所有資料？\n`+
    `含 ${pts.length} 個 RUN、${slotCount} 個排班位子${dropCount?`、${dropCount} 筆掉落紀錄`:''}${vidCount?`、${vidCount} 個錄影連結`:''}。\n`+
    `刪除後材料統計也會少掉這天的數據。`,
    ()=>{
      commitUndoable(`${fmtDate(target)} 這天的資料`,()=>{ delete state.schedule[target]; curDate=null; });
    });
};
document.getElementById('btnAddPt').onclick=()=>ptSheet(null);
document.getElementById('btnDayTime').onclick=()=>{
  if(!curDate) return toast('請先選一個日期');
  dayTimeSheet();
};
document.getElementById('btnAddMember').onclick=()=>memberSheet(null);
document.getElementById('memberSearch').oninput=renderMembers;
document.getElementById('btnPrevDate').onclick=()=>{ const ks=dates(),i=ks.indexOf(curDate); if(i>0){curDate=ks[i-1];render();} };
document.getElementById('btnNextDate').onclick=()=>{ const ks=dates(),i=ks.indexOf(curDate); if(i<ks.length-1){curDate=ks[i+1];render();} };

document.getElementById('btnClearDay').onclick=()=>{
  if(!assignedIds(curDate).size) return toast('本日還沒有排班');
  confirmSheet(`清空 ${fmtDate(curDate)} 所有 RUN 的成員？RUN 本身會保留。`, ()=>{
    commitUndoable('本日排班',()=>{ ptsOf(curDate).forEach(p=>p.slots=[]); });
  });
};

/* iOS Safari（尤其 standalone PWA）鍵盤彈出時不會縮小 fixed 元素所依據的 layout viewport，
   改用 visualViewport 動態量測可視高度／位移，寫進 --vvh／--vvtop，讓 sheet／scrim 貼齊實際看得到的範圍，
   避免鍵盤蓋住輸入欄或畫面被鍵盤頂到跑版。 */
function syncVVH(){
  const vv=window.visualViewport;
  const h=(vv&&vv.height)||window.innerHeight;
  const top=(vv&&vv.offsetTop)||0;
  document.documentElement.style.setProperty('--vvh',h+'px');
  document.documentElement.style.setProperty('--vvtop',top+'px');
}
syncVVH();
let focusedField=null;
document.addEventListener('focusin',e=>{
  if(e.target.matches('input,textarea,select')) focusedField=e.target;
});
document.addEventListener('focusout',e=>{
  if(e.target===focusedField) focusedField=null;
});
/* 只在 visualViewport 真的因鍵盤而變化「之後」才校正一次位置，
   不用猜時間的 setTimeout（會跟 iOS 原生的捲動打架，越修越跑版）。 */
if(window.visualViewport){
  window.visualViewport.addEventListener('resize',()=>{
    syncVVH();
    if(focusedField&&document.activeElement===focusedField){
      focusedField.scrollIntoView({block:'nearest'});
    }
  });
  window.visualViewport.addEventListener('scroll',syncVVH);
}else{
  window.addEventListener('resize',syncVVH);
}


/* ── PWA 更新流程 ─────────────────────────────────────────
   sw.js 的 install 不再自動 skipWaiting，新版會停在 waiting 狀態等使用者確認。
   偵測到有 waiting 的 worker 就在畫面底部顯示提示，使用者按了才真的換版，
   避免編輯到一半被抽換成新版（舊 index.html 配新 styles.css 的混搭狀態）。 */
/* ── 安裝到主畫面 ─────────────────────────────────────────
   這件事不只是方便：Safari 對一般瀏覽器分頁有「7 天沒互動就清掉 script-writable
   storage」的規則，加到主畫面的 PWA 不受此限；Chrome 也把「是否已安裝」列入
   要不要給持久化儲存的判斷。所以裝到主畫面 = 資料比較不容易被清掉。 */
let installPrompt=null;
addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();          // 擋掉瀏覽器自己的迷你提示，改由我們挑時機
  installPrompt=e;
  maybeShowInstallBar();
});
addEventListener('appinstalled',()=>{
  installPrompt=null;
  document.getElementById('installBar')?.remove();
  /* 安裝後再要一次持久化——這時候拿到的機率比在分頁裡高很多 */
  ensurePersistentStorage();
});

const INSTALL_DISMISS_KEY='star-tower-install-dismissed';
function maybeShowInstallBar(){
  if(!installPrompt || isStandalone()) return;
  try{ if(localStorage.getItem(INSTALL_DISMISS_KEY)) return; }catch(e){}
  if(document.getElementById('installBar')) return;
  const bar=document.createElement('div');
  bar.id='installBar'; bar.className='updatebar';
  bar.innerHTML=`<span>加到主畫面，資料更不易被清除</span>
    <button class="updatebar-go">安裝</button>
    <button class="updatebar-x" aria-label="不要再顯示">×</button>`;
  bar.querySelector('.updatebar-go').onclick=async()=>{
    bar.querySelector('.updatebar-go').disabled=true;
    try{ await installPrompt.prompt(); }catch(e){}
    installPrompt=null; bar.remove();
  };
  bar.querySelector('.updatebar-x').onclick=()=>{
    try{ localStorage.setItem(INSTALL_DISMISS_KEY,'1'); }catch(e){}
    bar.remove();
  };
  document.body.appendChild(bar);
  requestAnimationFrame(()=>bar.classList.add('in'));
}

let swReg=null, swReloading=false;

function showUpdateBar(worker){
  if(document.getElementById('updateBar')) return;
  const bar=document.createElement('div');
  bar.id='updateBar'; bar.className='updatebar';
  bar.innerHTML=`<span>有新版本</span>
    <button class="updatebar-go">立即更新</button>
    <button class="updatebar-x" aria-label="稍後再說">×</button>`;
  bar.querySelector('.updatebar-go').onclick=()=>{
    flushPersist();                       // 換版會重新整理，先把還沒落盤的異動存好
    bar.querySelector('.updatebar-go').disabled=true;
    worker.postMessage({type:'SKIP_WAITING'});
  };
  bar.querySelector('.updatebar-x').onclick=()=>bar.remove();
  document.body.appendChild(bar);
  requestAnimationFrame(()=>bar.classList.add('in'));
}

function watchWorker(reg){
  if(reg.waiting) showUpdateBar(reg.waiting);
  reg.addEventListener('updatefound',()=>{
    const nw=reg.installing; if(!nw) return;
    nw.addEventListener('statechange',()=>{
      /* 只有「已經有舊版在跑」時才提示；第一次安裝沒有舊版可換，不需要打擾 */
      if(nw.state==='installed' && navigator.serviceWorker.controller) showUpdateBar(nw);
    });
  });
}

if('serviceWorker' in navigator){
  window.addEventListener('load',async()=>{
    try{
      swReg=await navigator.serviceWorker.register('./sw.js');
      watchWorker(swReg);
    }catch(e){}
  });
  /* 第一次安裝時頁面本來就沒有 controller，activate 的 clients.claim() 也會觸發
     controllerchange —— 那不是「換版」，重整只是白白閃一下（在測試裡還會把執行到一半的
     操作打斷）。所以只有「本來就有舊版在跑」時才需要重整。 */
  const hadController=!!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(!hadController||swReloading) return;
    swReloading=true;
    location.reload();
  });
}

