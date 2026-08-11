/* 星座塔團隊 — Sheet 底部面板與所有設定、編輯、備份面板
   這個檔案是從原本的單一 index.html 拆出來的，載入順序有相依性，
   請維持 index.html 裡的 <script> 排列順序。 */
/* ══════════════════════════════════════════════════════════
   Sheet（底部彈出面板）
   ══════════════════════════════════════════════════════════ */
/* iOS Safari 在 fixed 定位的彈窗裡點輸入框時，就算容器是 fixed，
   還是會把「背後的頁面」往上捲動去對齊鍵盤，導致打字的地方被捲到看不見。
   開彈窗時把 body 鎖成 fixed（等於背後頁面不能捲），Safari 就沒有頁面可以捲了。 */
function lockBodyScroll(){
  if(document.body.style.position==='fixed') return;
  const y=window.scrollY||window.pageYOffset||0;
  document.body.dataset.scrollY=y;
  document.body.style.position='fixed';
  document.body.style.top=(-y)+'px';
  document.body.style.left='0';
  document.body.style.right='0';
  document.body.style.width='100%';
  document.body.style.overflow='hidden';
  document.documentElement.style.overflow='hidden';
}
function unlockBodyScroll(){
  if(document.body.style.position!=='fixed') return;
  const y=parseInt(document.body.dataset.scrollY||'0',10);
  document.body.style.position='';
  document.body.style.top='';
  document.body.style.left='';
  document.body.style.right='';
  document.body.style.width='';
  document.body.style.overflow='';
  document.documentElement.style.overflow='';
  delete document.body.dataset.scrollY;
  window.scrollTo(0,y);
}
function sheet(title, bodyHtml, onMount){
  const host=document.getElementById('sheetHost');
  lockBodyScroll();
  host.innerHTML=`<div class="scrim"><div class="sheet" role="dialog" aria-modal="true">
    <div class="grip"></div><div class="sheet-t">${esc(title)}</div>${bodyHtml}</div></div>`;
  const scrim=host.querySelector('.scrim');
  scrim.addEventListener('click',ev=>{ if(ev.target===scrim) closeSheet(); });
  document.addEventListener('keydown',escClose);
  onMount&&onMount(host.querySelector('.sheet'));
  const f=host.querySelector('input,textarea,select'); if(f&&window.innerWidth>760) f.focus();
}
function closeSheet(){ document.getElementById('sheetHost').innerHTML=''; document.removeEventListener('keydown',escClose); unlockBodyScroll(); }
function escClose(e){ if(e.key==='Escape') closeSheet(); }
const val=(s,n)=>s.querySelector(`[name="${n}"]`).value.trim();


/* 原生 confirm() 在 PWA 獨立模式下不一定會顯示，改用畫面內的確認卡片 */
function confirmSheet(message, onConfirm, confirmLabel){
  sheet('請確認',`
    <p style="font-size:13.5px; color:var(--ink-2); line-height:1.6; margin:0 0 16px; white-space:pre-line">${esc(message)}</p>
    <div class="sheet-foot">
      <button class="gbtn" data-s="no">取消</button>
      <button class="gbtn warn" data-s="yes" style="background:var(--danger);color:#fff;border-color:var(--danger)">${esc(confirmLabel||'確定刪除')}</button>
    </div>`,s=>{
    s.querySelector('[data-s="no"]').onclick=closeSheet;
    s.querySelector('[data-s="yes"]').onclick=()=>{ closeSheet(); onConfirm(); };
  });
}

function memberSheet(id){
  const m=id?memberById(id):{name:'',active:true,notes:'',defaultRoleId:null,buffs:{}};
  const opts=`<option value="">不指定</option>`+sortedRoles().map(r=>
    `<option value="${r.id}" ${m.defaultRoleId===r.id?'selected':''}>${esc(r.name)}</option>`).join('');
  /* 已設過覆蓋的職業 + 預設職業，都列出來讓人直接改（新成員還沒存檔，先不顯示） */
  const buffRoleIds=[...new Set([
    ...Object.keys(m.buffs||{}),
    ...(m.defaultRoleId?[m.defaultRoleId]:[]),
  ])].filter(rid=>roleById(rid));
  const buffRows = !id ? '' : `
    <div class="skillgrp">職業 BUFF</div>
    ${buffRoleIds.length ? buffRoleIds.map(rid=>{
      const r=roleById(rid), own=hasBuffOverride(m,rid), txt=buffFor(m,r);
      return `<button class="buffrow" data-buffrole="${rid}">
        <span class="buffrow-n" style="color:${r.color}">${esc(r.icon||'')}${esc(r.name)}</span>
        <span class="buffrow-v ${txt?'':'none'}">${txt?esc(txt):'未設定'}</span>
        <span class="buffrow-tag ${own?'own':''}">${own?'自訂':'預設'}</span>
      </button>`;
    }).join('') : `<p class="sheet-note">先指定預設職業，就能在這裡調整這個人的 BUFF。</p>`}
    <p class="sheet-note">「自訂」只影響這個人，不會動到職業預設或其他同職業的成員。</p>`;

  sheet(id?'編輯成員':'新增成員',`
    <div class="field"><label>名字</label><input name="name" value="${esc(m.name)}" placeholder="遊戲角色名"></div>
    <div class="field"><label>預設職業</label><select name="role">${opts}</select></div>
    <div class="field"><label>備註</label><input name="notes" value="${esc(m.notes)}" placeholder="選填"></div>
    <label class="toggle"><input type="checkbox" name="active" ${m.active?'checked':''}> 目前有在跑（停用後不會出現在成員名單）</label>
    ${buffRows}
    <div class="sheet-foot">
      ${id?'<button class="gbtn warn" data-s="del">刪除</button>':''}
      <button class="gbtn" data-s="cancel">取消</button>
      <button class="gbtn accent" data-s="save">儲存</button>
    </div>`,s=>{
    s.querySelectorAll('[data-buffrole]').forEach(b=>b.onclick=()=>{
      /* 先把面板上改過的欄位存起來再跳走，不然改到一半的名字／備註會不見 */
      commit(()=>{ Object.assign(memberById(id),{
        name:val(s,'name')||m.name, notes:val(s,'notes'),
        defaultRoleId:s.querySelector('[name="role"]').value||null,
        active:s.querySelector('[name="active"]').checked}); });
      memberBuffSheet(id, b.dataset.buffrole);
    });
    s.querySelector('[data-s="save"]').onclick=()=>{
      const name=val(s,'name'); if(!name) return toast('請輸入名字');
      commit(()=>{
        const d={name,notes:val(s,'notes'),
          defaultRoleId:s.querySelector('[name="role"]').value||null,
          active:s.querySelector('[name="active"]').checked};
        if(id) Object.assign(memberById(id),d); else state.members.push({id:uid(),buffs:{},...d});
      });
      closeSheet();
    };
    s.querySelector('[data-s="cancel"]').onclick=closeSheet;
    const del=s.querySelector('[data-s="del"]');
    if(del) del.onclick=()=>{
      confirmSheet(`刪除「${m.name}」？所有日期的排班紀錄也會一併移除。`, ()=>{
        commit(()=>{
          state.members=state.members.filter(x=>x.id!==id);
          Object.values(state.schedule).forEach(ps=>ps.forEach(p=>{p.slots=p.slots.filter(x=>x.memberId!==id);}));
        });
      });
    };
  });
}

