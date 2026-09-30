import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {BRAND} from '../brand';
import {CardRow} from '../components/CardRow';
import {Backdrop, Chip, TopTag, popIn, slideUp} from '../components/Chrome';
import {Banknote, Database, Envelope, Flag, Folder, Laptop, Lock, Power, Refresh, Server, Shield, Stopwatch, Trash} from '../components/Icons';
import {Contact, Slogan} from '../components/Slogan';
import {Subtitles} from '../components/Subtitles';
import {easeIn, easeOut, keyframes, lerp, progress} from '../lib/anim';
import {getScene, phraseAt, sceneEnd, Timeline} from '../lib/timeline';
import {C, FONT, MONO} from '../theme';
import timeline from '../data/video4.timeline.json';

export const tl4 = timeline as unknown as Timeline;

const FILES = [
  {name: '報價單', ext: 'xlsx', color: C.green},
  {name: '訂單明細', ext: 'pdf', color: C.red},
  {name: '產品規格', ext: 'docx', color: C.link},
  {name: '客戶名單', ext: 'xlsx', color: C.green},
  {name: '會議紀錄', ext: 'docx', color: C.link},
  {name: '出貨排程', ext: 'xlsx', color: C.green},
  {name: '設計圖', ext: 'dwg', color: '#E08E0B'},
  {name: '合約草稿', ext: 'docx', color: C.link},
];

const FileIcon: React.FC<{color: string; ext: string; locked: boolean}> = ({color, ext, locked}) => (
  <div style={{position: 'relative', width: 96, height: 120}}>
    <svg width={96} height={120} viewBox="0 0 64 80">
      <path d="M4 4 H44 L60 20 V76 H4 Z" fill={locked ? '#B7C2D2' : color} />
      <path d="M44 4 V20 H60" fill="rgba(255,255,255,0.45)" />
      <text x="32" y="58" textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff" fontFamily="DejaVu Sans, sans-serif">
        {ext.toUpperCase()}
      </text>
    </svg>
    {locked && <Lock size={50} color={C.red} style={{position: 'absolute', right: -16, bottom: -10}} />}
  </div>
);

