import React from 'react';
import {Chip, popIn, slideUp} from '../components/Chrome';
import {Badge, Envelope, Stopwatch, WarningTriangle} from '../components/Icons';
import {easeIn, easeOut, pop} from '../lib/anim';
import {C, FONT, MONO} from '../theme';
import {FAKE} from './layout';

const panel: React.CSSProperties = {
  position: 'absolute',
  background: '#0C1626',
  border: `3px solid ${C.panelLine}`,
  borderRadius: 24,
  boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
  fontFamily: FONT,
  color: C.white,
};

/** 新郵件通知 */
export const Toast: React.FC<{frame: number; at: number}> = ({frame, at}) => {
  const inT = easeIn(frame, at, 12);
  const outT = easeOut(frame, at + 80, 12);
  if (frame < at || outT <= 0) return null;
  return (
    <div
      style={{
        ...panel,
        right: 36,
        top: 26,
        width: 500,
        padding: '18px 24px',
        display: 'flex',
        gap: 18,
        alignItems: 'center',
        opacity: Math.min(inT, outT),
        transform: `translateX(${(1 - inT) * 540}px)`,
      }}
    >
      <Envelope size={58} color={C.yellow} />
      <div>
        <div style={{fontSize: 22, color: C.muted}}>新郵件．{FAKE.senderName}</div>
        <div style={{fontSize: 25, fontWeight: 700, whiteSpace: 'nowrap'}}>【緊急】您的帳號將於 24 小時後停用</div>
      </div>
    </div>
  );
};

/** 黃色問號泡泡 */
export const Question: React.FC<{frame: number; at: number; x: number; y: number; out: number}> = ({frame, at, x, y, out}) => {
  if (frame < at) return null;
  const t = pop(frame, at);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 104,
        height: 104,
        borderRadius: 52,
        background: C.yellow,
        color: C.bg,
        fontFamily: FONT,
        fontSize: 72,
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `scale(${t}) rotate(${(1 - t) * -30}deg)`,
        opacity: out,
        boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
      }}
    >
      ?
    </div>
  );
};

/** 禁止點擊圖示（可附文字） */
export const StopBadge: React.FC<{frame: number; at: number; x: number; y: number; label?: string; opacity?: number}> = ({
  frame,
  at,
  x,
  y,
  label,
  opacity = 1,
}) => {
  if (frame < at) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: label ? '8px 22px 8px 10px' : 0,
        borderRadius: 999,
        background: label ? C.red : 'transparent',
        fontFamily: FONT,
        fontSize: 30,
        fontWeight: 700,
        color: C.white,
        boxShadow: label ? '0 8px 24px rgba(0,0,0,0.4)' : 'none',
        transformOrigin: '0% 50%',
        ...popIn(frame, at, 0.4),
        opacity: Math.min(opacity, pop(frame, at) * 1.5),
      }}
    >
      <svg width={label ? 48 : 76} height={label ? 48 : 76} viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="27" fill="#fff" stroke={C.red} strokeWidth="8" />
        <path d="M14 14 L50 50" stroke={C.red} strokeWidth="8" strokeLinecap="round" />
      </svg>
      {label}
    </div>
  );
};

/** 疑似釣魚信警示標籤 */
export const WarnChip: React.FC<{frame: number; at: number; opacity: number}> = ({frame, at, opacity}) => {
  if (frame < at) return null;
  return (
    <div style={{position: 'absolute', right: 250, top: 72, transformOrigin: '100% 50%', ...popIn(frame, at, 0.5), opacity: Math.min(opacity, pop(frame, at) * 1.5)}}>
      <Chip color={C.red} size={34} icon={<WarningTriangle size={40} color="#fff" style={{filter: 'none'}} />}>
        疑似釣魚信
      </Chip>
    </div>
  );
};

