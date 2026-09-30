import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {slideUp} from '../components/Chrome';
import {Badge, Sparkle} from '../components/Icons';
import {easeIn, easeOut, pop, progress} from '../lib/anim';
import {getScene, phraseAt, sceneEnd, Timeline} from '../lib/timeline';
import {C, FONT, MONO} from '../theme';

/** 會被換成代號的字：at 之前是原始資料（紅），之後劃掉並換成代號（綠） */
const Token: React.FC<{before: string; after: string; at: number; frame: number; mono?: boolean}> = ({before, after, at, frame, mono}) => {
  const swapped = frame >= at + 8;
  if (!swapped) {
    const strike = progress(frame, at, 8);
    return (
      <span
        style={{
          position: 'relative',
          display: 'inline-block',
          padding: '0 10px',
          margin: '0 4px',
          borderRadius: 10,
          background: 'rgba(229,72,77,0.14)',
          color: '#B42318',
          fontWeight: 700,
          fontFamily: mono ? MONO : undefined,
          fontSize: mono ? '0.9em' : undefined,
          opacity: 1 - strike * 0.5,
        }}
      >
        {before}
        <span style={{position: 'absolute', left: 6, top: '52%', height: 5, width: `calc(${strike * 100}% - 12px)`, background: C.red, borderRadius: 3}} />
      </span>
    );
  }
  const t = pop(frame, at + 8);
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '0 14px',
        margin: '0 4px',
        borderRadius: 10,
        background: 'rgba(48,164,108,0.18)',
        border: `3px solid ${C.green}`,
        color: '#1E7A4F',
        fontWeight: 700,
        transform: `scale(${0.6 + 0.4 * t})`,
      }}
    >
      {after}
    </span>
  );
};

/** S4：先把姓名、金額、公司名換成代號 */
export const DeidScene: React.FC<{tl: Timeline}> = ({tl}) => {
  const f = useCurrentFrame();
  const s = getScene(tl, 's4_deid');
  const end = sceneEnd(s);
  if (f < s.from || f >= end) return null;

  const opacity = Math.min(easeIn(f, s.from, 12), easeOut(f, end - 10, 10));
  const nameAt = phraseAt(s, 1, 2); // 姓名
  const amountAt = phraseAt(s, 1, 3); // 金額
  const companyAt = phraseAt(s, 1, 4); // 公司名
  const done = companyAt + 24;

  return (
    <AbsoluteFill style={{opacity, fontFamily: FONT}}>
      <div style={{position: 'absolute', top: 170, left: 0, right: 0, textAlign: 'center', fontSize: 54, fontWeight: 700, color: C.white, ...slideUp(f, s.from + 4, 24)}}>
        要問 AI 之前
      </div>
      <div
        style={{
          position: 'absolute',
          left: 250,
          top: 320,
          width: 1420,
          borderRadius: 26,
          background: C.paper,
          border: `5px solid ${f >= done ? C.green : 'transparent'}`,
          boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
          padding: '34px 56px',
          boxSizing: 'border-box',
          ...slideUp(f, s.from + 6, 40, 14),
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 12, fontSize: 28, fontWeight: 700, color: C.inkSoft}}>
          <Sparkle size={34} />
          你的提問
        </div>
        <div style={{marginTop: 26, fontSize: 48, lineHeight: 1.95, color: C.ink, whiteSpace: 'nowrap'}}>
          <div>
            請幫我寫信給
            <Token frame={f} at={nameAt} before="王小明 0912-345-678" after="客戶 A" />
            ，
          </div>
          <div>
            說明
            <Token frame={f} at={companyAt} before="範例科技" after="公司 B" />
            的報價
            <Token frame={f} at={amountAt} before="NT$1,280,000" after="金額 X" mono />
            需要調整。
          </div>
        </div>
        {f >= done && <Badge kind="check" size={96} p={easeIn(f, done, 12)} style={{position: 'absolute', right: -34, top: -34}} />}
      </div>
    </AbsoluteFill>
  );
};
