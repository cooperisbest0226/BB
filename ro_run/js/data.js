/* 星座塔團隊 — 資料模型、版本遷移、存檔與共用查詢輔助
   這個檔案是從原本的單一 index.html 拆出來的，載入順序有相依性，
   請維持 index.html 裡的 <script> 排列順序。 */
/* ══════════════════════════════════════════════════════════
   星座塔團隊 — 資料模型
   state = { members, roles, schedule:{ 'YYYY-MM-DD': [pt,...] } }
   pt    = { id, name, time, capacity, slots:[{memberId, roleId}] }
   ══════════════════════════════════════════════════════════ */
const KEY='pt-manager-v1';
/* App 版本流水號：每次交付新版就手動 +1（沒有建置流程可以自動產生，純手動維護的計數器） */
const APP_VERSION='v42';
const APP_AUTHOR='BB';
const uid=()=>Math.random().toString(36).slice(2,9);
const PALETTE=['#4f46e5','#0ea5e9','#0f9d76','#65a30d','#ca8a04','#ea580c','#dc2626','#db2777','#9333ea','#475569'];

// 四轉職業（基本職業／四轉欄）——新安裝的預設職業清單
const FOURTH_JOBS=[
  {name:'盧恩龍爵',icon:'🐉'},   // Dragon Knight
  {name:'帝國聖衛軍',icon:'🛡'}, // Imperial Guard
  {name:'深淵追跡者',icon:'🔪'}, // Abyss Chaser
  {name:'十字影武',icon:'🗡'},   // Shadow Cross
  {name:'機甲神匠',icon:'🔧'},   // Meister
  {name:'生命締造者',icon:'🧪'}, // Biolo
  {name:'風鷹狩獵者',icon:'🏹'}, // Wind Hawk
  {name:'天籟頌者',icon:'🎵'},   // Troubadour
  {name:'樂之舞靈',icon:'💃'},   // Trouvere
  {name:'禁咒魔導士',icon:'🔮'}, // Arch Mage
  {name:'元素支配者',icon:'✨'}, // Elemental Master
  {name:'樞機主教',icon:'⛪'},   // Cardinal
  {name:'聖裁者',icon:'🔥'},     // Inquisitor
];

/* RO 支援／BUFF 技能庫（資料來源：仙境全書 ro.ntome.com/skill）
   只收錄增益／支援類技能，不含攻擊、被動精熟等。
   p = 前一轉職業，用來把整條轉職鏈（一轉～四轉）的支援技能一起列出來。 */