/** 寄件網域比對面板 */
export const DomainCompare: React.FC<{frame: number; at: number; opacity: number}> = ({frame, at, opacity}) => {
  if (frame < at) return null;
  const pulse = 1 + 0.08 * Math.max(0, Math.sin(((frame - at - 30) / 30) * Math.PI * 2)) * (frame > at + 30 ? 1 : 0);
  const diff = (ch: string, color: string, show: boolean) => (
    <span
      style={{
        display: 'inline-block',
        background: show ? color : 'transparent',
        color: show ? '#fff' : 'inherit',
        borderRadius: 8,
        padding: '0 3px',
        margin: '0 -3px',
        transform: `scale(${show ? pulse : 1})`,
      }}
    >
      {ch}
    </span>
  );
  const showDiff = frame >= at + 30;
  const row = (ok: boolean, label: string, ch: string, t: number) => (
    <div style={{display: 'flex', alignItems: 'center', gap: 22, height: 92, ...slideUp(frame, t, 24)}}>
      <Badge kind={ok ? 'check' : 'x'} size={62} p={easeIn(frame, t + 4, 10)} />
      <div style={{width: 150, fontSize: 32, fontWeight: 700, color: ok ? '#4CC38A' : '#FF6B6F'}}>{label}</div>
      <div style={{fontFamily: MONO, fontSize: 56, letterSpacing: 1, color: C.white}}>
        @corp-examp{diff(ch, ok ? C.green : C.red, showDiff)}e.com
      </div>
    </div>
  );
  return (
    <div style={{...panel, left: 260, top: 590, width: 1400, height: 300, padding: '22px 44px', boxSizing: 'border-box', opacity: Math.min(opacity, easeIn(frame, at, 10))}}>
      <div style={{fontSize: 26, color: C.muted, fontWeight: 700, marginBottom: 4}}>寄件網域比對</div>
      {row(false, '這封信', '1', at + 4)}
      {row(true, '公司網域', 'l', at + 14)}
      <div
        style={{
          position: 'absolute',
          right: 44,
          top: 120,
          width: 380,
          fontSize: 34,
          fontWeight: 700,
          lineHeight: 1.5,
          textAlign: 'center',
          ...slideUp(frame, at + 40, 20),
        }}
      >
        數字 <span style={{color: '#FF6B6F', fontFamily: MONO}}>1</span>
        <span style={{color: C.yellow}}>　≠　</span>
        字母 <span style={{color: '#4CC38A', fontFamily: MONO}}>l</span>
        <div style={{fontSize: 26, color: C.muted, fontWeight: 400}}>差一個字，就是別人的網域</div>
      </div>
    </div>
  );
};

/** 真正網址說明框 */
export const UrlCallout: React.FC<{frame: number; at: number; opacity: number}> = ({frame, at, opacity}) => {
  if (frame < at) return null;
  return (
    <div
      style={{
        ...panel,
        left: 1010,
        top: 452,
        width: 870,
        padding: '26px 34px',
        boxSizing: 'border-box',
        ...slideUp(frame, at, 30),
        opacity: Math.min(opacity, easeIn(frame, at, 12)),
      }}
    >
      <div style={{fontSize: 26, color: C.muted, fontWeight: 700}}>按鈕實際會連到：</div>
      <div style={{fontFamily: MONO, fontSize: 31, marginTop: 12, whiteSpace: 'nowrap'}}>
        http://<span style={{color: '#FF6B6F', fontWeight: 700, borderBottom: `4px solid ${C.red}`}}>{FAKE.fakeDomain}</span>
        /verify/login.php
      </div>
      <div style={{display: 'flex', alignItems: 'center', gap: 14, marginTop: 20, fontSize: 30, fontWeight: 700, ...slideUp(frame, at + 14, 16)}}>
        <Badge kind="x" size={46} p={easeIn(frame, at + 18, 10)} />
        不是公司網域
        <span style={{fontFamily: MONO, color: '#4CC38A', fontSize: 29}}>{FAKE.realDomain}</span>
      </div>
    </div>
  );
};

/** 語氣可疑字眼的說明標籤 */
export const ToneTags: React.FC<{frame: number; urgentAt: number; pwdAt: number; stampAt: number; opacity: number}> = ({
  frame,
  urgentAt,
  pwdAt,
  stampAt,
  opacity,
}) => (
  <div style={{position: 'absolute', inset: 0, opacity}}>
    {frame >= urgentAt && (
      <div style={{position: 'absolute', left: 1230, top: 466, transformOrigin: '0% 50%', ...popIn(frame, urgentAt, 0.5)}}>
        <Chip color={C.yellow} style={{color: C.bg}} size={32} icon={<Stopwatch size={40} color={C.bg} />}>
          催促：製造急迫感
        </Chip>
      </div>
    )}
    {frame >= pwdAt && (
      <div style={{position: 'absolute', left: 1230, top: 594, transformOrigin: '0% 50%', ...popIn(frame, pwdAt, 0.5)}}>
        <Chip color={C.red} size={32} icon={<WarningTriangle size={40} color="#fff" />}>
          索取密碼
        </Chip>
      </div>
    )}
    {frame >= stampAt && (
      <div
        style={{
          position: 'absolute',
          left: 1560,
          top: 640,
          width: 230,
          height: 230,
          borderRadius: '50%',
          border: `10px solid ${C.red}`,
          color: C.red,
          background: 'rgba(255,255,255,0.92)',
          fontFamily: FONT,
          fontSize: 76,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `rotate(-12deg) scale(${1.6 - 0.6 * pop(frame, stampAt)})`,
          opacity: Math.min(1, pop(frame, stampAt) * 1.4),
          boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
        }}
      >
        可疑
      </div>
    )}
  </div>
);