/* draft：從 BUFF 選擇器返回時帶回尚未儲存的欄位值，避免挑完技能後前面填的東西不見 */
function roleSheet(id, draft){
  const base=id?roleById(id):{name:'',color:PALETTE[state.roles.length%PALETTE.length],icon:'',buff:''};
  const r=draft?{...base,...draft}:base;
  sheet(id?'編輯職業':'新增職業',`
    <div class="field-2">
      <div class="field"><label>名稱</label><input name="name" value="${esc(r.name)}" placeholder="例：妖術"></div>
      <div class="field"><label>圖示（選填）</label><input name="icon" value="${esc(r.icon)}" placeholder="🔮" maxlength="2"></div>
    </div>
    <div class="field"><label>顏色</label><div class="swatches">${PALETTE.map(c=>
      `<button class="sw-opt" data-c="${c}" style="background:${c}" aria-pressed="${c===r.color}"></button>`).join('')}</div></div>
    <div class="field">
      <label>技能 BUFF（會顯示在陣容分配的 RUN 上）</label>
      <input name="buff" value="${esc(r.buff||'')}" placeholder="例：攻擊 BUFF">
      <button class="gbtn" data-s="pick" style="margin-top:7px;width:100%;padding:10px;font-size:13px">＋ 從 RO 技能庫選擇</button>
    </div>
    <div class="sheet-foot">
      ${id?'<button class="gbtn warn" data-s="del">刪除</button>':''}
      <button class="gbtn" data-s="cancel">取消</button>
      <button class="gbtn accent" data-s="save">儲存</button>
    </div>`,s=>{
    let color=r.color;
    s.querySelectorAll('.sw-opt').forEach(b=>b.onclick=()=>{
      color=b.dataset.c;
      s.querySelectorAll('.sw-opt').forEach(x=>x.setAttribute('aria-pressed',x.dataset.c===color));
    });
    const snapshot=()=>({name:val(s,'name'),icon:val(s,'icon'),color,buff:val(s,'buff')});
    s.querySelector('[data-s="pick"]').onclick=()=>{
      const cur=snapshot();
      buffPickerSheet(cur.buff, cur.name,
        picked=>roleSheet(id,{...cur,buff:picked}),
        ()=>roleSheet(id,cur));
    };
    s.querySelector('[data-s="save"]').onclick=()=>{
      const name=val(s,'name'); if(!name) return toast('請輸入名稱');
      commit(()=>{
        const d={name,icon:val(s,'icon'),color,buff:val(s,'buff')};
        if(id) Object.assign(roleById(id),d);
        else state.roles.push({id:uid(),...d,order:state.roles.length});
      });
      closeSheet();
    };
    s.querySelector('[data-s="cancel"]').onclick=closeSheet;
    const del=s.querySelector('[data-s="del"]');
    if(del) del.onclick=()=>{
      confirmSheet(`刪除職業「${r.name}」？已指定這個職業的人會變成未指定。`, ()=>{
        commit(()=>{
          state.roles=state.roles.filter(x=>x.id!==id);
          Object.values(state.schedule).forEach(ps=>ps.forEach(p=>p.slots.forEach(sl=>{ if(sl.roleId===id) sl.roleId=null; })));
          state.members.forEach(m=>{ if(m.defaultRoleId===id) m.defaultRoleId=null; });
        });
      });
    };
  });
}

/* 某個成員「當某個職業時」的 BUFF。存在成員身上，所以改這裡不會動到職業預設，
   也不會影響其他同職業的人。draft 用來從技能選擇器返回時帶回還沒儲存的內容。 */
function memberBuffSheet(memberId, roleId, draft){
  const m=memberById(memberId), r=roleById(roleId);
  if(!m||!r) return;
  const own=hasBuffOverride(m,roleId);
  const cur = draft!==undefined ? draft : (own ? (m.buffs[roleId]||'') : (r.buff||''));
  sheet(`${m.name} · ${r.name} 的 BUFF`,`
    <div class="buffdefault">
      <span class="buffdefault-k">職業預設</span>
      <span class="buffdefault-v">${r.buff?esc(r.buff):'（未設定）'}</span>
    </div>
    <div class="field">
      <label>這個人的 BUFF
        <button class="minibtn" data-s="pick" type="button">從技能挑選</button>
      </label>
      <input name="buff" value="${esc(cur)}" placeholder="留空＝這個人不放 BUFF">
    </div>
    <p class="sheet-note">只會套用在「${esc(m.name)}」擔任「${esc(r.name)}」的時候，其他人與職業預設都不受影響。</p>
    <div class="sheet-foot">
      ${own?'<button class="gbtn warn" data-s="reset">還原成職業預設</button>':''}
      <button class="gbtn" data-s="cancel">取消</button>
      <button class="gbtn accent" data-s="save">儲存</button>
    </div>`, s=>{
    s.querySelector('[data-s="pick"]').onclick=()=>{
      const typed=val(s,'buff');
      buffPickerSheet(typed, r.name,
        picked=>memberBuffSheet(memberId, roleId, picked),
        ()=>memberBuffSheet(memberId, roleId, typed));
    };
    s.querySelector('[data-s="save"]').onclick=()=>{
      const text=val(s,'buff');
      commit(()=>{ setBuffOverride(memberById(memberId), roleId, text); });
      closeSheet();
      toast('已更新這個人的 BUFF');
    };
    s.querySelector('[data-s="cancel"]').onclick=closeSheet;
    const rs=s.querySelector('[data-s="reset"]');
    if(rs) rs.onclick=()=>{
      commit(()=>{ clearBuffOverride(memberById(memberId), roleId); });
      closeSheet();
      toast('已還原成職業預設');
    };
  });
}

/* BUFF 技能選擇器：依職業列出整條轉職鏈的支援技能，可複選，結果用「、」串起來
   current：目前的 BUFF 文字（沿用既有的自由輸入內容，不會被洗掉）
   roleName：職業名稱，用來自動對應到 RO 職業 */
function buffPickerSheet(current, roleName, onApply, onCancel){
  const CATS=['初心者','一轉','二轉','轉生二轉','三轉','四轉','擴充職業'];
  const picks=(current||'').split('、').map(x=>x.trim()).filter(Boolean);
  const selected=new Set(picks);
  const pickable=roPickableJobs();
  let jobId=roJobIdByName(roleName);
  if(!jobId||!RO_JOBS[jobId]){
    const sameCat=jobId&&RO_JOBS[jobId]?pickable.find(j=>RO_JOBS[j].c===RO_JOBS[jobId].c):null;
    jobId=sameCat||pickable[0]||Object.keys(RO_JOBS)[0];
  }

  /* 下拉選單列出「全部」職業（不只是有 BUFF 的），這樣自己的職業一定找得到、選得到，
     就算這條轉職線目前沒收錄支援技能，也會清楚顯示原因，而不是整個從清單消失 */
  const opts=CATS.map(c=>{
    const list=Object.keys(RO_JOBS).filter(jid=>RO_JOBS[jid].c===c);
    if(!list.length) return '';
    return `<optgroup label="${c}">`+list.map(jid=>
      `<option value="${jid}" ${jid===jobId?'selected':''}>${esc(RO_JOBS[jid].n)}</option>`).join('')+`</optgroup>`;
  }).join('');

  sheet('選擇技能 BUFF',`
    <div class="field"><label>職業（會一併列出這條轉職線的支援技能）</label>
      <select name="job">${opts}</select></div>
    <div id="skillHost"></div>
    <div class="buffprev" id="buffPrev"></div>
    <div class="sheet-foot">
      <button class="gbtn" data-s="clear">清除</button>
      <button class="gbtn" data-s="cancel">取消</button>
      <button class="gbtn accent" data-s="apply">套用</button>
    </div>`,s=>{
    const host=s.querySelector('#skillHost'), prev=s.querySelector('#buffPrev');

    function paintPrev(){
      const arr=[...selected];
      prev.innerHTML=arr.length
        ? `<b>已選 ${arr.length} 個：</b>${esc(arr.join('、'))}`
        : `<span class="none">還沒選任何技能 — 點下方技能加入</span>`;
    }
    function paintSkills(){
      const chain=roJobChain(s.querySelector('[name="job"]').value);
      const groups=chain.filter(c=>RO_JOBS[c].s.length).map(c=>
        `<div class="skillgrp">${esc(RO_JOBS[c].n)}</div>
         <div class="skillgrid">${RO_JOBS[c].s.map(sk=>
           `<button class="skillpill" data-sk="${esc(sk)}" aria-pressed="${selected.has(sk)}">${esc(sk)}</button>`).join('')}</div>`).join('');
      host.innerHTML=groups||`<div class="bench-empty">這個職業沒有收錄支援類技能</div>`;
      host.querySelectorAll('[data-sk]').forEach(b=>b.onclick=()=>{
        const sk=b.dataset.sk;
        if(selected.has(sk)) selected.delete(sk); else selected.add(sk);
        b.setAttribute('aria-pressed',selected.has(sk));
        paintPrev();
      });
    }
    s.querySelector('[name="job"]').onchange=paintSkills;
    paintSkills(); paintPrev();

    s.querySelector('[data-s="clear"]').onclick=()=>{
      selected.clear(); paintSkills(); paintPrev();
    };
    s.querySelector('[data-s="apply"]').onclick=()=>onApply([...selected].join('、'));
    s.querySelector('[data-s="cancel"]').onclick=()=>onCancel();
  });
}

