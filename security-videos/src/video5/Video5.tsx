import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {BRAND} from '../brand';
import {Backdrop, Chip, Cursor, Ripple, TopTag, popIn, slideUp} from '../components/Chrome';
import {Badge, Bug, Envelope, FormIcon, LegalMark, Server, Shield, WarningTriangle} from '../components/Icons';
import {Contact, Slogan} from '../components/Slogan';
import {Subtitles} from '../components/Subtitles';
import {easeIn, easeOut, keyframes, lerp, pop, progress} from '../lib/anim';
import {getScene, phraseAt, sceneEnd, Timeline} from '../lib/timeline';
import {C, FONT, MONO} from '../theme';
import timeline from '../data/video5.timeline.json';

export const tl5 = timeline as unknown as Timeline;

const fade = (f: number, from: number, end: number) => Math.min(easeIn(f, from, 12), easeOut(f, end - 10, 10));

/** S1：更新提醒一直按「稍後」＝門一直開著 */
const LaterScene: React.FC<{f: number}> = ({f}) => {
  const s = getScene(tl5, 's1_later');
  const end = sceneEnd(s);
  if (f >= end) return null;
  const clicks = [s.cues.later1, s.cues.later2, s.cues.later3];
  const n = clicks.filter((c) => f >= c).length;
  const hidden = clicks.some((c) => f >= c && f < c + 10);
  const doorAt = phraseAt(s, 1, 2);
  const open = keyframes(f, [clicks[0], clicks[2] + 10], [0.1, 0.75]);
  const btn = {x: 1485, y: 648};
  const cur = f < clicks[0] ? {x: lerp(1300, btn.x, easeIn(f, 20, 14)), y: lerp(420, btn.y, easeIn(f, 20, 14))} : btn;
  return (
    <AbsoluteFill style={{opacity: fade(f, 0, end), fontFamily: FONT}}>
      {/* 門 */}
      <div style={{position: 'absolute', left: 150, top: 250, width: 300, height: 500, ...slideUp(f, 4, 30)}}>
        <div style={{position: 'absolute', inset: 0, borderRadius: 8, background: '#07101C', border: `12px solid ${C.panelLine}`}} />
        <div
          style={{
            position: 'absolute',
            left: 12,
            top: 12,
            width: 276,
            height: 476,
            background: '#8A6A4A',
            borderRadius: 4,
            transform: `perspective(800px) rotateY(${-open * 80}deg)`,
            transformOrigin: '0% 50%',
            boxShadow: 'inset 0 0 0 10px rgba(0,0,0,0.12)',
          }}
        >
          <div style={{position: 'absolute', right: 26, top: 230, width: 22, height: 22, borderRadius: 11, background: C.yellow}} />
        </div>
        {f >= doorAt && <Bug size={100} style={{position: 'absolute', left: 150, top: 360, ...popIn(f, doorAt + 6, 0.3)}} />}
      </div>
      {f >= doorAt && (
        <div style={{position: 'absolute', left: 150, top: 790, width: 300, display: 'flex', justifyContent: 'center', ...popIn(f, doorAt, 0.5)}}>
          <Chip color={C.red} size={34}>門一直開著</Chip>
        </div>
      )}
      {/* 螢幕 */}
      <div style={{position: 'absolute', left: 560, top: 130, width: 1080, height: 610, borderRadius: 20, background: '#1B2A40', padding: 14, boxSizing: 'border-box', ...slideUp(f, 0, 30)}}>
        <div style={{position: 'relative', width: '100%', height: '100%', borderRadius: 10, overflow: 'hidden', background: 'linear-gradient(135deg, #1E3A5F, #2F5D8C)'}}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{position: 'absolute', left: 30, top: 30 + i * 110, width: 70, height: 80, borderRadius: 10, background: 'rgba(255,255,255,0.18)'}} />
          ))}
          <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 50, background: 'rgba(10,20,34,0.85)'}} />
          {f >= 12 && !hidden && (
            <div style={{position: 'absolute', right: 24, bottom: 70, width: 470, borderRadius: 14, background: C.paper, padding: '20px 24px', color: C.ink, boxShadow: '0 12px 30px rgba(0,0,0,0.4)', ...slideUp(f, 12, 20)}}>
              <div style={{fontSize: 27, fontWeight: 700}}>系統更新已準備就緒</div>
              <div style={{fontSize: 22, color: C.inkSoft, marginTop: 6}}>需要重新開機才能完成安裝</div>
              <div style={{display: 'flex', gap: 14, marginTop: 16}}>
                <div style={{flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 10, background: C.link, color: '#fff', fontSize: 22, fontWeight: 700}}>立即重新開機</div>
                <div style={{flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 10, border: `2px solid ${C.paperLine}`, fontSize: 22}}>稍後提醒</div>
              </div>
            </div>
          )}
        </div>
      </div>
      {n > 0 && (
        <div style={{position: 'absolute', left: 1180, top: 60, transformOrigin: '50% 50%', transform: `scale(${1 + 0.15 * Math.max(0, 1 - (f - clicks[n - 1]) / 8)})`}}>
          <Chip color={C.yellow} style={{color: C.bg}} size={36}>已延後 {n} 次</Chip>
        </div>
      )}
      {clicks.map((c) => (
        <Ripple key={c} x={btn.x} y={btn.y} frame={f} at={c} color={C.link} />
      ))}
      {f >= 20 && <Cursor x={cur.x} y={cur.y} press={clicks.some((c) => f >= c && f < c + 4) ? 1 : 0} opacity={Math.min(easeIn(f, 20, 8), easeOut(f, clicks[2] + 30, 10))} />}
    </AbsoluteFill>
  );
};

