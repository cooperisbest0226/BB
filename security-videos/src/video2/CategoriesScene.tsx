import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {slideUp} from '../components/Chrome';
import {ChartLock, CodeKey, Contract, IdCard, Prohibit} from '../components/Icons';
import {easeIn, easeOut, pop} from '../lib/anim';
import {getScene, phraseAt, sceneEnd, Timeline} from '../lib/timeline';
import {C, FONT} from '../theme';

const CARDS = [
  {label: ['客戶個資'], icon: <IdCard size={130} />},
  {label: ['合約與報價'], icon: <Contract size={96} />},
  {label: ['程式碼與', '帳號密碼'], icon: <CodeKey size={130} />},
  {label: ['未公開的', '財務與人事資料'], icon: <ChartLock size={130} />},
];
const W = 370;
const GAP = 36;
const X0 = (1920 - (4 * W + 3 * GAP)) / 2;

/** S3：四類資料不要貼進外部 AI（每張卡片在唸到時出現並打上禁止符號） */
export const CategoriesScene: React.FC<{tl: Timeline}> = ({tl}) => {
  const f = useCurrentFrame();
  const s = getScene(tl, 's3_categories');
  const end = sceneEnd(s);
  if (f < s.from || f >= end) return null;

  const opacity = Math.min(easeIn(f, s.from, 12), easeOut(f, end - 10, 10));
  const dont = phraseAt(s, 1, 2); // 「不要貼進外部 AI 服務」

  return (
    <AbsoluteFill style={{opacity, fontFamily: FONT, color: C.white}}>
      <div style={{position: 'absolute', top: 104, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 28, fontSize: 56, fontWeight: 700}}>
        <span style={slideUp(f, s.lines[0].from - 4, 24)}>這四類資料</span>
        <span style={{color: '#FF6B6F', ...slideUp(f, dont, 24)}}>不要貼進外部 AI 服務</span>
      </div>
      {CARDS.map((c, i) => {
        const at = phraseAt(s, 1, i + 3);
        const t = pop(f, at - 3);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: X0 + i * (W + GAP),
              top: 232,
              width: W,
              height: 430,
              borderRadius: 30,
              background: C.panel,
              border: `3px solid ${f >= at + 4 ? 'rgba(229,72,77,0.7)' : C.panelLine}`,
              boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
              opacity: Math.min(1, t * 1.4),
              transform: `translateY(${(1 - t) * 40}px) scale(${0.85 + 0.15 * t})`,
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: (W - 200) / 2,
                top: 34,
                width: 200,
                height: 200,
                borderRadius: 100,
                background: C.bg,
                border: `3px solid ${C.panelLine}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {c.icon}
              {f >= at + 2 && <Prohibit size={214} p={easeIn(f, at + 2, 16)} style={{position: 'absolute', left: -10, top: -10}} />}
            </div>
            <div style={{position: 'absolute', top: 268, left: 0, right: 0, textAlign: 'center', fontSize: 42, fontWeight: 700, lineHeight: 1.35}}>
              {c.label.map((l) => (
                <div key={l}>{l}</div>
              ))}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
