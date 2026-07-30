/* ==========================================================
   store.js — 應用狀態
   模式：記憶體快取 + 發佈訂閱。
   任何寫入都會更新快取並通知訂閱者，所以總覽的健康分數、車庫清單
   不需要各自重新查資料庫就能同步（未來加模組也是掛 subscribe 就好）。
   ========================================================== */

import {
  openDB, dbAll, dbPut, dbDel, dbWhere, dbGet, uid,
  putBlob, getBlob, delBlob, dbClear, DATA_STORES,
} from './db.js';
import { todayISO, addMonths } from './utils.js';

/* ---------- 預設值 ---------- */

export const TINTS = ['blue', 'green', 'orange', 'red', 'purple', 'teal', 'indigo', 'graphite'];

export const DEFAULT_LIFECYCLE = {
  oilLastDate: null,        // 上次換機油日期
  oilLastMileage: null,     // 上次換機油里程
  oilIntervalKm: 10000,     // 機油更換里程週期
  oilIntervalMonths: 12,    // 機油更換時間週期
  insuranceExpiry: null,    // 保險到期日
  inspectionExpiry: null,   // 驗車到期日
  licenseTaxDue: null,      // 牌照稅繳納期限
  fuelTaxDue: null,         // 燃料稅繳納期限
  batteryDate: null,        // 電瓶更換日
  batteryLifeMonths: 30,
  tyreDate: null,           // 輪胎更換日
  tyreLastMileage: null,
  tyreLifeKm: 50000,
  tyreLifeMonths: 60,
};

const DEFAULT_SETTINGS = {
  key: 'app',
  theme: 'auto',        // auto | light | dark
  remindDays: 30,       // 幾天內到期算「即將到期」
  currentVehicleId: null,
  lastRemindShown: null,
  onboarded: false,
};

/* ---------- 狀態 ---------- */

export const state = {
  ready: false,
  settings: { ...DEFAULT_SETTINGS },
  vehicles: [],
  mileage: [],   // 全部里程紀錄（量小，直接全載入，過濾在記憶體做）
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(reason = 'change') {
  for (const fn of listeners) {
    try { fn(reason); } catch (err) { console.error('[store] listener 出錯', err); }
  }
}

/* ---------- 初始化 ---------- */

export async function initStore() {
  await openDB();
  const saved = await dbGet('settings', 'app');
  state.settings = { ...DEFAULT_SETTINGS, ...(saved || {}) };
  state.vehicles = sortVehicles(await dbAll('vehicles'));
  state.mileage = await dbAll('mileage');

  // 當前車輛失效時自動回到第一台
  if (!state.vehicles.some((v) => v.id === state.settings.currentVehicleId)) {
    state.settings.currentVehicleId = state.vehicles[0]?.id || null;
  }
  state.ready = true;
  emit('init');
}

const sortVehicles = (list) => [...list].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

/* ---------- 設定 ---------- */

export async function updateSettings(patch) {
  state.settings = { ...state.settings, ...patch, key: 'app' };
  await dbPut('settings', state.settings);
  emit('settings');
  return state.settings;
}

/* ---------- 車輛 ---------- */

export const vehicles = () => state.vehicles;

export const getVehicle = (id) => state.vehicles.find((v) => v.id === id) || null;

export function currentVehicle() {
  return getVehicle(state.settings.currentVehicleId) || state.vehicles[0] || null;
}

export async function setCurrentVehicle(id) {
  if (state.settings.currentVehicleId === id) return;
  await updateSettings({ currentVehicleId: id });
  emit('vehicle');
}

/** 新增或更新車輛。data.id 有值就是更新。 */
export async function saveVehicle(data) {
  const now = Date.now();
  const existing = data.id ? getVehicle(data.id) : null;
  const vehicle = {
    id: existing?.id || uid('veh'),
    nickname: '',
    maker: '',
    model: '',
    year: null,
    vin: '',
    engine: '',
    transmission: '',
    plate: '',
    mileage: null,
    purchaseDate: null,
    purchasePrice: null,
    tint: TINTS[state.vehicles.length % TINTS.length],
    photoId: null,
    ...existing,
    ...data,
    lifecycle: { ...DEFAULT_LIFECYCLE, ...(existing?.lifecycle || {}), ...(data.lifecycle || {}) },
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  await dbPut('vehicles', vehicle);

  if (existing) {
    state.vehicles = state.vehicles.map((v) => (v.id === vehicle.id ? vehicle : v));
  } else {
    state.vehicles = sortVehicles([...state.vehicles, vehicle]);
    // 第一台車自動成為當前車輛
    if (!state.settings.currentVehicleId) await updateSettings({ currentVehicleId: vehicle.id });
    // 有里程就自動建立第一筆里程紀錄，趨勢圖才有起點
    if (Number.isFinite(+vehicle.mileage)) {
      await addMileage({ vehicleId: vehicle.id, date: todayISO(), mileage: +vehicle.mileage, note: '建立車輛' }, { silent: true });
    }
  }
  emit('vehicle');
  return vehicle;
}

export async function deleteVehicle(id) {
  const v = getVehicle(id);
  if (!v) return;
  if (v.photoId) await delBlob(v.photoId);
  await dbDel('vehicles', id);
  // 連帶清掉附屬紀錄，避免孤兒資料
  for (const m of state.mileage.filter((m) => m.vehicleId === id)) await dbDel('mileage', m.id);
  state.mileage = state.mileage.filter((m) => m.vehicleId !== id);
  state.vehicles = state.vehicles.filter((x) => x.id !== id);
  if (state.settings.currentVehicleId === id) {
    await updateSettings({ currentVehicleId: state.vehicles[0]?.id || null });
  }
  emit('vehicle');
}

/* ---------- 里程紀錄 ---------- */

/** 某車的里程紀錄，日期由舊到新 */
export function mileageFor(vehicleId) {
  return state.mileage
    .filter((m) => m.vehicleId === vehicleId)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.createdAt || 0) - (b.createdAt || 0)));
}

