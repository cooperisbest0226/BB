/* ==========================================================
   dashboard.js — 總覽
   佈局參考 Apple Health：一張大健康卡（分段環）→ 待辦 → 明細 → 趨勢 → 成本。
   規則：所有數字都必須是真的算出來的，沒有任何示意用的假資料。
   ========================================================== */

import { setNav, listRow, listGroup, section, emptyState, toast, haptic, actionSheet } from '../ui.js';
import { icon } from '../icons.js';
import { healthRing, miniGauge, sparkline, animateRings } from '../charts.js';
import { vehicleHealth, alertsFor, ownership } from '../health.js';
import {
  state, vehicles, currentVehicle, setCurrentVehicle, mileageFor,
  monthlyAverageKm, photoUrl, seedDemo,
} from '../store.js';
import { fmtInt, fmtMoney, ageText, fmtDate, escapeHtml, parseDate, fmtDec } from '../utils.js';
import { openVehicleForm, openHealthSetup, openMileageSheet } from './editors.js';

const weekday = ['日', '一', '二', '三', '四', '五', '六'];

export async function show(root, { navigate }) {
  const list = vehicles();
  const v = currentVehicle();
  const remindDays = state.settings.remindDays;

  setNav({
    title: '總覽',
    right: v ? { iconName: 'plusCircle', act: 'quick' } : null,
  });

  if (!v) {
    root.innerHTML = `
      <h1 class="large-title">總覽</h1>
      ${emptyState({
        iconName: 'car',
        title: '車庫還是空的',
        text: '加入第一台車，就能開始追蹤健康狀況、到期日與持有成本。',
        actions: [
          { label: '新增車輛', act: 'add', iconName: 'plus' },
          { label: '載入示範資料', act: 'demo', style: 'btn--tinted' },
        ],
      })}`;
    bindEmpty(root, navigate);
    return;
  }

  const health = vehicleHealth(v, { remindDays });
  const alerts = alertsFor(v, { remindDays });
  const own = ownership(v);
  const logs = mileageFor(v.id);
  const avgMonth = monthlyAverageKm(v.id);
  const oil = health.items.find((i) => i.key === 'oil');
  const now = new Date();

  root.innerHTML = `
    <h1 class="large-title">總覽
      <span class="large-title__sub">${now.getMonth() + 1}月${now.getDate()}日 星期${weekday[now.getDay()]}</span>
    </h1>

    ${list.length > 1 ? `<div class="switcher">${list.map((x) => `
      <button class="switcher__item ${x.id === v.id ? 'is-active' : ''}" data-veh="${x.id}" type="button">
        <span class="switcher__thumb" data-thumb="${x.photoId || ''}">${icon('car')}</span>
        <span>${escapeHtml(x.nickname || x.model || '車輛')}</span>
      </button>`).join('')}</div>` : ''}

    <!-- 健康主卡 -->
    <div class="card">
      <div class="health">
        <div class="health__ring">
          ${healthRing({
            score: health.score,
            color: health.grade.color,
            items: health.items.map((i) => ({ weight: i.weight, color: i.state.color })),
          })}
          <div class="health__center">
            <div class="health__score" data-score>${health.score === null ? '—' : '0'}${health.score === null ? '' : '<sup>%</sup>'}</div>
            <div class="health__caption">車輛健康</div>
          </div>
        </div>
        <div class="health__meta">
          <div class="health__state" style="color:${health.grade.color}">${health.grade.label}</div>
          <div class="health__desc">${escapeHtml(health.grade.desc)}</div>
          <div class="health__legend">
            ${legendItems(health.items)}
          </div>
        </div>
      </div>
      <div class="metrics">
        <div class="metrics__item">
          <div class="metrics__value">${fmtInt(v.mileage)}<small>km</small></div>
          <div class="metrics__label">總里程</div>
        </div>
        <div class="metrics__item">
          <div class="metrics__value">${ageText(v.purchaseDate, v.year)}</div>
          <div class="metrics__label">車齡</div>
        </div>
        <div class="metrics__item">
          <div class="metrics__value">${oilShort(oil)}</div>
          <div class="metrics__label">距下次換油</div>
        </div>
      </div>
    </div>

    ${alerts.length ? section({
      title: '待辦提醒',
      body: `<div class="stack stack--tight">${alerts.map((a) => `
        <button class="banner ${a.state.key === 'bad' ? 'banner--bad' : ''}" data-fix="${a.key}" type="button">
          <span class="banner__icon" style="color:${a.state.color}">${icon(a.icon)}</span>
          <span class="banner__body">
            <span class="banner__title">${escapeHtml(a.label)}</span>
            <span class="banner__text">${escapeHtml(a.detail)}</span>
          </span>
          <span class="chip ${a.state.chip}">${a.state.label}</span>
        </button>`).join('')}</div>`,
    }) : section({
      title: '待辦提醒',
      body: `<div class="card card--pad" style="display:flex;gap:12px;align-items:center">
        <span style="color:var(--state-good)">${icon('checkCircle')}</span>
        <div>
          <div style="font:var(--t-subhead);font-weight:590">目前沒有待處理的事</div>
          <div style="font:var(--t-caption);color:var(--label-secondary);margin-top:1px">
            ${health.configuredCount ? '所有已設定的項目都在期限內' : '設定健康基準後就會出現提醒'}
          </div>
        </div>
      </div>`,
    })}

    ${section({
      title: '健康明細',
      action: { label: '設定基準', act: 'setup' },
      body: `<div class="list">${health.items.map((i) => `
        <button class="gauge-row" data-fix="${i.key}" type="button">
          <span class="gauge" style="color:${i.state.color}">
            ${miniGauge(i.factor, i.state.color)}
            ${icon(i.icon)}
          </span>
          <span class="gauge-row__body">
            <span class="gauge-row__label">${escapeHtml(i.label)}</span>
            <span class="gauge-row__sub">${escapeHtml(i.detail)}</span>
          </span>
          ${i.configured
            ? `<span class="chip ${i.state.chip}">${i.state.label}</span>`
            : `<span class="chip">設定</span>`}
          <span class="list__chevron">${icon('chevronRight')}</span>
        </button>`).join('')}</div>`,
      note: health.configuredCount < 6 ? `還有 ${6 - health.configuredCount} 個項目未設定，補齊後分數會更準確。` : '',
    })}

    ${section({
      title: '里程趨勢',
      action: { label: '更新里程', act: 'mileage' },
      body: `<div class="card">
        <div class="chart-head">
          <div>
            <div class="chart-head__value">${avgMonth ? fmtInt(avgMonth) : fmtInt(v.mileage)}<small>km</small></div>
            <div class="chart-head__label">${avgMonth ? '每月平均行駛' : '目前里程'}</div>
          </div>
          <div style="text-align:right">
            <div class="chart-head__value" style="font:600 17px/22px var(--font-round)">${logs.length}</div>
            <div class="chart-head__label">筆紀錄</div>
          </div>
        </div>
        ${logs.length >= 2
          ? `<div style="padding:6px 8px 12px">${sparkline(logs.map((m) => ({ x: parseDate(m.date).getTime(), y: m.mileage })), { color: `var(--${v.tint})` })}</div>
             <div style="display:flex;justify-content:space-between;padding:0 16px 14px;font:var(--t-caption);color:var(--label-tertiary)">
               <span>${fmtDate(logs[0].date)}</span><span>${fmtDate(logs.at(-1).date)}</span>
             </div>`
          : `<div class="chart__empty">再記錄一次里程就能看到趨勢曲線。</div>`}
      </div>`,
    })}

    ${section({
      title: '持有成本',
      body: listGroup([
        listRow({ label: '購入價格', value: own.price ? fmtMoney(own.price) : '未填寫', iconName: 'coin', tint: 'var(--green)' }),
        listRow({ label: '持有時間', value: own.days ? `${fmtInt(own.days)} 天` : '未填寫', iconName: 'calendar', tint: 'var(--orange)' }),
        listRow({ label: '每公里成本', value: own.perKm ? `${fmtDec(own.perKm, 2)} 元` : '需要里程與價格', iconName: 'road', tint: 'var(--blue)' }),
        listRow({ label: '每月攤提', value: own.perMonth ? fmtMoney(own.perMonth) : '需要購入日期', iconName: 'chart', tint: 'var(--purple)' }),
      ]),
      note: '目前只計入購入價格；保養、加油、保險等支出會在後續模組併入。',
    })}

    ${section({
      title: '快捷動作',
      body: `<div class="actions">
        ${action('mileage', 'gauge', '更新里程', '記一筆最新讀數')}
        ${action('setup', 'sparkles', '健康基準', '調整週期與到期日')}
        ${action('edit', 'pencil', '編輯車輛', escapeHtml(v.nickname || v.model || '車輛'))}
        ${action('add', 'plus', '新增車輛', '加入另一台車')}
      </div>`,
    })}
  `;

  // 分數滾動 + 環填滿動畫（使用者偏好的效果）
  const scoreEl = root.querySelector('[data-score]');
  if (health.score !== null) animateScore(scoreEl, health.score);
  animateRings(root);
  await paintThumbs(root);
  bind(root, { v, navigate });
}