/* 從 RO「擴充職業」快速新增職業：點一個就直接建立職業卡，之後可再進去挑 BUFF */
function expansionRoleSheet(){
  const list=Object.keys(RO_JOBS).filter(jid=>RO_JOBS[jid].c==='擴充職業');
  sheet('新增擴充職業',`
    <div class="rolegrid">${list.map(jid=>
      `<button class="rolepill" data-j="${jid}" style="padding:9px 15px;font-size:13.5px">${esc(RO_JOBS[jid].n)}</button>`).join('')}</div>
    <div class="sheet-foot"><button class="gbtn" data-s="cancel">取消</button></div>`,s=>{
    s.querySelectorAll('[data-j]').forEach(b=>b.onclick=()=>{
      const jid=b.dataset.j, name=RO_JOBS[jid].n;
      const dup=state.roles.find(x=>x.name===name);
      if(dup){ closeSheet(); return roleSheet(dup.id); }
      let newId;
      commit(()=>{
        newId=uid();
        state.roles.push({id:newId,name,color:PALETTE[state.roles.length%PALETTE.length],icon:'',buff:'',order:state.roles.length});
      });
      closeSheet();
      roleSheet(newId);
    });
    s.querySelector('[data-s="cancel"]').onclick=closeSheet;
  });
}

function ptSheet(id){
  const pt=id?ptsOf(curDate).find(p=>p.id===id):{name:`RUN ${ptsOf(curDate).length+1}`,time:state.settings.defaultTime,capacity:state.settings.defaultCap};
  sheet(id?'編輯 RUN':'新增 RUN',`
    <div class="field"><label>RUN 名稱</label><input name="name" value="${esc(pt.name)}"></div>
    <div class="field-2">
      <div class="field"><label>時間</label><input name="time" value="${esc(pt.time)}" placeholder="20:00"></div>
      <div class="field"><label>人數上限</label><input name="cap" type="number" min="1" max="30" value="${pt.capacity}"></div>
    </div>
    <div class="sheet-foot">
      <button class="gbtn" data-s="cancel">取消</button>
      <button class="gbtn accent" data-s="save">儲存</button>
    </div>`,s=>{
    s.querySelector('[data-s="save"]').onclick=()=>{
      const name=val(s,'name')||'PT';
      const cap=Math.max(1,Math.min(30,parseInt(val(s,'cap'))||12));
      commit(()=>{
        if(id){ const p=ptsOf(curDate).find(x=>x.id===id); Object.assign(p,{name,time:val(s,'time'),capacity:cap});
          if(p.slots.length>cap) p.slots=p.slots.slice(0,cap); }
        else { ensureDate(curDate); state.schedule[curDate].push({...mkPt(name,val(s,'time'),cap)}); }
      });
      closeSheet();
    };
    s.querySelector('[data-s="cancel"]').onclick=closeSheet;
  });
}

/* 預先知道的材料清單（星座之塔目前的掉落物項目），一開始就會出現在自動建議裡，不用等打過一次才有 */
const KNOWN_MATERIALS=[
  '未知的隕石碎片','稀微魔力符文石',
  '威力隕石浮塵','耐力隕石浮塵','專注隕石浮塵','創造隕石浮塵','咒數隕石浮塵','智慧隕石浮塵',
  '威力隕石碎片','耐力隕石碎片','專注隕石碎片','創造隕石碎片','咒數隕石碎片','智慧隕石碎片',
];
/* 這個 App 目前用過的所有材料名稱（預設清單 + 跨全部日期、全部 RUN 實際打過的），給輸入自動建議用 */
function allMaterialNames(){
  const seen=new Set(KNOWN_MATERIALS), extra=new Set();
  Object.values(state.schedule).forEach(pts=>pts.forEach(pt=>(pt.drops||[]).forEach(d=>{
    if(!seen.has(d.name)) extra.add(d.name);
  })));
  /* 預設 14 種維持遊戲裡的屬性順序（威力→耐力→專注→創造→咒數→智慧），自訂材料排在後面 */
  return [...KNOWN_MATERIALS, ...[...extra].sort((a,b)=>a.localeCompare(b,'zh-Hant'))];
}

/* 掉落物批次編輯：一次調整整場 RUN 的所有材料數量（新增／修改／刪除都在這裡完成）。
   數量歸 0 就等於把那筆刪掉，不用一個一個開來刪。 */
