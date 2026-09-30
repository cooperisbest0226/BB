import React from 'react';
import {C, FONT} from '../theme';

/** 手機外框（通訊軟體畫面用，不含任何品牌） */
export const Phone: React.FC<{x: number; y: number; w?: number; h?: number; title: string; sub?: string; children: React.ReactNode; style?: React.CSSProperties}> = ({
  x,
  y,
  w = 520,
  h = 820,
  title,
  sub,
  children,
  style,
}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      width: w,
      height: h,
      borderRadius: 56,
      background: '#1B2A40',
      padding: 16,
      boxSizing: 'border-box',
      boxShadow: '0 30px 80px rgba(0,0,0,0.55)',
      fontFamily: FONT,
      ...style,
    }}
  >
    <div style={{position: 'relative', width: '100%', height: '100%', borderRadius: 42, background: '#EEF2F7', overflow: 'hidden'}}>
      <div style={{height: 118, background: '#FFFFFF', borderBottom: `2px solid ${C.paperLine}`, display: 'flex', alignItems: 'center', gap: 16, padding: '26px 24px 0'}}>
        <div style={{fontSize: 34, color: C.inkSoft}}>‹</div>
        <div>
          <div style={{fontSize: 27, fontWeight: 700, color: C.ink}}>{title}</div>
          {sub && <div style={{fontSize: 19, color: C.inkSoft}}>{sub}</div>}
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 118, bottom: 0, overflow: 'hidden'}}>{children}</div>
    </div>
  </div>
);

/** 聊天泡泡（左側，他人訊息） */
export const Bubble: React.FC<{name?: string; avatar?: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties; highlight?: string}> = ({
  name,
  avatar,
  children,
  style,
  highlight,
}) => (
  <div style={{display: 'flex', gap: 12, alignItems: 'flex-start', ...style}}>
    <div style={{width: 58, height: 58, flexShrink: 0}}>{avatar}</div>
    <div>
      {name && <div style={{fontSize: 19, color: C.inkSoft, marginBottom: 4}}>{name}</div>}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '6px 22px 22px 22px',
          padding: '12px 18px',
          fontSize: 25,
          lineHeight: 1.45,
          color: C.ink,
          maxWidth: 360,
          boxShadow: highlight ? `0 0 0 4px ${highlight}` : '0 2px 6px rgba(0,0,0,0.06)',
        }}
      >
        {children}
      </div>
    </div>
  </div>
);
