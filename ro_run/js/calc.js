/* 星座塔團隊 — PT 計算（屬性星數 → 總 PT 等級）
   這個檔案是從原本的單一 index.html 拆出來的，載入順序有相依性，
   請維持 index.html 裡的 <script> 排列順序。 */
/* ══════════════════════════════════════════════════════════
   PT 計算（屬性星數 → 總 PT 等級）
   ══════════════════════════════════════════════════════════ */
const ATTRS=[
  {id:'hp',      label:'體力', en:'HP',       color:'#0f9d76', pts:[0,15,30,45,60,75]},
  {id:'attack',  label:'攻擊', en:'Attack',   color:'#dc2626', pts:[0,20,40,60,80,100]},
  {id:'recovery',label:'恢復', en:'Recovery', color:'#65a30d', pts:[0,30,60,90,120,150]},
  {id:'defense', label:'防禦', en:'Defense',  color:'#ca8a04', pts:[0,50,100,150,200,250]},
  {id:'trap',    label:'陷阱', en:'Trap',     color:'#9333ea', pts:[0,85,170,255,340,425]},
];
const MAX_PT=1000;
const PT_TIERS=[
  {pt:0,   label:'50 層挑戰範圍'},
  {pt:600, label:'75 層挑戰範圍'},
];
const stars={hp:0,attack:0,recovery:0,defense:0,trap:0};
const tierOf=t=>PT_TIERS.reduce((c,x)=>t>=x.pt?x:c,PT_TIERS[0]);

function renderCalc(){
  document.getElementById('attrCards').innerHTML=ATTRS.map((a,i)=>{
    const n=stars[a.id];
    /* 一張卡一行：名稱｜星星｜pt。原本三行高，五張疊起來就把合計擠出畫面 */
    return `<div class="attrcard" style="--ac:${a.color};--ac-soft:${hexA(a.color,.1)};--ac-line:${hexA(a.color,.28)};animation-delay:${i*40}ms">
      <div class="attr-id">
        <span class="attr-nm">${a.label}</span>
        <span class="star-lb">${n?n+' 顆星':'封印'}</span>
      </div>
      <div class="stars">
        ${[1,2,3,4,5].map(v=>`<button class="star ${v<=n?'on':''}" data-attr="${a.id}" data-v="${v}" aria-label="${a.label} ${v} 顆星">★</button>`).join('')}
      </div>
      <span class="attr-pt num">${a.pts[n]} pt</span>
    </div>`;
  }).join('');

  const total=ATTRS.reduce((s,a)=>s+a.pts[stars[a.id]],0);
  const tier=tierOf(total), hi=tier.pt>=600;
  document.getElementById('calcTotal').innerHTML=`${total}<small>pt</small>`;
  document.getElementById('calcMeter').innerHTML=
    Array.from({length:10},(_,i)=>`<div class="pip ${total/MAX_PT*10>i?(hi?'full':'on'):''}"></div>`).join('');
  document.getElementById('calcTier').className='tier'+(hi?' hi':'');
  document.getElementById('calcTierText').textContent=tier.label;
}

document.addEventListener('click',e=>{
  const st=e.target.closest('.star');
  if(st){
    const id=st.dataset.attr, v=+st.dataset.v;
    stars[id]= stars[id]===v ? v-1 : v;   // 再點同一顆＝取消該顆
    renderCalc(); return;
  }
  /* 只認 PT 計算頁自己的快捷鈕。材料與出場統計的日期快捷鈕也叫 data-preset
     （值是 today／week…），全域去抓的話，按一下「今天」就會把體力星數寫成 NaN。 */
  const ps=e.target.closest('#view-calc [data-preset]');
  if(ps){
    ps.dataset.preset.split(',').forEach((v,i)=>stars[ATTRS[i].id]=+v);
    renderCalc();
  }
});
renderCalc();