const RO_JOBS={
  novice:{n:"初心者",c:"初心者",s:[]},
  acolyte:{n:"服事",c:"一轉",s:["光之障壁","加速術","天使之護","天使之賜福","天使之障壁","治療術","治癒術"]},
  archer:{n:"弓箭手",c:"一轉",s:[]},
  magician:{n:"魔法師",c:"一轉",s:[]},
  merchant:{n:"商人",c:"一轉",s:[]},
  swordman:{n:"劍士",c:"一轉",s:[]},
  thief:{n:"盜賊",c:"一轉",s:[]},
  alchemist:{n:"鍊金術師",c:"二轉",p:"merchant",s:["化學武器保護","化學盾牌保護","化學鎧甲保護","化學頭盔保護"]},
  assassin:{n:"刺客",c:"二轉",p:"thief",s:[]},
  bard:{n:"吟遊詩人",c:"二轉",p:"archer",s:["伊登的蘋果","尼貝隆根之戒指","布萊奇之詩","經驗值倍增"]},
  blacksmith:{n:"鐵匠",c:"二轉",p:"merchant",s:["強化火屬性","所有速度激發"]},
  crusader:{n:"十字軍",c:"二轉",p:"swordman",s:["天使之護","治療術","治癒術","神祐之光"]},
  dancer:{n:"舞孃",c:"二轉",p:"archer",s:["尼貝隆根之戒指","經驗值倍增"]},
  hunter:{n:"獵人",c:"二轉",p:"archer",s:[]},
  knight:{n:"騎士",c:"二轉",p:"swordman",s:[]},
  monk:{n:"武道家",c:"二轉",p:"acolyte",s:[]},
  priest:{n:"祭司",c:"二轉",p:"acolyte",s:["光耀之堂","幸運之頌歌","復活術","撒水祈福","犧牲祈福","痊癒術","神威祈福","聖之祈福","聖母之頌歌","轉生術"]},
  rogue:{n:"流氓",c:"二轉",p:"thief",s:[]},
  sage:{n:"賢者",c:"二轉",p:"magician",s:["地元素領域","地屬性附加","水元素領域","水屬性附加","火元素領域","火屬性附加","風元素領域","風屬性附加"]},
  wizard:{n:"巫師",c:"二轉",p:"magician",s:[]},
  assassin_cross:{n:"十字刺客",c:"轉生二轉",p:"assassin",s:[]},
  champion:{n:"武術宗師",c:"轉生二轉",p:"monk",s:[]},
  clown:{n:"搞笑藝人",c:"轉生二轉",p:"bard",s:[]},
  creator:{n:"創造者",c:"轉生二轉",p:"alchemist",s:["所有化學武器保護"]},
  gypsy:{n:"冷豔舞姬",c:"轉生二轉",p:"dancer",s:[]},
  high_priest:{n:"神官",c:"轉生二轉",p:"priest",s:["聖母之祈福"]},
  high_wizard:{n:"超魔導師",c:"轉生二轉",p:"wizard",s:[]},
  lord_knight:{n:"騎士領主",c:"轉生二轉",p:"knight",s:[]},
  paladin:{n:"聖殿十字軍",c:"轉生二轉",p:"crusader",s:["聖音"]},
  professor:{n:"智者",c:"轉生二轉",p:"sage",s:[]},
  sniper:{n:"神射手",c:"轉生二轉",p:"hunter",s:[]},
  stalker:{n:"神行太保",c:"轉生二轉",p:"rogue",s:[]},
  whitesmith:{n:"神工匠",c:"轉生二轉",p:"blacksmith",s:[]},
  archbishop:{n:"大主教",c:"三轉",p:"high_priest",s:["奉獻頌","感恩歌","感恩祈禱","慈悲術","折枝讚頌","淨化","祈禱文","純白百合花","羔羊歌頌","聖靈降臨祈禱","解除","贖罪","集結","高階治癒術"]},
  genetic:{n:"基因學者",c:"三轉",p:"creator",s:["爆炸孢子","調配料理"]},
  guillotine_cross:{n:"十字斬首者",c:"三轉",p:"assassin_cross",s:["解毒劑"]},
  mechanic:{n:"機械工匠",c:"三轉",p:"whitesmith",s:[]},
  minstrel:{n:"宮廷樂師",c:"三轉",p:"clown",s:["和聲演奏","課程","豐年頌","魔力之歌"]},
  ranger:{n:"遊俠",c:"三轉",p:"sniper",s:[]},
  royal_guard:{n:"皇家禁衛隊",c:"三轉",p:"paladin",s:["先鋒部隊","威信","王的恩典","聖冕加護","聚集","虔誠"]},
  rune_knight:{n:"盧恩騎士",c:"三轉",p:"lord_knight",s:[]},
  shadow_chaser:{n:"魅影追蹤者",c:"三轉",p:"stalker",s:[]},
  sorcerer:{n:"妖術師",c:"三轉",p:"professor",s:["加熱術","地之紋章","打擊強化","水之紋章","火之紋章","精靈治癒","精靈激發","精靈結界","風之紋章"]},
  sura:{n:"修羅",c:"三轉",p:"champion",s:[]},
  wanderer:{n:"浪姬舞者",c:"三轉",p:"gypsy",s:["戀人交響樂","課程","豐年頌","魔力之歌"]},
  warlock:{n:"咒術士",c:"三轉",p:"high_wizard",s:[]},
  abyss_chaser:{n:"深淵追跡者",c:"四轉",p:"shadow_chaser",s:[]},
  arch_mage:{n:"禁咒魔導士",c:"四轉",p:"warlock",s:["毀滅颶風","萬紫千紅"]},
  biolo:{n:"生命締造者",c:"四轉",p:"genetic",s:["全影化學保護","全體化學保護"]},
  cardinal:{n:"樞機主教",c:"四轉",p:"archbishop",s:["光耀天命","全心奉獻","博愛治癒","治癒誓言","祝福讚歌","神聖權能","神聖花雨","神聖防護","聖光治癒","靈魂忠誠"]},
  dragon_knight:{n:"盧恩龍爵",c:"四轉",p:"rune_knight",s:["天龍光環","活力之源"]},
  elemental_master:{n:"元素支配者",c:"四轉",p:"sorcerer",s:["元素天幕","咒力賦予"]},
  imperial_guard:{n:"帝國聖衛軍",c:"四轉",p:"royal_guard",s:["守護神盾","抗性聖盾","霸權震域"]},
  inquisitor:{n:"聖裁者",c:"四轉",p:"sura",s:["聖油洗禮"]},
  meister:{n:"機甲神匠",c:"四轉",p:"mechanic",s:["衝擊撼動"]},
  shadow_cross:{n:"十字影武",c:"四轉",p:"guillotine_cross",s:[]},
  troubadour:{n:"天籟頌者",c:"四轉",p:"minstrel",s:["普隆德拉進行曲","神秘交響曲","舞台禮儀"]},
  wind_hawk:{n:"風鷹狩獵者",c:"四轉",p:"ranger",s:["熱愛自然"]},
  windsinger:{n:"樂之舞靈",c:"四轉",p:"wanderer",s:["普隆德拉進行曲","神秘交響曲","舞台禮儀"]},
  alicia:{n:"阿利提亞",c:"擴充職業",p:"kanoss",s:["同步飛翔","大地豐收","自然助力","自然調和"]},
  druid:{n:"德魯伊",c:"擴充職業",s:["土地之花","繁花盛放","自然盾牌"]},
  extended_super_novice:{n:"終極初學者",c:"擴充職業",p:"super_novice",s:[]},
  gunslinger:{n:"神槍手",c:"擴充職業",s:[]},
  kagerou:{n:"日影忍者",c:"擴充職業",p:"ninja",s:["明鏡止水","靈魂阻隔"]},
  kagerou_upper:{n:"流浪忍者",c:"擴充職業",p:"kagerou",s:[]},
  kanoss:{n:"卡諾斯",c:"擴充職業",p:"druid",s:["自然保護","自然活力","風之帳幕"]},
  night_watch:{n:"夜行使",c:"擴充職業",p:"rebellion",s:[]},
  ninja:{n:"忍者",c:"擴充職業",s:[]},
  oboro:{n:"月影忍者",c:"擴充職業",p:"ninja",s:["明鏡止水","靈魂阻隔"]},
  oboro_upper:{n:"疾風忍者",c:"擴充職業",p:"oboro",s:[]},
  rebellion:{n:"反叛者",c:"擴充職業",p:"gunslinger",s:[]},
  sky:{n:"獵靈士",c:"擴充職業",p:"soul_linker",s:["凱渥特","巨人靈魂","影子靈魂","精靈靈魂","艾斯哈","艾斯帕","艾斯核","隼鷹靈魂","靈魂集結"]},
  soul_emperor:{n:"天帝",c:"擴充職業",p:"star_emperor",s:[]},
  soul_linker:{n:"悟靈士",c:"擴充職業",p:"taekwon",s:["一轉上等職業的靈魂","凱易哲","凱易娜","凱易特","凱誣僕","凱阿希","刺客的靈魂","十字軍的靈魂","吟遊詩人和舞孃的靈魂","巫師的靈魂","悟靈士的靈魂","拳聖的靈魂","武道家的靈魂","流氓的靈魂","獵人的靈魂","祭司的靈魂","艾斯克","艾斯卡","艾斯提","艾斯敦","艾斯誣","艾斯麻","賢者的靈魂","超級初學者的靈魂","鍊金術師的靈魂","鐵匠的靈魂","騎士的靈魂"]},
  spirit_handler:{n:"魂靈師",c:"擴充職業",p:"summoner",s:["急速交流","神龜海洋慶典","靈物祝福"]},
  spirit_shaman:{n:"契靈士",c:"擴充職業",p:"sky",s:["五行符","四方五行陣","四方神符","天地神靈","朱雀符","武士符","法師符","玄武符","白虎符","護身符","靈魂聚集","青龍符"]},
  star_emperor:{n:"拳皇",c:"擴充職業",p:"star_gladiator",s:[]},
  star_gladiator:{n:"拳聖",c:"擴充職業",p:"taekwon",s:["太陽和月亮和星星的朋友","太陽的平安感","太陽的祝福","星星的平安感","星星的祝福","月亮的平安感","月亮的祝福"]},
  summoner:{n:"召喚師",c:"擴充職業",s:["大地之魂","大地力量","海洋之魂","海洋力量","生命之魂","生命力量","舔毛"]},
  super_novice:{n:"超級初學者",c:"擴充職業",s:[]},
  taekwon:{n:"跆拳少年",c:"擴充職業",s:["加油","溫暖的風"]}
};
/* 取得某職業的整條轉職鏈（一轉 → 該職業） */
function roJobChain(jid){
  const out=[]; let cur=jid;
  while(cur&&RO_JOBS[cur]){ out.unshift(cur); cur=RO_JOBS[cur].p; }
  return out;
}
/* 鏈上有支援技能的職業才列進選單，避免選了卻沒東西可挑 */
function roPickableJobs(){
  return Object.keys(RO_JOBS).filter(jid=>roJobChain(jid).some(c=>RO_JOBS[c].s.length));
}
/* 用職業名稱回頭找 RO 職業 id（App 預設職業就是四轉職業名，所以多半對得上） */
function roJobIdByName(name){
  const n=(name||'').trim();
  return Object.keys(RO_JOBS).find(jid=>RO_JOBS[jid].n===n)||null;
}

