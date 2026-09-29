import React from 'react';
import {C} from '../theme';

const SKIN = '#F6CFA8';
const INK = '#1B2638';
const MOUTH = '#8A3B3B';

/**
 * 坐在筆電後方的員工（扁平插畫）
 * mood：0 = 擔心，1 = 鬆一口氣；alert：驚嘆號泡泡；sigh：「呼～」進度
 */
export const Person: React.FC<{mood: number; alert: number; sigh: number; width?: number}> = ({
  mood,
  alert,
  sigh,
  width = 700,
}) => (
  <svg width={width} height={(width * 560) / 640} viewBox="0 0 640 560" style={{overflow: 'visible'}}>
    {/* 盆栽 */}
    <g>
      <ellipse cx="84" cy="360" rx="18" ry="40" fill={C.green} transform="rotate(-25 84 360)" />
      <ellipse cx="112" cy="352" rx="18" ry="44" fill="#3DBB7E" transform="rotate(18 112 352)" />
      <ellipse cx="98" cy="345" rx="14" ry="46" fill="#2A8F5E" />
      <path d="M68 392 H128 L120 432 H76 Z" fill="#B7794E" />
    </g>
    {/* 椅背 */}
    <rect x="182" y="196" width="276" height="240" rx="44" fill="#22344F" />
    {/* 身體與手臂 */}
    <path d="M168 436 C168 344 214 300 320 300 C426 300 472 344 472 436 Z" fill="#3F7BD8" />
    <path d="M290 302 L320 338 L350 302 Z" fill="#EAF1FB" />
    <rect x="298" y="258" width="44" height="50" rx="10" fill="#E8B48C" />
    {/* 頭 */}
    <circle cx="238" cy="208" r="15" fill="#F0C197" />
    <circle cx="402" cy="208" r="15" fill="#F0C197" />
    <circle cx="320" cy="200" r="82" fill={SKIN} />
    <path
      d="M238 200 C232 132 276 106 322 106 C370 106 410 132 404 200 C396 164 366 150 330 152 C300 150 262 162 238 200 Z"
      fill="#2B2F3A"
    />
    <path d="M300 112 C318 140 350 150 392 156 C380 126 350 108 320 108 Z" fill="#2B2F3A" />
    {/* 擔心的臉 */}
    <g opacity={1 - mood}>
      <path d="M274 176 L302 166" stroke={INK} strokeWidth="6" strokeLinecap="round" />
      <path d="M338 166 L366 176" stroke={INK} strokeWidth="6" strokeLinecap="round" />
      <circle cx="292" cy="202" r="8" fill={INK} />
      <circle cx="348" cy="202" r="8" fill={INK} />
      <ellipse cx="320" cy="246" rx="12" ry="9" fill={MOUTH} />
      <path d="M396 150 C390 162 388 170 396 176 C404 170 402 162 396 150 Z" fill="#7CC4FF" />
    </g>
    {/* 放心的臉 */}
    <g opacity={mood}>
      <path d="M276 172 Q290 164 304 172" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M336 172 Q350 164 364 172" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M280 204 Q292 194 304 204" stroke={INK} strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M336 204 Q348 194 360 204" stroke={INK} strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M300 236 Q320 256 340 236" stroke={MOUTH} strokeWidth="6" fill="none" strokeLinecap="round" />
      <circle cx="274" cy="228" r="13" fill="#F29C9C" opacity="0.55" />
      <circle cx="366" cy="228" r="13" fill="#F29C9C" opacity="0.55" />
    </g>
    {/* 手 */}
    <circle cx="206" cy="424" r="18" fill={SKIN} />
    <circle cx="434" cy="424" r="18" fill={SKIN} />
    {/* 筆電（背面） */}
    <rect x="206" y="300" width="228" height="134" rx="14" fill="#D5DDE8" />
    <rect x="206" y="300" width="228" height="14" rx="7" fill="#E7EDF5" />
    <rect x="184" y="430" width="272" height="14" rx="5" fill="#AEB9C8" />
    {/* 桌面 */}
    <rect x="16" y="440" width="608" height="22" rx="6" fill="#2F4566" />
    <rect x="40" y="462" width="560" height="98" fill="#1C2E47" />
    {/* 馬克杯 */}
    <rect x="500" y="384" width="50" height="56" rx="8" fill={C.yellow} />
    <circle cx="556" cy="408" r="14" fill="none" stroke={C.yellow} strokeWidth="7" />
    <path d="M514 372 C508 360 520 354 514 342 M534 372 C528 360 540 354 534 342" stroke="#C8D3E2" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.7" />
    {/* 驚嘆號泡泡 */}
    <g transform={`translate(480 262) scale(${alert})`} opacity={alert > 0 ? 1 : 0}>
      <circle r="56" fill={C.red} />
      <path d="M-22 48 L-48 74 L-4 54 Z" fill={C.red} />
      <rect x="-7" y="-34" width="14" height="44" rx="7" fill="#fff" />
      <circle cy="24" r="8" fill="#fff" />
    </g>
    {/* 呼～ */}
    <g opacity={sigh > 0 ? Math.min(1, sigh * 3) * (1 - Math.max(0, sigh - 0.7) / 0.3) : 0} transform={`translate(${410 + 30 * sigh} ${250 - 40 * sigh})`}>
      <circle cx="0" cy="0" r="16" fill="#DCE6F3" opacity="0.8" />
      <circle cx="26" cy="-14" r="12" fill="#DCE6F3" opacity="0.6" />
      <text x="40" y="-24" fontSize="54" fontWeight="700" fill="#FFFFFF" fontFamily='"Noto Sans CJK TC", sans-serif'>
        呼～
      </text>
    </g>
  </svg>
);
