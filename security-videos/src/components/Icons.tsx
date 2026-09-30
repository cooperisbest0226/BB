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

/** AI 標誌（四角星光，泛用圖形） */
export const Sparkle: React.FC<P> = ({size = 40, color = '#8B7CF6', style}) => (
  <svg width={size} height={size} viewBox="0 0 64 64" style={style}>
    <path d="M28 4 C30 20 34 26 50 28 C34 30 30 36 28 52 C26 36 22 30 6 28 C22 26 26 20 28 4 Z" fill={color} />
    <path d="M50 38 C51 45 53 47 60 48 C53 49 51 51 50 58 C49 51 47 49 40 48 C47 47 49 45 50 38 Z" fill={color} opacity="0.8" />
  </svg>
);

/** 禁止符號（紅圈斜線），p = 0→1 畫出 */
export const Prohibit: React.FC<P & {p?: number}> = ({size = 180, p = 1, style}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
    <circle cx="50" cy="50" r="42" fill="none" stroke={C.red} strokeWidth="9" pathLength={1} style={dash(p * 1.6)} transform="rotate(-90 50 50)" />
    <path d="M21 21 L79 79" stroke={C.red} strokeWidth="9" strokeLinecap="round" pathLength={1} style={dash(p * 2.2 - 1.2)} />
  </svg>
);

export const Laptop: React.FC<{width?: number; children?: React.ReactNode; style?: React.CSSProperties}> = ({width = 360, children, style}) => (
  <div style={{position: 'relative', width, ...style}}>
    <div
      style={{
        width,
        height: width * 0.64,
        borderRadius: 14,
        background: '#2A3E5C',
        padding: 12,
        boxSizing: 'border-box',
      }}
    >
      <div style={{width: '100%', height: '100%', borderRadius: 6, background: '#F3F6FA', overflow: 'hidden', position: 'relative'}}>
        {children}
      </div>
    </div>
    <div style={{width: width * 1.18, height: 16, marginLeft: -width * 0.09, borderRadius: '0 0 12px 12px', background: '#8FA0B8'}} />
  </div>
);

/** 文件（含表格線），可加標籤 */
export const DataFile: React.FC<P & {label?: string}> = ({size = 70, label, style}) => (
  <div style={{position: 'relative', width: size, height: size * 1.25, ...style}}>
    <svg width={size} height={size * 1.25} viewBox="0 0 64 80">
      <path d="M4 4 H44 L60 20 V76 H4 Z" fill="#FFFFFF" stroke="#C8D3E2" strokeWidth="3" strokeLinejoin="round" />
      <path d="M44 4 V20 H60" fill="#E2E8F0" stroke="#C8D3E2" strokeWidth="3" strokeLinejoin="round" />
      {[30, 42, 54, 66].map((y) => (
        <g key={y}>
          <rect x="12" y={y} width="14" height="6" rx="2" fill="#7C8DA6" />
          <rect x="30" y={y} width="22" height="6" rx="2" fill="#B7C2D2" />
        </g>
      ))}
    </svg>
    {label && (
      <div style={{position: 'absolute', left: '50%', top: '100%', transform: 'translateX(-50%)', marginTop: 4, whiteSpace: 'nowrap', fontSize: size * 0.26, fontWeight: 700, color: C.white, fontFamily: '"Noto Sans CJK TC", sans-serif'}}>
        {label}
      </div>
    )}
  </div>
);

export const IdCard: React.FC<P> = ({size = 130, style}) => (
  <svg width={size} height={size * 0.72} viewBox="0 0 100 72" style={style}>
    <rect x="3" y="3" width="94" height="66" rx="10" fill="#EAF1FB" stroke="#9FB3CF" strokeWidth="3" />
    <circle cx="30" cy="30" r="11" fill="#5B7BA8" />
    <path d="M13 58 C14 45 46 45 47 58 Z" fill="#5B7BA8" />
    <rect x="56" y="22" width="32" height="6" rx="3" fill="#7C8DA6" />
    <rect x="56" y="35" width="26" height="6" rx="3" fill="#B7C2D2" />
    <rect x="56" y="48" width="30" height="6" rx="3" fill="#B7C2D2" />
  </svg>
);