// 全新安裝時的預設狀態：不帶任何示範成員／RUN，職業清單直接套用四轉職業
function seed(){
  const roles=FOURTH_JOBS.map((j,i)=>({id:uid(),name:j.name,color:PALETTE[i%PALETTE.length],icon:j.icon,order:i}));
  return {schemaVersion:SCHEMA_VERSION,members:[],roles,schedule:{},sales:[],
    settings:{theme:'system',defaultTime:'20:00',defaultCap:12}};
}

function mkPt(name,time,cap){ return {id:uid(),name,time,capacity:cap,slots:[],drops:[]}; }
function todayKey(){ const d=new Date(); return ymd(d); }
function ymd(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function parseYmd(k){ const [y,m,d]=k.split('-').map(Number); return new Date(y,m-1,d); }
const DOW=['日','一','二','三','四','五','六'];
function fmtDate(k){ const d=parseYmd(k); return String(d.getMonth()+1).padStart(2,'0')+'/'+String(d.getDate()).padStart(2,'0'); }
function fmtDow(k){ return '週'+DOW[parseYmd(k).getDay()]; }
/* 手動組時間字串，不用 toLocaleString —— zh-TW 這個 locale 在部分瀏覽器上 hour12:false 不會正確生效，
   半夜容易跑出「24:xx」或又跳回 12 小時制帶「上午/下午」的錯誤格式，自己組才會保證是正確的 24 小時制在地時間 */
function fmtNow(){
  const d=new Date();
  const y=d.getFullYear(), mo=String(d.getMonth()+1).padStart(2,'0'), da=String(d.getDate()).padStart(2,'0');
  const h=String(d.getHours()).padStart(2,'0'), mi=String(d.getMinutes()).padStart(2,'0'), se=String(d.getSeconds()).padStart(2,'0');
  return `${y}/${mo}/${da} ${h}:${mi}:${se}`;
}
function shiftDate(k,n){ const d=parseYmd(k); d.setDate(d.getDate()+n); return ymd(d); }

/* ── 資料結構版本遷移 ─────────────────────────────────────
   以前是靠「某個欄位在不在」反推資料是哪一版，每加一個欄位就要多一段猜測邏輯。
   改成明確的 schemaVersion：舊資料沒有這個欄位就當成第 0 版，
   然後照順序把 0→1、1→2 … 的轉換一步步套上去，之後要再加版本只要往 MIGRATIONS 後面接一段。 */
const MIGRATIONS=[
  /* 0 → 1：舊命名 PT 1 / PT1 改成 RUN 1；補上 drops 陣列；
            技能 BUFF 從「成員」搬到「職業」（同職業的人 BUFF 才會一致）；補上 sales 欄位 */
  p=>{
    Object.values(p.schedule||{}).forEach(pts=>pts.forEach(pt=>{
      const m=/^PT\s*(\d+)$/i.exec((pt.name||'').trim());
      if(m) pt.name='RUN '+m[1];
      if(!Array.isArray(pt.drops)) pt.drops=[];
    }));
    (p.members||[]).forEach(m=>{
      if(m.buff&&m.defaultRoleId){
        const r=(p.roles||[]).find(x=>x.id===m.defaultRoleId);
        if(r&&!r.buff) r.buff=m.buff;
      }
      delete m.buff;
    });
    if(!Array.isArray(p.sales)) p.sales=[];
  },
  /* 1 → 2：新增設定物件（外觀主題、新增 RUN 的預設時間／人數上限） */
  p=>{
    p.settings=Object.assign({theme:'system',defaultTime:'20:00',defaultCap:12},p.settings||{});
  },
  /* 2 → 3：交易分成「整組出售」與「單品出售」兩種模式。
            舊資料都是按組賣的，一律標成 set，並補上空的 items 陣列。 */
  p=>{
    (p.sales||[]).forEach(s=>{
      if(s.mode!=='item') s.mode='set';
      if(!Array.isArray(s.items)) s.items=[];
    });
  },
  /* 3 → 4：成員可以針對「自己在某個職業時」覆蓋該職業的預設 BUFF。
            舊資料沒有任何覆蓋，補上空物件即可，顯示結果完全不變。 */
  p=>{
    (p.members||[]).forEach(m=>{
      if(!m.buffs || typeof m.buffs!=='object' || Array.isArray(m.buffs)) m.buffs={};
    });
  },
];
const SCHEMA_VERSION=MIGRATIONS.length;

function migrate(p){
  let from=Number.isInteger(p.schemaVersion)?p.schemaVersion:0;
  /* 資料比程式還新（例如從新版匯出的 JSON 匯進舊版 App）就不硬轉，原樣留著避免弄壞資料 */
  if(from>SCHEMA_VERSION) return p;
  for(let v=from; v<SCHEMA_VERSION; v++) MIGRATIONS[v](p);
  p.schemaVersion=SCHEMA_VERSION;
  return p;
}

let state=load(), curDate=null, picked=null, dateRailReady=false;

function load(){
  try{
    const r=localStorage.getItem(KEY);
    if(r){ const p=JSON.parse(r); if(p&&p.members&&p.roles&&p.schedule) return migrate(p); }
  }catch(e){}
  return seed();
}

/* 套用外觀設定。<head> 裡的行內 script 已經在畫面畫出來前先套過一次（避免閃色），
   這裡是主程式載入後、以及使用者在設定裡切換主題時，同步更新 <html> 屬性跟瀏覽器狀態列顏色。 */
const sysDark=window.matchMedia&&matchMedia('(prefers-color-scheme: dark)');
function applyTheme(){
  const t=state.settings?.theme||'system';
  const dark=t==='dark'||(t==='system'&&sysDark&&sysDark.matches);
  document.documentElement.dataset.theme=dark?'dark':'';
  const mc=document.querySelector('meta[name="theme-color"]');
  if(mc) mc.content=dark?'#0d0f14':'#eef1f7';
}
applyTheme();
if(sysDark) sysDark.addEventListener('change',()=>{ if((state.settings?.theme||'system')==='system') applyTheme(); });
/* 寫入 localStorage 是同步的，而且每次都要把整個 state 序列化一遍。
   連續操作（連按加減、拖曳排序、逐字打字）會在主執行緒上重複做同一件重活，
   所以合併成一次：先記下「有東西要存」，150ms 內沒有新的異動才真的寫。
   離開頁面前一定要 flushPersist()，不然最後那 150ms 內的異動會遺失。 */
let persistTimer=null, persistPending=false;
function writeNow(){
  persistTimer=null; persistPending=false;
  try{ localStorage.setItem(KEY,JSON.stringify(state)); }
  catch(e){ toast('儲存失敗，裝置空間可能已滿'); }
}
function persist(){
  persistPending=true;
  if(persistTimer) clearTimeout(persistTimer);
  persistTimer=setTimeout(writeNow,150);
}
function flushPersist(){
  if(!persistPending) return;
  if(persistTimer) clearTimeout(persistTimer);
  writeNow();
}
/* pagehide 在 iOS 上比 beforeunload 可靠；visibilitychange 則涵蓋切到背景後被系統回收的情況 */
addEventListener('pagehide',flushPersist);
addEventListener('beforeunload',flushPersist);
addEventListener('visibilitychange',()=>{ if(document.visibilityState==='hidden') flushPersist(); });

/* 所有異動都走這裡：改資料 → 存檔 → 重繪。
   （復原／重做已移除，因此不再需要每次異動前後各做一次整包 JSON 快照比對） */
function commit(fn){
  fn();
  persist(); render();
}

/* ── 查詢輔助 ─────────────────────────────────────────── */
const dates=()=>Object.keys(state.schedule).sort();
const ptsOf=k=>state.schedule[k]||[];
const memberById=id=>state.members.find(m=>m.id===id);
const roleById=id=>state.roles.find(r=>r.id===id);
const sortedRoles=()=>[...state.roles].sort((a,b)=>a.order-b.order);

/* ── BUFF 的兩層設定 ───────────────────────────────────────
   職業卡上的 buff 是「這個職業的預設」，成員的 buffs[職業id] 是「這個人當這個職業時」的覆蓋。
   用 key 存不存在來判斷有沒有覆蓋，不是看字串空不空 —— 這樣「這個人刻意不放 BUFF」
   （存空字串）才能跟「沒設定過、套職業預設」區分開。 */
function hasBuffOverride(m,roleId){
  return !!(m && m.buffs && Object.prototype.hasOwnProperty.call(m.buffs, roleId));
}
function buffFor(m, r){
  if(!r) return '';
  return hasBuffOverride(m, r.id) ? (m.buffs[r.id]||'') : (r.buff||'');
}
function setBuffOverride(m, roleId, text){ (m.buffs=m.buffs||{})[roleId]=text; }
function clearBuffOverride(m, roleId){ if(m&&m.buffs) delete m.buffs[roleId]; }
function assignedIds(k){ const s=new Set(); ptsOf(k).forEach(p=>p.slots.forEach(x=>s.add(x.memberId))); return s; }
/* 同一天可以把同一個人加進多個 RUN，所以「成員名單」永遠列出全部啟用中的成員，
   不會因為已經加過就消失 —— 這樣才能重複拖曳/點選加入不同場次。 */
function countRuns(k,memberId){ return ptsOf(k).reduce((n,p)=>n+(p.slots.some(s=>s.memberId===memberId)?1:0),0); }
function benchMembers(k){ return state.members.filter(m=>m.active); }
/* 純粹「今天一場都還沒排到」的人 —— 給統計卡片用 */
function unassignedMembers(k){ const a=assignedIds(k); return state.members.filter(m=>m.active&&!a.has(m.id)); }
function ensureDate(k){ if(!state.schedule[k]) state.schedule[k]=[]; }

function toast(msg){
  document.querySelectorAll('.toast').forEach(t=>t.remove());
  const el=document.createElement('div'); el.className='toast'; el.textContent=msg;
  document.body.appendChild(el);
  setTimeout(()=>{ el.style.transition='opacity .3s'; el.style.opacity='0'; setTimeout(()=>el.remove(),300); },1900);
}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function hexA(hex,a){ const h=hex.replace('#',''); const r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16); return `rgba(${r},${g},${b},${a})`; }

