/* ==========================================================
   editors.js — 三個編輯用 Sheet
   1. openVehicleForm   車輛基本資料（身分／規格／購入）
   2. openHealthSetup   健康基準（驅動健康分數的關鍵日期與週期）
   3. openMileageSheet  更新里程

   刻意把「基本資料」和「健康基準」拆成兩張表單：
   一次塞 25 個欄位會讓使用者放棄填寫（漸進式揭露）。
   ========================================================== */

import {
  openSheet, toast, haptic, wire, readForm, attachTransforms,
  fieldText, fieldNumber, fieldDate, fieldGroup, photoPicker, tintPicker, confirmSheet,
} from '../ui.js';
import { icon } from '../icons.js';
import { compressImage, todayISO, fmtInt, fmtKm } from '../utils.js';
import {
  TINTS, saveVehicle, saveVehiclePhoto, removeVehiclePhoto, photoUrl,
  addMileage, mileageFor, deleteMileage, getVehicle,
} from '../store.js';

/* ==========================================================
   1. 車輛基本資料
   ========================================================== */
export async function openVehicleForm({ vehicle = null, onSaved = null } = {}) {
  const isNew = !vehicle;
  const v = vehicle || {};
  const existingUrl = v.photoId ? await photoUrl(v.photoId) : null;

  let photoId = v.photoId || null;       // 已存檔的照片
  let pendingBlob = null;                // 尚未存檔的新照片
  let removedPhoto = false;
  let tint = v.tint || TINTS[0];

  const body = `
    <div class="form">
      ${photoPicker({ url: existingUrl })}

      ${fieldGroup({
        title: '這台車怎麼稱呼',
        body:
          fieldText({ name: 'nickname', label: '暱稱', value: v.nickname, placeholder: '小白、我的車' }) +
          fieldText({ name: 'plate', label: '車牌', value: v.plate, placeholder: 'ABC-1234', transform: 'upper', maxlength: 12 }),
        note: '暱稱會顯示在總覽與車庫。',
      })}

      ${fieldGroup({
        title: '車輛資料',
        body:
          fieldText({ name: 'maker', label: '廠牌', value: v.maker, placeholder: 'Toyota' }) +
          fieldText({ name: 'model', label: '車型', value: v.model, placeholder: 'Corolla Altis' }) +
          fieldNumber({ name: 'year', label: '年份', value: v.year, placeholder: '2021', min: '1950', step: '1' }) +
          fieldText({ name: 'vin', label: '車身號碼', value: v.vin, placeholder: '選填', transform: 'upper', maxlength: 24 }),
      })}

      ${fieldGroup({
        title: '規格',
        body:
          fieldText({ name: 'engine', label: '引擎', value: v.engine, placeholder: '1.8L Hybrid' }) +
          fieldText({ name: 'transmission', label: '變速系統', value: v.transmission, placeholder: 'E-CVT' }),
      })}

      ${fieldGroup({
        title: '里程與購入',
        body:
          fieldNumber({ name: 'mileage', label: '目前里程', value: v.mileage, placeholder: '0', unit: 'km' }) +
          fieldDate({ name: 'purchaseDate', label: '購入日期', value: v.purchaseDate }) +
          fieldNumber({ name: 'purchasePrice', label: '購入價格', value: v.purchasePrice, placeholder: '0', unit: '元' }),
        note: isNew ? '填了里程就會自動建立第一筆里程紀錄，趨勢圖才有起點。' : '',
      })}

      ${fieldGroup({ title: '主題色', body: tintPicker(TINTS, tint), note: '總覽的強調色會跟著這台車走。' })}
    </div>`;

  const sheet = openSheet({
    title: isNew ? '新增車輛' : '編輯車輛',
    tall: true,
    left: { label: '取消' },
    right: { label: '儲存', strong: true, act: save },
    body,
  });

  attachTransforms(sheet.body);

  /* ---- 照片 ---- */
  const frame = sheet.body.querySelector('[data-photo-frame]');
  const input = sheet.body.querySelector('[data-photo-input]');
  const pickEl = sheet.body.querySelector('[data-photo]');

  const renderPhoto = (url) => {
    frame.innerHTML = url
      ? `<img src="${url}" alt="車輛照片">`
      : `<span class="photo-pick__hint">${icon('camera')}<span>加入車輛照片</span></span>`;
    pickEl.querySelector('[data-photo-clear]')?.remove();
    if (url) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'photo-pick__clear';
      btn.setAttribute('aria-label', '移除照片');
      btn.innerHTML = icon('xmark');
      btn.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        haptic();
        pendingBlob = null; removedPhoto = true;
        renderPhoto(null);
      });
      pickEl.appendChild(btn);
    }
  };
  renderPhoto(existingUrl);

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      pendingBlob = await compressImage(file);  // 壓縮後才進 IndexedDB
      removedPhoto = false;
      renderPhoto(URL.createObjectURL(pendingBlob));
      haptic('light');
    } catch {
      toast('照片讀取失敗，換一張試試', { type: 'bad' });
    }
    input.value = '';
  });

  /* ---- 色票 ---- */
  sheet.body.querySelectorAll('[data-tint]').forEach((btn) => {
    btn.addEventListener('click', () => {
      haptic();
      tint = btn.dataset.tint;
      sheet.body.querySelectorAll('[data-tint]').forEach((b) => {
        const on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', String(on));
      });
    });
  });

  /* ---- 儲存 ---- */
  async function save(close) {
    const data = readForm(sheet.body);
    if (!data.nickname && !data.model && !data.plate) {
      toast('至少填暱稱、車型或車牌其中一項', { type: 'bad' });
      return;
    }
    try {
      if (pendingBlob) photoId = await saveVehiclePhoto(pendingBlob, v.photoId || null);
      else if (removedPhoto && v.photoId) { await removeVehiclePhoto(v.photoId); photoId = null; }

      const saved = await saveVehicle({
        ...(v.id ? { id: v.id } : {}),
        ...data,
        nickname: data.nickname || data.model || data.plate,
        tint,
        photoId,
      });

      // 編輯時若里程被改大，補一筆里程紀錄，保持趨勢圖連續
      if (!isNew && Number.isFinite(+data.mileage)) {
        const last = mileageFor(saved.id).at(-1);
        if (!last || +data.mileage > last.mileage) {
          await addMileage({ vehicleId: saved.id, date: todayISO(), mileage: +data.mileage, note: '編輯車輛' }, { silent: true });
        }
      }

      close();
      toast(isNew ? '已加入車庫' : '已更新', { type: 'good' });
      onSaved?.(saved);
    } catch (err) {
      console.error(err);
      toast('儲存失敗，請再試一次', { type: 'bad' });
    }
  }

  return sheet;
}