function dropsSheet(ptId){
  const pt=ptsOf(curDate).find(p=>p.id===ptId); if(!pt) return;
  const work=new Map((pt.drops||[]).map(d=>[d.name,d.qty]));
  /* 預設 14 種常用材料 + 其他場次用過的自訂材料（自訂一次之後每場都選得到） */
  const names=allMaterialNames();
  (pt.drops||[]).forEach(d=>{ if(!names.includes(d.name)) names.push(d.name); });

  const rowHtml=n=>`<div class="droprow ${(work.get(n)||0)>0?'on':''}" data-row="${esc(n)}" style="${msVars(matSeries(n))}">
      <span class="droprow-n">${esc(n)}</span>
      <div class="stepper">
        <button class="stepbtn" data-step="-1" data-m="${esc(n)}" ${(work.get(n)||0)<=0?'disabled':''}>−</button>
        <input class="stepqty" type="number" min="0" data-qty="${esc(n)}" value="${work.get(n)||0}">
        <button class="stepbtn plus" data-step="1" data-m="${esc(n)}">＋</button>
      </div>
    </div>`;

  /* 依系列分段列出（碎片／浮塵／其餘），一長串材料比較好找 */
  const groupsHtml=()=>groupBySeries(names).map(({s,names:ns})=>
    `<div class="dropgrp" style="${msVars(s)}">${s.label}</div>`+ns.map(rowHtml).join('')).join('');

  sheet(`${pt.name} 的掉落物`,`
    <div id="dropRows">${groupsHtml()}</div>
    <div class="skillgrp">新增自訂材料</div>
    <div class="dropadd">
      <div class="field"><input name="newName" placeholder="清單裡沒有的材料名稱"></div>
      <button class="gbtn" data-s="addName" style="padding:10px 14px">新增</button>
    </div>
    <div class="dropsum" id="dropSum"></div>
    <div class="sheet-foot">
      <button class="gbtn warn" data-s="clear">全部清空</button>
      <button class="gbtn" data-s="cancel">取消</button>
      <button class="gbtn accent" data-s="save">儲存</button>
    </div>`,s=>{
    const host=s.querySelector('#dropRows'), sum=s.querySelector('#dropSum');

    function paintSum(){
      const picked=[...work.entries()].filter(([,q])=>q>0);
      const total=picked.reduce((a,[,q])=>a+q,0);
      sum.innerHTML=picked.length
        ? `<b>${picked.length} 種 · 共 ${total} 個</b><br>${esc(picked.map(([n,q])=>`${n}×${q}`).join('、'))}`
        : `<span class="none">還沒記錄任何材料</span>`;
    }
    function paintRow(n){
      const row=host.querySelector(`[data-row="${CSS.escape(n)}"]`); if(!row) return;
      const q=work.get(n)||0;
      row.classList.toggle('on',q>0);
      row.querySelector('[data-qty]').value=q;
      row.querySelector('[data-step="-1"]').disabled=q<=0;
    }
    function bindRow(row){
      const n=row.dataset.row;
      row.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>{
        const q=Math.max(0,(work.get(n)||0)+(+b.dataset.step));
        work.set(n,q); paintRow(n); paintSum();
      });
      row.querySelector('[data-qty]').oninput=e=>{
        work.set(n,Math.max(0,parseInt(e.target.value)||0));
        row.classList.toggle('on',(work.get(n)||0)>0);
        row.querySelector('[data-step="-1"]').disabled=(work.get(n)||0)<=0;
        paintSum();
      };
    }
    host.querySelectorAll('.droprow').forEach(bindRow);
    paintSum();

    s.querySelector('[data-s="addName"]').onclick=()=>{
      const nm=val(s,'newName').trim(); if(!nm) return toast('請輸入材料名稱');
      const dup=names.includes(nm);
      if(dup) toast('清單裡已經有這個材料了'); else names.push(nm);
      work.set(nm,Math.max(1,work.get(nm)||0));
      /* 新材料要落到它該去的系列分段裡，所以整份重畫再重綁 */
      if(!dup){ host.innerHTML=groupsHtml(); host.querySelectorAll('.droprow').forEach(bindRow); }
      paintRow(nm); paintSum();
      s.querySelector('[name="newName"]').value='';
      const added=host.querySelector(`[data-row="${CSS.escape(nm)}"]`);
      if(added) added.scrollIntoView({block:'nearest'});
    };
    s.querySelector('[data-s="clear"]').onclick=()=>{
      names.forEach(n=>{ work.set(n,0); paintRow(n); });
      paintSum();
    };
    s.querySelector('[data-s="save"]').onclick=()=>{
      commit(()=>{
        const p=ptsOf(curDate).find(x=>x.id===ptId); if(!p) return;
        const old=new Map((p.drops||[]).map(d=>[d.name,d]));
        p.drops=names.filter(n=>(work.get(n)||0)>0).map(n=>{
          const ex=old.get(n);
          return ex?{...ex,qty:work.get(n)}:{id:uid(),name:n,qty:work.get(n)};
        });
      });
      closeSheet();
    };
    s.querySelector('[data-s="cancel"]').onclick=closeSheet;
  });
}

function rolePickSheet(ptId,i){
  const pt=ptsOf(curDate).find(p=>p.id===ptId); if(!pt) return;
  const slot=pt.slots[i], m=memberById(slot.memberId);
  sheet(`${m?m.name:''} 的職業`,`
    <div class="rolegrid">${sortedRoles().map(r=>
      `<button class="rolepill" data-r="${r.id}"
        style="color:${r.color};border-color:${hexA(r.color,.45)};background:${hexA(r.color,.1)};padding:8px 14px;font-size:13px">
        ${esc(r.icon||'')}${esc(r.name)}</button>`).join('')}</div>
    <div class="sheet-foot">
      <button class="gbtn" data-s="clear">清除職業</button>
      <button class="gbtn" data-s="cancel">取消</button>
    </div>`,s=>{
    s.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{
      commit(()=>{ pt.slots[i].roleId=b.dataset.r; }); closeSheet();
    });
    s.querySelector('[data-s="clear"]').onclick=()=>{ commit(()=>{ pt.slots[i].roleId=null; }); closeSheet(); };
    s.querySelector('[data-s="cancel"]').onclick=closeSheet;
  });
}

function dateSheet(){
  const allDates=dates();
  const prev=allDates.filter(k=>k<curDate).pop()||allDates[allDates.length-1];
  /* 今天還沒建立的話，預設就填今天（最常見的情境）；否則填目前這天的隔天 */
  const def=state.schedule[todayKey()]?shiftDate(curDate,1):todayKey();
  const dateOpts=allDates.slice().reverse().map(k=>
    `<option value="${k}" ${k===prev?'selected':''}>${fmtDate(k)} ${fmtDow(k)}（${ptsOf(k).length} RUN）</option>`).join('');
  sheet('新增日期',`
    <div class="field"><label>日期</label><input name="d" type="date" value="${def}"></div>
    ${allDates.length?`
    <label class="toggle"><input type="checkbox" name="copy" checked> 複製指定日期的所有 RUN 與職業配置</label>
    <div class="field" id="copyFromField"><label>從哪一天複製</label><select name="copyFrom">${dateOpts}</select></div>`:''}
    <div class="sheet-foot">
      <button class="gbtn" data-s="cancel">取消</button>
      <button class="gbtn accent" data-s="save">建立</button>
    </div>`,s=>{
    const copyChk=s.querySelector('[name="copy"]'), copyField=s.querySelector('#copyFromField');
    const syncCopyVisibility=()=>{ if(copyField) copyField.style.display=(copyChk&&copyChk.checked)?'':'none'; };
    if(copyChk) copyChk.onchange=syncCopyVisibility;
    syncCopyVisibility();
    s.querySelector('[data-s="save"]').onclick=()=>{
      const k=s.querySelector('[name="d"]').value; if(!k) return toast('請選擇日期');
      if(state.schedule[k]){ curDate=k; closeSheet(); render(); return toast('這天已經有排班了'); }
      const copy=copyChk?.checked;
      const from=s.querySelector('[name="copyFrom"]')?.value;
      commit(()=>{
        state.schedule[k]= (copy&&from&&state.schedule[from])
          ? JSON.parse(JSON.stringify(ptsOf(from))).map(p=>({...p,id:uid(),drops:[]}))
          : [mkPt('RUN 1',state.settings.defaultTime,state.settings.defaultCap)];
      });
      curDate=k; closeSheet(); render();
    };
    s.querySelector('[data-s="cancel"]').onclick=closeSheet;
  });
}

/* 修改目前這天的日期：把 state.schedule 底下的 RUN／排班資料整包搬到新的日期鍵上，內容不會不見 */
function editDateSheet(){
  const from=curDate;
  sheet('修改日期',`
    <div class="field"><label>把 ${fmtDate(from)}（${fmtDow(from)}）改成</label>
      <input name="d" type="date" value="${from}"></div>
    <div class="sheet-foot">
      <button class="gbtn" data-s="cancel">取消</button>
      <button class="gbtn accent" data-s="save">儲存</button>
    </div>`,s=>{
    s.querySelector('[data-s="save"]').onclick=()=>{
      const to=s.querySelector('[name="d"]').value; if(!to) return toast('請選擇日期');
      if(to===from){ closeSheet(); return; }
      if(state.schedule[to]){ return toast(`${fmtDate(to)} 已經有排班了，不能覆蓋`); }
      commit(()=>{
        state.schedule[to]=state.schedule[from];
        delete state.schedule[from];
      });
      curDate=to; closeSheet(); render();
      toast(`已改成 ${fmtDate(to)}`);
    };
    s.querySelector('[data-s="cancel"]').onclick=closeSheet;
  });
}

/* 目前 localStorage 用掉多少空間，設定頁的「資料用量」要顯示這個 */
function storageUsageKB(){
  try{ return new Blob([localStorage.getItem(KEY)||'']).size/1024; }
  catch(e){ return 0; }
}

