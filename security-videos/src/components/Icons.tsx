import React from 'react';
import {C} from '../theme';

type P = {size?: number; color?: string; style?: React.CSSProperties};

/** 以 pathLength=1 畫線條動畫：p = 0→1 */
const dash = (p: number) => ({strokeDasharray: 1, strokeDashoffset: 1 - Math.max(0, Math.min(1, p))});

export const Envelope: React.FC<P> = ({size = 120, color = C.white, style}) => (
  <svg width={size} height={size * 0.75} viewBox="0 0 64 48" style={style}>
    <rect x="3" y="3" width="58" height="42" rx="6" fill="none" stroke={color} strokeWidth="4" />
    <path d="M5 7 L32 28 L59 7" fill="none" stroke={color} strokeWidth="4" strokeLinejoin="round" />
  </svg>
);

export const CursorArrow: React.FC<P> = ({size = 44, style}) => (
  <svg width={size} height={size * 1.4} viewBox="0 0 20 28" style={style}>
    <path
      d="M1.5 1.5 L1.5 22 L6.8 17 L10.6 25.6 L14.2 24 L10.5 15.6 L17.6 15.6 Z"
      fill="#FFFFFF"
      stroke="#101820"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

export const HandPointer: React.FC<P> = ({size = 48, style}) => (
  <svg width={size} height={size * 1.2} viewBox="0 0 30 36" style={style}>
    <path
      d="M10 3.5 a2.8 2.8 0 0 1 5.6 0 V15 l1-0.4 a2.6 2.6 0 0 1 3.3 1.5 l0.2 0.5 a2.6 2.6 0 0 1 3.5 1.2 l0.2 0.6
         a2.6 2.6 0 0 1 3.4 1.6 L27.5 26 c0.6 4.5-2.5 8.5-7.5 8.5 h-5 c-2.6 0-4.6-1-6.2-3 L3.3 24.5
         a2.7 2.7 0 0 1 3.9-3.7 L10 23.5 Z"
      fill="#FFFFFF"
      stroke="#101820"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

export const Shield: React.FC<P & {check?: number; fill?: string}> = ({size = 200, color = C.green, fill, check = 1, style}) => (
  <svg width={size} height={size * 1.15} viewBox="0 0 100 115" style={style}>
    <path
      d="M50 4 L90 18 V52 C90 80 72 100 50 111 C28 100 10 80 10 52 V18 Z"
      fill={fill ?? color}
      stroke={color}
      strokeWidth="5"
      strokeLinejoin="round"
    />
    <path
      d="M30 57 L45 72 L72 42"
      fill="none"
      stroke="#FFFFFF"
      strokeWidth="10"
      strokeLinecap="round"
      strokeLinejoin="round"
      pathLength={1}
      style={dash(check)}
    />
  </svg>
);

/** 圓形徽章 + 打叉 / 打勾（p 控制線條畫出進度） */
export const Badge: React.FC<P & {kind: 'x' | 'check'; p?: number}> = ({size = 90, kind, p = 1, style}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
    <circle cx="50" cy="50" r="46" fill={kind === 'x' ? C.red : C.green} stroke={C.bg} strokeWidth="6" />
    {kind === 'x' ? (
      <>
        <path d="M32 32 L68 68" stroke="#fff" strokeWidth="11" strokeLinecap="round" pathLength={1} style={dash(p * 2)} />
        <path d="M68 32 L32 68" stroke="#fff" strokeWidth="11" strokeLinecap="round" pathLength={1} style={dash(p * 2 - 1)} />
      </>
    ) : (
      <path
        d="M28 52 L44 67 L73 36"
        fill="none"
        stroke="#fff"
        strokeWidth="11"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        style={dash(p)}
      />
    )}
  </svg>
);

export const WarningTriangle: React.FC<P> = ({size = 64, color = C.red, style}) => (
  <svg width={size} height={size} viewBox="0 0 64 64" style={style}>
    <path d="M32 5 L61 57 H3 Z" fill={color} stroke={color} strokeWidth="4" strokeLinejoin="round" />
    <rect x="29" y="22" width="6" height="20" rx="3" fill="#fff" />
    <circle cx="32" cy="49" r="3.6" fill="#fff" />
  </svg>
);

export const ReplyArrow: React.FC<P> = ({size = 64, color = C.white, style}) => (
  <svg width={size} height={size} viewBox="0 0 64 64" style={style}>
    <path
      d="M26 14 L8 30 L26 46 V36 C40 36 50 40 57 52 C55 34 45 24 26 24 Z"
      fill={color}
      stroke={color}
      strokeWidth="3"
      strokeLinejoin="round"
    />
  </svg>
);

export const Stopwatch: React.FC<P> = ({size = 64, color = C.white, style}) => (
  <svg width={size} height={size} viewBox="0 0 64 64" style={style}>
    <circle cx="32" cy="36" r="23" fill="none" stroke={color} strokeWidth="5" />
    <rect x="26" y="4" width="12" height="7" rx="2" fill={color} />
    <path d="M32 36 L32 22 M32 36 L42 42" stroke={color} strokeWidth="5" strokeLinecap="round" />
  </svg>
);

export const Flag: React.FC<P> = ({size = 56, color = C.white, style}) => (
  <svg width={size} height={size} viewBox="0 0 64 64" style={style}>
    <path d="M14 6 V60" stroke={color} strokeWidth="6" strokeLinecap="round" />
    <path d="M17 9 H50 L42 21 L50 33 H17 Z" fill={color} strokeLinejoin="round" />
  </svg>
);

export const Cloud: React.FC<P> = ({size = 200, color = C.white, style}) => (
  <svg width={size} height={size * 0.62} viewBox="0 0 160 100" style={style}>
    <path
      d="M44 92 H124 C144 92 156 78 156 62 C156 45 143 33 127 33 C122 16 106 6 89 6 C70 6 55 18 50 35
         C31 35 16 48 16 64 C16 80 28 92 44 92 Z"
      fill={color}
    />
  </svg>
);
