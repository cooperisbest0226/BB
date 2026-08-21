/* 星座塔團隊 — 匯出圖片 / CSV / JSON
   這個檔案是從原本的單一 index.html 拆出來的，載入順序有相依性，
   請維持 index.html 裡的 <script> 排列順序。 */
/* ══════════════════════════════════════════════════════════
   匯出
   圖片：不截取畫面，改用資料重建一份乾淨的 DOM 再轉圖，
   避免 html2canvas 對 <button> 與 CSS 動畫的已知問題。
   ══════════════════════════════════════════════════════════ */
/* 匯出圖片的掉落物區塊：以前是「掉落：A×3、B×5、…」一長行，材料一多就爆版看不完。
   改成依系列分段（碎片紅／浮塵藍／其餘綠），每段一列標籤 + 可換行的材料標籤。
   材料一律列出完整名稱（威力隕石碎片×3），不縮寫、不省略。 */
function exDrops(pt){
  if(!pt.drops||!pt.drops.length) return '';
  const names=pt.drops.map(d=>d.name);
  const qty=n=>pt.drops.filter(d=>d.name===n).reduce((a,d)=>a+d.qty,0);
  const total=pt.drops.reduce((a,d)=>a+d.qty,0);
  const segs=groupBySeries([...new Set(names)]).map(({s,names:ns})=>
    `<div class="ex-dgrp">
      <span class="ex-dlb" style="background:${s.color}">${s.label}</span>
      <div class="ex-dp">${ns.map(n=>
        `<span class="ex-dpill" style="color:${s.ink};border-color:${s.line};background:${s.soft}">${esc(n)}<b>×${qty(n)}</b></span>`
      ).join('')}</div>
    </div>`).join('');
  return `<div class="ex-drops">
    <div class="ex-dtop">掉落物 · ${new Set(names).size} 種 · 共 ${total} 個</div>${segs}</div>`;
}

/* 匯出範圍：預設就是目前這天；選了區間才會是多天。
   回傳的是「這個範圍內真的有排班的日期」，空日期不會產生空白區塊。 */
function exportDates(from,to){
  if(!from&&!to) return [curDate];
  return dates().filter(k=>(!from||k>=from)&&(!to||k<=to));
}
function rangeLabel(ks){
  if(ks.length===1) return `${fmtDate(ks[0])}（${fmtDow(ks[0]).slice(1)}）`;
  return `${fmtDate(ks[0])} – ${fmtDate(ks[ks.length-1])}`;
}
function fileStamp(ks){
  return ks.length===1 ? fmtDate(ks[0]).replace('/','')
                       : `${fmtDate(ks[0]).replace('/','')}-${fmtDate(ks[ks.length-1]).replace('/','')}`;
}

function ptExportBlock(pt){
  const rows=pt.slots.length ? pt.slots.map(s=>{
    const m=memberById(s.memberId), r=roleById(s.roleId);
    if(!m) return '';
    return `<div class="ex-row ${s.bento?'bento':''}"><span class="ex-nm">${esc(m.name)}${s.bento?'<span class="ex-buff" style="color:#16a34a">便當</span>':''}${buffFor(m,r)?`<span class="ex-buff">${esc(buffFor(m,r))}</span>`:''}</span>`+
      (r?`<span class="ex-rl" style="color:${r.color};border-color:${hexA(r.color,.45)};background:${hexA(r.color,.1)}">${esc(r.name)}</span>`
         :`<span class="ex-rl" style="color:#a8aec0;border-color:#e6e8ef">未指定</span>`)+`</div>`;
  }).join('') : `<div class="ex-row"><span class="ex-nm" style="color:#a8aec0">（無人）</span></div>`;
  /* 時間不再逐場印：一天共用一個時間，印在上方的日期標題就好，
     每張卡片重複同一個時間只是佔位置。 */
  return `<div class="ex-pt">
    <div class="ex-pt-h"><span class="ex-pt-n">${esc(pt.name)}</span>
      <span class="ex-pt-c">${pt.slots.length}/${pt.capacity}</span></div>
    ${rows}
    ${exDrops(pt)}
    </div>`;
}