const Wall: React.FC<{crack: boolean; patch: number; danger: boolean}> = ({crack, patch, danger}) => (
  <svg width={560} height={300} viewBox="0 0 560 300">
    {Array.from({length: 6}).map((_, r) =>
      Array.from({length: 6}).map((__, c) => {
        const w = 100;
        const x = c * w - (r % 2 ? 50 : 0);
        return <rect key={`${r}-${c}`} x={x + 4} y={r * 50 + 4} width={w - 8} height={42} rx="4" fill={danger ? '#6B2A30' : '#7A5B45'} />;
      }),
    )}
    {crack && <path d="M280 20 L262 80 L296 120 L258 170 L290 220 L270 280" stroke={danger ? C.red : '#1A0F0A'} strokeWidth="12" fill="none" strokeLinejoin="round" />}
    {patch > 0 && (
      <g transform={`translate(278 150) scale(${patch})`}>
        <rect x="-70" y="-120" width="140" height="240" rx="18" fill={C.green} />
        <path d="M-30 0 L-8 22 L34 -24" stroke="#fff" strokeWidth="12" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    )}
  </svg>
);

/** S2：更新＝補洞；駭客專找沒更新的電腦 */
const PatchScene: React.FC<{f: number}> = ({f}) => {
  const s = getScene(tl5, 's2_patch');
  const end = sceneEnd(s);
  if (f < s.from || f >= end) return null;
  const patchAt = s.lines[0].from;
  const hackAt = phraseAt(s, 1, 2);
  const oldAt = phraseAt(s, 2, 2);
  const bugT = keyframes(f, [hackAt, hackAt + 26], [0, 1]);
  const inside = f >= hackAt + 26;
  const panel = (x: number, title: string, color: string, body: React.ReactNode, border: string) => (
    <div style={{position: 'absolute', left: x, top: 180, width: 670, height: 500, borderRadius: 30, background: C.panel, border: `4px solid ${border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, paddingTop: 28, boxSizing: 'border-box', ...slideUp(f, s.from + 2, 30)}}>
      <div style={{fontSize: 44, fontWeight: 700, color}}>{title}</div>
      {body}
    </div>
  );
  return (
    <AbsoluteFill style={{opacity: fade(f, s.from, end), fontFamily: FONT, color: C.white}}>
      {panel(230, '沒更新的電腦', '#FF6B6F', <Wall crack patch={0} danger={inside} />, inside ? C.red : C.panelLine)}
      {panel(1020, '已更新的電腦', '#4CC38A', <Wall crack patch={pop(f, patchAt + 6)} danger={false} />, f >= patchAt + 10 ? C.green : C.panelLine)}
      {f < hackAt + 30 && f >= hackAt - 4 && (
        <Bug size={110} style={{position: 'absolute', left: lerp(900, 510, bugT), top: lerp(760, 420, bugT), transform: `scale(${1 - 0.6 * Math.max(0, bugT - 0.7) / 0.3}) rotate(${-40 * bugT}deg)`, opacity: easeIn(f, hackAt - 4, 6)}} />
      )}
      {f >= patchAt + 10 && (
        <div style={{position: 'absolute', left: 1020, width: 670, top: 700, display: 'flex', justifyContent: 'center', ...popIn(f, patchAt + 10, 0.5)}}>
          <Chip color={C.green} size={34}>漏洞已修補</Chip>
        </div>
      )}
      {inside && (
        <div style={{position: 'absolute', left: 230, width: 670, top: 700, display: 'flex', justifyContent: 'center', ...popIn(f, hackAt + 26, 0.5)}}>
          <Chip color={C.red} size={34} icon={<Bug size={40} color="#fff" />}>駭客從漏洞入侵</Chip>
        </div>
      )}
      {f >= oldAt && (
        <div style={{position: 'absolute', left: 0, right: 0, top: 790, display: 'flex', justifyContent: 'center', ...popIn(f, oldAt, 0.5)}}>
          <Chip color={C.yellow} style={{color: C.bg}} size={38}>修補早就有了，只是沒安裝</Chip>
        </div>
      )}
    </AbsoluteFill>
  );
};

const Monitor: React.FC<{w?: number; lit?: number}> = ({w = 120, lit = 0}) => (
  <div style={{width: w, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
    <div style={{width: w, height: w * 0.62, borderRadius: 8, background: '#2A3E5C', padding: 6, boxSizing: 'border-box'}}>
      <div style={{width: '100%', height: '100%', borderRadius: 4, background: lit > 0.5 ? C.green : '#9FB3CF', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        {lit > 0.5 && <Badge kind="check" size={w * 0.34} p={lit} />}
      </div>
    </div>
    <div style={{width: w * 0.2, height: 14, background: '#2A3E5C'}} />
    <div style={{width: w * 0.5, height: 8, borderRadius: 4, background: '#2A3E5C'}} />
  </div>
);

/** S3：公司自動推送更新；重新開機提醒就讓它完成 */
const InstallScene: React.FC<{f: number}> = ({f}) => {
  const s = getScene(tl5, 's3_install');
  const end = sceneEnd(s);
  if (f < s.from || f >= end) return null;
  const pushAt = s.lines[0].from;
  const [remind, save, finish] = [1, 2, 3].map((i) => phraseAt(s, 2, i));
  const pc = [0, 1, 2, 3];
  const steps = [
    {at: remind, title: '重新開機提醒', body: <WarningTriangle size={70} color={C.yellow} />},
    {at: save, title: '存好檔案', body: <Badge kind="check" size={76} p={easeIn(f, save + 4, 10)} />},
    {
      at: finish,
      title: '安裝更新',
      body: (
        <div style={{width: 200}}>
          <div style={{height: 22, borderRadius: 11, background: C.bgDeep, overflow: 'hidden'}}>
            <div style={{height: '100%', width: `${progress(f, finish, 30) * 100}%`, background: C.green}} />
          </div>
          <div style={{textAlign: 'center', fontFamily: MONO, fontSize: 28, marginTop: 10}}>{Math.round(progress(f, finish, 30) * 100)}%</div>
        </div>
      ),
    },
    {at: finish + 32, title: '完成', body: <Shield size={80} check={easeIn(f, finish + 36, 12)} />},
  ];
  return (
    <AbsoluteFill style={{opacity: fade(f, s.from, end), fontFamily: FONT, color: C.white}}>
      <div style={{position: 'absolute', left: 330, top: 150, width: 260, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, fontSize: 34, fontWeight: 700, ...slideUp(f, s.from + 2, 20)}}>
        <Server size={120} />
        {BRAND.company} 資訊部
      </div>
      <svg style={{position: 'absolute', left: 0, top: 0}} width={1920} height={1080}>
        {pc.map((i) => {
          // 從伺服器呈扇形連到每台電腦底座（二次曲線，從電腦列下方繞上去）
          const a = {x: 560, y: 215};
          const b = {x: 1165 + i * 170, y: 262};
          const c = {x: 860 + i * 60, y: 430};
          const t = ((f - pushAt + i * 7) % 30) / 30;
          const q = (u: number, k: 'x' | 'y') => (1 - u) ** 2 * a[k] + 2 * (1 - u) * u * c[k] + u ** 2 * b[k];
          return (
            <g key={i}>
              <path d={`M${a.x} ${a.y} Q${c.x} ${c.y} ${b.x} ${b.y}`} stroke={C.panelLine} strokeWidth="5" strokeDasharray="12 10" fill="none" />
              {f >= pushAt && <circle cx={q(t, 'x')} cy={q(t, 'y')} r="9" fill={C.green} />}
            </g>
          );
        })}
      </svg>
      {f >= pushAt && (
        <div style={{position: 'absolute', left: 700, top: 120, ...popIn(f, pushAt, 0.5)}}>
          <Chip color={C.green} size={34}>自動推送更新</Chip>
        </div>
      )}
      <div style={{position: 'absolute', left: 1100, top: 150, display: 'grid', gridTemplateColumns: 'repeat(4, 150px)', gap: 20}}>
        {pc.map((i) => (
          <div key={i} style={{...slideUp(f, s.from + 6 + i * 3, 20)}}>
            <Monitor w={130} lit={easeIn(f, pushAt + 20 + i * 6, 8)} />
          </div>
        ))}
      </div>
      {steps.map((st, i) =>
        f >= st.at - 2 ? (
          <div
            key={st.title}
            style={{
              position: 'absolute',
              left: 190 + i * 400,
              top: 500,
              width: 340,
              height: 300,
              borderRadius: 28,
              background: C.panel,
              border: `4px solid ${i === 3 ? C.green : C.panelLine}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 26,
              ...slideUp(f, st.at - 2, 26),
            }}
          >
            <div style={{height: 100, display: 'flex', alignItems: 'center'}}>{st.body}</div>
            <div style={{fontSize: 38, fontWeight: 700, color: i === 3 ? '#4CC38A' : C.white}}>{st.title}</div>
          </div>
        ) : null,
      )}
    </AbsoluteFill>
  );
};