/** S1：檔案被加密 → 勒索畫面 */
const LockedScene: React.FC<{f: number}> = ({f}) => {
  const s = getScene(tl4, 's1_locked');
  const end = sceneEnd(s);
  if (f >= end) return null;
  const opacity = Math.min(easeIn(f, 0, 14), easeOut(f, end - 10, 10));
  const ransomAt = phraseAt(s, 1, 2);
  const labelAt = phraseAt(s, 1, 3);
  const lockAt = (i: number) => 38 + i * 6;
  const secs = 59 - Math.max(0, Math.floor((f - ransomAt) / 30));
  return (
    <AbsoluteFill style={{opacity, fontFamily: FONT}}>
      <div style={{position: 'absolute', left: 330, top: 120, width: 1260, height: 720, borderRadius: 22, background: C.paper, overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,0.5)', ...slideUp(f, 0, 30)}}>
        <div style={{height: 56, background: '#E4EAF2', borderBottom: `2px solid ${C.paperLine}`, display: 'flex', alignItems: 'center', gap: 12, padding: '0 24px', fontSize: 24, fontWeight: 700, color: C.inkSoft}}>
          <Folder size={34} />
          共用資料夾 ─ 業務部
        </div>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', rowGap: 36, padding: '50px 40px'}}>
          {FILES.map((file, i) => {
            const locked = f >= lockAt(i);
            return (
              <div key={file.name} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, transform: `scale(${locked && f < lockAt(i) + 6 ? 1.08 : 1})`}}>
                <FileIcon color={file.color} ext={file.ext} locked={locked} />
                <div style={{fontSize: 24, color: C.ink, whiteSpace: 'nowrap'}}>
                  {file.name}.{file.ext}
                  {locked && <span style={{color: C.red, fontWeight: 700}}>.locked</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {f >= ransomAt && (
        <div
          style={{
            position: 'absolute',
            left: 500,
            top: 230,
            width: 920,
            height: 520,
            borderRadius: 26,
            background: '#3A0F14',
            border: `5px solid ${C.red}`,
            boxShadow: '0 30px 90px rgba(0,0,0,0.6)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            color: C.white,
            ...popIn(f, ransomAt, 0.7),
          }}
        >
          <Lock size={96} color={C.red} />
          <div style={{fontSize: 56, fontWeight: 700}}>你的檔案已被加密</div>
          <div style={{fontSize: 34, color: C.yellow, fontWeight: 700}}>72 小時內付款，才能取回檔案</div>
          <div style={{fontFamily: MONO, fontSize: 60, color: '#FF6B6F', fontWeight: 700}}>71:59:{String(secs).padStart(2, '0')}</div>
        </div>
      )}
      {f >= labelAt && (
        <div style={{position: 'absolute', left: 0, right: 0, top: 150, display: 'flex', justifyContent: 'center', ...popIn(f, labelAt, 0.5)}}>
          <Chip color={C.red} size={46} style={{padding: '12px 40px'}}>這就是勒索病毒</Chip>
        </div>
      )}
    </AbsoluteFill>
  );
};

const NODES = [
  {x: 480, y: 270, label: '共用資料夾', icon: <Folder size={96} />},
  {x: 1440, y: 270, label: '同事電腦', icon: <Laptop width={110} />},
  {x: 480, y: 690, label: '同事電腦', icon: <Laptop width={110} />},
  {x: 1440, y: 690, label: '伺服器', icon: <Server size={96} />},
];
const CENTER = {x: 960, y: 480};

const Node: React.FC<{x: number; y: number; label: string; icon: React.ReactNode; infected: number; appear: number}> = ({x, y, label, icon, infected, appear}) => (
  <div
    style={{
      position: 'absolute',
      left: x - 120,
      top: y - 95,
      width: 240,
      height: 190,
      borderRadius: 26,
      background: infected > 0 ? `rgba(229,72,77,${0.18 * infected})` : C.panel,
      border: `4px solid ${infected > 0.5 ? C.red : C.panelLine}`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      color: C.white,
      fontSize: 30,
      fontWeight: 700,
      opacity: appear,
      transform: `scale(${0.9 + 0.1 * appear})`,
    }}
  >
    <div style={{height: 90, display: 'flex', alignItems: 'center'}}>{icon}</div>
    {label}
    {infected > 0.5 && <Lock size={54} color={C.red} style={{position: 'absolute', right: -18, top: -22}} />}
  </div>
);

/** S2：透過網路擴散 */
const SpreadScene: React.FC<{f: number}> = ({f}) => {
  const s = getScene(tl4, 's2_spread');
  const end = sceneEnd(s);
  if (f < s.from || f >= end) return null;
  const opacity = Math.min(easeIn(f, s.from, 12), easeOut(f, end - 10, 10));
  const spread = phraseAt(s, 1, 2);
  const hit = (k: number) => spread + k * 10;
  return (
    <AbsoluteFill style={{opacity, fontFamily: FONT}}>
      <svg style={{position: 'absolute', inset: 0}} width={1920} height={1080}>
        {NODES.map((n, k) => {
          const t = progress(f, hit(k), 16);
          return (
            <g key={k}>
              <line x1={CENTER.x} y1={CENTER.y} x2={n.x} y2={n.y} stroke={C.panelLine} strokeWidth="8" strokeLinecap="round" />
              <line x1={CENTER.x} y1={CENTER.y} x2={lerp(CENTER.x, n.x, t)} y2={lerp(CENTER.y, n.y, t)} stroke={C.red} strokeWidth="8" strokeLinecap="round" />
            </g>
          );
        })}
      </svg>
      {NODES.map((n, k) => (
        <Node key={k} {...n} infected={easeIn(f, hit(k) + 16, 6)} appear={easeIn(f, s.from + 4 + k * 4, 10)} />
      ))}
      <Node x={CENTER.x} y={CENTER.y} label="你的電腦" icon={<Laptop width={120} />} infected={easeIn(f, s.lines[0].from, 8)} appear={easeIn(f, s.from, 10)} />
    </AbsoluteFill>
  );
};

const WifiArcs: React.FC<{on: number}> = ({on}) => (
  <svg width={150} height={120} viewBox="0 0 100 80">
    {[36, 24, 12].map((r, i) => (
      <path key={r} d={`M${50 - r * 1.3} ${70 - r} A${r * 1.6} ${r * 1.6} 0 0 1 ${50 + r * 1.3} ${70 - r}`} fill="none" stroke={on > 0.5 ? C.white : C.dim} strokeWidth="7" strokeLinecap="round" opacity={on > 0.5 ? 1 : 0.6 - i * 0.1} />
    ))}
    <circle cx="50" cy="70" r="7" fill={on > 0.5 ? C.white : C.dim} />
  </svg>
);

/** S3：第一步，斷網；拔不掉就先關機 */
const UnplugScene: React.FC<{f: number}> = ({f}) => {
  const s = getScene(tl4, 's3_unplug');
  const end = sceneEnd(s);
  if (f < s.from || f >= end) return null;
  const opacity = Math.min(easeIn(f, s.from, 12), easeOut(f, end - 10, 10));
  const cableAt = phraseAt(s, 1, 2);
  const wifiAt = phraseAt(s, 1, 3);
  const stopAt = phraseAt(s, 1, 4);
  const powerAt = phraseAt(s, 2, 2);
  const pull = keyframes(f, [cableAt + 4, cableAt + 16], [0, 1]);
  const off = keyframes(f, [wifiAt + 4, wifiAt + 12], [0, 1]);
  const panel = (x: number, at: number, title: string, body: React.ReactNode, done: boolean) => (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: 200,
        width: 570,
        height: 360,
        borderRadius: 30,
        background: C.panel,
        border: `4px solid ${done ? C.green : C.panelLine}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 30,
        ...slideUp(f, at - 4, 30),
      }}
    >
      <div style={{height: 150, display: 'flex', alignItems: 'center'}}>{body}</div>
      <div style={{fontSize: 48, fontWeight: 700, color: done ? '#4CC38A' : C.white}}>{title}</div>
    </div>
  );
  return (
    <AbsoluteFill style={{opacity, fontFamily: FONT, color: C.white}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 104, display: 'flex', justifyContent: 'center', ...popIn(f, s.lines[0].from, 0.5)}}>
        <Chip color={C.yellow} style={{color: C.bg}} size={44}>第一步：先斷網</Chip>
      </div>
      {panel(
        330,
        cableAt,
        '拔掉網路線',
        <svg width={360} height={150} viewBox="0 0 240 100">
          <rect x="10" y="24" width="60" height="52" rx="8" fill="#9FB3CF" />
          <rect x="24" y="38" width="32" height="24" rx="3" fill={C.bgDeep} />
          <g transform={`translate(${pull * 60} 0)`}>
            <rect x="56" y="40" width="26" height="20" rx="3" fill="#DCE6F3" />
            <rect x="80" y="34" width="44" height="32" rx="6" fill="#DCE6F3" />
            <path d="M124 50 C170 50 170 80 230 80" stroke="#DCE6F3" strokeWidth="10" fill="none" strokeLinecap="round" />
          </g>
          {pull > 0.9 && <path d="M86 20 l6 10 M100 14 v12 M114 20 l-6 10" stroke={C.yellow} strokeWidth="4" strokeLinecap="round" />}
        </svg>,
        pull > 0.99,
      )}
      {panel(
        1020,
        wifiAt,
        '關閉無線網路',
        <div style={{display: 'flex', alignItems: 'center', gap: 36}}>
          <WifiArcs on={1 - off} />
          <div style={{width: 150, height: 76, borderRadius: 38, background: off > 0.5 ? C.dim : C.green, position: 'relative'}}>
            <div style={{position: 'absolute', top: 8, left: lerp(82, 8, off), width: 60, height: 60, borderRadius: 30, background: '#fff'}} />
          </div>
        </div>,
        off > 0.99,
      )}
      {f >= stopAt && (
        <div style={{position: 'absolute', left: 0, right: 0, top: 590, display: 'flex', justifyContent: 'center', ...popIn(f, stopAt, 0.5)}}>
          <Chip color={C.green} size={38} icon={<Shield size={40} color="#fff" fill="rgba(255,255,255,0.2)" />}>阻止病毒擴散</Chip>
        </div>
      )}
      {f >= s.lines[1].from && (
        <div
          style={{
            position: 'absolute',
            left: 560,
            top: 700,
            width: 800,
            height: 130,
            borderRadius: 30,
            background: C.panel,
            border: `4px solid ${f >= powerAt ? C.yellow : C.panelLine}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 26,
            fontSize: 46,
            fontWeight: 700,
            ...slideUp(f, s.lines[1].from, 30),
          }}
        >
          <Power size={76} color={f >= powerAt ? C.yellow : C.muted} />
          拔不掉網路？<span style={{color: C.yellow, opacity: easeIn(f, powerAt, 8)}}>就先關機</span>
        </div>
      )}
    </AbsoluteFill>
  );
};