/* ---------- 局部元件 ---------- */

function legendItems(items) {
  // 只顯示最需要注意的 3 項，避免資訊過載
  const sorted = [...items].filter((i) => i.configured).sort((a, b) => a.urgency - b.urgency).slice(0, 3);
  if (!sorted.length) {
    return `<div class="health__legend-item">
      <span class="health__dot" style="background:var(--state-idle)"></span>尚未設定健康基準</div>`;
  }
  return sorted.map((i) => `
    <div class="health__legend-item">
      <span class="health__dot" style="background:${i.state.color}"></span>
      ${escapeHtml(i.label)} · ${escapeHtml(i.detail)}
    </div>`).join('');
}

const action = (act, iconName, label, sub) => `
  <button class="action" data-act="${act}" type="button">
    <span class="action__icon">${icon(iconName)}</span>
    <span>
      <span class="action__label">${label}</span>
      <span class="action__sub">${sub}</span>
    </span>
  </button>`;

function oilShort(oil) {
  if (!oil || !oil.configured) return '—';
  const m = /([\d,]+) km/.exec(oil.detail);
  if (!m) return oil.detail;
  return `${m[1]}<small>km</small>`;
}

/** 分數滾動（需要保留 <sup>%</sup> 的 HTML） */
function animateScore(el, target) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) { el.innerHTML = `${target}<sup>%</sup>`; return; }
  const t0 = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - t0) / 900);
    const eased = 1 - Math.pow(1 - p, 3);
    el.innerHTML = `${Math.round(target * eased)}<sup>%</sup>`;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** 車輛切換膠囊的縮圖（照片是 Blob，要非同步補上） */
