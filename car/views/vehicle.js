/* ==========================================================
   vehicle.js — 車輛詳情
   一台車的完整檔案：照片、健康摘要、規格、購入資訊、里程紀錄。
   未來的保養／保險／加油模組會以「區塊」形式加在健康摘要下方，
   所以這裡的版面留了明確的插入點（見 MODULE SLOT 註解）。
   ========================================================== */

import {
  setNav, listRow, listGroup, section, haptic, toast, actionSheet, confirmSheet,
} from '../ui.js';
import { icon } from '../icons.js';
import { miniGauge, animateRings } from '../charts.js';
import { vehicleHealth, ownership } from '../health.js';
import { state, getVehicle, photoUrl, mileageFor, deleteVehicle } from '../store.js';
import {
  fmtInt, fmtKm, fmtMoney, fmtDate, ageText, escapeHtml, fmtDec,
} from '../utils.js';
import { openVehicleForm, openHealthSetup, openMileageSheet } from './editors.js';

export async function show(root, { navigate, params }) {
  const v = getVehicle(params.id);
  if (!v) {
    navigate('#/garage', { replace: true });
    return;
  }

  const remindDays = state.settings.remindDays;
  const health = vehicleHealth(v, { remindDays });
  const own = ownership(v);
  const logs = [...mileageFor(v.id)].reverse();
  const url = v.photoId ? await photoUrl(v.photoId) : null;

  setNav({
    title: v.nickname || v.model || '車輛',
    left: { iconName: 'chevronLeft', label: '車庫', act: 'back', back: true },
    right: { iconName: 'ellipsis', act: 'more' },
  });

  root.innerHTML = `
    <div class="hero">
      ${url ? `<img src="${url}" alt="${escapeHtml(v.nickname || '車輛照片')}">` : icon('car')}
      <div class="hero__overlay">
        <div class="hero__name">${escapeHtml(v.nickname || v.model || '車輛')}</div>
        <div class="hero__sub">${escapeHtml([v.year, v.maker, v.model].filter(Boolean).join(' ') || '尚未填寫車輛資料')}
          ${v.plate ? ` · ${escapeHtml(v.plate)}` : ''}</div>
      </div>
    </div>

    ${section({
      title: '健康摘要',
      action: { label: '設定基準', act: 'setup' },
      body: `<div class="list">
        <div class="list__row">
          <span class="list__body">
            <span class="list__label">車輛健康</span>
            <span class="list__sub">${escapeHtml(health.grade.desc)}</span>
          </span>
          <span class="list__value" style="font:700 22px/26px var(--font-round);color:${health.grade.color}">
            ${health.score === null ? '—' : `${health.score}%`}
          </span>
        </div>
        ${health.items.map((i) => `
          <button class="gauge-row" data-fix="${i.key}" type="button">
            <span class="gauge" style="color:${i.state.color}">
              ${miniGauge(i.factor, i.state.color)}
              ${icon(i.icon)}
            </span>
            <span class="gauge-row__body">
              <span class="gauge-row__label">${escapeHtml(i.label)}</span>
              <span class="gauge-row__sub">${escapeHtml(i.detail)}</span>
            </span>
            <span class="chip ${i.state.chip}">${i.configured ? i.state.label : '設定'}</span>
          </button>`).join('')}
      </div>`,
    })}

    <!-- MODULE SLOT：保養時間軸 / 保險 / 加油 / 花費 模組上線後插在這裡 -->

    ${section({
      title: '里程',
      action: { label: '更新', act: 'mileage' },
      body: listGroup([
        listRow({ label: '目前里程', value: fmtKm(v.mileage), iconName: 'gauge', tint: 'var(--blue)' }),
        listRow({ label: '紀錄筆數', value: `${logs.length} 筆`, iconName: 'list', tint: 'var(--graphite)' }),
      ]),
    })}

    ${logs.length ? section({
      title: '里程紀錄',
      body: listGroup(logs.slice(0, 8).map((m) => listRow({
        label: fmtKm(m.mileage),
        sub: `${fmtDate(m.date)}${m.note ? ` · ${m.note}` : ''}`,
      }))),
      note: logs.length > 8 ? `只顯示最近 8 筆，共 ${logs.length} 筆。` : '',
    }) : ''}

    ${section({
      title: '規格',
      body: listGroup([
        listRow({ label: '廠牌', value: v.maker || '未填寫' }),
        listRow({ label: '車型', value: v.model || '未填寫' }),
        listRow({ label: '年份', value: v.year ? `${v.year}` : '未填寫' }),
        listRow({ label: '引擎', value: v.engine || '未填寫' }),
        listRow({ label: '變速系統', value: v.transmission || '未填寫' }),
        listRow({ label: '車牌', value: v.plate || '未填寫' }),
        listRow({ label: '車身號碼', value: v.vin || '未填寫' }),
      ]),
    })}

    ${section({
      title: '購入與成本',
      body: listGroup([
        listRow({ label: '購入日期', value: v.purchaseDate ? fmtDate(v.purchaseDate) : '未填寫' }),
        listRow({ label: '購入價格', value: own.price ? fmtMoney(own.price) : '未填寫' }),
        listRow({ label: '車齡', value: ageText(v.purchaseDate, v.year) }),
        listRow({ label: '每公里成本', value: own.perKm ? `${fmtDec(own.perKm, 2)} 元` : '—' }),
        listRow({ label: '每月攤提', value: own.perMonth ? fmtMoney(own.perMonth) : '—' }),
      ]),
    })}

    ${section({
      body: `<div class="stack stack--tight">
        <button class="btn btn--full btn--tinted" data-act="edit" type="button">${icon('pencil')}編輯車輛資料</button>
        <button class="btn btn--full btn--danger" data-act="delete" type="button">${icon('trash')}刪除這台車</button>
      </div>`,
      note: `建立於 ${fmtDate(new Date(v.createdAt).toISOString().slice(0, 10))}`,
    })}
  `;

  animateRings(root);
  bind(root, { v, navigate });
}