/** S4：網頁跳出的「更新」多半是陷阱 */
const FakeUpdateScene: React.FC<{f: number}> = ({f}) => {
  const s = getScene(tl5, 's4_fakeupdate');
  const end = sceneEnd(s);
  if (f < s.from || f >= end) return null;
  const popAt = s.lines[0].from + 8;
  const trapAt = phraseAt(s, 1, 2);
  const realAt = s.lines[1].from;
  const close = s.cues.closeTab;
  const closeBtn = {x: 652, y: 147}; // 分頁上的「×」
  const ct = keyframes(f, [phraseAt(s, 2, 2), close - 2], [0, 1]);
  const closed = easeIn(f, close + 2, 10);
  const shake = f >= popAt && f < trapAt ? Math.sin(f / 2) * 3 : 0;
  return (
    <AbsoluteFill style={{opacity: fade(f, s.from, end), fontFamily: FONT}}>
      <div style={{position: 'absolute', left: 300, top: 110, width: 1320, height: 740, borderRadius: 20, background: C.paper, overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,0.5)', opacity: 1 - closed, transform: `scale(${1 - 0.05 * closed})`}}>
        <div style={{height: 60, background: '#E4EAF2', display: 'flex', alignItems: 'flex-end', padding: '0 20px'}}>
          <div style={{width: 360, height: 46, background: C.paper, borderRadius: '12px 12px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px', fontSize: 22, color: C.ink}}>
            每日新聞快報
            <span style={{fontSize: 26, color: C.inkSoft}}>×</span>
          </div>
        </div>
        <div style={{height: 56, borderBottom: `2px solid ${C.paperLine}`, display: 'flex', alignItems: 'center', padding: '0 24px'}}>
          <div style={{flex: 1, height: 38, borderRadius: 19, background: C.paperAlt, fontFamily: MONO, fontSize: 21, color: C.inkSoft, display: 'flex', alignItems: 'center', paddingLeft: 20}}>
            http://news-daily.example/article/2026
          </div>
        </div>
        <div style={{padding: '40px 60px'}}>
          <div style={{width: 700, height: 36, borderRadius: 8, background: '#C8D3E2'}} />
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} style={{width: 1100 - (i % 3) * 140, height: 18, borderRadius: 9, background: '#E2E8F0', marginTop: 28}} />
          ))}
        </div>
        {f >= popAt && (
          <div
            style={{
              position: 'absolute',
              left: 310,
              top: 190,
              width: 700,
              borderRadius: 18,
              background: C.paper,
              boxShadow: f >= trapAt ? `0 0 0 8px ${C.red}, 0 20px 60px rgba(0,0,0,0.4)` : '0 20px 60px rgba(0,0,0,0.4)',
              overflow: 'hidden',
              transform: `translateX(${shake}px) scale(${0.7 + 0.3 * pop(f, popAt)})`,
              opacity: Math.min(1, pop(f, popAt) * 1.5),
            }}
          >
            <div style={{background: C.yellow, padding: '18px 26px', display: 'flex', alignItems: 'center', gap: 14, fontSize: 32, fontWeight: 700, color: C.bg}}>
              <WarningTriangle size={40} color={C.bg} />
              你的瀏覽器版本過舊！
            </div>
            <div style={{padding: '26px 30px', fontSize: 28, color: C.ink}}>
              為了安全，請立即下載最新版本
              <div style={{marginTop: 22, textAlign: 'center', padding: '16px 0', borderRadius: 12, background: C.green, color: '#fff', fontSize: 32, fontWeight: 700}}>立即下載更新</div>
            </div>
            {f >= trapAt && (
              <div
                style={{
                  position: 'absolute',
                  right: 30,
                  top: 70,
                  padding: '8px 26px',
                  border: `8px solid ${C.red}`,
                  borderRadius: 16,
                  color: C.red,
                  background: 'rgba(255,255,255,0.9)',
                  fontSize: 56,
                  fontWeight: 700,
                  transform: `rotate(-12deg) scale(${1.6 - 0.6 * pop(f, trapAt)})`,
                }}
              >
                假更新
              </div>
            )}
          </div>
        )}
      </div>
      {f >= realAt && (
        <div style={{position: 'absolute', right: 40, top: 30, ...popIn(f, realAt, 0.5), transformOrigin: '100% 50%'}}>
          <Chip color={C.green} size={34} icon={<Shield size={38} color="#fff" fill="rgba(255,255,255,0.2)" check={1} />}>真正的更新：公司自動推送</Chip>
        </div>
      )}
      {f >= phraseAt(s, 2, 2) && f < close + 16 && (
        <>
          <Ripple x={closeBtn.x} y={closeBtn.y} frame={f} at={close} />
          <Cursor x={lerp(1200, closeBtn.x, ct)} y={lerp(700, closeBtn.y, ct)} press={f >= close && f < close + 4 ? 1 : 0} />
        </>
      )}
      {f >= close + 8 && (
        <div style={{position: 'absolute', left: 0, right: 0, top: 420, display: 'flex', justifyContent: 'center', ...popIn(f, close + 8, 0.5)}}>
          <Chip color={C.green} size={48} icon={<Badge kind="check" size={56} p={1} />} style={{padding: '16px 44px'}}>
            不下載，直接關掉網頁
          </Chip>
        </div>
      )}
    </AbsoluteFill>
  );
};