async function paintThumbs(root) {
  for (const el of root.querySelectorAll('[data-thumb]')) {
    const id = el.dataset.thumb;
    if (!id) continue;
    const url = await photoUrl(id);
    if (url) el.innerHTML = `<img src="${url}" alt="" style="width:100%;height:100%;object-fit:cover">`;
  }
}

/* ---------- 事件 ---------- */

function bind(root, { v, navigate }) {
  const refresh = () => navigate(location.hash || '#/', { replace: true, force: true });

  root.querySelectorAll('[data-veh]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      haptic();
      await setCurrentVehicle(btn.dataset.veh);
    });
  });

  root.querySelectorAll('[data-fix]').forEach((btn) => {
    btn.addEventListener('click', () => {
      haptic();
      openHealthSetup({ vehicle: v, focusKey: btn.dataset.fix, onSaved: refresh });
    });
  });

  const acts = {
    setup: () => openHealthSetup({ vehicle: v, onSaved: refresh }),
    mileage: () => openMileageSheet({ vehicle: v, onSaved: refresh }),
    edit: () => openVehicleForm({ vehicle: v, onSaved: refresh }),
    add: () => openVehicleForm({ onSaved: () => refresh() }),
    quick: () => actionSheet({
      title: '快速記錄',
      options: [
        { label: '更新里程', icon: 'gauge', onSelect: () => openMileageSheet({ vehicle: v, onSaved: refresh }) },
        { label: '調整健康基準', icon: 'sparkles', onSelect: () => openHealthSetup({ vehicle: v, onSaved: refresh }) },
        { label: '新增車輛', icon: 'plus', onSelect: () => openVehicleForm({ onSaved: () => refresh() }) },
      ],
    }),
  };
  for (const [act, fn] of Object.entries(acts)) {
    root.querySelectorAll(`[data-act="${act}"]`).forEach((el) => el.addEventListener('click', () => { haptic(); fn(); }));
    document.getElementById('nav-right').querySelectorAll(`[data-act="${act}"]`)
      .forEach((el) => el.addEventListener('click', () => { haptic(); fn(); }));
  }
}

function bindEmpty(root, navigate) {
  root.querySelector('[data-act="add"]')?.addEventListener('click', () => {
    haptic();
    openVehicleForm({ onSaved: () => navigate('#/', { replace: true, force: true }) });
  });
  root.querySelector('[data-act="demo"]')?.addEventListener('click', async () => {
    haptic('medium');
    await seedDemo();
    toast('示範資料已載入', { type: 'good' });
  });
}