/* ==========================================================
   2. 健康基準設定
   這些欄位就是健康分數的輸入來源，所以表單上直接說明用途。
   focusKey 讓使用者從總覽點某一項時，捲到對應區塊。
   ========================================================== */
export function openHealthSetup({ vehicle, focusKey = null, onSaved = null }) {
  const lc = vehicle.lifecycle || {};

  const body = `
    <div class="form">
      <div data-group="oil">${fieldGroup({
        title: '引擎機油',
        body:
          fieldDate({ name: 'oilLastDate', label: '上次更換日期', value: lc.oilLastDate }) +
          fieldNumber({ name: 'oilLastMileage', label: '上次更換里程', value: lc.oilLastMileage, unit: 'km' }) +
          fieldNumber({ name: 'oilIntervalKm', label: '更換週期', value: lc.oilIntervalKm, unit: 'km' }) +
          fieldNumber({ name: 'oilIntervalMonths', label: '或每', value: lc.oilIntervalMonths, unit: '個月' }),
        note: '里程與時間哪個先到就以它為準，這是健康分數權重最高的項目。',
      })}</div>

      <div data-group="insurance">${fieldGroup({
        title: '保險與驗車',
        body:
          fieldDate({ name: 'insuranceExpiry', label: '保險到期日', value: lc.insuranceExpiry }) +
          fieldDate({ name: 'inspectionExpiry', label: '驗車到期日', value: lc.inspectionExpiry }),
      })}</div>

      <div data-group="tax">${fieldGroup({
        title: '稅金',
        body:
          fieldDate({ name: 'licenseTaxDue', label: '牌照稅期限', value: lc.licenseTaxDue }) +
          fieldDate({ name: 'fuelTaxDue', label: '燃料稅期限', value: lc.fuelTaxDue }),
        note: '牌照稅通常在 4 月、燃料稅在 7 月開徵。',
      })}</div>

      <div data-group="battery">${fieldGroup({
        title: '電瓶',
        body:
          fieldDate({ name: 'batteryDate', label: '更換日期', value: lc.batteryDate }) +
          fieldNumber({ name: 'batteryLifeMonths', label: '預估壽命', value: lc.batteryLifeMonths, unit: '個月' }),
        note: '一般鉛酸電瓶約 24～36 個月。',
      })}</div>

      <div data-group="tyre">${fieldGroup({
        title: '輪胎',
        body:
          fieldDate({ name: 'tyreDate', label: '更換日期', value: lc.tyreDate }) +
          fieldNumber({ name: 'tyreLastMileage', label: '更換時里程', value: lc.tyreLastMileage, unit: 'km' }) +
          fieldNumber({ name: 'tyreLifeKm', label: '預估可跑', value: lc.tyreLifeKm, unit: 'km' }) +
          fieldNumber({ name: 'tyreLifeMonths', label: '或每', value: lc.tyreLifeMonths, unit: '個月' }),
      })}</div>
    </div>`;

  const sheet = openSheet({
    title: '健康基準',
    tall: true,
    left: { label: '取消' },
    right: {
      label: '儲存',
      strong: true,
      act: async (close) => {
        const data = readForm(sheet.body);
        await saveVehicle({ id: vehicle.id, lifecycle: { ...lc, ...data } });
        close();
        toast('健康分數已更新', { type: 'good' });
        onSaved?.();
      },
    },
    body,
  });

  if (focusKey) {
    const target = sheet.body.querySelector(`[data-group="${focusKey === 'inspection' ? 'insurance' : focusKey}"]`);
    if (target) setTimeout(() => target.scrollIntoView({ block: 'start', behavior: 'smooth' }), 380);
  }

  return sheet;
}

