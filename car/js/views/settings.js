/* ==========================================================
   settings.js — 設定
   包含備份／還原：資料只存在裝置上，所以「能把資料帶走」是必要功能，
   不是加分項（Cloudflare 同步上線前，這是唯一的保險）。
   ========================================================== */

import {
  setNav, listRow, listGroup, section, switchRow, haptic, toast,
  actionSheet, confirmSheet,
} from '../ui.js';
import { icon } from '../icons.js';
import { state, vehicles, updateSettings, seedDemo, reload, wipeUserData } from '../store.js';
import { exportAll, importAll, storageEstimate } from '../db.js';
import { fmtBytes, todayISO, escapeHtml } from '../utils.js';
import { APP_VERSION } from '../config.js';

const THEMES = { auto: '自動', light: '淺色', dark: '深色' };
const REMIND_OPTIONS = [7, 14, 30, 60];

export async function show(root, { navigate }) {
  setNav({ title: '設定' });

  const s = state.settings;
  const est = await storageEstimate();
  const standalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;

  root.innerHTML = `
    <h1 class="large-title">設定</h1>

    ${section({
      title: '外觀',
      body: `<div class="card card--pad">
        <div class="segmented" role="group" aria-label="外觀">
          ${Object.entries(THEMES).map(([k, label]) => `
            <button class="segmented__item ${s.theme === k ? 'is-active' : ''}" data-theme="${k}" type="button">${label}</button>`).join('')}
        </div>
      </div>`,
      note: '「自動」會跟隨 iPhone 的深色模式設定。',
    })}

    ${section({
      title: '提醒',
      body: listGroup([
        listRow({
          label: '提前提醒天數', value: `${s.remindDays} 天`, iconName: 'bell', tint: 'var(--orange)',
          act: 'remindDays', chevron: true,
        }),
        switchRow({
          label: '開啟 App 時顯示提醒', sub: '有逾期或即將到期項目時跳出',
          name: 'remindOnLaunch', checked: s.remindOnLaunch !== false,
          iconName: 'warning', tint: 'var(--red)',
        }),
      ]),
      note: '這是本機提醒，不需要通知權限，離線也會顯示。',
    })}

    ${section({
      title: '資料',
      body: listGroup([
        listRow({ label: '匯出備份', sub: 'JSON 檔，含車輛照片', iconName: 'export', tint: 'var(--blue)', act: 'export', chevron: true }),
        listRow({ label: '匯入備份', sub: '會覆蓋現有資料', iconName: 'import', tint: 'var(--indigo)', act: 'import', chevron: true }),
        listRow({ label: '載入示範資料', iconName: 'sparkles', tint: 'var(--purple)', act: 'demo', chevron: true }),
        listRow({ label: '清除所有資料', iconName: 'trash', tint: 'var(--red)', act: 'wipe', chevron: true, danger: true }),
      ]),
      note: est ? `已使用 ${fmtBytes(est.usage)}，可用空間約 ${fmtBytes(est.quota)}。` : '',
    })}

    ${section({
      title: '關於',
      body: listGroup([
        listRow({ label: '車庫', value: `版本 ${APP_VERSION}` }),
        listRow({ label: '車輛數', value: `${vehicles().length} 台` }),
        listRow({ label: '安裝狀態', value: standalone ? '已加到主畫面' : '瀏覽器中執行' }),
        listRow({ label: '離線可用', value: 'serviceWorker' in navigator ? '是' : '不支援' }),
      ]),
      note: standalone ? '' : '在 Safari 點分享 → 加入主畫面，就能像原生 App 一樣全螢幕使用。',
    })}

    <input type="file" accept="application/json,.json" data-import-input class="visually-hidden">
  `;

  bind(root, navigate);
}

function bind(root, navigate) {
  const refresh = () => navigate('#/settings', { replace: true, force: true });

  /* 外觀 */
  root.querySelectorAll('[data-theme]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      haptic();
      await updateSettings({ theme: btn.dataset.theme });
      root.querySelectorAll('[data-theme]').forEach((b) => b.classList.toggle('is-active', b === btn));
    });
  });

  /* 開啟時提醒 */
  root.querySelector('[name="remindOnLaunch"]')?.addEventListener('change', async (e) => {
    haptic();
    await updateSettings({ remindOnLaunch: e.target.checked });
  });

  const fileInput = root.querySelector('[data-import-input]');

  const acts = {
    remindDays: () => actionSheet({
      title: '提前提醒天數',
      message: '距離到期日還有這麼多天時，就會出現在待辦提醒。',
      options: REMIND_OPTIONS.map((d) => ({
        label: `${d} 天`,
        checked: state.settings.remindDays === d,
        onSelect: async () => { await updateSettings({ remindDays: d }); refresh(); },
      })),
    }),

    export: async () => {
      try {
        const payload = await exportAll();
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `garage-backup-${todayISO()}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        toast('備份已匯出', { type: 'good' });
      } catch (err) {
        console.error(err);
        toast('匯出失敗', { type: 'bad' });
      }
    },

    import: () => fileInput.click(),

    demo: async () => {
      const ok = await confirmSheet({
        title: '載入示範資料？',
        message: '會新增兩台示範車輛，現有資料不會被刪除。',
        confirmLabel: '載入',
      });
      if (!ok) return;
      await seedDemo();
      toast('示範資料已載入', { type: 'good' });
      refresh();
    },

    wipe: async () => {
      const ok = await confirmSheet({
        title: '清除所有資料？',
        message: '所有車輛、里程紀錄與照片都會被刪除，無法復原。建議先匯出備份。',
        confirmLabel: '清除所有資料',
        danger: true,
      });
      if (!ok) return;
      await wipeUserData();
      toast('資料已清除');
      navigate('#/', { replace: true, force: true });
    },
  };

  for (const [act, fn] of Object.entries(acts)) {
    root.querySelectorAll(`[data-act="${act}"]`).forEach((el) => el.addEventListener('click', () => { haptic(); fn(); }));
  }

  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      const ok = await confirmSheet({
        title: '匯入備份？',
        message: `備份時間 ${escapeHtml((payload.exportedAt || '').slice(0, 10) || '未知')}，匯入後會覆蓋目前所有資料。`,
        confirmLabel: '匯入並覆蓋',
        danger: true,
      });
      if (!ok) return;
      await importAll(payload, 'replace');
      await reload();
      toast('備份已還原', { type: 'good' });
      navigate('#/', { replace: true, force: true });
    } catch (err) {
      console.error(err);
      toast(err.message === '備份檔格式不正確' ? err.message : '無法讀取這個檔案', { type: 'bad' });
    } finally {
      fileInput.value = '';
    }
  });
}