const DownloadTool: React.FC = () => (
  <svg width={110} height={110} viewBox="0 0 64 64">
    <path d="M32 6 V38 M20 26 L32 38 L44 26" stroke="#fff" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10 44 V56 H54 V44" stroke="#fff" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** S4：不付款、不自己處理、保留現場 */
const DontScene: React.FC<{f: number}> = ({f}) => {
  const s = getScene(tl4, 's4_dont');
  const end = sceneEnd(s);
  if (f < s.from || f >= end) return null;
  const opacity = Math.min(easeIn(f, s.from, 12), easeOut(f, end - 10, 10));
  const keepAt = phraseAt(s, 1, 4);
  return (
    <AbsoluteFill style={{opacity, fontFamily: FONT, color: C.white}}>
      <div style={{position: 'absolute', top: 108, left: 0, right: 0, textAlign: 'center', fontSize: 54, fontWeight: 700, ...slideUp(f, s.from + 4, 24)}}>中毒了，千萬不要</div>
      <CardRow
        frame={f}
        kind="x"
        ats={[1, 2, 3].map((i) => phraseAt(s, 1, i))}
        cards={[
          {icon: <Banknote size={120} />, label: '不要付款', desc: '付了也不一定拿得回'},
          {icon: <Trash size={100} />, label: '不自己刪檔', desc: '刪掉會破壞線索'},
          {icon: <DownloadTool />, label: '不找工具解密', desc: '來路不明的工具更危險'},
        ]}
      />
      {f >= keepAt && (
        <div style={{position: 'absolute', left: 0, right: 0, top: 690, display: 'flex', justifyContent: 'center', ...popIn(f, keepAt, 0.5)}}>
          <Chip color={C.yellow} style={{color: C.bg}} size={44}>保留現場，等資訊人員處理</Chip>
        </div>
      )}
    </AbsoluteFill>
  );
};

/** S5：拍照、回報給 Henry */
const ReportScene: React.FC<{f: number}> = ({f}) => {
  const s = getScene(tl4, 's5_report');
  const end = sceneEnd(s);
  if (f < s.from || f >= end) return null;
  const opacity = Math.min(easeIn(f, s.from, 12), easeOut(f, end - 10, 10));
  const shutter = s.cues.shutter;
  const reportAt = phraseAt(s, 1, 2);
  const henryAt = phraseAt(s, 1, 3);
  const soonAt = s.lines[1].from;
  const flash = f >= shutter ? Math.max(0, 1 - (f - shutter) / 8) : 0;
  return (
    <AbsoluteFill style={{opacity, fontFamily: FONT, color: C.white}}>
      <div style={{position: 'absolute', left: 300, top: 140, width: 400, height: 700, borderRadius: 50, background: '#1B2A40', padding: 16, boxSizing: 'border-box', boxShadow: '0 30px 80px rgba(0,0,0,0.55)', ...slideUp(f, s.from + 2, 30)}}>
        <div style={{position: 'relative', width: '100%', height: '100%', borderRadius: 36, background: '#0A0F18', overflow: 'hidden'}}>
          <div style={{position: 'absolute', left: 30, right: 30, top: 150, height: 300, borderRadius: 14, background: '#3A0F14', border: `4px solid ${C.red}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10}}>
            <Lock size={60} color={C.red} />
            <div style={{fontSize: 26, fontWeight: 700}}>你的檔案已被加密</div>
            <div style={{fontFamily: MONO, fontSize: 30, color: '#FF6B6F'}}>71:58:12</div>
          </div>
          {['left', 'right'].map((side) =>
            ['top', 'bottom'].map((v) => (
              <div key={side + v} style={{position: 'absolute', [side]: 20, [v]: v === 'top' ? 130 : 210, width: 40, height: 40, [`border${side === 'left' ? 'Left' : 'Right'}`]: '5px solid #fff', [`border${v === 'top' ? 'Top' : 'Bottom'}`]: '5px solid #fff'}} />
            )),
          )}
          <div style={{position: 'absolute', left: '50%', bottom: 50, width: 90, height: 90, marginLeft: -45, borderRadius: 45, border: '6px solid #fff', boxSizing: 'border-box', transform: `scale(${f >= shutter && f < shutter + 5 ? 0.85 : 1})`}}>
            <div style={{position: 'absolute', inset: 8, borderRadius: '50%', background: '#fff'}} />
          </div>
          <div style={{position: 'absolute', inset: 0, background: '#fff', opacity: flash}} />
        </div>
      </div>
      {f >= reportAt && (
        <div style={{position: 'absolute', left: 820, top: 240, ...popIn(f, reportAt, 0.5), transformOrigin: '0% 50%'}}>
          <Chip color={C.red} size={42} icon={<Flag size={46} />}>立刻回報</Chip>
        </div>
      )}
      {f >= henryAt && (
        <div
          style={{
            position: 'absolute',
            left: 820,
            top: 370,
            width: 820,
            height: 150,
            borderRadius: 34,
            background: C.green,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 22,
            fontSize: 52,
            fontWeight: 700,
            boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
            ...slideUp(f, henryAt, 30),
          }}
        >
          <Shield size={70} color="#fff" fill="rgba(255,255,255,0.2)" check={1} />
          交給資訊部 {BRAND.contact} 處理
        </div>
      )}
      {f >= soonAt && (
        <div style={{position: 'absolute', left: 820, top: 590, ...popIn(f, soonAt, 0.5), transformOrigin: '0% 50%'}}>
          <Chip color={C.yellow} style={{color: C.bg}} size={42} icon={<Stopwatch size={48} color={C.bg} />}>
            越早回報，損失越小
          </Chip>
        </div>
      )}
    </AbsoluteFill>
  );
};

const AttachmentIcon: React.FC = () => (
  <div style={{position: 'relative'}}>
    <Envelope size={110} />
    <svg width={50} height={70} viewBox="0 0 30 42" style={{position: 'absolute', right: -24, top: -30}}>
      <path d="M22 14 V30 a8 8 0 0 1 -16 0 V10 a5 5 0 0 1 10 0 V28 a2 2 0 0 1 -4 0 V14" stroke={C.yellow} strokeWidth="3.5" fill="none" strokeLinecap="round" />
    </svg>
  </div>
);

/** S6：平常就做好：備份、更新、不開可疑附件 */
const PreventScene: React.FC<{f: number}> = ({f}) => {
  const s = getScene(tl4, 's6_prevent');
  const end = sceneEnd(s);
  if (f < s.from || f >= end) return null;
  const opacity = Math.min(easeIn(f, s.from, 12), easeOut(f, end - 10, 10));
  const riskAt = phraseAt(s, 1, 4);
  return (
    <AbsoluteFill style={{opacity, fontFamily: FONT, color: C.white}}>
      <div style={{position: 'absolute', top: 108, left: 0, right: 0, textAlign: 'center', fontSize: 54, fontWeight: 700, ...slideUp(f, s.from + 4, 24)}}>平常就做好</div>
      <CardRow
        frame={f}
        kind="check"
        ats={[1, 2, 3].map((i) => phraseAt(s, 1, i))}
        cards={[
          {icon: <Database size={96} />, label: '做好備份', desc: '重要檔案定期備份'},
          {icon: <Refresh size={100} />, label: '更新系統', desc: '公司推送的更新要裝'},
          {icon: <AttachmentIcon />, label: '不開可疑附件', desc: '不明來源不要開'},
        ]}
      />
      {f >= riskAt && (
        <div style={{position: 'absolute', left: 0, right: 0, top: 690, display: 'flex', justifyContent: 'center', ...popIn(f, riskAt, 0.5)}}>
          <Chip color={C.green} size={44} icon={<Shield size={48} color="#fff" fill="rgba(255,255,255,0.2)" check={1} />}>
            大幅降低風險
          </Chip>
        </div>
      )}
    </AbsoluteFill>
  );
};

/** S7：先斷網、不付款、快回報 */
const EndingScene: React.FC<{f: number}> = ({f}) => {
  const s = getScene(tl4, 's7_slogan');
  const end = sceneEnd(s);
  if (f < s.from || f >= end) return null;
  const [w1, w2, w3] = [1, 2, 3].map((i) => phraseAt(s, 1, i));
  const word = (text: string, color: string, at: number) => (
    <span style={{color, display: 'inline-block', ...slideUp(f, at, 30, 10)}}>{text}</span>
  );
  return (
    <AbsoluteFill style={{opacity: easeIn(f, s.from, 12)}}>
      <Slogan
        frame={f}
        iconAt={s.from + 4}
        icon={<Shield size={170} check={easeIn(f, w3 + 6, 14)} />}
        rows={[
          {
            content: (
              <>
                {word('先斷網', C.yellow, w1)}
                {word('、', C.white, w2)}
                {word('不付款', '#FF6B6F', w2)}
                {word('、', C.white, w3)}
                {word('快回報', '#4CC38A', w3)}
              </>
            ),
            at: s.from,
            size: 128,
          },
        ]}
        pills={[
          {text: '拔網路線', color: C.yellow},
          {text: '關無線網路', color: C.yellow},
          {text: '拍照回報', color: '#4CC38A'},
        ]}
        pillsAt={w3 + 12}
        footer={<>發現勒索病毒，立刻通報 <Contact /></>}
        footerAt={w3 + 24}
      />
    </AbsoluteFill>
  );
};

/** 影片四：勒索病毒應變 */
export const Video4: React.FC = () => {
  const f = useCurrentFrame();
  const fadeOut = progress(f, tl4.durationInFrames - 20, 20);
  return (
    <AbsoluteFill style={{background: C.bg, fontFamily: FONT}}>
      <Backdrop />
      <LockedScene f={f} />
      <SpreadScene f={f} />
      <UnplugScene f={f} />
      <DontScene f={f} />
      <ReportScene f={f} />
      <PreventScene f={f} />
      <EndingScene f={f} />
      <TopTag company={BRAND.company} label="資安宣導｜勒索病毒應變" />
      <Subtitles tl={tl4} />
      <AbsoluteFill style={{background: C.bgDeep, opacity: fadeOut}} />
    </AbsoluteFill>
  );
};
