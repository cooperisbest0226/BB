import React from 'react';
import {AbsoluteFill} from 'remotion';
import {easeIn, pop} from '../lib/anim';
import {C, FONT} from '../theme';
import {CursorArrow, HandPointer, Shield} from './Icons';

/** 深藍底 + 淡淡的中央光暈與點陣 */
export const Backdrop: React.FC = () => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse 70% 60% at 50% 42%, #16294A 0%, ${C.bg} 62%, ${C.bgDeep} 100%)`,
    }}
  >
    <AbsoluteFill
      style={{
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1.5px, transparent 1.5px)',
        backgroundSize: '36px 36px',
      }}
    />
  </AbsoluteFill>
);

/** 左上角主題標籤 */
export const TopTag: React.FC<{label: string; opacity?: number}> = ({label, opacity = 1}) => (
  <div
    style={{
      position: 'absolute',
      left: 36,
      top: 30,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '8px 20px 8px 14px',
      borderRadius: 999,
      background: 'rgba(8, 16, 28, 0.88)',
      border: `2px solid ${C.panelLine}`,
      color: C.muted,
      fontFamily: FONT,
      fontSize: 26,
      fontWeight: 700,
      letterSpacing: 1,
      opacity,
    }}
  >
    <Shield size={26} color={C.green} check={1} />
    {label}
  </div>
);

/** 「三看」進度：active = 目前第幾看（0 起算），pulse = 目前這一看的強調動畫進度 */
export const Tracker: React.FC<{items: string[]; active: number; frame: number; pulseAt: number; opacity: number}> = ({
  items,
  active,
  frame,
  pulseAt,
  opacity,
}) => {
  const p = pop(frame, pulseAt);
  const bump = 1 + 0.18 * Math.sin(Math.min(1, p) * Math.PI) * (frame < pulseAt + 24 ? 1 : 0);
  return (
    <div
      style={{
        position: 'absolute',
        top: 26,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        gap: 14,
        opacity,
        fontFamily: FONT,
      }}
    >
      {items.map((label, i) => {
        const done = i < active;
        const on = i === active;
        return (
          <div
            key={label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              height: 60,
              padding: '0 26px',
              borderRadius: 999,
              fontSize: 30,
              fontWeight: 700,
              background: on ? C.yellow : 'rgba(8, 16, 28, 0.9)',
              color: on ? C.bg : done ? '#4CC38A' : C.dim,
              border: `3px solid ${on ? C.yellow : done ? C.green : C.panelLine}`,
              transform: `scale(${on ? bump : 1})`,
              boxShadow: on ? '0 6px 24px rgba(245,165,36,0.35)' : 'none',
            }}
          >
            <span style={{fontSize: 26}}>{done ? '✓' : `${i + 1}`}</span>
            {label}
          </div>
        );
      })}
    </div>
  );
};

/** 滑鼠游標：(x, y) 為指尖位置 */
export const Cursor: React.FC<{x: number; y: number; hand?: boolean; press?: number; opacity?: number; scale?: number}> = ({
  x,
  y,
  hand,
  press = 0,
  opacity = 1,
  scale = 1,
}) => {
  const s = scale * (1 - 0.15 * press);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        opacity,
        transform: `scale(${s})`,
        transformOrigin: '0 0',
        filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.45))',
      }}
    >
      {hand ? (
        <HandPointer size={52} style={{position: 'absolute', left: -22, top: -2}} />
      ) : (
        <CursorArrow size={46} style={{position: 'absolute', left: -3, top: -3}} />
      )}
    </div>
  );
};

/** 點擊漣漪 */
export const Ripple: React.FC<{x: number; y: number; frame: number; at: number; color?: string}> = ({
  x,
  y,
  frame,
  at,
  color = C.white,
}) => {
  if (frame < at || frame > at + 20) return null;
  const t = (frame - at) / 20;
  const r = 12 + 60 * t;
  return (
    <div
      style={{
        position: 'absolute',
        left: x - r,
        top: y - r,
        width: r * 2,
        height: r * 2,
        borderRadius: '50%',
        border: `5px solid ${color}`,
        opacity: 1 - t,
      }}
    />
  );
};

/** 圈選：放在 position:relative 的元素裡，p = 0→1 順時針畫出 */
export const Circle: React.FC<{p: number; color: string; pad?: [number, number]; stroke?: number; opacity?: number}> = ({
  p,
  color,
  pad = [22, 16],
  stroke = 6,
  opacity = 1,
}) => {
  if (p <= 0 || opacity <= 0) return null;
  const deg = Math.min(1, p) * 360;
  const mask = `conic-gradient(from -100deg, #000 ${deg}deg, transparent ${deg}deg)`;
  return (
    <div
      style={{
        position: 'absolute',
        left: -pad[0],
        top: -pad[1],
        right: -pad[0],
        bottom: -pad[1],
        borderRadius: '50%',
        border: `${stroke}px solid ${color}`,
        transform: 'rotate(-2deg)',
        WebkitMaskImage: mask,
        maskImage: mask,
        opacity,
        pointerEvents: 'none',
      }}
    />
  );
};

/** 螢光筆標示：p = 0→1 由左到右刷過 */
export const Mark: React.FC<{p: number; color: string; outline?: string; children: React.ReactNode}> = ({
  p,
  color,
  outline,
  children,
}) => (
  <span
    style={{
      backgroundImage: `linear-gradient(${color}, ${color})`,
      backgroundRepeat: 'no-repeat',
      backgroundSize: `${Math.max(0, Math.min(1, p)) * 100}% 100%`,
      borderRadius: 6,
      padding: '0 4px',
      margin: '0 -4px',
      boxShadow: outline ? `0 0 0 3px ${outline}` : 'none',
    }}
  >
    {children}
  </span>
);

/** 圓角標籤（說明用） */
export const Chip: React.FC<{
  color: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  style?: React.CSSProperties;
  size?: number;
}> = ({color, children, icon, style, size = 30}) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 12,
      padding: '10px 24px',
      borderRadius: 999,
      background: color,
      color: C.white,
      fontFamily: FONT,
      fontWeight: 700,
      fontSize: size,
      boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
      whiteSpace: 'nowrap',
      ...style,
    }}
  >
    {icon}
    {children}
  </div>
);

/** 進場：淡入 + 由下往上滑 */
export const slideUp = (frame: number, at: number, dist = 30, dur = 12): React.CSSProperties => {
  const t = easeIn(frame, at, dur);
  return {opacity: t, transform: `translateY(${(1 - t) * dist}px)`};
};

/** 進場：彈出放大 */
export const popIn = (frame: number, at: number, from = 0.6): React.CSSProperties => {
  const t = pop(frame, at);
  return {opacity: Math.min(1, t * 1.5), transform: `scale(${from + (1 - from) * t})`};
};
