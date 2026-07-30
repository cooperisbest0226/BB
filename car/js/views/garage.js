/* ==========================================================
   garage.js — 車庫
   卡片設計參考 Apple Wallet：照片為主體、車牌像卡號一樣壓在左上、
   健康分數做成右上的膠囊，讓多台車一眼可比。
   ========================================================== */

import { setNav, emptyState, haptic, toast, section } from '../ui.js';
import { icon } from '../icons.js';
import { vehicleHealth } from '../health.js';
import { state, vehicles, photoUrl, setCurrentVehicle, seedDemo } from '../store.js';
import { fmtInt, escapeHtml, ageText } from '../utils.js';
import { openVehicleForm } from './editors.js';

export async function show(root, { navigate }) {
  const list = vehicles();

  setNav({ title: '車庫', right: { iconName: 'plus', act: 'add' } });

  if (!list.length) {
    root.innerHTML = `
      <h1 class="large-title">車庫</h1>
      ${emptyState({
        iconName: 'car',
        title: '加入你的第一台車',
        text: '車輛資料只存在這支手機裡，離線也能使用。',
        actions: [
          { label: '新增車輛', act: 'add', iconName: 'plus' },
          { label: '載入示範資料', act: 'demo', style: 'btn--tinted' },
        ],
      })}`;
  } else {
    root.innerHTML = `
      <h1 class="large-title">車庫
        <span class="large-title__sub">${list.length} 台車</span>
      </h1>
      <div class="stack">
        ${list.map((v) => card(v, state.settings.remindDays)).join('')}
      </div>
      ${section({
        body: `<button class="btn btn--full btn--tinted" data-act="add" type="button">${icon('plus')}新增車輛</button>`,
      })}`;
    await paintPhotos(root);
  }

  bind(root, navigate);
}

function card(v, remindDays) {
  const { score, grade } = vehicleHealth(v, { remindDays });
  const spec = [v.year, v.maker, v.model].filter(Boolean).join(' ') || '未填寫車輛資料';
  return `
  <button class="vcard" data-open="${v.id}" type="button">
    <span class="vcard__media" data-photo="${v.photoId || ''}">
      ${icon('car')}
      <span class="vcard__scrim"></span>
      ${v.plate ? `<span class="vcard__plate">${escapeHtml(v.plate)}</span>` : ''}
      <span class="vcard__health">
        <span style="width:9px;height:9px;border-radius:50%;background:${grade.color};display:inline-block"></span>
        ${score === null ? '尚無資料' : `${score}%`}
      </span>
    </span>
    <span class="vcard__foot">
      <span>
        <span class="vcard__name">${escapeHtml(v.nickname || v.model || '車輛')}</span>
        <span class="vcard__spec">${escapeHtml(spec)} · 車齡 ${ageText(v.purchaseDate, v.year)}</span>
      </span>
      <span class="vcard__km">${fmtInt(v.mileage)}<small>總里程 km</small></span>
    </span>
  </button>`;
}

async function paintPhotos(root) {
  for (const el of root.querySelectorAll('[data-photo]')) {
    const id = el.dataset.photo;
    if (!id) continue;
    const url = await photoUrl(id);
    if (!url) continue;
    el.querySelector('svg')?.remove();
    el.insertAdjacentHTML('afterbegin', `<img src="${url}" alt="">`);
  }
}

function bind(root, navigate) {
  root.querySelectorAll('[data-open]').forEach((el) => {
    el.addEventListener('click', async () => {
      haptic();
      await setCurrentVehicle(el.dataset.open);
      navigate(`#/vehicle/${el.dataset.open}`);
    });
  });

  const addBtns = [
    ...root.querySelectorAll('[data-act="add"]'),
    ...document.getElementById('nav-right').querySelectorAll('[data-act="add"]'),
  ];
  addBtns.forEach((el) => el.addEventListener('click', () => {
    haptic();
    openVehicleForm({ onSaved: () => navigate('#/garage', { replace: true, force: true }) });
  }));

  root.querySelector('[data-act="demo"]')?.addEventListener('click', async () => {
    haptic('medium');
    await seedDemo();
    toast('示範資料已載入', { type: 'good' });
  });
}