/* 主動檢查有沒有新版本：強迫瀏覽器重新抓一次 sw.js，真的抓到不同內容才會觸發 updatefound。
   sw.js 的 install 階段本來就會自動 skipWaiting，所以這裡等新的 worker 進到 activated 就代表換版完成，直接重新整理套用。 */
async function checkUpdate(btn){
  if(!('serviceWorker' in navigator)) return toast('此瀏覽器不支援自動更新檢查');
  if(btn) btn.disabled=true;
  toast('檢查更新中…');
  try{
    const reg=swReg||await navigator.serviceWorker.getRegistration();
    if(!reg){ toast('找不到背景服務，請確認網路連線'); if(btn) btn.disabled=false; return; }
    await reg.update();
    /* update() 回來後，新版若真的有差異會停在 waiting；沒有就是已經最新。
       實際的換版交給更新提示列，這裡只負責告知結果。 */
    if(reg.waiting){
      showUpdateBar(reg.waiting);
      toast('有新版本，請點畫面下方的「立即更新」');
    } else {
      toast(`已經是最新版本（${APP_VERSION}）`);
    }
  }catch(e){ toast('檢查更新失敗，請確認網路連線'); }
  if(btn) btn.disabled=false;
}

/* 更新記錄：手動維護的簡短版本說明，給使用者看這個 PWA 有在持續改版 */
/* ── 版本更新紀錄 ─────────────────────────────────────────
   資料放這裡，之後發新版只要在最前面加一筆。
   tag：add 新增 / fix 修正 / imp 改善 / chg 變更 / rm 移除
   note：整段補充說明（用在需要額外交代脈絡的版本上） */
const CHANGELOG=[
  { v:'v42', d:'2026/08/11', c:[
    ['fix','手機上連點兩下會把整頁放大，點擊也慢半拍（雙指縮放仍然保留）'],
    ['fix','切到成員分頁時畫面停在半空中，要往上滑才看得到「成員列表／職業設定」'],
    ['add','每個分頁各自記住捲動位置，切回去接續原本看的地方'],
    ['fix','第一次安裝時會多重新整理一次頁面'],
  ]},
  { v:'v41', d:'2026/08/11',
    note:'純粹的內部整理，功能與畫面完全沒有變動。',
    c:[
    ['chg','主程式從單一 index.html 拆成 10 個檔案，改動一個區塊不再讓整份主檔的離線快取失效'],
  ]},
  { v:'v40', d:'2026/08/11',
    note:'延續 v39 的長期使用強化，這次處理的是「每次操作都在做白工」的部分，畫面與功能沒有變動。',
    c:[
    ['imp','每次操作只重畫看得到的那個分頁，其他分頁等切過去才補畫（原本連背景的成員與職業列表都會整包重建）'],
    ['imp','重繪不再蓋掉正在輸入的欄位，值沒變也不重寫，打字打到一半不會被抽掉'],
    ['imp','單品明細列只有在增減列數時才重建，改數字時輸入框完全不動'],
  ]},
  { v:'v39', d:'2026/08/11',
    note:'這一版針對「資料不要弄丟」與「離線時真的能用」做了一輪強化，功能畫面沒有變動。',
    c:[
    ['add','自動備份：每天第一次開啟、以及匯入或清空前，自動在 IndexedDB 留一份完整快照，最多 5 份，可隨時還原或刪除'],
    ['add','設定頁提醒距離上次匯出備份幾天，超過兩週會顯眼提示'],
    ['add','有新版本時改為在畫面下方詢問「立即更新」，不再趁使用中直接抽換'],
    ['imp','存檔改為延遲合併寫入，連續操作不再每次都把整包資料序列化一遍；離開頁面前會強制落盤'],
    ['imp','開啟 App 改為先用快取秒開、背景再抓新版，訊號差時不用再等連線逾時'],
    ['imp','匯出圖片用的元件改為自帶，離線狀態下第一次使用也不會失敗'],
    ['fix','Service Worker 會把 404 或錯誤回應也存進快取，之後一直回傳壞掉的內容'],
  ]},
  { v:'v38', d:'2026/08/11', c:[
    ['add','同職業的不同成員可以各自覆蓋 BUFF，職業卡上的設定變成「沒特別指定時套用的預設」'],
    ['add','陣容格子的 BUFF 可直接點開修改，自訂過的會加上虛線底標示'],
    ['add','成員編輯面板列出該成員的職業 BUFF，標示是自訂還是套用預設，可一鍵還原'],
    ['imp','資料結構升到第 4 版，既有成員一律維持套用職業預設，顯示結果不變'],
  ]},
  { v:'v37', d:'2026/08/10', c:[
    ['add','交易可選「整組出售」或「單品出售」，單品模式逐列記錄材料、數量與單價'],
    ['add','單品行情：依材料統計歷史加權均價、最近成交價與累計售出數量'],
    ['add','成交紀錄支援日期區間篩選，附今天／本週／本月／全部快捷'],
    ['imp','資料結構升到第 3 版，既有交易一律標為整組出售，數字不受影響'],
    ['fix','PT 計算的星數快捷鈕會連帶把材料統計的日期篩選重設掉'],
  ]},
  { v:'v36', d:'2026/08/10', c:[
    ['chg','交易明細改為拍賣行式的成交卡片，依月份分堆並附每月筆數、組數與成交總額'],
    ['add','成交走勢圖：每組成交價折線、最高與最低成交價、近六個月成交額長條'],
    ['add','每筆成交標示高於／低於均價多少，均價改用加權計算（總台幣 ÷ 總組數）'],
    ['fix','深色模式下 R 幣金額的紫色太暗，改用會跟著主題調整的色票'],
  ]},
  { v:'v35', d:'2026/08/10', c:[
    ['chg','「職業」不再是獨立分頁，併入「成員」頁的子分頁（成員列表 / 職業設定）'],
    ['add','新增「拍賣」分頁，售出試算與交易明細從材料頁搬出來獨立成頁'],
    ['chg','材料頁只保留材料總計、組數試算、場次明細，專心呈現庫存與進度'],
  ]},
  { v:'v34', d:'2026/08/10', c:[
    ['fix','複製 RUN 只產生空白名單，成員、職業與便當標記沒有一起帶過去'],
  ]},
  { v:'v33', d:'2026/08/07', c:[
    ['chg','人數格子從單調的長條改成波利圖示：粉紅波利代表已入座，額滿時整排變成綠色波波利'],
    ['add','已入座的波利會依序跳動（蹲下 → 躍起 → 落地回彈），系統若關閉動態效果則不跳'],
  ]},
  { v:'v32', d:'2026/08/07', c:[
    ['imp','版本更新紀錄改成時間軸呈現，補上發布日期與變更分類標籤'],
  ]},
  { v:'v31', d:'2026/08/07', c:[
    ['rm','未儲存警示列（依需求移除，存檔失敗恢復為一般提示）'],
  ]},
  { v:'v30', d:'2026/08/07', c:[
    ['fix','深色模式下「儲存 / 建立」等主要按鈕、toast 提示、售出明細編號幾乎看不見 —— 這些元素的底色誤用了會隨主題反轉的文字色變數'],
    ['chg','未備份提示從畫面頂部移到底部，不再擋住標題列'],
  ]},
  { v:'v29', d:'2026/08/07',
    note:'針對「長期使用」做了一輪壓力測試（模擬兩年、每天排班、17,520 個排班位子），以下為據此修復的項目。',
    c:[
    ['imp','日期列不再每次操作都整條重繪，兩年份資料下從約 99ms 降到約 1ms'],
    ['fix','指派人員後畫面會自動跳回頂部（日期列的自動捲動連帶捲動了整個頁面）'],
    ['imp','存檔失敗改為常駐警示，不再只有一閃即逝的提示'],
  ]},
  { v:'v28', d:'2026/08/06', c:[
    ['add','深色模式，可選淺色 / 深色 / 跟隨系統'],
    ['add','新增 RUN 的預設時間與預設人數上限可自訂'],
    ['add','設定頁顯示目前資料用量'],
    ['add','檢查更新與版本更新紀錄'],
    ['add','清空所有資料（清除前自動備份）'],
  ]},
  { v:'v27', d:'2026/08/06', c:[
    ['chg','「更多」改名為「設定」，圖示改為齒輪'],
    ['imp','設定選項改為分組列表，每列整條可點，觸控區域加大'],
    ['rm','職業篩選功能'],
  ]},
  { v:'v26', d:'2026/08/06', c:[
    ['chg','底部分頁列與螢幕邊緣的間距調得更貼齊'],
  ]},
  { v:'v25', d:'2026/08/06', c:[
    ['chg','分頁列移至底部，改為玻璃質感懸浮設計，文字改為圖示 + 標籤'],
    ['chg','待分配成員列從底部移到頂部'],
    ['rm','復原 / 重做功能，連同 Ctrl+Z 快捷鍵'],
  ]},
  { v:'v24', d:'2026/08/06', c:[
    ['add','匯入設定前自動下載一份現有資料備份'],
    ['add','圖片與 CSV 匯出支援日期區間，附本週 / 本月 / 全部快捷'],
    ['imp','資料結構改為明確版本號管理，不再靠欄位存在與否推測版本'],
    ['imp','材料統計改為切到該分頁時才計算，不再每次操作都掃描全部歷史'],
    ['chg','CSS 抽離為獨立的 styles.css'],
  ]},
  { v:'v23', d:'2026/08/06', c:[
    ['add','新增日期時可指定要複製哪一天的陣容配置，不再固定複製前一天'],
  ]},
  { v:'v22', d:'2026/08/06', c:[
    ['add','售出計算的交易明細支援編輯（日期、組數、金額、幣值）'],
  ]},
  { v:'v21', d:'2026/08/06', c:[
    ['fix','長按會跳出選字與複製選單，與拖曳排序手勢互相干擾'],
  ]},
  { v:'v20', d:'2026/08/06', c:[
    ['chg','陣容排序改為全螢幕編輯器，拖曳把手加大'],
    ['chg','便當標記改為只在排序編輯器內切換，主畫面僅以底色標示'],
  ]},
];
const CL_TAG={add:'新增',fix:'修正',imp:'改善',chg:'變更',rm:'移除'};
function changelogSheet(){
  sheet('版本更新紀錄',`
    <div class="cl-list">${CHANGELOG.map((e,i)=>`
      <div class="cl-item${i===0?' now':''}">
        <span class="cl-dot"></span>
        <div class="cl-head">
          <span class="cl-ver num">${esc(e.v)}</span>
          <span class="cl-date num">${esc(e.d)}</span>
          ${i===0?'<span class="cl-now-badge">目前版本</span>':''}
        </div>
        ${e.note?`<div class="cl-note">${esc(e.note)}</div>`:''}
        ${e.c.map(([t,txt])=>`<div class="cl-line">
          <span class="cl-tag ${t}">${CL_TAG[t]||''}</span>
          <span class="cl-txt">${esc(txt)}</span>
        </div>`).join('')}
      </div>`).join('')}</div>`, s=>{
    s.classList.add('sheet-tall');
  });
}

