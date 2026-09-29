import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Cursor, Ripple, slideUp} from '../components/Chrome';
import {Badge, CursorArrow, Flag, ReplyArrow} from '../components/Icons';
import {easeIn, easeOut, keyframes, lerp, pop} from '../lib/anim';
import {getScene, phraseAt, sceneEnd, Timeline} from '../lib/timeline';
import {C, FONT} from '../theme';

const LinkIcon: React.FC = () => (
  <div style={{position: 'relative', width: 150, height: 110}}>
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 18,
        width: 130,
        height: 54,
        borderRadius: 10,
        background: C.link,
        color: '#fff',
        fontSize: 26,
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      連結
    </div>
    <CursorArrow size={40} style={{position: 'absolute', left: 92, top: 48}} />
  </div>
);

const PasswordIcon: React.FC = () => (
  <div
    style={{
      width: 150,
      height: 60,
      borderRadius: 10,
      background: '#fff',
      border: `4px solid ${C.muted}`,
      display: 'flex',
      alignItems: 'center',
      paddingLeft: 16,
      gap: 8,
      boxSizing: 'border-box',
    }}
  >
    {[0, 1, 2, 3].map((i) => (
      <div key={i} style={{width: 16, height: 16, borderRadius: 8, background: C.ink}} />
    ))}
    <div style={{width: 3, height: 32, background: C.link, marginLeft: 6}} />
  </div>
);

const CARDS = [
  {label: '不點', desc: '連結、按鈕、附件', icon: <LinkIcon />},
  {label: '不回覆', desc: '不回信、不提供資料', icon: <ReplyArrow size={110} color={C.white} />},
  {label: '不輸入', desc: '帳號、密碼、驗證碼', icon: <PasswordIcon />},
];

/** S6：不點、不回覆、不輸入 → 回報資訊部 */
export const ActionsScene: React.FC<{tl: Timeline}> = ({tl}) => {
  const f = useCurrentFrame();
  const s = getScene(tl, 's6_actions');
  const end = sceneEnd(s);
  if (f < s.from || f >= end) return null;

  const opacity = Math.min(easeIn(f, s.from, 12), easeOut(f, end - 10, 10));
  const reportAt = phraseAt(s, 1, 4);
  const click = s.cues.reportClick;
  const done = s.cues.reportDone;
  const btn = {x: 960, y: 752};
  const ct = keyframes(f, [reportAt + 4, click - 2], [0, 1]);
  const cursor = {x: lerp(1520, btn.x + 90, ct), y: lerp(980, btn.y + 20, ct)};
  const glow = f >= done ? 0.5 + 0.5 * Math.sin(((f - done) / 20) * Math.PI) : 0;

  return (
    <AbsoluteFill style={{opacity, fontFamily: FONT, color: C.white}}>
      <div style={{position: 'absolute', top: 108, left: 0, right: 0, textAlign: 'center', fontSize: 54, fontWeight: 700, ...slideUp(f, s.from + 4, 24)}}>
        收到可疑信件時
      </div>
      {CARDS.map((c, i) => {
        const at = phraseAt(s, 1, i + 1);
        const t = pop(f, at - 3);
        return (
          <div
            key={c.label}
            style={{
              position: 'absolute',
              left: 300 + i * 460,
              top: 205,
              width: 400,
              height: 400,
              borderRadius: 30,
              background: C.panel,
              border: `3px solid ${C.panelLine}`,
              boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
              opacity: Math.min(1, t * 1.4),
              transform: `translateY(${(1 - t) * 40}px) scale(${0.85 + 0.15 * t})`,
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 110,
                top: 36,
                width: 180,
                height: 180,
                borderRadius: 90,
                background: C.bg,
                border: `3px solid ${C.panelLine}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {c.icon}
              <Badge kind="x" size={86} p={easeIn(f, at + 4, 10)} style={{position: 'absolute', right: -22, bottom: -14, opacity: f >= at + 2 ? 1 : 0}} />
            </div>
            <div style={{position: 'absolute', top: 246, left: 0, right: 0, textAlign: 'center', fontSize: 64, fontWeight: 700, color: '#FF6B6F'}}>
              {c.label}
            </div>
            <div style={{position: 'absolute', top: 334, left: 0, right: 0, textAlign: 'center', fontSize: 27, color: C.muted}}>{c.desc}</div>
          </div>
        );
      })}
      {f >= reportAt && (
        <div
          style={{
            position: 'absolute',
            left: btn.x - 300,
            top: btn.y - 64,
            width: 600,
            height: 128,
            borderRadius: 64,
            background: C.green,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 22,
            fontSize: 54,
            fontWeight: 700,
            boxShadow: `0 0 0 ${10 + 10 * glow}px rgba(48,164,108,${0.25 + 0.2 * glow}), 0 16px 40px rgba(0,0,0,0.4)`,
            ...slideUp(f, reportAt, 40, 14),
            transform: `${slideUp(f, reportAt, 40, 14).transform} scale(${f >= click && f < click + 5 ? 0.95 : 1})`,
          }}
        >
          {f >= done ? <Badge kind="check" size={74} p={easeIn(f, done, 10)} style={{marginLeft: -10}} /> : <Flag size={58} />}
          {f >= done ? '已回報資訊部' : '回報資訊部'}
        </div>
      )}
      {f >= reportAt + 4 && (
        <>
          <Ripple x={btn.x + 90} y={btn.y + 20} frame={f} at={click} />
          <Cursor x={cursor.x} y={cursor.y} press={f >= click && f < click + 5 ? 1 : 0} opacity={easeOut(f, done + 20, 10)} />
        </>
      )}
    </AbsoluteFill>
  );
};
