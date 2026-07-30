/* ==========================================================
   health.js — 車輛健康評分引擎
   這是整個 App 的核心，不是裝飾用的數字。

   評分方式：
   每個健康項目算出一個 0~1 的「剩餘壽命係數」，再依權重加權平均。
   只有「使用者已設定」的項目會被計入，未設定的項目不會拉低分數
   （否則新建立的車永遠是 40 分，毫無意義），而是提示去補資料。

   未來 Maintenance / Insurance / Inspection 模組上線後，
   只要把 read() 的資料來源從 vehicle.lifecycle 換成各模組最新一筆紀錄，
   評分邏輯與 UI 都不需要改動。
   ========================================================== */

import { clamp, daysUntil, monthsSince, fmtInt, dueText } from './utils.js';

/* ---------- 狀態分級 ---------- */

export const STATE = {
  good: { key: 'good', label: '良好', color: 'var(--state-good)', chip: 'chip--good' },
  fair: { key: 'fair', label: '注意', color: 'var(--state-fair)', chip: 'chip--fair' },
  warn: { key: 'warn', label: '即將到期', color: 'var(--state-warn)', chip: 'chip--warn' },
  bad:  { key: 'bad',  label: '需處理', color: 'var(--state-bad)', chip: 'chip--bad' },
  idle: { key: 'idle', label: '未設定', color: 'var(--state-idle)', chip: '' },
};

/** 依剩餘天數判定狀態（日期型項目用） */
function stateByDays(days, remindDays) {
  if (days === null) return STATE.idle;
  if (days < 0) return STATE.bad;
  if (days <= remindDays) return STATE.warn;
  if (days <= remindDays * 2) return STATE.fair;
  return STATE.good;
}

/** 依剩餘係數判定狀態（里程型項目用） */
function stateByFactor(f) {
  if (f === null) return STATE.idle;
  if (f <= 0) return STATE.bad;
  if (f < 0.15) return STATE.warn;
  if (f < 0.35) return STATE.fair;
  return STATE.good;
}

/* ---------- 各健康項目 ---------- */

const FACTORS = [
  {
    key: 'oil', label: '引擎機油', icon: 'drop', weight: 26,
    field: 'oilLastDate',
    compute(v, { remindDays }) {
      const lc = v.lifecycle || {};
      const kmUsed = (Number.isFinite(+v.mileage) && Number.isFinite(+lc.oilLastMileage))
        ? +v.mileage - +lc.oilLastMileage : null;
      const kmFrac = (kmUsed !== null && lc.oilIntervalKm) ? kmUsed / +lc.oilIntervalKm : null;
      const months = lc.oilLastDate ? monthsSince(lc.oilLastDate) : null;
      const monthFrac = (months !== null && lc.oilIntervalMonths) ? months / +lc.oilIntervalMonths : null;

      if (kmFrac === null && monthFrac === null) {
        return { factor: null, state: STATE.idle, detail: '未記錄上次更換', urgency: 1e9 };
      }
      // 里程與時間哪個先到就以它為準
      const used = Math.max(kmFrac ?? 0, monthFrac ?? 0);
      const factor = clamp(1 - used);
      const kmLeft = kmFrac !== null ? Math.round(+lc.oilIntervalKm - kmUsed) : null;
      let detail;
      if (kmLeft === null) detail = `已使用 ${months} 個月／週期 ${lc.oilIntervalMonths} 個月`;
      else if (kmLeft > 0) detail = `還可跑 ${fmtInt(kmLeft)} km`;
      else detail = `已超出 ${fmtInt(-kmLeft)} km`;
      return {
        factor,
        state: factor <= 0 ? STATE.bad : stateByFactor(factor),
        detail,
        urgency: factor <= 0 ? -1000 : Math.round(factor * 400),
        remindDays,
      };
    },
  },
  {
    key: 'insurance', label: '保險', icon: 'shield', weight: 18,
    field: 'insuranceExpiry',
    compute(v, { remindDays }) {
      const days = daysUntil(v.lifecycle?.insuranceExpiry);
      if (days === null) return { factor: null, state: STATE.idle, detail: '未設定到期日', urgency: 1e9 };
      return { factor: clamp(days / 90), state: stateByDays(days, remindDays), detail: dueText(days), urgency: days };
    },
  },
  {
    key: 'inspection', label: '定期驗車', icon: 'seal', weight: 14,
    field: 'inspectionExpiry',
    compute(v, { remindDays }) {
      const days = daysUntil(v.lifecycle?.inspectionExpiry);
      if (days === null) return { factor: null, state: STATE.idle, detail: '未設定到期日', urgency: 1e9 };
      return { factor: clamp(days / 120), state: stateByDays(days, remindDays), detail: dueText(days), urgency: days };
    },
  },
  {
    key: 'tax', label: '稅金', icon: 'doc', weight: 10,
    field: 'licenseTaxDue',
    compute(v, { remindDays }) {
      const lc = v.lifecycle || {};
      const items = [
        ['牌照稅', daysUntil(lc.licenseTaxDue)],
        ['燃料稅', daysUntil(lc.fuelTaxDue)],
      ].filter(([, d]) => d !== null);
      if (!items.length) return { factor: null, state: STATE.idle, detail: '未設定繳納期限', urgency: 1e9 };
      items.sort((a, b) => a[1] - b[1]);
      const [name, days] = items[0];
      return {
        factor: clamp(days / 60),
        state: stateByDays(days, remindDays),
        detail: `${name}${dueText(days)}`,
        urgency: days,
      };
    },
  },
  {
    key: 'battery', label: '電瓶', icon: 'battery', weight: 16,
    field: 'batteryDate',
    compute(v) {
      const lc = v.lifecycle || {};
      const months = lc.batteryDate ? monthsSince(lc.batteryDate) : null;
      if (months === null || !lc.batteryLifeMonths) {
        return { factor: null, state: STATE.idle, detail: '未記錄更換日期', urgency: 1e9 };
      }
      const factor = clamp(1 - months / +lc.batteryLifeMonths);
      const left = Math.round(+lc.batteryLifeMonths - months);
      return {
        factor,
        state: stateByFactor(factor),
        detail: left > 0 ? `已使用 ${months} 個月，預估還有 ${left} 個月` : `已使用 ${months} 個月，建議更換`,
        urgency: factor <= 0 ? -800 : Math.round(factor * 500),
      };
    },
  },
  {
    key: 'tyre', label: '輪胎', icon: 'tyre', weight: 16,
    field: 'tyreDate',
    compute(v) {
      const lc = v.lifecycle || {};
      const months = lc.tyreDate ? monthsSince(lc.tyreDate) : null;
      const monthFrac = (months !== null && lc.tyreLifeMonths) ? months / +lc.tyreLifeMonths : null;
      const kmUsed = (Number.isFinite(+v.mileage) && Number.isFinite(+lc.tyreLastMileage))
        ? +v.mileage - +lc.tyreLastMileage : null;
      const kmFrac = (kmUsed !== null && lc.tyreLifeKm) ? kmUsed / +lc.tyreLifeKm : null;
      if (monthFrac === null && kmFrac === null) {
        return { factor: null, state: STATE.idle, detail: '未記錄更換日期', urgency: 1e9 };
      }
      const factor = clamp(1 - Math.max(monthFrac ?? 0, kmFrac ?? 0));
      const kmLeft = kmFrac !== null ? Math.round(+lc.tyreLifeKm - kmUsed) : null;
      const detail = kmLeft !== null
        ? (kmLeft > 0 ? `還可跑 ${fmtInt(kmLeft)} km` : `已超出建議里程 ${fmtInt(-kmLeft)} km`)
        : `已使用 ${months} 個月`;
      return {
        factor,
        state: stateByFactor(factor),
        detail,
        urgency: factor <= 0 ? -600 : Math.round(factor * 500),
      };
    },
  },
];