/* 清空所有資料：回到全新安裝的狀態。跟匯入一樣，動手前先自動備份一份，且完全無法用復原救回 */
function resetAllData(){
  confirmSheet(
    '這會清空所有成員、職業、排班與售出紀錄，且無法復原（復原功能已移除）。\n按下確定後會先自動下載一份目前資料的備份。',
    ()=>{
      saveSnapshot('reset');
      backupJson();
      commit(()=>{ state=seed(); });
      curDate=null; applyTheme(); render();
      toast('已清空所有資料（已自動備份）');
    },'清空所有資料');
}


function moreSheet(){
  const set=state.settings;
  sheet('設定',`
    <div class="settings-sec">偏好設定</div>
    <div class="settings-group" style="padding:12px 14px 14px">
      <div style="font-size:13px;font-weight:560;margin-bottom:8px">外觀</div>
      <div class="subseg" role="tablist" id="themeSeg" style="margin-bottom:16px">
        <button role="tab" data-theme-v="light" aria-selected="${set.theme==='light'}">淺色</button>
        <button role="tab" data-theme-v="dark" aria-selected="${set.theme==='dark'}">深色</button>
        <button role="tab" data-theme-v="system" aria-selected="${set.theme==='system'}">自動</button>
      </div>
      <div style="font-size:13px;font-weight:560;margin-bottom:8px">新增 RUN 的預設值</div>
      <div class="field-2">
        <div class="field"><label>預設時間</label><input name="defTime" value="${esc(set.defaultTime)}" placeholder="20:00"></div>
        <div class="field" style="margin-bottom:0"><label>預設人數上限</label><input name="defCap" type="number" min="1" max="30" value="${set.defaultCap}"></div>
      </div>
    </div>

    <div class="settings-sec">分享與匯出</div>
    <div class="settings-group">
      <button class="settings-row" data-s="img">
        <span class="settings-ic" style="color:#7c3aed;background:rgba(124,58,237,.12)">
          <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="15" rx="2.5"/><circle cx="8.5" cy="10" r="1.6"/><path d="M21 16l-5.5-5.5L9 17"/></svg>
        </span>
        <span class="settings-tx"><span class="settings-t">產出圖片</span><span class="settings-d">陣容分配轉成 PNG，可直接分享或下載</span></span>
        <svg class="settings-chev" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
      </button>
      <button class="settings-row" data-s="csv">
        <span class="settings-ic" style="color:#0e7490;background:rgba(14,116,144,.12)">
          <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M9 10v10"/></svg>
        </span>
        <span class="settings-tx"><span class="settings-t">匯出 CSV</span><span class="settings-d">陣容、職業、掉落物明細，可用 Excel 開啟</span></span>
        <svg class="settings-chev" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
      </button>
    </div>

    <div class="settings-sec">資料備份</div>
    <div class="settings-group">
      <button class="settings-row" data-s="exportJson">
        <span class="settings-ic" style="color:#15803d;background:rgba(21,128,61,.12)">
          <svg viewBox="0 0 24 24"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 19h16"/></svg>
        </span>
        <span class="settings-tx"><span class="settings-t">匯出設定 JSON</span><span class="settings-d">完整備份成員、職業、排班與售出紀錄</span></span>
      </button>
      <button class="settings-row" data-s="importJson">
        <span class="settings-ic" style="color:#b45309;background:rgba(180,83,9,.12)">
          <svg viewBox="0 0 24 24"><path d="M12 21V9"/><path d="M7 14l5-5 5 5"/><path d="M4 5h16"/></svg>
        </span>
        <span class="settings-tx"><span class="settings-t">匯入設定 JSON</span><span class="settings-d">會覆蓋目前資料，匯入前自動備份一份</span></span>
      </button>
      <button class="settings-row" data-s="snapshots">
        <span class="settings-ic" style="color:#0e7490;background:rgba(14,116,144,.12)">
          <svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 4v5h-5"/><path d="M12 8v4l3 2"/></svg>
        </span>
        <span class="settings-tx"><span class="settings-t">自動備份與還原</span><span class="settings-d">每天自動留一份快照，最多 ${SNAP_KEEP} 份，可隨時還原</span></span>
        <svg class="settings-chev" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
      </button>
    </div>
    ${backupNagHTML()}

    <div class="settings-sec">關於</div>
    <div class="settings-group">
      <div class="settings-row" style="cursor:default">
        <span class="settings-ic" style="color:var(--muted);background:var(--surface-2)">
          <svg viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></svg>
        </span>
        <span class="settings-tx"><span class="settings-t">資料用量</span><span class="settings-d">目前約 ${storageUsageKB().toFixed(0)} KB（瀏覽器通常提供 5–10MB 空間）</span></span>
      </div>
      <button class="settings-row" data-s="checkUpdate">
        <span class="settings-ic" style="color:#4f46e5;background:var(--accent-soft)">
          <svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 4v5h-5"/></svg>
        </span>
        <span class="settings-tx"><span class="settings-t">檢查更新</span><span class="settings-d">目前版本 ${esc(APP_VERSION)}</span></span>
      </button>
      <button class="settings-row" data-s="changelog">
        <span class="settings-ic" style="color:var(--muted);background:var(--surface-2)">
          <svg viewBox="0 0 24 24"><path d="M4 19V5a2 2 0 0 1 2-2h10l4 4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><path d="M8 10h8"/><path d="M8 14h5"/></svg>
        </span>
        <span class="settings-tx"><span class="settings-t">版本更新紀錄</span><span class="settings-d">${esc(CHANGELOG[0].v)} · ${esc(CHANGELOG[0].c[0][1])}</span></span>
        <svg class="settings-chev" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
      </button>
    </div>

    <div class="settings-sec">危險區</div>
    <div class="settings-group" style="border-color:rgba(220,38,38,.3)">
      <button class="settings-row" data-s="reset">
        <span class="settings-ic" style="color:var(--danger);background:rgba(220,38,38,.1)">
          <svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </span>
        <span class="settings-tx"><span class="settings-t" style="color:var(--danger)">清空所有資料</span><span class="settings-d">回到全新安裝狀態，會先自動備份</span></span>
      </button>
    </div>

    <div style="text-align:center;color:var(--faint);font-size:11px;margin-top:16px">
      作者：${esc(APP_AUTHOR)} · 版本 ${esc(APP_VERSION)}
    </div>
    <input type="file" name="jsonFile" accept="application/json,.json" style="display:none">`,s=>{
    s.querySelectorAll('#themeSeg [data-theme-v]').forEach(b=>b.onclick=()=>{
      commit(()=>{ state.settings.theme=b.dataset.themeV; });
      applyTheme();
      s.querySelectorAll('#themeSeg [data-theme-v]').forEach(x=>x.setAttribute('aria-selected',x===b));
    });
    const defTime=s.querySelector('[name="defTime"]'), defCap=s.querySelector('[name="defCap"]');
    defTime.onchange=()=>{ commit(()=>{ state.settings.defaultTime=defTime.value.trim()||'20:00'; }); };
    defCap.onchange=()=>{ commit(()=>{ state.settings.defaultCap=Math.max(1,Math.min(30,parseInt(defCap.value)||12)); }); };
    s.querySelector('[data-s="checkUpdate"]').onclick=e=>checkUpdate(e.currentTarget);
    s.querySelector('[data-s="changelog"]').onclick=()=>{ closeSheet(); changelogSheet(); };
    s.querySelector('[data-s="reset"]').onclick=()=>{ closeSheet(); resetAllData(); };
    s.querySelector('[data-s="img"]').onclick=()=>{ closeSheet(); exportRangeSheet('img'); };
    s.querySelector('[data-s="csv"]').onclick=()=>{ closeSheet(); exportRangeSheet('csv'); };
    s.querySelector('[data-s="exportJson"]').onclick=()=>{ exportJson(); };
    s.querySelector('[data-s="snapshots"]').onclick=()=>{ closeSheet(); snapshotSheet(); };
    const fileInput=s.querySelector('[name="jsonFile"]');
    s.querySelector('[data-s="importJson"]').onclick=()=>{ fileInput.click(); };
    fileInput.onchange=()=>{
      const file=fileInput.files[0]; if(!file) return;
      const reader=new FileReader();
      reader.onload=ev=>{
        let data;
        try{ data=JSON.parse(ev.target.result); }
        catch(err){ toast('讀取失敗，請確認是有效的 JSON 檔'); return; }
        if(!data||!Array.isArray(data.members)||!Array.isArray(data.roles)||typeof data.schedule!=='object'){
          toast('檔案格式不正確'); return;
        }
        closeSheet();
        confirmSheet('匯入將覆蓋目前所有成員、職業與排班資料。\n按下確定後會先自動下載一份目前資料的備份，再進行匯入。',()=>{
          /* 匯入是整包覆蓋且重新整理後就無法用復原救回，所以先存一份快照再下載備份檔，然後才蓋 */
          saveSnapshot('import');
          backupJson();
          curDate=null;
          commit(()=>{ state=migrate(data); });
          applyTheme();
          toast('已匯入設定（原資料已備份下載）');
        },'備份並匯入');
      };
      reader.readAsText(file);
    };
  });
}

