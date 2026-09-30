import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Chip, popIn} from '../components/Chrome';
import {Badge, Cloud, Database, DataFile, Laptop, Shield, Sparkle} from '../components/Icons';
import {easeIn, easeOut, keyframes, lerp, progress} from '../lib/anim';
import {getScene, phraseAt, phraseFrac, sceneEnd, Timeline} from '../lib/timeline';
import {C, FONT} from '../theme';

const BOX = {x: 90, y: 180, w: 700, h: 610}; // 公司邊界
const FROM = {x: 440, y: 440}; // 筆電螢幕
const TO = {x: 1460, y: 380}; // 雲端
const CTRL = {x: 930, y: 170};
const RETURN = {a: {x: 1250, y: 560}, c: {x: 1000, y: 800}, b: {x: 720, y: 560}};

const bezier = (t: number, a: {x: number; y: number}, c: {x: number; y: number}, b: {x: number; y: number}) => ({
  x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t ** 2 * b.x,
  y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t ** 2 * b.y,
});

/** S2：資料穿過公司邊界，飛向外部雲端 */
export const UploadScene: React.FC<{tl: Timeline}> = ({tl}) => {
  const f = useCurrentFrame();
  const s = getScene(tl, 's2_upload');
  const end = sceneEnd(s);
  if (f < s.from || f >= end) return null;

  const line = s.lines[0].from;
  const saved = phraseFrac(s, 1, 1, 0.45); // 「保存」
  const sentOut = phraseAt(s, 1, 2); // 「一旦送出」
  const noReturn = phraseAt(s, 1, 3); // 「公司就收不回來」

  const opacity = Math.min(easeIn(f, s.from + 6, 14), easeOut(f, end - 10, 10));
  const packets = [0, 1, 2, 3].map((i) => {
    const t0 = line - 6 + i * 11;
    const t = keyframes(f, [t0, t0 + 42], [0, 1]);
    const p = bezier(t, FROM, CTRL, TO);
    return {t, p, visible: f >= t0 && t < 1, scale: t < 0.5 ? lerp(0.6, 1.1, t * 2) : lerp(1.1, 0.5, (t - 0.5) * 2)};
  });
  const cross = Math.max(0, ...packets.filter((k) => k.visible).map((k) => 1 - Math.min(1, Math.abs(k.p.x - (BOX.x + BOX.w)) / 70)));
  const arrived = packets.filter((k) => k.t >= 1).length;
  const cloudPulse = 1 + 0.04 * Math.max(0, ...packets.map((k) => (k.t >= 1 ? Math.max(0, 1 - (f - (line - 6 + packets.indexOf(k) * 11 + 42)) / 10) : 0)));
  const dbFill = keyframes(f, [saved, saved + 30], [0.01, 1]);
  const ret = progress(f, sentOut, 20);
  const mid = bezier(0.5, RETURN.a, RETURN.c, RETURN.b);

  return (
    <AbsoluteFill style={{opacity, fontFamily: FONT, color: C.white}}>
      {/* 公司邊界 */}
      <div
        style={{
          position: 'absolute',
          left: BOX.x,
          top: BOX.y,
          width: BOX.w,
          height: BOX.h,
          borderRadius: 30,
          border: `5px dashed ${cross > 0.05 ? `rgba(229,72,77,${0.5 + 0.5 * cross})` : 'rgba(169,184,204,0.55)'}`,
          background: 'rgba(22,38,61,0.55)',
        }}
      />
      <div style={{position: 'absolute', left: BOX.x + 30, top: BOX.y - 30}}>
        <Chip color={C.bgDeep} size={32} style={{border: `3px solid ${C.panelLine}`}} icon={<Shield size={34} />}>
          公司內部
        </Chip>
      </div>
      <div style={{position: 'absolute', left: 250, top: 330}}>
        <Laptop width={380}>
          <div style={{position: 'absolute', left: 14, top: 14, right: 14, height: 18, borderRadius: 9, background: '#E4EAF2'}} />
          <div style={{position: 'absolute', right: 16, top: 50, width: 210, height: 118, borderRadius: 12, background: C.link, opacity: 1 - arrived / 5}} />
          {[0, 1, 2].map((r) => (
            <div key={r} style={{position: 'absolute', right: 30, top: 66 + r * 28, width: 180 - r * 30, height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.6)', opacity: 1 - arrived / 5}} />
          ))}
        </Laptop>
        <div style={{textAlign: 'center', marginTop: 18, fontSize: 30, fontWeight: 700, color: C.muted}}>你的電腦</div>
      </div>

      {/* 外部雲端 */}
      <div style={{position: 'absolute', left: 1180, top: 200, transform: `scale(${cloudPulse})`, transformOrigin: '50% 50%'}}>
        <Cloud size={560} color="#DCE6F3" />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            paddingTop: 50,
            color: C.bg,
            fontSize: 46,
            fontWeight: 700,
          }}
        >
          <Sparkle size={50} />
          外部 AI 服務
        </div>
      </div>
      {f >= saved - 4 && (
        <div style={{position: 'absolute', left: 1385, top: 575, display: 'flex', flexDirection: 'column', alignItems: 'center', ...popIn(f, saved - 4, 0.6)}}>
          <Database size={130} fill={dbFill} />
          <div style={{marginTop: 8, fontSize: 30, fontWeight: 700, color: C.yellow, whiteSpace: 'nowrap'}}>保存你輸入的內容</div>
        </div>
      )}

      {/* 飛出去的資料 */}
      {packets.map(
        (k, i) =>
          k.visible && (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: k.p.x - 45,
                top: k.p.y - 56,
                transform: `scale(${k.scale}) rotate(${(k.t - 0.5) * 30}deg)`,
                opacity: Math.min(1, k.t * 6, (1 - k.t) * 6),
                filter: 'drop-shadow(0 8px 12px rgba(0,0,0,0.4))',
              }}
            >
              <DataFile size={90} label={i === 0 ? '客戶名單' : undefined} />
            </div>
          ),
      )}

      {/* 收不回來 */}
      {f >= sentOut && (
        <svg style={{position: 'absolute', left: 0, top: 0}} width={1920} height={1080}>
          <defs>
            <marker id="arrow2" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 Z" fill={C.muted} />
            </marker>
          </defs>
          <path
            d={`M${RETURN.a.x} ${RETURN.a.y} Q${RETURN.c.x} ${RETURN.c.y} ${RETURN.b.x} ${RETURN.b.y}`}
            fill="none"
            stroke={C.muted}
            strokeWidth="6"
            strokeDasharray="16 14"
            strokeDashoffset={0}
            opacity={0.9}
            markerEnd={ret > 0.95 ? 'url(#arrow2)' : undefined}
            style={{clipPath: `inset(0 0 0 ${(1 - ret) * 100}%)`}}
          />
        </svg>
      )}
      {f >= noReturn && (
        <>
          <div style={{position: 'absolute', left: mid.x - 45, top: mid.y - 45, ...popIn(f, noReturn, 0.4)}}>
            <Badge kind="x" size={90} p={easeIn(f, noReturn + 3, 10)} />
          </div>
          <div style={{position: 'absolute', left: mid.x + 64, top: mid.y - 32, transformOrigin: '0% 50%', ...popIn(f, noReturn + 4, 0.5)}}>
            <Chip color={C.red} size={34}>
              收不回來
            </Chip>
          </div>
        </>
      )}
    </AbsoluteFill>
  );
};
