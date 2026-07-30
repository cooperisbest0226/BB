/* ==========================================================
   db.js — IndexedDB 資料層
   設計決策：
   1. 一次把 13 個模組會用到的 object store 全部在 v1 建好（即使目前還沒用），
      這樣後續加模組不必升版本、不會有 migration 風險，使用者資料永遠安全。
   2. 照片／PDF 一律存在獨立的 blobs store，主資料只存 blobId，
      避免每次讀取車輛清單都把幾 MB 的二進位資料一起載進記憶體。
   ========================================================== */

const DB_NAME = 'garage_v1';
const DB_VERSION = 1;

/** store 定義：name → { keyPath, indexes: [[name, keyPath, opts]] } */
const SCHEMA = {
  vehicles:    { keyPath: 'id', indexes: [['createdAt', 'createdAt']] },
  mileage:     { keyPath: 'id', indexes: [['vehicleId', 'vehicleId'], ['byVehicleDate', ['vehicleId', 'date']]] },
  maintenance: { keyPath: 'id', indexes: [['vehicleId', 'vehicleId'], ['byVehicleDate', ['vehicleId', 'date']], ['category', 'category']] },
  fuel:        { keyPath: 'id', indexes: [['vehicleId', 'vehicleId'], ['byVehicleDate', ['vehicleId', 'date']]] },
  records:     { keyPath: 'id', indexes: [['vehicleId', 'vehicleId'], ['kind', 'kind'], ['dueDate', 'dueDate']] },
  expenses:    { keyPath: 'id', indexes: [['vehicleId', 'vehicleId'], ['byVehicleDate', ['vehicleId', 'date']], ['category', 'category']] },
  blobs:       { keyPath: 'id' },
  settings:    { keyPath: 'key' },
};

let _db = null;

export function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      for (const [name, def] of Object.entries(SCHEMA)) {
        const store = db.objectStoreNames.contains(name)
          ? req.transaction.objectStore(name)
          : db.createObjectStore(name, { keyPath: def.keyPath });
        for (const [idxName, idxKey, opts] of def.indexes || []) {
          if (!store.indexNames.contains(idxName)) store.createIndex(idxName, idxKey, opts || {});
        }
      }
      // 未來升版本時，在這裡依 e.oldVersion 逐步 migrate，不要刪 store。
      void e;
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function tx(store, mode) {
  return openDB().then((db) => db.transaction(store, mode).objectStore(store));
}

const done = (req) => new Promise((res, rej) => {
  req.onsuccess = () => res(req.result);
  req.onerror = () => rej(req.error);
});

export const dbGet   = (store, key) => tx(store, 'readonly').then((s) => done(s.get(key)));
export const dbAll   = (store) => tx(store, 'readonly').then((s) => done(s.getAll()));
export const dbPut   = (store, value) => tx(store, 'readwrite').then((s) => done(s.put(value))).then(() => value);
export const dbDel   = (store, key) => tx(store, 'readwrite').then((s) => done(s.delete(key)));
export const dbClear = (store) => tx(store, 'readwrite').then((s) => done(s.clear()));

/** 依索引取出資料，例如 dbWhere('mileage', 'vehicleId', id) */
export const dbWhere = (store, index, value) =>
  tx(store, 'readonly').then((s) => done(s.index(index).getAll(value)));

export const STORES = Object.keys(SCHEMA);
/** 使用者資料 store（不含快取型資料）— 匯出備份與清除都以這份清單為準 */
export const DATA_STORES = ['vehicles', 'mileage', 'maintenance', 'fuel', 'records', 'expenses', 'settings'];

/** 產生短 id（時間前綴 → 天然按建立時間排序，方便除錯） */
export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/* ---------- 照片／檔案 ---------- */

export async function putBlob(blob) {
  const id = uid('blob');
  await dbPut('blobs', { id, blob, type: blob.type, size: blob.size, createdAt: Date.now() });
  return id;
}

export async function getBlob(id) {
  if (!id) return null;
  const rec = await dbGet('blobs', id);
  return rec ? rec.blob : null;
}

export async function delBlob(id) {
  if (id) await dbDel('blobs', id);
}

/* ---------- 備份／還原 ---------- */

/** 匯出成 JSON（照片以 base64 帶出，讓備份檔可獨立還原） */
export async function exportAll() {
  const out = { app: 'garage', version: DB_VERSION, exportedAt: new Date().toISOString(), data: {}, blobs: [] };
  for (const store of DATA_STORES) out.data[store] = await dbAll(store);
  for (const rec of await dbAll('blobs')) {
    out.blobs.push({ id: rec.id, type: rec.type, dataUrl: await blobToDataUrl(rec.blob) });
  }
  return out;
}

/** 匯入備份。mode='replace' 會先清空，'merge' 則以 id 覆蓋同筆。 */
export async function importAll(payload, mode = 'replace') {
  if (!payload || payload.app !== 'garage' || !payload.data) throw new Error('備份檔格式不正確');
  if (mode === 'replace') {
    for (const store of [...DATA_STORES, 'blobs']) await dbClear(store);
  }
  for (const store of DATA_STORES) {
    for (const row of payload.data[store] || []) await dbPut(store, row);
  }
  for (const b of payload.blobs || []) {
    const blob = await dataUrlToBlob(b.dataUrl);
    await dbPut('blobs', { id: b.id, blob, type: b.type, size: blob.size, createdAt: Date.now() });
  }
}

export async function wipeAll() {
  for (const store of [...DATA_STORES, 'blobs']) await dbClear(store);
}

export function blobToDataUrl(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}

/** 儲存空間用量（部分瀏覽器不支援時回傳 null） */
export async function storageEstimate() {
  if (!navigator.storage || !navigator.storage.estimate) return null;
  const { usage, quota } = await navigator.storage.estimate();
  return { usage, quota };
}
