import React from 'react';
import {easeIn, pop} from '../lib/anim';
import {C, FONT} from '../theme';
import {Badge} from './Icons';

export type Card = {icon: React.ReactNode; label: string; desc?: string};

/** 一排說明卡片：每張在 ats[i] 彈出，稍後蓋上打叉或打勾徽章 */
export const CardRow: React.FC<{
  frame: number;
  cards: Card[];
  ats: number[];
  kind: 'x' | 'check';
  top?: number;
  width?: number;
  height?: number;
  gap?: number;
  labelColor?: string;
}> = ({frame: f, cards, ats, kind, top = 205, width = 400, height = 400, gap = 60, labelColor}) => {
  const total = cards.length * width + (cards.length - 1) * gap;
  const x0 = (1920 - total) / 2;
  const color = labelColor ?? (kind === 'x' ? '#FF6B6F' : '#4CC38A');
  return (
    <>
      {cards.map((c, i) => {
        const at = ats[i];
        const t = pop(f, at - 3);
        return (
          <div
            key={c.label}
            style={{
              position: 'absolute',
              left: x0 + i * (width + gap),
              top,
              width,
              height,
              borderRadius: 30,
              background: C.panel,
              border: `3px solid ${C.panelLine}`,
              boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
              fontFamily: FONT,
              opacity: Math.min(1, t * 1.4),
              transform: `translateY(${(1 - t) * 40}px) scale(${0.85 + 0.15 * t})`,
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: (width - 180) / 2,
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
              <Badge kind={kind} size={86} p={easeIn(f, at + 4, 10)} style={{position: 'absolute', right: -22, bottom: -14, opacity: f >= at + 2 ? 1 : 0}} />
            </div>
            <div style={{position: 'absolute', top: 246, left: 0, right: 0, textAlign: 'center', fontSize: c.label.length > 5 ? 50 : 60, fontWeight: 700, color}}>
              {c.label}
            </div>
            {c.desc && (
              <div style={{position: 'absolute', top: 330, left: 0, right: 0, textAlign: 'center', fontSize: 27, color: C.muted}}>{c.desc}</div>
            )}
          </div>
        );
      })}
    </>
  );
};