/** S5：破解版、盜版軟體：夾帶惡意程式＋侵權風險 */
const PirateScene: React.FC<{f: number}> = ({f}) => {
  const s = getScene(tl5, 's5_pirate');
  const end = sceneEnd(s);
  if (f < s.from || f >= end) return null;
  const typeAt = s.lines[0].from;
  const q = '繪圖軟體 免費破解版';
  const typed = q.slice(0, Math.floor(progress(f, typeAt - 6, 26) * q.length));
  const resultAt = typeAt + 24;
  const dlAt = typeAt + 40;
  const malwareAt = typeAt + 58;
  const lawAt = phraseAt(s, 1, 2);
  return (
    <AbsoluteFill style={{opacity: fade(f, s.from, end), fontFamily: FONT, color: C.white}}>
      <div style={{position: 'absolute', left: 220, top: 170, width: 780, height: 80, borderRadius: 40, background: C.paper, color: C.ink, display: 'flex', alignItems: 'center', padding: '0 34px', fontSize: 34, ...slideUp(f, s.from + 2, 20)}}>
        {typed}
        <span style={{width: 3, height: 38, background: C.link, marginLeft: 4, opacity: Math.floor(f / 8) % 2}} />
      </div>
      {f >= resultAt && (
        <div style={{position: 'absolute', left: 220, top: 280, width: 780, borderRadius: 20, background: C.panel, border: `3px solid ${C.panelLine}`, padding: '22px 30px', boxSizing: 'border-box', ...slideUp(f, resultAt, 20)}}>
          <div style={{fontSize: 32, fontWeight: 700, color: '#8FB6FF'}}>【免費】完整破解版下載</div>
          <div style={{fontFamily: MONO, fontSize: 22, color: '#4CC38A', marginTop: 6}}>http://free-soft.example/download</div>
        </div>
      )}
      {f >= dlAt && (
        <div style={{position: 'absolute', left: 220, top: 480, width: 560, height: 120, borderRadius: 20, background: C.panel, border: `3px solid ${C.panelLine}`, display: 'flex', alignItems: 'center', gap: 20, padding: '0 26px', boxSizing: 'border-box', ...slideUp(f, dlAt, 20)}}>
          <svg width={60} height={60} viewBox="0 0 64 64">
            <path d="M32 6 V38 M20 26 L32 38 L44 26" stroke="#fff" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10 44 V56 H54 V44" stroke="#fff" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{fontFamily: MONO, fontSize: 32, fontWeight: 700}}>setup_crack.exe</div>
        </div>
      )}
      {f >= dlAt + 6 && (
        <div style={{position: 'absolute', left: 1120, top: 200, width: 540, height: 420, ...slideUp(f, dlAt + 6, 30)}}>
          <svg width={540} height={420} viewBox="0 0 540 420" style={{position: 'absolute', left: 0, top: 0}}>
            <path d="M60 180 L270 260 L480 180 L480 380 L270 420 L60 380 Z" fill="#8A6A4A" />
            <path d="M270 260 L270 420" stroke="#6B4F36" strokeWidth="6" />
            <path d={`M60 180 L${lerp(30, 0, easeIn(f, malwareAt - 8, 10))} ${lerp(120, 60, easeIn(f, malwareAt - 8, 10))} L${lerp(240, 200, easeIn(f, malwareAt - 8, 10))} 150 L270 260 Z`} fill="#A07E5C" />
            <path d={`M480 180 L${lerp(510, 540, easeIn(f, malwareAt - 8, 10))} ${lerp(120, 60, easeIn(f, malwareAt - 8, 10))} L${lerp(300, 340, easeIn(f, malwareAt - 8, 10))} 150 L270 260 Z`} fill="#A07E5C" />
          </svg>
          {f >= malwareAt &&
            [
              {x: 150, y: 40, d: 0},
              {x: 260, y: -10, d: 4},
              {x: 370, y: 40, d: 8},
            ].map((b) => (
              <Bug key={b.x} size={100} style={{position: 'absolute', left: b.x, top: b.y + 120 - 120 * easeIn(f, malwareAt + b.d, 12), opacity: easeIn(f, malwareAt + b.d, 8)}} />
            ))}
        </div>
      )}
      {f >= malwareAt + 10 && (
        <div style={{position: 'absolute', left: 1120, width: 540, top: 650, display: 'flex', justifyContent: 'center', ...popIn(f, malwareAt + 10, 0.5)}}>
          <Chip color={C.red} size={38} icon={<Bug size={42} color="#fff" />}>夾帶惡意程式</Chip>
        </div>
      )}
      {f >= lawAt && (
        <div style={{position: 'absolute', left: 220, top: 660, ...popIn(f, lawAt, 0.5), transformOrigin: '0% 50%'}}>
          <Chip color={C.yellow} style={{color: C.bg}} size={40} icon={<LegalMark size={46} color={C.bg} />}>還有侵權的法律風險</Chip>
        </div>
      )}
    </AbsoluteFill>
  );
};