export async function addMileage({ vehicleId, date, mileage, note = '' }, { silent = false } = {}) {
  const row = { id: uid('mil'), vehicleId, date: date || todayISO(), mileage: +mileage, note, createdAt: Date.now() };
  await dbPut('mileage', row);
  state.mileage = [...state.mileage, row];

  // 車輛主檔的里程數永遠等於「最新一筆紀錄」，兩邊不會不同步
  const latest = mileageFor(vehicleId).at(-1);
  const v = getVehicle(vehicleId);
  if (v && latest && v.mileage !== latest.mileage) {
    const updated = { ...v, mileage: latest.mileage, updatedAt: Date.now() };
    await dbPut('vehicles', updated);
    state.vehicles = state.vehicles.map((x) => (x.id === v.id ? updated : x));
  }
  if (!silent) emit('mileage');
  return row;
}

export async function deleteMileage(id) {
  const row = state.mileage.find((m) => m.id === id);
  await dbDel('mileage', id);
  state.mileage = state.mileage.filter((m) => m.id !== id);
  if (row) {
    const latest = mileageFor(row.vehicleId).at(-1);
    const v = getVehicle(row.vehicleId);
    if (v && latest) {
      const updated = { ...v, mileage: latest.mileage, updatedAt: Date.now() };
      await dbPut('vehicles', updated);
      state.vehicles = state.vehicles.map((x) => (x.id === v.id ? updated : x));
    }
  }
  emit('mileage');
}

/** 每月平均里程（用最早與最新紀錄推算） */
export function monthlyAverageKm(vehicleId) {
  const logs = mileageFor(vehicleId);
  if (logs.length < 2) return null;
  const first = logs[0], last = logs.at(-1);
  const days = (new Date(last.date) - new Date(first.date)) / 86400000;
  if (days < 7) return null;
  const delta = last.mileage - first.mileage;
  if (delta <= 0) return null;
  return (delta / days) * 30;
}

/* ---------- 照片 ---------- */

const urlCache = new Map();

/** 取照片的 object URL（有快取，避免每次 render 都重新建立） */
export async function photoUrl(blobId) {
  if (!blobId) return null;
  if (urlCache.has(blobId)) return urlCache.get(blobId);
  const blob = await getBlob(blobId);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urlCache.set(blobId, url);
  return url;
}