/* ==========================================================
   3. 更新里程
   ========================================================== */
export function openMileageSheet({ vehicle, onSaved = null }) {
  const logs = mileageFor(vehicle.id);
  const last = logs.at(-1);

  const body = `
    <div class="form">
      ${fieldGroup({
        body:
          fieldNumber({ name: 'mileage', label: '里程數', value: '', placeholder: last ? String(last.mileage) : '0', unit: 'km' }) +
          fieldDate({ name: 'date', label: '日期', value: todayISO() }) +
          fieldText({ name: 'note', label: '備註', value: '', placeholder: '選填' }),
        note: last ? `上次紀錄：${fmtKm(last.mileage)}（${last.date}）` : '這會是第一筆里程紀錄。',
      })}
      ${logs.length ? `
      <div class="field-group">
        <div class="field-group__title">最近紀錄</div>
        <div class="field-group__body">
          ${[...logs].reverse().slice(0, 6).map((m) => `
            <div class="list__row">
              <span class="list__body">
                <span class="list__label">${fmtKm(m.mileage)}</span>
                <span class="list__sub">${m.date}${m.note ? ` · ${m.note}` : ''}</span>
              </span>
              <button class="btn btn--plain" style="min-height:34px;color:var(--red)" data-del="${m.id}" type="button">刪除</button>
            </div>`).join('')}
        </div>
      </div>` : ''}
    </div>`;

  const sheet = openSheet({
    title: '更新里程',
    left: { label: '取消' },
    right: {
      label: '儲存',
      strong: true,
      act: async (close) => {
        const data = readForm(sheet.body);
        if (!Number.isFinite(+data.mileage)) { toast('請輸入里程數', { type: 'bad' }); return; }
        // 里程通常只增不減，倒退時先確認，避免打錯字毀掉趨勢
        if (last && +data.mileage < last.mileage) {
          const ok = await confirmSheet({
            title: '里程比上次少',
            message: `上次是 ${fmtInt(last.mileage)} km，確定要記錄 ${fmtInt(data.mileage)} km 嗎？`,
            confirmLabel: '仍要儲存',
          });
          if (!ok) return;
        }
        await addMileage({ vehicleId: vehicle.id, date: data.date || todayISO(), mileage: +data.mileage, note: data.note || '' });
        close();
        toast('里程已更新', { type: 'good' });
        onSaved?.();
      },
    },
    body,
  });

  sheet.body.querySelectorAll('[data-del]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ok = await confirmSheet({ title: '刪除這筆里程紀錄？', confirmLabel: '刪除', danger: true });
      if (!ok) return;
      await deleteMileage(btn.dataset.del);
      sheet.close();
      toast('已刪除');
      onSaved?.();
    });
  });

  void wire; void getVehicle; // 保留給後續模組的擴充點
  return sheet;
}