/** S6：新軟體用 BPM 表單或寫信申請，交給 Henry 評估 */
const RequestScene: React.FC<{f: number}> = ({f}) => {
  const s = getScene(tl5, 's6_request');
  const end = sceneEnd(s);
  if (f < s.from || f >= end) return null;
  const [need, bpm, mail, henry] = [1, 2, 3, 4].map((i) => phraseAt(s, 1, i));
  const arrow = progress(f, henry, 14);
  const card = (x: number, at: number, icon: React.ReactNode, title: string, desc: string) => (
    <div style={{position: 'absolute', left: x, top: 210, width: 530, height: 320, borderRadius: 30, background: C.panel, border: `4px solid ${C.panelLine}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, ...slideUp(f, at, 30)}}>
      <div style={{height: 130, display: 'flex', alignItems: 'center'}}>{icon}</div>
      <div style={{fontSize: 48, fontWeight: 700, color: '#4CC38A'}}>{title}</div>
      <div style={{fontSize: 27, color: C.muted}}>{desc}</div>
    </div>
  );
  return (
    <AbsoluteFill style={{opacity: fade(f, s.from, end), fontFamily: FONT, color: C.white}}>
      <div style={{position: 'absolute', top: 108, left: 0, right: 0, textAlign: 'center', fontSize: 54, fontWeight: 700, ...slideUp(f, need - 4, 24)}}>需要新軟體？</div>
      {f >= bpm - 2 && card(330, bpm - 2, <FormIcon size={100} />, 'BPM 表單申請', '填寫用途與軟體名稱')}
      {f >= mail - 2 && (
        <div style={{position: 'absolute', left: 900, width: 120, top: 330, textAlign: 'center', fontSize: 44, fontWeight: 700, color: C.muted, ...slideUp(f, mail - 2, 16)}}>或</div>
      )}
      {f >= mail - 2 && card(1060, mail - 2, <Envelope size={130} />, '寫信說明', '說明需求與用途')}
      {f >= henry && (
        <svg style={{position: 'absolute', left: 0, top: 0}} width={1920} height={1080}>
          <line x1={595} y1={535} x2={lerp(595, 790, arrow)} y2={lerp(535, 630, arrow)} stroke={C.green} strokeWidth="8" strokeLinecap="round" />
          <line x1={1325} y1={535} x2={lerp(1325, 1130, arrow)} y2={lerp(535, 630, arrow)} stroke={C.green} strokeWidth="8" strokeLinecap="round" />
        </svg>
      )}
      {f >= henry + 8 && (
        <div style={{position: 'absolute', left: 560, top: 640, width: 800, height: 130, borderRadius: 34, background: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, fontSize: 48, fontWeight: 700, boxShadow: '0 16px 40px rgba(0,0,0,0.4)', ...slideUp(f, henry + 8, 24)}}>
          <Shield size={64} color="#fff" fill="rgba(255,255,255,0.2)" check={1} />
          交給資訊部 {BRAND.contact} 評估
        </div>
      )}
      {f >= henry + 30 && (
        <div style={{position: 'absolute', left: 0, right: 0, top: 800, display: 'flex', justifyContent: 'center', ...popIn(f, henry + 30, 0.5)}}>
          <Chip color={C.bgDeep} size={32} style={{border: `3px solid ${C.green}`, color: '#4CC38A'}}>核可後才安裝</Chip>
        </div>
      )}
    </AbsoluteFill>
  );
};

/** S7：更新不拖延，盜版不安裝 */
const EndingScene: React.FC<{f: number}> = ({f}) => {
  const s = getScene(tl5, 's7_slogan');
  const end = sceneEnd(s);
  if (f < s.from || f >= end) return null;
  const [l1, l2] = [1, 2].map((i) => phraseAt(s, 1, i));
  return (
    <AbsoluteFill style={{opacity: easeIn(f, s.from, 12)}}>
      <Slogan
        frame={f}
        iconAt={s.from + 4}
        icon={<Shield size={170} check={easeIn(f, l2 + 6, 14)} />}
        rows={[
          {content: '更新不拖延', at: l1, size: 150, color: C.yellow},
          {content: <>盜版<span style={{color: '#4CC38A'}}>不安裝</span></>, at: l2, size: 118},
        ]}
        pills={[
          {text: '更新提醒就讓它完成', color: '#4CC38A'},
          {text: '網頁跳出的不下載', color: '#FF6B6F'},
          {text: '新軟體走 BPM 申請', color: '#4CC38A'},
        ]}
        pillsAt={l2 + 16}
        footer={<>軟體申請：BPM 表單或寫信給 <Contact /></>}
        footerAt={l2 + 40}
      />
    </AbsoluteFill>
  );
};

/** 影片五：軟體更新與盜版軟體 */
export const Video5: React.FC = () => {
  const f = useCurrentFrame();
  const fadeOut = progress(f, tl5.durationInFrames - 20, 20);
  return (
    <AbsoluteFill style={{background: C.bg, fontFamily: FONT}}>
      <Backdrop />
      <LaterScene f={f} />
      <PatchScene f={f} />
      <InstallScene f={f} />
      <FakeUpdateScene f={f} />
      <PirateScene f={f} />
      <RequestScene f={f} />
      <EndingScene f={f} />
      <TopTag company={BRAND.company} label="資安宣導｜軟體更新與盜版" />
      <Subtitles tl={tl5} />
      <AbsoluteFill style={{background: C.bgDeep, opacity: fadeOut}} />
    </AbsoluteFill>
  );
};
