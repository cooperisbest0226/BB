/* 星座塔團隊 — 全域事件綁定與 PWA 更新流程
   這個檔案是從原本的單一 index.html 拆出來的，載入順序有相依性，
   請維持 index.html 裡的 <script> 排列順序。 */
/* ══════════════════════════════════════════════════════════
   事件綁定
   ══════════════════════════════════════════════════════════ */
document.addEventListener('click',e=>{
  const chip=e.target.closest('[data-date]');
  if(chip){ curDate=chip.dataset.date; picked=null; pickedFrom=null; render(); return; }
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
    /* 選到一半切走分頁：底部的放置列只屬於陣容頁，選取一併取消，切回來不會莫名其妙還選著 */
    if(moved && !onBoard && picked!==null){ picked=null; pickedFrom=null; }
    renderPickBar();
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
  /* 展開／收合翻車卡片的封條 */
  if(a==='wipeOpen'){
    if(wipeOpen.has(ptId)) wipeOpen.delete(ptId); else wipeOpen.add(ptId);
    renderBoard();
  }
  /* 翻車標記。改回通關直接切換 —— 誤按的代價只是再按一次。
     但標記為翻車會清掉已記錄的掉落物，那是會弄丟資料的操作，所以要確認 + 可復原。
     為什麼要清：分潤本來就當翻車沒有掉落（「沒有東西可以分」），
     但材料統計以前照算，於是同一批材料會出現在材料頁、卻拿不到分潤。
     兩邊講不同的話，對帳的人只能自己猜哪個是真的。 */
  if(a==='toggleWipe'){
    const p0=ptsOf(curDate).find(x=>x.id===ptId); if(!p0) return;
    const markWipe=!p0.wipe, dn=(p0.drops||[]).length;
    const apply=()=>{
      if(markWipe && dn){
        /* 訊息交給 commitUndoable 一起發，不要在後面再 toast 一次 —— 那會蓋掉「復原」 */
        commitUndoable('',()=>{
          const p=ptsOf(curDate).find(x=>x.id===ptId);
          if(p){ p.wipe=true; p.drops=[]; }
        }, `${p0.name} 已標記為翻車，清掉 ${dn} 筆掉落`);
      }else{
        commit(()=>{ const p=ptsOf(curDate).find(x=>x.id===ptId); if(p) p.wipe=markWipe; });
        toast(markWipe?`${p0.name} 已標記為翻車`:`${p0.name} 已改回通關`);
      }
      if(!markWipe) wipeOpen.delete(ptId);
    };
    if(markWipe && dn)
      confirmSheet(`標記「${p0.name}」為翻車？\n已記錄的 ${dn} 筆掉落物會一併清除。`, apply, '標記翻車');
    else apply();
  }
  if(a==='orderPt')   orderSheet(ptId);
  if(a==='addDate')   dateSheet();
  if(a==='dropToggle'){
    if(dropOpen.has(ptId)) dropOpen.delete(ptId); else dropOpen.add(ptId);
    renderBoard();
  }
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
  /* 場次明細：精簡列 ↔ 逐項標籤 */
  if(a==='mrunPills'){
    const k=btn.dataset.key;
    if(matRunPills.has(k)) matRunPills.delete(k); else matRunPills.add(k);
    renderMaterials();
  }
  /* 成交紀錄往前多載幾個月。每按一次多開同樣的區間，
     不是一次全開 —— 一次全開等於把剛剛省下的成本原封不動還回去。 */
  if(a==='ledgerMore'){ ledgerMonths+=LEDGER_MONTHS; renderSales(); }
  if(a==='delSale')   confirmSheet('確定要刪除這筆交易紀錄嗎？',()=>{
    commitUndoable('交易紀錄',()=>{ state.sales=(state.sales||[]).filter(s=>s.id!==id); });
  });
  if(a==='editSale')  saleSheet(id);
  if(a==='editPt')    ptSheet(ptId);
  if(a==='dupPt'){
    /* 複製 RUN：成員、職業、便當標記都要帶過去；
       掉落物、錄影連結與翻車標記都是「這一場實際發生了什麼」的紀錄，
       複本是還沒打的場次，不該憑空繼承一份結果，所以一律清空。 */
    commit(()=>{ const p=ptsOf(curDate).find(x=>x.id===ptId); if(!p) return;
      const copy=JSON.parse(JSON.stringify(p));
      copy.id=uid();
      copy.name=p.name+' 複本';
      copy.slots=(p.slots||[]).map(s=>({memberId:s.memberId,roleId:s.roleId??null,bento:!!s.bento}));
      copy.drops=[]; copy.videos=[]; copy.wipe=false;
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
});

document.getElementById('btnMore').onclick=moreSheet;
/* 日期的次要操作（回到今天、修改、刪除）收進「⋯」：這三個都不常用，
   以前跟前後箭頭一起獨立佔一整排，陣容卡被往下推了 60px。
   前後箭頭拿掉了——日期列本身就能左右滑，點哪天就是哪天。 */
document.getElementById('btnDateMore').onclick=()=>dateMoreSheet();
function goToday(){
  const tk=todayKey();
  if(!state.schedule[tk]) return toast('今天還沒有建立排班，可以點日期列最後的「＋」建立');
  curDate=tk; picked=null; pickedFrom=null; render();
}
function dateMoreSheet(){
  const tk=todayKey(), onToday=curDate===tk, hasToday=!!state.schedule[tk];
  const ic=d=>`<svg viewBox="0 0 24 24">${d}</svg>`;
  sheet(`${fmtDate(curDate)} ${fmtDow(curDate)}`,`
    <div class="settings-group">
      <button class="settings-row" id="btnToday" ${onToday?'disabled':''}>
        <span class="settings-ic" style="color:var(--accent);background:var(--accent-soft)">${ic('<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18"/><path d="M8 3v4"/><path d="M16 3v4"/>')}</span>
        <span class="settings-tx"><span class="settings-t">回到今天</span>
          <span class="settings-d">${onToday?'目前就在今天':hasToday?fmtDate(tk)+' '+fmtDow(tk):'今天還沒有建立排班'}</span></span>
      </button>
      <button class="settings-row" id="btnEditDate">
        <span class="settings-ic" style="color:var(--ink-2);background:var(--surface-2)">${ic('<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>')}</span>
        <span class="settings-tx"><span class="settings-t">修改日期</span><span class="settings-d">整天的 RUN、排班與集合時間一起搬到另一天</span></span>
      </button>
      <button class="settings-row" id="btnDelDate">
        <span class="settings-ic" style="color:var(--danger);background:rgba(220,38,38,.1)">${ic('<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>')}</span>
        <span class="settings-tx"><span class="settings-t" style="color:var(--danger)">刪除這天</span><span class="settings-d">會先確認，刪除後可以復原</span></span>
      </button>
    </div>
    <div class="sheet-foot"><button class="gbtn" data-s="cancel">關閉</button></div>`, s=>{
    s.querySelector('#btnToday').onclick=()=>{ closeSheet(); goToday(); };
    s.querySelector('#btnEditDate').onclick=()=>editDateSheet();
    s.querySelector('#btnDelDate').onclick=()=>{ closeSheet(); deleteCurDate(); };
    s.querySelector('[data-s="cancel"]').onclick=closeSheet;
  });
}
function deleteCurDate(){
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
      commitUndoable(`${fmtDate(target)} 這天的資料`,()=>{
        delete state.schedule[target];
        /* 時間跟著日期走：留著的話，之後重建同一天會吃到這個舊時間 */
        if(state.dayTimes) delete state.dayTimes[target];
        curDate=null;
      });
    });
};
document.getElementById('btnAddPt').onclick=()=>ptSheet(null);
document.getElementById('btnDayTime').onclick=()=>{
  if(!curDate) return toast('請先選一個日期');
  dayTimeSheet();
};
document.getElementById('btnAddMember').onclick=()=>memberSheet(null);
document.getElementById('memberSearch').oninput=renderMembers;

/* 底部放置列：點場次名稱就放進去（加入或移動），× 取消選取 */
document.getElementById('pickBar').addEventListener('click',e=>{
  if(e.target.closest('[data-pickcancel]')){ clearPick(); return; }
  const b=e.target.closest('[data-pickto]'); if(!b||b.disabled||picked===null) return;
  if(pickedFrom) moveSlot(pickedFrom.pt, pickedFrom.si, b.dataset.pickto, picked);
  else assign(picked, b.dataset.pickto);
});

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


/* ── 未攔截的錯誤 ─────────────────────────────────────────
   這個 App 沒有後端，也沒有人會去看手機的開發者主控台。
   在沒有這段之前，只要繪製途中丟出例外，畫面就停在改到一半的狀態不動 ——
   使用者看到的是「按了沒反應」，然後很合理地再按一次、再按一次，
   而真正的錯誤訊息只留在他打不開的主控台裡。

   這裡不試圖修復什麼，只做一件事：讓錯誤是看得見的，
   並且告訴使用者「資料還在」——因為當下最該知道的就是這件事。
   同一次開啟只提示三次就停，連續失敗時洗版的 toast 比沉默更難用。 */
let errShown=0;
function reportError(err){
  if(errShown>=3) return;
  errShown++;
  const msg=(err&&(err.message||err.reason&&err.reason.message))||String(err&&err.reason||err||'');
  /* 先寫進主控台（電腦上接手機除錯時看得到完整堆疊），再用 toast 告訴使用者 */
  console.error('[星座塔團隊]',err);
  toast(`發生錯誤，資料仍在：${String(msg).slice(0,60)}`);
  if(errShown===3) setTimeout(()=>toast('錯誤重複發生，建議先匯出備份再重新開啟'),3000);
}
addEventListener('error',e=>reportError(e.error||e));
addEventListener('unhandledrejection',e=>reportError(e));