export const Contract: React.FC<P> = ({size = 100, style}) => (
  <svg width={size} height={size * 1.15} viewBox="0 0 80 92" style={style}>
    <path d="M6 4 H50 L70 24 V88 H6 Z" fill="#FFFFFF" stroke="#C8D3E2" strokeWidth="3" strokeLinejoin="round" />
    <path d="M50 4 V24 H70" fill="#E2E8F0" stroke="#C8D3E2" strokeWidth="3" strokeLinejoin="round" />
    {[34, 46, 58].map((y) => (
      <rect key={y} x="16" y={y} width={y === 58 ? 26 : 42} height="6" rx="3" fill="#B7C2D2" />
    ))}
    <path d="M16 76 C22 68 26 82 32 74 S40 72 44 76" stroke="#5B7BA8" strokeWidth="3" fill="none" strokeLinecap="round" />
    <circle cx="60" cy="72" r="15" fill={C.yellow} />
    <text x="60" y="79" textAnchor="middle" fontSize="20" fontWeight="700" fill="#0F1B2D" fontFamily="DejaVu Sans, sans-serif">$</text>
  </svg>
);

export const CodeKey: React.FC<P> = ({size = 130, style}) => (
  <svg width={size} height={size * 0.8} viewBox="0 0 100 80" style={style}>
    <rect x="3" y="3" width="80" height="58" rx="10" fill="#1B2A40" stroke="#3B5270" strokeWidth="3" />
    <text x="43" y="42" textAnchor="middle" fontSize="26" fontWeight="700" fill="#4CC38A" fontFamily="DejaVu Sans Mono, monospace">{'</>'}</text>
    <g transform="translate(62 48) rotate(-35)">
      <circle cx="0" cy="0" r="11" fill="none" stroke={C.yellow} strokeWidth="6" />
      <path d="M11 0 H34 M26 0 V8 M32 0 V7" stroke={C.yellow} strokeWidth="6" strokeLinecap="round" />
    </g>
  </svg>
);

export const ChartLock: React.FC<P> = ({size = 130, style}) => (
  <svg width={size} height={size * 0.8} viewBox="0 0 100 80" style={style}>
    <path d="M8 72 H78" stroke="#9FB3CF" strokeWidth="4" strokeLinecap="round" />
    <rect x="14" y="44" width="14" height="26" rx="3" fill="#5B7BA8" />
    <rect x="34" y="30" width="14" height="40" rx="3" fill="#7C9CCB" />
    <rect x="54" y="14" width="14" height="56" rx="3" fill="#A7C0E4" />
    <circle cx="26" cy="16" r="9" fill="#EAF1FB" />
    <path d="M13 38 C14 28 38 28 39 38 Z" fill="#EAF1FB" />
    <g transform="translate(72 44)">
      <rect x="0" y="12" width="26" height="22" rx="4" fill={C.yellow} />
      <path d="M5 12 V7 a8 8 0 0 1 16 0 V12" fill="none" stroke={C.yellow} strokeWidth="4.5" />
    </g>
  </svg>
);

export const Database: React.FC<P & {fill?: number}> = ({size = 120, fill = 1, style}) => (
  <svg width={size} height={size * 1.1} viewBox="0 0 80 88" style={style}>
    {[0, 1, 2].map((i) => (
      <g key={i} opacity={fill > i / 3 ? 1 : 0.18}>
        <path d={`M8 ${62 - i * 24} V${74 - i * 24} C8 ${84 - i * 24} 72 ${84 - i * 24} 72 ${74 - i * 24} V${62 - i * 24}`} fill="#C9D6E8" />
        <ellipse cx="40" cy={62 - i * 24} rx="32" ry="10" fill="#EAF1FB" />
      </g>
    ))}
  </svg>
);

export const Lock: React.FC<P> = ({size = 160, color = C.green, style}) => (
  <svg width={size} height={size * 1.15} viewBox="0 0 80 92" style={style}>
    <path d="M20 40 V26 a20 20 0 0 1 40 0 V40" fill="none" stroke={color} strokeWidth="9" />
    <rect x="8" y="38" width="64" height="50" rx="10" fill={color} />
    <circle cx="40" cy="58" r="7" fill="#fff" />
    <rect x="37" y="60" width="6" height="15" rx="3" fill="#fff" />
  </svg>
);

export const Magnifier: React.FC<P> = ({size = 48, color = C.white, style}) => (
  <svg width={size} height={size} viewBox="0 0 64 64" style={style}>
    <circle cx="26" cy="26" r="18" fill="none" stroke={color} strokeWidth="7" />
    <path d="M40 40 L58 58" stroke={color} strokeWidth="8" strokeLinecap="round" />
  </svg>
);
