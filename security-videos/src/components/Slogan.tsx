import React from 'react';
import {AbsoluteFill} from 'remotion';
import {BRAND} from '../brand';
import {C, FONT} from '../theme';
import {popIn, slideUp} from './Chrome';
import {Shield} from './Icons';

export type SloganRow = {content: React.ReactNode; at: number; size: number; color?: string};

/** 結尾標語頁：圖示＋一到兩行大字＋重點標籤＋國泰電業資訊部頁尾 */
export const Slogan: React.FC<{
  frame: number;
  iconAt: number;
  icon: React.ReactNode;
  rows: SloganRow[];
  pills?: {text: string; color: string}[];
  pillsAt?: number;
  footer: React.ReactNode;
  footerAt: number;
}> = ({frame: f, iconAt, icon, rows, pills = [], pillsAt = 0, footer, footerAt}) => {
  const single = rows.length === 1;
  const tops = single ? [410] : [360, 550];
  const pillsTop = single ? 630 : 762;
  const footerTop = single ? 724 : 852;
  return (
    <AbsoluteFill style={{fontFamily: FONT, color: C.white}}>
      <div style={{position: 'absolute', left: 0, right: 0, top: 138, display: 'flex', justifyContent: 'center', ...popIn(f, iconAt, 0.5)}}>
        {icon}
      </div>
      {rows.map((r, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: tops[i],
            textAlign: 'center',
            fontSize: r.size,
            fontWeight: 700,
            letterSpacing: 10,
            color: r.color ?? C.white,
            textShadow: '0 8px 30px rgba(0,0,0,0.45)',
            ...slideUp(f, r.at, 40, 14),
          }}
        >
          {r.content}
        </div>
      ))}
      <div style={{position: 'absolute', left: 0, right: 0, top: pillsTop, display: 'flex', justifyContent: 'center', gap: 18}}>
        {pills.map((p, i) => (
          <div
            key={p.text}
            style={{
              padding: '10px 30px',
              borderRadius: 999,
              fontSize: 36,
              fontWeight: 700,
              border: `3px solid ${p.color}`,
              color: p.color,
              background: 'rgba(8,16,28,0.7)',
              ...slideUp(f, pillsAt + i * 5, 20),
            }}
          >
            {p.text}
          </div>
        ))}
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: footerTop, display: 'flex', justifyContent: 'center', ...slideUp(f, footerAt, 16)}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 14, fontSize: 34, fontWeight: 700, color: C.muted}}>
          <Shield size={34} color={C.green} check={1} />
          <span style={{color: C.white}}>{BRAND.company} 資訊部</span>
          <span style={{color: C.dim}}>｜</span>
          {footer}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** 頁尾裡的回報窗口名字（綠色） */
export const Contact: React.FC = () => <span style={{color: '#4CC38A'}}>{BRAND.contact}</span>;
