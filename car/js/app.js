/* ==========================================================
   app.js — 啟動與路由
   架構：
   App Shell（index.html）+ hash 路由 + 每個 view 一個模組。
   用 hash 路由是因為要部署到 GitHub Pages 子路徑，
   history API 會在重新整理時 404，hash 不會。
   ========================================================== */

import { APP_VERSION } from './config.js';
import { initStore, state, subscribe, currentVehicle, vehicles } from './store.js';
import { alertsFor } from './health.js';
import { attachCondense, setNav, openSheet, haptic, toast } from './ui.js';
import { icon } from './icons.js';
import { escapeHtml, todayISO } from './utils.js';

import * as dashboard from './views/dashboard.js';
import * as garage from './views/garage.js';
import * as vehicleView from './views/vehicle.js';
import * as settings from './views/settings.js';

/* ---------- 路由表 ---------- */

const ROUTES = [
  { id: 'dashboard', pattern: /^#\/$/,                view: dashboard,   tab: 'dashboard' },
  { id: 'garage',    pattern: /^#\/garage$/,          view: garage,      tab: 'garage' },
  { id: 'vehicle',   pattern: /^#\/vehicle\/(.+)$/,   view: vehicleView, tab: 'garage', push: true,
    params: (m) => ({ id: m[1] }) },
  { id: 'settings',  pattern: /^#\/settings$/,        view: settings,    tab: 'settings' },
];

const TABS = [
  { tab: 'dashboard', hash: '#/',         label: '總覽', iconName: 'gauge' },
  { tab: 'garage',    hash: '#/garage',   label: '車庫', iconName: 'car' },
  { tab: 'settings',  hash: '#/settings', label: '設定', iconName: 'gear' },
];

const viewEl = document.getElementById('view');
const navEl = document.getElementById('navbar');
const tabbarEl = document.getElementById('tabbar');

let currentRouteId = null;
let currentHash = null;
let rendering = false;
const scrollMemory = new Map();

/* ---------- 導覽 ---------- */

export function navigate(hash, { replace = false, force = false } = {}) {
  if (hash === location.hash && !force) return;
  if (hash === location.hash && force) return render(hash);
  if (replace) history.replaceState(null, '', hash);
  else history.pushState(null, '', hash);
  render(hash);
}

async function render(hash = location.hash || '#/') {
  if (rendering) return;
  const route = ROUTES.find((r) => r.pattern.test(hash)) || ROUTES[0];
  const match = route.pattern.exec(hash);
  const params = route.params ? route.params(match) : {};

  // 換頁前記住捲動位置，回上一頁時才不會跳到頂端
  if (currentHash) scrollMemory.set(currentHash, viewEl.scrollTop);

  rendering = true;
  try {
    viewEl.classList.remove('view-enter', 'view-push');
    void viewEl.offsetWidth; // 強制 reflow，讓動畫重播
    viewEl.classList.add(route.push ? 'view-push' : 'view-enter');

    await route.view.show(viewEl, { navigate, params });

    viewEl.scrollTop = route.id === currentRouteId ? viewEl.scrollTop : (scrollMemory.get(hash) || 0);
    currentRouteId = route.id;
    currentHash = hash;
    paintTabs(route.tab);
    applyTint();
  } catch (err) {
    console.error('[render]', err);
    viewEl.innerHTML = `<h1 class="large-title">出了點問題</h1>
      <div class="card card--pad">畫面載入失敗：${escapeHtml(err.message)}</div>`;
  } finally {
    rendering = false;
  }
}

/* ---------- 分頁列 ---------- */

function paintTabs(activeTab) {
  if (!tabbarEl.childElementCount) {
    tabbarEl.innerHTML = TABS.map((t) => `
      <button class="tab" data-tab="${t.tab}" data-hash="${t.hash}" type="button" role="tab">
        ${icon(t.iconName)}<span>${t.label}</span>
      </button>`).join('');
    tabbarEl.querySelectorAll('[data-hash]').forEach((btn) => {
      btn.addEventListener('click', () => {
        haptic();
        const hash = btn.dataset.hash;
        // 已在該分頁 → 回到頂端（iOS 行為）
        if (location.hash === hash || (hash === '#/' && !location.hash)) {
          viewEl.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }
        navigate(hash);
      });
    });
  }
  tabbarEl.querySelectorAll('.tab').forEach((el) => {
    const on = el.dataset.tab === activeTab;
    el.classList.toggle('is-active', on);
    el.setAttribute('aria-selected', String(on));
  });
}

/* ---------- 外觀 ---------- */

const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

function applyTheme() {
  const mode = state.settings.theme || 'auto';
  const dark = mode === 'dark' || (mode === 'auto' && systemDark.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

/** 動態強調色：跟著當前車輛的主題色走 */
function applyTint() {
  const v = currentVehicle();
  document.documentElement.dataset.tint = v?.tint || 'blue';
}

systemDark.addEventListener('change', applyTheme);

/* ---------- 開啟時的到期提醒 ----------
   刻意不用推播（PWA 在 iOS 的背景推播限制多），
   而是在開啟 App 時把待處理事項集中顯示一次，每天最多一次。 */
function showLaunchReminders() {
  if (state.settings.remindOnLaunch === false) return;
  if (state.settings.lastRemindShown === todayISO()) return;

  const rows = [];
  for (const v of vehicles()) {
    for (const a of alertsFor(v, { remindDays: state.settings.remindDays })) {
      if (a.state.key === 'bad' || a.urgency <= state.settings.remindDays) {
        rows.push({ v, a });
      }
    }
  }
  if (!rows.length) return;

  const overdue = rows.filter((r) => r.a.state.key === 'bad').length;
  const body = `
    <p class="section__note" style="padding:0 4px 12px">
      ${overdue ? `有 ${overdue} 項已逾期，` : ''}共 ${rows.length} 項需要注意。
    </p>
    <div class="list">
      ${rows.slice(0, 8).map(({ v, a }) => `
        <div class="list__row">
          <span class="list__icon" style="background:${a.state.color}">${icon(a.icon)}</span>
          <span class="list__body">
            <span class="list__label">${escapeHtml(a.label)}</span>
            <span class="list__sub">${escapeHtml(v.nickname || v.model || '車輛')} · ${escapeHtml(a.detail)}</span>
          </span>
          <span class="chip ${a.state.chip}">${a.state.label}</span>
        </div>`).join('')}
    </div>`;

  setTimeout(() => {
    const sheet = openSheet({
      title: '待處理事項',
      body,
      right: { label: '知道了', strong: true, act: (close) => close() },
    });
    void sheet;
    haptic('warn');
  }, 700);

  // 用 state 直接寫入（不觸發 emit → 不會造成剛開啟就重繪）
  state.settings.lastRemindShown = todayISO();
  import('./db.js').then(({ dbPut }) => dbPut('settings', state.settings));
}

/* ---------- Service Worker ----------
   註冊路徑一定要用相對路徑 './sw.js'，
   部署在 https://<user>.github.io/<repo>/ 時才會註冊到正確的 scope。 */
async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    reg.addEventListener('updatefound', () => {
      const sw = reg.installing;
      sw?.addEventListener('statechange', () => {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) {
          toast('已有新版本，下次開啟就會更新');
        }
      });
    });
  } catch (err) {
    console.warn('[sw] 註冊失敗', err);
  }
}

/* ---------- 啟動 ---------- */

async function boot() {
  setNav({ title: '' });
  applyTheme();
  attachCondense(viewEl, navEl);

  try {
    await initStore();
  } catch (err) {
    console.error(err);
    viewEl.innerHTML = `<h1 class="large-title">無法開啟資料庫</h1>
      <div class="card card--pad">請確認瀏覽器允許儲存資料（無痕模式可能會擋）。</div>`;
    return;
  }

  applyTheme();
  applyTint();

  if (!location.hash) history.replaceState(null, '', '#/');
  await render(location.hash);

  window.addEventListener('popstate', () => render(location.hash));
  window.addEventListener('hashchange', () => {
    if (location.hash !== currentHash) render(location.hash);
  });

  // 資料變動就重繪當前畫面（總覽的分數、車庫的卡片都會自動同步）
  subscribe(() => {
    applyTheme();
    render(location.hash);
  });

  showLaunchReminders();
  registerSW();

  console.info(`車庫 v${APP_VERSION} 已啟動`);
}

boot();

export { APP_VERSION };