/* 匯出範圍選擇：圖片與 CSV 共用。預設是「只有目前這天」，維持原本一鍵匯出的習慣；
   要多天再切到「日期區間」，快捷鍵沿用材料統計那邊的本週／本月語彙。 */
function exportRangeSheet(kind){
  const isImg=kind==='img';
  const t=todayKey(), d=parseYmd(t), dow=(d.getDay()+6)%7;
  const weekFrom=shiftDate(t,-dow), weekTo=shiftDate(t,6-dow);
  const monthFrom=t.slice(0,8)+'01';
  const monthTo=shiftDate(monthFrom,new Date(d.getFullYear(),d.getMonth()+1,0).getDate()-1);
  const all=dates();
  sheet(isImg?'產出圖片':'匯出 CSV',`
    <label class="toggle"><input type="radio" name="mode" value="cur" checked> 只匯出目前這天（${fmtDate(curDate)} ${fmtDow(curDate)}）</label>
    <label class="toggle"><input type="radio" name="mode" value="range"> 匯出日期區間</label>
    <div id="expRange" style="display:none">
      <div class="preset-row">
        <button class="gbtn" data-p="week">本週</button>
        <button class="gbtn" data-p="month">本月</button>
        <button class="gbtn" data-p="all">全部</button>
      </div>
      <div class="field-2">
        <div class="field"><label>從</label><input name="from" type="date" value="${all[0]||t}"></div>
        <div class="field"><label>到</label><input name="to" type="date" value="${all[all.length-1]||t}"></div>
      </div>
      <div style="font-size:11.5px;color:var(--muted);margin:-4px 0 4px" id="expCount"></div>
    </div>
    <div class="sheet-foot">
      <button class="gbtn" data-s="cancel">取消</button>
      <button class="gbtn accent" data-s="go">${isImg?'產出':'匯出'}</button>
    </div>`, s=>{
    const box=s.querySelector('#expRange'), cnt=s.querySelector('#expCount');
    const fromEl=s.querySelector('[name="from"]'), toEl=s.querySelector('[name="to"]');
    const isRange=()=>s.querySelector('[name="mode"]:checked').value==='range';
    const picked=()=>isRange()?exportDates(fromEl.value,toEl.value):[curDate];
    const sync=()=>{
      box.style.display=isRange()?'':'none';
      if(isRange()){
        const ks=picked();
        cnt.textContent=ks.length?`這個區間有 ${ks.length} 天有排班資料`:'這個區間沒有任何排班資料';
      }
    };
    s.querySelectorAll('[name="mode"]').forEach(r=>r.onchange=sync);
    fromEl.onchange=sync; toEl.onchange=sync;
    s.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{
      const p=b.dataset.p;
      if(p==='week'){ fromEl.value=weekFrom; toEl.value=weekTo; }
      else if(p==='month'){ fromEl.value=monthFrom; toEl.value=monthTo; }
      else { fromEl.value=all[0]||t; toEl.value=all[all.length-1]||t; }
      sync();
    });
    sync();
    s.querySelector('[data-s="cancel"]').onclick=closeSheet;
    s.querySelector('[data-s="go"]').onclick=()=>{
      const ks=picked();
      if(!ks.length) return toast('這個區間沒有任何排班資料');
      closeSheet();
      isImg?exportImage(ks):exportCsv(ks);
    };
  });
}