function bind(root, { v, navigate }) {
  const refresh = () => navigate(`#/vehicle/${v.id}`, { replace: true, force: true });

  const remove = async () => {
    const ok = await confirmSheet({
      title: `刪除「${v.nickname || v.model || '這台車'}」？`,
      message: '車輛資料與里程紀錄會一併刪除，無法復原。',
      confirmLabel: '刪除車輛',
      danger: true,
    });
    if (!ok) return;
    await deleteVehicle(v.id);
    toast('已刪除', { type: 'good' });
    navigate('#/garage', { replace: true, force: true });
  };

  const acts = {
    back: () => navigate('#/garage'),
    edit: () => openVehicleForm({ vehicle: v, onSaved: refresh }),
    setup: () => openHealthSetup({ vehicle: v, onSaved: refresh }),
    mileage: () => openMileageSheet({ vehicle: v, onSaved: refresh }),
    delete: remove,
    more: () => actionSheet({
      title: v.nickname || v.model || '車輛',
      options: [
        { label: '編輯車輛資料', icon: 'pencil', onSelect: () => openVehicleForm({ vehicle: v, onSaved: refresh }) },
        { label: '設定健康基準', icon: 'sparkles', onSelect: () => openHealthSetup({ vehicle: v, onSaved: refresh }) },
        { label: '更新里程', icon: 'gauge', onSelect: () => openMileageSheet({ vehicle: v, onSaved: refresh }) },
        { label: '刪除車輛', icon: 'trash', danger: true, onSelect: remove },
      ],
    }),
  };

  const nav = document.getElementById('navbar');
  for (const [act, fn] of Object.entries(acts)) {
    [...root.querySelectorAll(`[data-act="${act}"]`), ...nav.querySelectorAll(`[data-act="${act}"]`)]
      .forEach((el) => el.addEventListener('click', () => { haptic(); fn(); }));
  }

  root.querySelectorAll('[data-fix]').forEach((el) => {
    el.addEventListener('click', () => {
      haptic();
      openHealthSetup({ vehicle: v, focusKey: el.dataset.fix, onSaved: refresh });
    });
  });

  void fmtInt;
}