function buildExportNode(ks){
  ks=ks&&ks.length?ks:[curDate];
  const totalPts=ks.reduce((a,k)=>a+ptsOf(k).length,0);
  const totalSlots=ks.reduce((a,k)=>a+ptsOf(k).reduce((b,p)=>b+p.slots.length,0),0);
  /* 多天時每天各自一個標題段落，單天則維持原本沒有日期小標的乾淨版面 */
  const body=ks.map(k=>{
    const pts=ptsOf(k);
    const cols=pts.map(ptExportBlock).join('');
    const dayHead=ks.length>1
      ? `<div class="ex-day">${fmtDate(k)}（${DOW[parseYmd(k).getDay()]}）${dayTime(k)?` · ${esc(dayTime(k))}`:''} · ${pts.length} RUN · ${pts.reduce((a,p)=>a+p.slots.length,0)} 人</div>`
      : '';
    return dayHead+`<div class="ex-cols">${cols||'<div class="ex-sub">這天還沒有 RUN</div>'}</div>`;
  }).join('');
  const host=document.getElementById('exportHost');
  host.innerHTML=`<div class="exportwrap" id="exportWrap">
    <div class="ex-h">${rangeLabel(ks)} 陣容分配${ks.length===1&&dayTime(ks[0])?` · ${esc(dayTime(ks[0]))}`:''}</div>
    <div class="ex-sub">${ks.length>1?`${ks.length} 天 · `:''}${totalPts} RUN · 出席 ${totalSlots} 人 · 產出於 ${fmtNow()}</div>
    ${body}
  </div>`;
  return document.getElementById('exportWrap');
}

async function exportImage(ks){
  ks=ks&&ks.length?ks:[curDate];
  if(typeof html2canvas==='undefined') return toast('圖片元件尚未載入完成，請稍候再試');
  toast('產出中⋯');
  const node=buildExportNode(ks);
  try{
    const canvas=await html2canvas(node,{backgroundColor:'#ffffff',scale:2,useCORS:true});
    const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));
    const file=new File([blob],`陣容分配_${fileStamp(ks)}.png`,{type:'image/png'});
    if(navigator.canShare&&navigator.canShare({files:[file]})){
      /* 只帶檔案，不帶 title／text：帶了的話 LINE 之類的 App 會在圖片旁邊
         附一段文字訊息，貼到群組就變成「圖片 + 一行字」。這裡只要圖片。 */
      try{ await navigator.share({files:[file]}); }
      catch(err){ if(err.name!=='AbortError') download(blob,file.name); }
    } else download(blob,file.name);
  }catch(err){ console.error(err); toast('圖片產出失敗，請再試一次'); }
  finally{ document.getElementById('exportHost').innerHTML=''; }
}

function exportCsv(ks){
  ks=ks&&ks.length?ks:[curDate];
  const rows=[['日期','星期','RUN','時間','成員','職業','BUFF','便當','掉落物']];
  ks.forEach(k=>{
    ptsOf(k).forEach(pt=>{
      pt.slots.forEach(s=>{
        const m=memberById(s.memberId), r=roleById(s.roleId);
        if(m) rows.push([fmtDate(k),fmtDow(k),pt.name,dayTime(k),m.name,r?r.name:'',buffFor(m,r),s.bento?'是':'','']);
      });
      if(pt.drops&&pt.drops.length){
        rows.push([fmtDate(k),fmtDow(k),pt.name,dayTime(k),'','','','',
          pt.drops.map(d=>`${d.name}×${d.qty}`).join('、')]);
      }
    });
  });
  if(rows.length===1) return toast(ks.length>1?'這個範圍還沒有排班資料':'這天還沒有排班資料');
  const csv=rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\r\n');
  download(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}),`陣容分配_${fileStamp(ks)}.csv`);
  toast(`已匯出 CSV（${ks.length} 天）`);
}
function download(blob,name){
  const url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