/**
 * 算出整車健康狀況。
 * @returns {{score:number|null, grade:object, items:Array, configuredCount:number}}
 */
export function vehicleHealth(vehicle, { remindDays = 30 } = {}) {
  if (!vehicle) return { score: null, grade: GRADES.at(-1), items: [], configuredCount: 0 };

  const items = FACTORS.map((f) => {
    const r = f.compute(vehicle, { remindDays });
    return {
      key: f.key, label: f.label, icon: f.icon, weight: f.weight, field: f.field,
      configured: r.factor !== null,
      ...r,
    };
  });

  const used = items.filter((i) => i.configured);
  const totalWeight = used.reduce((s, i) => s + i.weight, 0);
  const score = totalWeight
    ? Math.round(used.reduce((s, i) => s + i.weight * i.factor, 0) / totalWeight * 100)
    : null;

  return { score, grade: gradeFor(score), items, configuredCount: used.length };
}

/* ---------- 分數等級 ---------- */

const GRADES = [
  { min: 85, label: '狀態良好', desc: '所有項目都在建議範圍內', color: 'var(--state-good)' },
  { min: 70, label: '大致正常', desc: '有項目接近更換或到期時間', color: 'var(--state-fair)' },
  { min: 50, label: '需要注意', desc: '建議盡快安排保養或續期', color: 'var(--state-warn)' },
  { min: -1, label: '需要處理', desc: '有項目已逾期，請優先處理', color: 'var(--state-bad)' },
];

export function gradeFor(score) {
  if (score === null || score === undefined) {
    return { min: null, label: '尚無資料', desc: '補上關鍵日期就能計算健康分數', color: 'var(--state-idle)' };
  }
  return GRADES.find((g) => score >= g.min);
}

/** 待辦提醒：只回傳需要使用者動作的項目，最急的排前面 */
export function alertsFor(vehicle, { remindDays = 30 } = {}) {
  const { items } = vehicleHealth(vehicle, { remindDays });
  return items
    .filter((i) => i.configured && (i.state.key === 'bad' || i.state.key === 'warn'))
    .sort((a, b) => a.urgency - b.urgency);
}

/** 多台車的提醒總數（分頁列小紅點、開啟提醒橫幅用） */
export function alertCount(vehicleList, opts) {
  return vehicleList.reduce((sum, v) => sum + alertsFor(v, opts).length, 0);
}

/* ---------- 持有成本 ---------- */

export function ownership(vehicle) {
  if (!vehicle) return null;
  const price = Number.isFinite(+vehicle.purchasePrice) ? +vehicle.purchasePrice : null;
  const days = vehicle.purchaseDate ? Math.max(1, -daysUntil(vehicle.purchaseDate)) : null;
  const km = Number.isFinite(+vehicle.mileage) ? +vehicle.mileage : null;
  return {
    price,
    days,
    km,
    perDay: price && days ? price / days : null,
    perKm: price && km ? price / km : null,
    perMonth: price && days ? price / (days / 30.44) : null,
  };
}
