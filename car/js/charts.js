/* ==========================================================
   charts.js — 純 SVG 圖表元件
   刻意不使用 Chart.js 之類的 CDN 套件：
   1. offline-first，不能依賴外部請求
   2. 分段式健康環是本 App 的視覺主角，需要完全控制
   動畫一律用 rAF 插值，避免 stroke-dasharray 在各瀏覽器的 transition 差異。
   ========================================================== */

import { clamp } from './utils.js';

const TAU = Math.PI * 2;
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ==========================================================
   分段式健康環（Signature 元件）
   一個環同時表達「總分」與「各項目狀態」：
   每個健康項目佔一段弧（長度依權重），弧的填滿比例是該項目的剩餘壽命，
   顏色是該項目的狀態色。所以一眼就能看出「哪一段紅了」。
   ========================================================== */
export function healthRing({ score, color, items }, { size = 132, stroke = 12, gap = 0.028 } = {}) {
  const cx = size / 2, cy = size / 2;

  /* --- 外環：整體分數，一條連續的弧，顏色是等級色 --- */
  const rOuter = (size - stroke) / 2;
  const Co = TAU * rOuter;
  const f = score === null ? 0 : clamp(score / 100);
  const outer = `
    <circle cx="${cx}" cy="${cy}" r="${rOuter}" fill="none" stroke="var(--fill-3)" stroke-width="${stroke}"/>
    <circle class="ring-seg" cx="${cx}" cy="${cy}" r="${rOuter}" fill="none"
      stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"
      data-len="${(Co * f).toFixed(2)}" data-c="${Co.toFixed(2)}"
      stroke-dasharray="0 ${Co.toFixed(2)}"/>`;

  /* --- 內環：六個項目的狀態色實心分段，像一條診斷色帶 --- */
  const rInner = rOuter - stroke * 0.86;
  const Ci = TAU * rInner;
  const total = items.reduce((s, i) => s + i.weight, 0) || 1;
  const innerStroke = Math.max(3, stroke * 0.34);
  let cursor = 0;
  const inner = items.map((item) => {
    const share = item.weight / total;
    const len = Math.max(1, Ci * (share - gap));
    const start = Ci * cursor;
    cursor += share;
    return `<circle class="ring-seg" cx="${cx}" cy="${cy}" r="${rInner}" fill="none"
      stroke="${item.color}" stroke-width="${innerStroke}" stroke-linecap="round"
      data-len="${len.toFixed(2)}" data-c="${Ci.toFixed(2)}" data-delay="${(cursor * 220).toFixed(0)}"
      stroke-dasharray="0 ${Ci.toFixed(2)}" stroke-dashoffset="${(-start).toFixed(2)}"/>`;
  }).join('');

  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">${outer}${inner}</svg>`;
}

/** 小型單環量表（健康明細列使用） */
export function miniGauge(factor, color, { size = 26, stroke = 3 } = {}) {
  const r = (size - stroke) / 2;
  const C = TAU * r;
  const f = factor === null ? 0 : clamp(factor);
  return `<svg viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--fill-3)" stroke-width="${stroke}"/>
    <circle class="ring-seg" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none"
      stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"
      data-len="${(C * f).toFixed(2)}" data-c="${C.toFixed(2)}"
      stroke-dasharray="0 ${C.toFixed(2)}"/>
  </svg>`;
}

/** 掃描容器內所有環並播放填滿動畫 */
export function animateRings(root = document) {
  const segs = root.querySelectorAll('.ring-seg[data-len]');
  if (!segs.length) return;
  if (reduceMotion()) {
    segs.forEach((el) => {
      el.setAttribute('stroke-dasharray', `${el.dataset.len} ${el.dataset.c}`);
      el.removeAttribute('data-len');
    });
    return;
  }
  const dur = 700;
  const t0 = performance.now();
  const list = [...segs].map((el) => ({
    el, len: +el.dataset.len, c: +el.dataset.c, delay: +(el.dataset.delay || 0),
  }));
  list.forEach(({ el }) => { el.removeAttribute('data-len'); el.removeAttribute('data-delay'); });

  const step = (now) => {
    let running = false;
    for (const { el, len, c, delay } of list) {
      const p = clamp((now - t0 - delay) / dur);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      el.setAttribute('stroke-dasharray', `${(len * eased).toFixed(2)} ${c}`);
      if (p < 1) running = true;
    }
    if (running) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** 數字滾動動畫（使用者明確喜歡這個效果） */
export function countUp(el, target, { dur = 800, decimals = 0, format } = {}) {
  if (!el) return;
  const to = Number(target);
  if (!Number.isFinite(to)) { el.textContent = '—'; return; }
  const render = (v) => { el.textContent = format ? format(v) : v.toFixed(decimals); };
  if (reduceMotion()) { render(to); return; }
  const from = 0;
  const t0 = performance.now();
  const step = (now) => {
    const p = clamp((now - t0) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    render(from + (to - from) * eased);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ==========================================================
   折線圖（里程趨勢）
   points: [{ x: 毫秒時間, y: 數值 }]，至少 2 點才畫。
   ========================================================== */
export function sparkline(points, { w = 320, h = 92, color = 'var(--accent)', pad = 6, fill = true } = {}) {
  if (!points || points.length < 2) return '';
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const px = (x) => pad + ((x - minX) / spanX) * (w - pad * 2);
  const py = (y) => h - pad - ((y - minY) / spanY) * (h - pad * 2);

  // 用 Catmull-Rom 轉貝茲，線條比折線柔和，接近 Apple Health 的曲線
  const pts = points.map((p) => [px(p.x), py(p.y)]);
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  const area = `${d} L${pts.at(-1)[0].toFixed(1)},${h} L${pts[0][0].toFixed(1)},${h} Z`;
  const gid = `g${Math.random().toString(36).slice(2, 8)}`;
  const last = pts.at(-1);

  return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity=".26"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${fill ? `<path d="${area}" fill="url(#${gid})"/>` : ''}
    <path d="${d}" fill="none" stroke="${color}" stroke-width="2.4"
      stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
    <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3.4" fill="${color}"/>
  </svg>`;
}

/** 直條圖（每月里程） */
export function bars(values, { w = 320, h = 76, color = 'var(--accent)', gap = 3 } = {}) {
  if (!values || !values.length) return '';
  const max = Math.max(...values.map((v) => v.value), 1);
  const bw = (w - gap * (values.length - 1)) / values.length;
  const rects = values.map((v, i) => {
    const bh = Math.max(2, (v.value / max) * (h - 16));
    const x = i * (bw + gap);
    return `<rect x="${x.toFixed(1)}" y="${(h - 14 - bh).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}"
      rx="${Math.min(3, bw / 2).toFixed(1)}" fill="${color}" opacity="${v.dim ? .35 : 1}"/>
      <text x="${(x + bw / 2).toFixed(1)}" y="${h - 3}" font-size="8" fill="var(--label-tertiary)"
        text-anchor="middle">${v.label}</text>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" aria-hidden="true">${rects}</svg>`;
}