function exportJson(){
  const json=JSON.stringify(state,null,2);
  download(new Blob([json],{type:'application/json'}),`星座塔團隊_設定_${APP_VERSION}_${todayKey()}.json`);
  /* 記下時間，設定頁才能提醒「已經幾天沒備份了」 */
  state.settings.lastExportAt=Date.now();
  persist();
  toast('已匯出設定 JSON');
}

/* 匯入前的自動備份：檔名帶到「時分秒」，才不會跟當天手動匯出的檔案同名互相蓋掉 */
/* ── 自動備份快照 ─────────────────────────────────────────
   localStorage 只有一份資料，被瀏覽器清掉（iOS 對未加到主畫面的網站有清除政策）
   或被誤操作蓋掉就沒了。所以另外在 IndexedDB 留最近幾份完整快照 ——
   IndexedDB 跟 localStorage 是分開的儲存區，容量也大得多，兩邊同時掛掉的機率低很多。
   快照只在「每天第一次開啟」與「匯入／清空前」建立，不會每次異動都寫。 */
const SNAP_DB='star-tower-backup', SNAP_STORE='snapshots', SNAP_KEEP=5;

function snapDB(){
  return new Promise((res,rej)=>{
    if(!self.indexedDB) return rej(new Error('no-idb'));
    const req=indexedDB.open(SNAP_DB,1);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(SNAP_STORE)) db.createObjectStore(SNAP_STORE,{keyPath:'id'});
    };
    req.onsuccess=()=>res(req.result);
    req.onerror=()=>rej(req.error);
  });
}
function snapTx(mode,fn){
  return snapDB().then(db=>new Promise((res,rej)=>{
    const tx=db.transaction(SNAP_STORE,mode), store=tx.objectStore(SNAP_STORE);
    let out;
    try{ out=fn(store); }catch(e){ rej(e); return; }
    tx.oncomplete=()=>res(out&&out.result!==undefined?out.result:undefined);
    tx.onerror=()=>rej(tx.error);
  }));
}
async function listSnapshots(){
  try{
    const rows=await snapTx('readonly',s=>s.getAll());
    return (rows||[]).sort((a,b)=>b.id.localeCompare(a.id));
  }catch(e){ return []; }
}
/* reason：'daily'（每天第一次開啟）／'import'／'reset' */
async function saveSnapshot(reason){
  try{
    const json=JSON.stringify(state);
    const row={id:`${Date.now()}-${reason}`, at:fmtNow(), day:todayKey(), reason,
               size:new Blob([json]).size, version:APP_VERSION, data:json};
    await snapTx('readwrite',s=>s.put(row));
    /* 只留最新的幾份，舊的刪掉，免得 IndexedDB 無限長大 */
    const all=await listSnapshots();
    const drop=all.slice(SNAP_KEEP);
    if(drop.length) await snapTx('readwrite',s=>{ drop.forEach(r=>s.delete(r.id)); });
    return true;
  }catch(e){ return false; }
}
async function deleteSnapshot(id){
  try{ await snapTx('readwrite',s=>s.delete(id)); return true; }catch(e){ return false; }
}
/* 每天第一次開啟時留一份。用 settings.lastSnapDay 記，避免同一天重複寫。 */
async function autoSnapshot(){
  const t=todayKey();
  if(state.settings?.lastSnapDay===t) return false;
  const ok=await saveSnapshot('daily');
  if(ok){ state.settings.lastSnapDay=t; persist(); }
  return ok;
}

const SNAP_REASON={daily:'每日自動',import:'匯入前',reset:'清空前'};
/* 距離上次匯出 JSON 備份幾天；從沒匯出過回 null */
function daysSinceExport(){
  const last=state.settings?.lastExportAt;
  if(!last) return null;
  return Math.max(0,Math.floor((Date.now()-last)/86400000));
}

/* 自動備份快照的檢視與還原。還原本身也會先存一份「還原前」的快照，
   所以按錯了還救得回來。 */
function snapshotSheet(){
  sheet('自動備份',`
    <p class="sheet-note">每天第一次開啟 App、以及匯入或清空資料前，都會自動留一份完整快照，最多保留 ${SNAP_KEEP} 份。這份資料存在瀏覽器的 IndexedDB，跟主要資料分開存放。</p>
    <div id="snapList"><div class="bench-empty">讀取中⋯</div></div>
    <p class="sheet-note">快照仍然跟 App 一起放在這台裝置上。重要資料請另外用「匯出設定 JSON」存到裝置或雲端。</p>
    <div class="sheet-foot">
      <button class="gbtn" data-s="now">立刻建立快照</button>
      <button class="gbtn accent" data-s="cancel">關閉</button>
    </div>`, s=>{
    const host=s.querySelector('#snapList');
    async function paint(){
      const rows=await listSnapshots();
      if(!rows.length){ host.innerHTML=`<div class="bench-empty">還沒有任何快照</div>`; return; }
      host.innerHTML=rows.map(r=>`<div class="snaprow">
        <div class="snap-m">
          <div class="snap-t">${esc(r.at)}</div>
          <div class="snap-s">${esc(SNAP_REASON[r.reason]||r.reason)} · ${(r.size/1024).toFixed(0)} KB · ${esc(r.version||'')}</div>
        </div>
        <button class="gbtn" data-restore="${esc(r.id)}">還原</button>
        <button class="salerow-x" data-drop="${esc(r.id)}" aria-label="刪除這份快照">×</button>
      </div>`).join('');
      host.querySelectorAll('[data-restore]').forEach(b=>b.onclick=async()=>{
        const row=rows.find(x=>x.id===b.dataset.restore); if(!row) return;
        confirmSheet(`還原到 ${row.at} 的狀態？\n目前的資料會被覆蓋（覆蓋前會先自動存一份快照）。`,async()=>{
          let data;
          try{ data=JSON.parse(row.data); }catch(e){ return toast('這份快照已損毀，無法還原'); }
          await saveSnapshot('import');
          curDate=null;
          commit(()=>{ state=migrate(data); });
          applyTheme();
          toast('已還原到所選的快照');
        },'還原');
      });
      host.querySelectorAll('[data-drop]').forEach(b=>b.onclick=async()=>{
        await deleteSnapshot(b.dataset.drop); paint();
      });
    }
    paint();
    s.querySelector('[data-s="now"]').onclick=async()=>{
      const ok=await saveSnapshot('daily');
      toast(ok?'已建立快照':'建立快照失敗，此瀏覽器可能不支援');
      paint();
    };
    s.querySelector('[data-s="cancel"]').onclick=closeSheet;
  });
}

/* 設定頁的備份提醒：超過兩週沒匯出（或從沒匯出過）就顯眼提醒一次。
   自動快照只擋得住「資料被誤改」，擋不住「整台裝置或整個瀏覽器資料沒了」，
   所以還是要推使用者把 JSON 存到裝置外。 */
const BACKUP_NAG_DAYS=14;
function backupNagHTML(){
  const d=daysSinceExport();
  if(d!==null && d<BACKUP_NAG_DAYS) return `<p class="sheet-note">上次匯出備份：${d===0?'今天':`${d} 天前`}</p>`;
  const txt = d===null ? '你還沒有匯出過任何備份檔' : `已經 ${d} 天沒有匯出備份了`;
  return `<div class="backupnag">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>
    <span>${txt}。快照只存在這台裝置上，建議用上方的「匯出設定 JSON」另外存一份。</span>
  </div>`;
}

function backupJson(){
  const stamp=fmtNow().replace(/[/:]/g,'').replace(' ','_');
  download(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),
    `星座塔團隊_匯入前備份_${stamp}.json`);
}

