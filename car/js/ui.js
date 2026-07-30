/* ==========================================================
   ui.js — 共用 UI 元件與互動
   所有模組都應該重用這裡的元件，這是「全 App 視覺一致」的實作保證。
   ========================================================== */

import { icon } from './icons.js';
import { escapeHtml } from './utils.js';

/* ---------- DOM 小工具 ---------- */

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** HTML 字串轉節點 */
export function node(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/** 依 data-act 綁事件，避免到處寫 querySelector */
export function wire(root, handlers) {
  for (const [act, fn] of Object.entries(handlers)) {
    $$(`[data-act="${act}"]`, root).forEach((el) => {
      const evt = el.tagName === 'INPUT' || el.tagName === 'SELECT' ? 'change' : 'click';
      el.addEventListener(evt, (e) => fn(e, el));
    });
  }
  return root;
}

/* ---------- 觸覺回饋 ----------
   iOS Safari 目前不支援 navigator.vibrate，所以觸覺感受主要靠
   「按下即縮放」的視覺回饋（見 CSS :active）；有支援的平台則震動。 */
export function haptic(kind = 'light') {
  const map = { light: 8, medium: 14, heavy: 22, success: [10, 40, 14], warn: [18, 60, 18] };
  try { navigator.vibrate?.(map[kind] ?? 8); } catch { /* 忽略 */ }
}

/* ---------- Toast ---------- */

const toastRoot = () => document.getElementById('toast-root');

export function toast(message, { type = 'plain', duration = 2200 } = {}) {
  const iconName = type === 'good' ? 'checkCircle' : type === 'bad' ? 'warning' : 'info';
  const el = node(`<div class="toast toast--${type}">${icon(iconName)}<span>${escapeHtml(message)}</span></div>`);
  toastRoot().appendChild(el);
  haptic(type === 'bad' ? 'warn' : 'light');
  setTimeout(() => {
    el.classList.add('is-out');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }, duration);
  return el;
}

/* ==========================================================
   Sheet
   可拖曳關閉的底部面板。表單、選單、詳情都用這個，
   使用者永遠不會離開當前畫面 → 符合「一到兩次點擊」的 UX 規則。
   ========================================================== */

const overlayRoot = () => document.getElementById('overlay-root');
let openSheets = 0;

export function openSheet({
  title = '',
  body = '',
  tall = false,
  left = null,      // { label, act } 或 null
  right = null,     // { label, act, strong, disabled }
  foot = '',
  onClose = null,
  dismissible = true,
} = {}) {
  const scrim = node('<div class="scrim"></div>');
  const sheet = node(`
    <section class="sheet ${tall ? 'sheet--tall' : ''}" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <div class="sheet__grip" data-grip></div>
      ${(title || left || right) ? `
      <header class="sheet__head">
        <div>${left ? `<button class="sheet__action" data-sheet-left>${escapeHtml(left.label)}</button>` : ''}</div>
        <h2 class="sheet__title">${escapeHtml(title)}</h2>
        <div>${right ? `<button class="sheet__action sheet__action--right ${right.strong ? 'sheet__action--strong' : ''}"
             data-sheet-right ${right.disabled ? 'disabled' : ''}>${escapeHtml(right.label)}</button>` : ''}</div>
      </header>` : ''}
      <div class="sheet__body">${body}</div>
      ${foot ? `<footer class="sheet__foot">${foot}</footer>` : ''}
    </section>`);

  overlayRoot().append(scrim, sheet);
  overlayRoot().style.pointerEvents = 'auto';
  openSheets++;

  requestAnimationFrame(() => {
    scrim.classList.add('is-open');
    sheet.classList.add('is-open');
  });

  let closed = false;
  const close = (reason = 'dismiss') => {
    if (closed) return;
    closed = true;
    scrim.classList.remove('is-open');
    sheet.classList.remove('is-open');
    setTimeout(() => {
      scrim.remove(); sheet.remove();
      openSheets = Math.max(0, openSheets - 1);
      if (!openSheets) overlayRoot().style.pointerEvents = 'none';
      onClose?.(reason);
    }, 320);
  };

  if (dismissible) scrim.addEventListener('click', () => { haptic(); close(); });

  const leftBtn = sheet.querySelector('[data-sheet-left]');
  const rightBtn = sheet.querySelector('[data-sheet-right]');
  leftBtn?.addEventListener('click', () => { haptic(); (left.act ? left.act(close) : close('left')); });
  rightBtn?.addEventListener('click', () => { haptic('medium'); right.act?.(close); });

  attachDrag(sheet, close, dismissible);

  return {
    el: sheet,
    body: sheet.querySelector('.sheet__body'),
    footEl: sheet.querySelector('.sheet__foot'),
    rightBtn,
    close,
    setRightDisabled: (v) => { if (rightBtn) rightBtn.disabled = !!v; },
  };
}

/** 拖曳把手／標題列往下拉即關閉，帶橡皮筋阻尼 */
function attachDrag(sheet, close, dismissible) {
  const handles = [sheet.querySelector('[data-grip]'), sheet.querySelector('.sheet__head')].filter(Boolean);
  let startY = 0, dy = 0, dragging = false, t0 = 0;

  const down = (e) => {
    if (!dismissible) return;
    dragging = true; startY = e.clientY; dy = 0; t0 = performance.now();
    sheet.style.transition = 'none';
    sheet.setPointerCapture?.(e.pointerId);
  };
  const move = (e) => {
    if (!dragging) return;
    dy = e.clientY - startY;
    // 往上拉時阻尼加大，感覺像 iOS
    const y = dy < 0 ? dy / 6 : dy;
    sheet.style.transform = `translateY(${y}px)`;
  };
  const up = () => {
    if (!dragging) return;
    dragging = false;
    sheet.style.transition = '';
    sheet.style.transform = '';
    const velocity = dy / Math.max(1, performance.now() - t0);
    if (dy > 110 || velocity > 0.7) { haptic(); close('drag'); }
  };

  handles.forEach((el) => {
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', down);
  });
  sheet.addEventListener('pointermove', move);
  sheet.addEventListener('pointerup', up);
  sheet.addEventListener('pointercancel', up);
}

/* ---------- Action Sheet（選單） ---------- */

export function actionSheet({ title = '', message = '', options = [] }) {
  const body = `
    ${message ? `<p class="section__note" style="padding-top:0">${escapeHtml(message)}</p>` : ''}
    <div class="opt-list">
      ${options.map((o, i) => `
        <button class="opt ${o.danger ? 'opt--danger' : ''}" data-opt="${i}">
          ${o.icon ? `<span style="color:${o.danger ? 'var(--red)' : 'var(--accent)'}">${icon(o.icon)}</span>` : ''}
          <span class="opt__label">${escapeHtml(o.label)}</span>
          ${o.checked ? `<span class="opt__check">${icon('check')}</span>` : ''}
        </button>`).join('')}
    </div>`;

  const sheet = openSheet({ title, body, left: { label: '取消' } });
  options.forEach((o, i) => {
    sheet.body.querySelector(`[data-opt="${i}"]`)?.addEventListener('click', () => {
      haptic('medium');
      sheet.close('select');
      setTimeout(() => o.onSelect?.(), 180);
    });
  });
  return sheet;
}

/* ---------- 確認對話 ---------- */

export function confirmSheet({ title, message = '', confirmLabel = '確認', danger = false }) {
  return new Promise((resolve) => {
    let settled = false;
    const sheet = openSheet({
      title,
      body: message ? `<p class="section__note" style="padding-top:0;text-align:center">${escapeHtml(message)}</p>` : '',
      foot: `
        <button class="btn btn--full ${danger ? 'btn--danger' : 'btn--primary'}" data-confirm>${escapeHtml(confirmLabel)}</button>
        <button class="btn btn--full btn--plain" data-cancel>取消</button>`,
      onClose: () => { if (!settled) { settled = true; resolve(false); } },
    });
    sheet.footEl.querySelector('[data-confirm]').addEventListener('click', () => {
      settled = true; haptic('medium'); sheet.close('confirm'); resolve(true);
    });
    sheet.footEl.querySelector('[data-cancel]').addEventListener('click', () => {
      settled = true; sheet.close('cancel'); resolve(false);
    });
  });
}

/* ==========================================================
   清單元件
   ========================================================== */

export function listRow({
  label, value = '', sub = '', iconName = null, tint = 'var(--accent)',
  chevron = false, act = null, danger = false, right = '',
}) {
  const tag = act ? 'button' : 'div';
  return `
  <${tag} class="list__row ${act ? 'list__row--tap' : ''} ${danger ? 'list__row--danger' : ''}"
    ${act ? `data-act="${act}" type="button"` : ''}>
    ${iconName ? `<span class="list__icon" style="background:${tint}">${icon(iconName)}</span>` : ''}
    <span class="list__body">
      <span class="list__label">${escapeHtml(label)}</span>
      ${sub ? `<span class="list__sub">${escapeHtml(sub)}</span>` : ''}
    </span>
    ${value !== '' && value !== null ? `<span class="list__value">${escapeHtml(value)}</span>` : ''}
    ${right}
    ${chevron ? `<span class="list__chevron">${icon('chevronRight')}</span>` : ''}
  </${tag}>`;
}

export const listGroup = (rows, cls = '') => `<div class="list ${cls}">${rows.join('')}</div>`;

export function section({ title = '', action = null, body = '', note = '' }) {
  return `
  <section class="section">
    ${(title || action) ? `
      <header class="section__head">
        <h2 class="section__title">${escapeHtml(title)}</h2>
        ${action ? `<button class="section__action" data-act="${action.act}">${escapeHtml(action.label)}</button>` : ''}
      </header>` : ''}
    ${body}
    ${note ? `<p class="section__note">${escapeHtml(note)}</p>` : ''}
  </section>`;
}

export function emptyState({ iconName = 'car', title, text = '', actions = [] }) {
  return `
  <div class="empty">
    <div class="empty__art">${icon(iconName)}</div>
    <h2 class="empty__title">${escapeHtml(title)}</h2>
    ${text ? `<p class="empty__text">${escapeHtml(text)}</p>` : ''}
    ${actions.length ? `<div class="empty__actions">
      ${actions.map((a) => `<button class="btn btn--full ${a.style || 'btn--primary'}" data-act="${a.act}">
        ${a.iconName ? icon(a.iconName) : ''}${escapeHtml(a.label)}</button>`).join('')}
    </div>` : ''}
  </div>`;
}

/* ==========================================================
   表單欄位
   name 對應資料欄位；讀值統一用 readForm()。
   ========================================================== */

export function fieldText({ name, label, value = '', placeholder = '', maxlength = 60, transform = '' }) {
  return `
  <label class="field">
    <span class="field__label">${escapeHtml(label)}</span>
    <input class="field__input" name="${name}" type="text" value="${escapeHtml(value ?? '')}"
      placeholder="${escapeHtml(placeholder)}" maxlength="${maxlength}"
      ${transform ? `data-transform="${transform}"` : ''} autocomplete="off" enterkeyhint="next">
  </label>`;
}

export function fieldNumber({ name, label, value = '', placeholder = '', unit = '', step = '1', min = '0' }) {
  return `
  <label class="field">
    <span class="field__label">${escapeHtml(label)}</span>
    <input class="field__input" name="${name}" type="number" inputmode="decimal"
      value="${value ?? ''}" placeholder="${escapeHtml(placeholder)}" step="${step}" min="${min}">
    ${unit ? `<span class="field__unit">${escapeHtml(unit)}</span>` : ''}
  </label>`;
}

export function fieldDate({ name, label, value = '' }) {
  return `
  <label class="field">
    <span class="field__label field__label--wide">${escapeHtml(label)}</span>
    <input class="field__input" name="${name}" type="date" value="${value || ''}">
  </label>`;
}

export function fieldSelect({ name, label, value = '', options = [] }) {
  return `
  <label class="field">
    <span class="field__label">${escapeHtml(label)}</span>
    <select class="field__input" name="${name}">
      ${options.map((o) => {
        const val = typeof o === 'string' ? o : o.value;
        const text = typeof o === 'string' ? o : o.label;
        return `<option value="${escapeHtml(val)}" ${String(value) === String(val) ? 'selected' : ''}>${escapeHtml(text)}</option>`;
      }).join('')}
    </select>
  </label>`;
}

export function fieldGroup({ title = '', body, note = '' }) {
  return `
  <div class="field-group">
    ${title ? `<div class="field-group__title">${escapeHtml(title)}</div>` : ''}
    <div class="field-group__body">${body}</div>
    ${note ? `<div class="field-group__note">${escapeHtml(note)}</div>` : ''}
  </div>`;
}

/** 讀出表單所有欄位（空字串一律回 null，資料庫不留空殼字串） */
export function readForm(root) {
  const out = {};
  $$('input[name], select[name], textarea[name]', root).forEach((el) => {
    let v = el.value;
    if (typeof v === 'string') v = v.trim();
    if (v === '') { out[el.name] = null; return; }
    out[el.name] = el.type === 'number' ? Number(v) : v;
  });
  return out;
}

/** 大寫轉換等輸入處理（車牌／VIN） */
export function attachTransforms(root) {
  $$('[data-transform="upper"]', root).forEach((el) => {
    el.addEventListener('input', () => {
      const pos = el.selectionStart;
      el.value = el.value.toUpperCase();
      el.setSelectionRange?.(pos, pos);
    });
  });
}

/* ---------- 照片挑選 ---------- */

export function photoPicker({ url = null, label = '加入車輛照片' }) {
  return `
  <div class="photo-pick" data-photo>
    <div class="photo-pick__frame" data-photo-frame>
      ${url
        ? `<img src="${url}" alt="車輛照片">`
        : `<span class="photo-pick__hint">${icon('camera')}<span>${escapeHtml(label)}</span></span>`}
    </div>
    <input type="file" accept="image/*" data-photo-input aria-label="${escapeHtml(label)}">
    ${url ? `<button class="photo-pick__clear" data-photo-clear type="button" aria-label="移除照片">${icon('xmark')}</button>` : ''}
  </div>`;
}

/* ---------- 色票 ---------- */

export function tintPicker(tints, current) {
  return `<div class="tints">${tints.map((t) => `
    <button class="tint-dot ${t === current ? 'is-active' : ''}" data-tint="${t}" type="button"
      style="--dot: var(--${t})" aria-label="主題色 ${t}" aria-pressed="${t === current}"></button>`).join('')}</div>`;
}

/* ==========================================================
   導覽列
   ========================================================== */

export function setNav({ title = '', left = null, right = null }) {
  const navTitle = document.getElementById('nav-title');
  const navLeft = document.getElementById('nav-left');
  const navRight = document.getElementById('nav-right');
  navTitle.textContent = title;
  navLeft.innerHTML = left ? navButton(left) : '';
  navRight.innerHTML = right ? navButton(right) : '';
  return { navLeft, navRight };
}

function navButton({ label = '', iconName = null, act = '', back = false }) {
  return `<button class="nav-btn ${back ? 'nav-btn--back' : ''}" data-act="${act}" type="button">
    ${iconName ? icon(iconName) : ''}${label ? `<span class="nav-btn__label">${escapeHtml(label)}</span>` : ''}
  </button>`;
}

/** 捲動超過大標題時，導覽列變玻璃並顯示行內標題 */
export function attachCondense(viewEl, navEl) {
  let condensed = false;
  const onScroll = () => {
    const should = viewEl.scrollTop > 26;
    if (should !== condensed) {
      condensed = should;
      navEl.classList.toggle('is-condensed', should);
    }
  };
  viewEl.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  return () => viewEl.removeEventListener('scroll', onScroll);
}

/* ---------- iOS 開關 ---------- */
export function switchRow({ label, sub = '', name, checked = false, iconName = null, tint = 'var(--accent)' }) {
  return `
  <div class="list__row">
    ${iconName ? `<span class="list__icon" style="background:${tint}">${icon(iconName)}</span>` : ''}
    <span class="list__body">
      <span class="list__label">${escapeHtml(label)}</span>
      ${sub ? `<span class="list__sub">${escapeHtml(sub)}</span>` : ''}
    </span>
    <label class="switch">
      <input type="checkbox" name="${name}" ${checked ? 'checked' : ''} aria-label="${escapeHtml(label)}">
      <span class="switch__track"></span><span class="switch__knob"></span>
    </label>
  </div>`;
}