export async function saveVehiclePhoto(blob, previousId = null) {
  const id = await putBlob(blob);
  if (previousId) {
    await delBlob(previousId);
    const old = urlCache.get(previousId);
    if (old) { URL.revokeObjectURL(old); urlCache.delete(previousId); }
  }
  return id;
}

export async function removeVehiclePhoto(blobId) {
  if (!blobId) return;
  await delBlob(blobId);
  const url = urlCache.get(blobId);
  if (url) { URL.revokeObjectURL(url); urlCache.delete(blobId); }
}

/* ---------- 重新載入（匯入備份後用） ---------- */

export async function reload() {
  for (const url of urlCache.values()) URL.revokeObjectURL(url);
  urlCache.clear();
  const saved = await dbGet('settings', 'app');
  state.settings = { ...DEFAULT_SETTINGS, ...(saved || {}) };
  state.vehicles = sortVehicles(await dbAll('vehicles'));
  state.mileage = await dbAll('mileage');
  if (!state.vehicles.some((v) => v.id === state.settings.currentVehicleId)) {
    state.settings.currentVehicleId = state.vehicles[0]?.id || null;
  }
  emit('reload');
}

export async function wipeUserData() {
  for (const store of [...DATA_STORES, 'blobs']) await dbClear(store);
  state.settings = { ...DEFAULT_SETTINGS };
  await dbPut('settings', state.settings);
  state.vehicles = [];
  state.mileage = [];
  emit('reload');
}

/* ---------- 示範資料 ----------
   空畫面很難判斷設計好不好，所以提供一鍵示範資料。
   內容是台灣常見的車與稅期，讓每張卡片都有真實數字可看。 */

export async function seedDemo() {
  const t = new Date();
  const iso = (offsetDays) => todayISO(new Date(t.getTime() + offsetDays * 86400000));

  const v = await saveVehicle({
    nickname: '小白',
    maker: 'Toyota',
    model: 'Corolla Altis Hybrid',
    year: 2021,
    vin: 'JTNK4RBE20J123456',
    engine: '1.8L Hybrid',
    transmission: 'E-CVT',
    plate: 'BKM-1668',
    mileage: 68420,
    purchaseDate: '2021-03-18',
    purchasePrice: 799000,
    tint: 'blue',
    lifecycle: {
      oilLastDate: iso(-240),
      oilLastMileage: 61200,
      oilIntervalKm: 10000,
      oilIntervalMonths: 12,
      insuranceExpiry: iso(21),
      inspectionExpiry: iso(126),
      licenseTaxDue: iso(-3),
      fuelTaxDue: iso(64),
      batteryDate: '2023-06-10',
      batteryLifeMonths: 30,
      tyreDate: '2023-11-02',
      tyreLastMileage: 41000,
      tyreLifeKm: 50000,
      tyreLifeMonths: 60,
    },
  });

  // 過去 8 個月的里程紀錄，讓趨勢圖是真的資料而不是假線
  const points = [
    [-240, 61200], [-210, 62150], [-180, 63020], [-150, 63980],
    [-120, 64860], [-90, 65710], [-60, 66640], [-30, 67520], [0, 68420],
  ];
  for (const [d, km] of points) {
    await addMileage({ vehicleId: v.id, date: iso(d), mileage: km }, { silent: true });
  }

  await saveVehicle({
    nickname: '通勤機車',
    maker: 'Yamaha',
    model: 'Force 2.0',
    year: 2023,
    engine: '155cc',
    transmission: 'CVT',
    plate: 'MGX-0231',
    mileage: 12480,
    purchaseDate: '2023-08-05',
    purchasePrice: 108000,
    tint: 'teal',
    lifecycle: {
      oilLastDate: iso(-95),
      oilLastMileage: 11100,
      oilIntervalKm: 3000,
      oilIntervalMonths: 6,
      insuranceExpiry: iso(188),
      inspectionExpiry: addMonths(todayISO(), 14),
      fuelTaxDue: iso(64),
      batteryDate: '2023-08-05',
      batteryLifeMonths: 30,
      tyreDate: '2025-02-14',
      tyreLastMileage: 8600,
      tyreLifeKm: 20000,
      tyreLifeMonths: 48,
    },
  });

  await updateSettings({ onboarded: true });
  emit('reload');
}

export const dbWhereRef = dbWhere; // 保留給後續模組使用
