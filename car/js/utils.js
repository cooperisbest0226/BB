/* ==========================================================
   utils.js — 格式化與小工具
   介面語言為繁體中文，所有數字／日期格式集中在這裡，避免各頁不一致。
   ========================================================== */

export const clamp = (n, min = 0, max = 1) => Math.min(max, Math.max(min, n));

export const DAY = 86400000;

/* ---------- 日期 ---------- */

/** 取當地時間的 YYYY-MM-DD（不能用 toISOString，會被 UTC 位移） */
export function todayISO(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 把 YYYY-MM-DD 轉成當地零時的 Date，避免時區造成差一天 */
export function parseDate(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function fmtDate(iso) {
  const d = parseDate(iso);
  if (!d) return '—';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
}

export function fmtDateShort(iso) {
  const d = parseDate(iso);
  if (!d) return '—';
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 相差天數（正 = 未來還有幾天，負 = 已過幾天） */
export function daysUntil(iso, from = new Date()) {
  const d = parseDate(iso);
  if (!d) return null;
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((d - base) / DAY);
}

export function daysSince(iso, from = new Date()) {
  const n = daysUntil(iso, from);
  return n === null ? null : -n;
}

export function monthsSince(iso, from = new Date()) {
  const d = parseDate(iso);
  if (!d) return null;
  return (from.getFullYear() - d.getFullYear()) * 12 + (from.getMonth() - d.getMonth())
    + (from.getDate() >= d.getDate() ? 0 : -1);
}

export function addMonths(iso, months) {
  const d = parseDate(iso);
  if (!d) return null;
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), lastDay));
  return todayISO(target);
}

/** 到期天數的人話說法 */
export function dueText(days) {
  if (days === null || days === undefined) return '未設定';
  if (days < 0) return `已逾期 ${Math.abs(days)} 天`;
  if (days === 0) return '今天到期';
  if (days === 1) return '明天到期';
  if (days <= 45) return `還有 ${days} 天`;
  if (days <= 365) return `還有 ${Math.round(days / 30)} 個月`;
  return `還有 ${(days / 365).toFixed(1)} 年`;
}

/* ---------- 數字 ---------- */

const nf = new Intl.NumberFormat('zh-Hant-TW');

export const fmtInt = (n) => (Number.isFinite(+n) ? nf.format(Math.round(+n)) : '—');

export function fmtKm(n) {
  return Number.isFinite(+n) ? `${nf.format(Math.round(+n))} km` : '—';
}

export function fmtMoney(n, { sign = true } = {}) {
  if (!Number.isFinite(+n)) return '—';
  const v = Math.round(+n);
  return `${sign ? 'NT$' : ''}${nf.format(v)}`;
}

/** 大金額縮寫：12.4 萬 */
export function fmtMoneyShort(n) {
  if (!Number.isFinite(+n)) return '—';
  const v = Math.round(+n);
  if (Math.abs(v) >= 100000000) return `${(v / 100000000).toFixed(2)} 億`;
  if (Math.abs(v) >= 10000) return `${(v / 10000).toFixed(v >= 1000000 ? 0 : 1)} 萬`;
  return nf.format(v);
}

export const fmtDec = (n, digits = 1) =>
  Number.isFinite(+n) ? (+n).toFixed(digits) : '—';

/** 車齡：2.4 年 */
export function ageText(purchaseDate, year) {
  const iso = purchaseDate || (year ? `${year}-01-01` : null);
  const m = monthsSince(iso);
  if (m === null || m < 0) return '—';
  if (m < 12) return `${m} 個月`;
  return `${(m / 12).toFixed(1)} 年`;
}

/* ---------- 圖片 ---------- */

/**
 * 壓縮照片：長邊縮到 maxSide、輸出 JPEG。
 * 車輛照片動輒 4~8MB，不壓縮會讓 IndexedDB 爆掉、清單捲動掉格。
 */
export async function compressImage(file, maxSide = 1400, quality = 0.82) {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file; // 不支援時退回原檔，功能不中斷
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
  return blob || file;
}

export function fmtBytes(bytes) {
  if (!Number.isFinite(+bytes)) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = +bytes, i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
