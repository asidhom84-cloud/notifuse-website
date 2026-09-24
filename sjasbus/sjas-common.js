// SJAS Bus portal — shared helpers for the parent page and the admin page.
// No secrets live here: every request is authorised server-side by sjasbus-api.

import { t, tBus, isRtl } from './sjas-i18n.js?v=5';

const PROD_API = 'https://onfoclxqgiuzsdsybnyi.supabase.co/functions/v1/sjasbus-api';
const IS_LOCAL = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
// An API override is only honoured on localhost so a crafted link can never
// point the live page at another server.
export const API = (IS_LOCAL && new URLSearchParams(location.search).get('api')) || PROD_API;

// ---------------------------------------------------------------------------
// Storage (wrapped: private windows / in-app browsers may throw)
// ---------------------------------------------------------------------------

function safeStore(kind) {
  return {
    get(key) {
      try {
        const raw = window[kind].getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch { return null; }
    },
    set(key, value) {
      try { window[kind].setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
    },
    del(key) {
      try { window[kind].removeItem(key); } catch { /* ignore */ }
    },
  };
}
export const local = safeStore('localStorage');
export const session = safeStore('sessionStorage');

export function tokenFrom(store, key) {
  const t = store.get(key);
  if (!t || !t.token || !t.expires_at || new Date(t.expires_at) <= new Date()) {
    store.del(key);
    return null;
  }
  return t.token;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = 'GET', token, body, form } = {}) {
  const headers = {};
  if (token) headers['x-sjas-token'] = token;
  if (body) headers['content-type'] = 'application/json';
  let res;
  try {
    res = await fetch(API + path, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  } catch {
    throw new ApiError(0, t('Could not reach the server. Please check your connection and try again.'));
  }
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok) throw new ApiError(res.status, t((data && data.error) || `Request failed (${res.status})`));
  return data;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const nf2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const egp = (n) => {
  const v = Number(n) || 0;
  const f = (Number.isInteger(v) ? nf : nf2).format(v);
  return isRtl() ? `${f} ${t('EGP')}` : `EGP ${f}`;
};
export const num = (n) => nf.format(Number(n) || 0);

export function fmtDate(value) {
  if (!value) return '';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function fmtDateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  return `${fmtDate(value)} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const plural = (n, one, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`;

export function toast(message, ms = 2600) {
  const el = document.createElement('div');
  el.className = 'sj-toast';
  el.setAttribute('role', 'status');
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { /* ignore */ }
    ta.remove();
    return ok;
  }
}

// ---------------------------------------------------------------------------
// Bus / district normalisation (mirrors sjas_bus_key / sjas_district_key in SQL)
// ---------------------------------------------------------------------------

function normText(s) {
  return String(s ?? '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function busKey(s) {
  const n = normText(s);
  const k = ` ${n} `
    .replace(/\s(bus|no|number|nr|num|route|رقم|باص|اتوبيس|أتوبيس|الباص)(?=\s)/g, ' ')
    .replace(/\s+/g, '')
    .replace(/^0+(?=\d)/, '');
  return k || n;
}

export function busLabel(s) {
  const k = busKey(s);
  if (/^\d/.test(k)) return `Bus ${k.toUpperCase()}`;
  return String(s ?? '').trim();
}

export function districtKey(s) {
  return normText(s)
    .replace(/^(al|el|ال)\s*/, '')
    .replace(/\s+/g, '')
    .replace(/[aeiouyاويى]/g, '')
    .replace(/(.)\1+/g, '$1');
}

function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m || !n) return m || n;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

/** Find an already-used district spelling that matches (exact key) or is close. */
export function matchDistrict(input, known) {
  const key = districtKey(input);
  if (!key) return null;
  let best = null;
  for (const d of known) {
    const k = districtKey(d);
    if (!k) continue;
    if (k === key) return { district: d, exact: true };
    const dist = lev(k, key);
    const tol = Math.max(k.length, key.length) >= 5 ? 2 : 1;
    if (dist <= tol && (!best || dist < best.dist)) best = { district: d, exact: false, dist };
  }
  return best;
}

// ---------------------------------------------------------------------------
// Image preparation: strip metadata (EXIF/GPS) by re-encoding, shrink large
// photos, convert HEIC where the browser can decode it.
// ---------------------------------------------------------------------------

const MAX_DIM = 2400;
const MAX_BYTES = 10 * 1024 * 1024;
const isHeic = (f) => /image\/hei[cf]/i.test(f.type) || /\.hei[cf]$/i.test(f.name);

async function sha256Hex(buf) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
  return Array.from(d, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function decode(file) {
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* fall through */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export async function prepareImage(file) {
  const okType = /image\/(jpeg|png|hei[cf])/i.test(file.type) || /\.(jpe?g|png|hei[cf])$/i.test(file.name);
  if (!okType) throw new Error(t('"{name}" is not a JPG, PNG or HEIC image.', { name: file.name }));
  const originalSha = await sha256Hex(await file.arrayBuffer());
  let blob = null;
  try {
    const src = await decode(file);
    const w = src.width || src.naturalWidth;
    const h = src.height || src.naturalHeight;
    const scale = Math.min(1, MAX_DIM / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
    if (src.close) src.close();
    blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.88));
  } catch { /* undecodable here (e.g. HEIC on Chrome) */ }
  if (!blob) {
    if (!isHeic(file)) throw new Error(t('"{name}" could not be read as an image.', { name: file.name }));
    blob = file; // server accepts HEIC as-is
  }
  if (blob.size > MAX_BYTES) throw new Error(t('"{name}" is too large (max 10 MB).', { name: file.name }));
  const name = blob === file ? file.name : file.name.replace(/\.[^.]+$/, '') + '.jpg';
  return { blob, name, originalSha, preview: blob === file ? null : URL.createObjectURL(blob) };
}

// ---------------------------------------------------------------------------
// Modal helpers (close with Esc / Android back)
// ---------------------------------------------------------------------------

const modalStack = [];
window.addEventListener('popstate', () => {
  const top = modalStack[modalStack.length - 1];
  if (top) top.close(true);
});
document.addEventListener('keydown', (e) => {
  const top = modalStack[modalStack.length - 1];
  if (top && e.key === 'Escape') top.close();
});

export function openLayer(el, { onClose } = {}) {
  document.body.appendChild(el);
  document.body.classList.add('sj-lock');
  const prevFocus = document.activeElement;
  const layer = {
    closed: false,
    close(fromPop = false) {
      if (layer.closed) return;
      layer.closed = true;
      modalStack.splice(modalStack.indexOf(layer), 1);
      el.remove();
      if (!modalStack.length) document.body.classList.remove('sj-lock');
      if (!fromPop) history.back();
      onClose?.();
      prevFocus?.focus?.();
    },
  };
  modalStack.push(layer);
  history.pushState({ sjLayer: modalStack.length }, '');
  return layer;
}

export function openModal(title, bodyEl, { wide = false } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'sj-modal';
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-modal', 'true');
  wrap.innerHTML = `<div class="sj-modal-panel" ${wide ? 'style="max-width:1040px"' : ''}>
    <div class="sj-modal-head"><h2></h2><span class="sj-spacer"></span><button class="sj-close" type="button" aria-label="Close">×</button></div>
    <div class="sj-modal-body"></div></div>`;
  wrap.querySelector('h2').textContent = title;
  wrap.querySelector('.sj-modal-body').appendChild(bodyEl);
  const layer = openLayer(wrap);
  wrap.querySelector('.sj-close').addEventListener('click', () => layer.close());
  wrap.addEventListener('click', (e) => { if (e.target === wrap) layer.close(); });
  wrap.querySelector('.sj-close').focus();
  layer.el = wrap;
  layer.setTitle = (t) => { wrap.querySelector('h2').textContent = t; };
  return layer;
}

// ---------------------------------------------------------------------------
// Evidence lightbox
// data: { title, subtitle, payments:[{id, number, amount, payment_date, transaction_reference}],
//         amount_total, evidence:[{id, payment_id, url, mime_type}] }
// reload(): optional async fn returning fresh data (signed URLs expire in minutes)
// ---------------------------------------------------------------------------

export function openLightbox(data, { reload, startIndex = 0 } = {}) {
  let d = data;
  let idx = Math.min(startIndex, Math.max(0, d.evidence.length - 1));
  let loadedAt = Date.now();
  let retried = false;

  const el = document.createElement('div');
  el.className = 'sj-lb';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', t('Payment receipts'));
  el.innerHTML = `
    <div class="sj-lb-head"><div class="t"><b></b><span></span></div>
      <button class="sj-close" type="button" aria-label="${esc(t('Close'))}">×</button></div>
    <div class="sj-lb-pay" aria-label="${esc(t('Payments'))}"></div>
    <div class="sj-lb-stage"></div>
    <div class="sj-lb-foot"><span class="cap"></span><a class="open" target="_blank" rel="noopener noreferrer">${esc(t('Open full size'))}</a><span class="cnt"></span></div>`;
  el.querySelector('.t b').textContent = d.title;
  el.querySelector('.t span').textContent = d.subtitle || '';
  const stage = el.querySelector('.sj-lb-stage');
  const payBar = el.querySelector('.sj-lb-pay');
  const cap = el.querySelector('.cap');
  const cnt = el.querySelector('.cnt');
  const openLink = el.querySelector('.open');

  const payById = new Map(d.payments.map((p) => [p.id, p]));
  const payDesc = (p) => [egp(p.amount), fmtDate(p.payment_date), p.transaction_reference ? t('Ref {ref}', { ref: p.transaction_reference }) : ''].filter(Boolean).join(' · ');

  payBar.innerHTML =
    d.payments.map((p) => `<button type="button" class="p" data-pay="${esc(p.id)}">${esc(t('Payment {n}', { n: p.number }))}<br><b>${esc(egp(p.amount))}</b>${p.payment_date ? ` · ${esc(fmtDate(p.payment_date))}` : ''}${p.transaction_reference ? `<br>${esc(t('Ref {ref}', { ref: p.transaction_reference }))}` : ''}</button>`).join('') +
    (d.payments.length > 1 ? `<div class="p tot">${esc(t('Total'))}<br><b>${esc(egp(d.amount_total))}</b></div>` : '');
  payBar.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pay]');
    if (!btn) return;
    const i = d.evidence.findIndex((ev) => ev.payment_id === btn.dataset.pay);
    if (i >= 0) show(i);
  });

  function show(i) {
    idx = (i + d.evidence.length) % d.evidence.length;
    stage.classList.remove('zoomed');
    const ev = d.evidence[idx];
    const p = ev ? payById.get(ev.payment_id) : null;
    payBar.querySelectorAll('[data-pay]').forEach((b) => b.classList.toggle('on', !!p && b.dataset.pay === p.id));
    cnt.textContent = d.evidence.length ? `${idx + 1} / ${d.evidence.length}` : '';
    cap.textContent = p ? `${t('Payment {n}', { n: p.number })} — ${payDesc(p)}` : d.evidence.length ? t('Payment receipt') : '';
    stage.innerHTML = '';
    if (!ev) {
      stage.innerHTML = `<div class="sj-lb-msg">${esc(t('No receipts are available for this record.'))}</div>`;
      openLink.hidden = true;
      return;
    }
    openLink.hidden = !ev.url;
    openLink.href = ev.url || '#';
    const img = new Image();
    img.alt = t('Payment receipt {i} of {n}', { i: idx + 1, n: d.evidence.length });
    img.draggable = false;
    img.src = ev.url;
    img.addEventListener('error', async () => {
      if (reload && !retried && Date.now() - loadedAt > 60_000) {
        retried = true;
        try {
          d = await reload();
          loadedAt = Date.now();
          show(idx);
          return;
        } catch { /* fall through */ }
      }
      const heic = /hei[cf]/.test(ev.mime_type || '');
      stage.innerHTML = `<div class="sj-lb-msg">${esc(heic ? t('This receipt is a HEIC photo, which this browser cannot display.') : t('This receipt could not be loaded.'))}<br><a href="${esc(ev.url)}" target="_blank" rel="noopener noreferrer">${esc(t('Open / download it'))}</a></div>`;
    });
    stage.appendChild(img);
    if (d.evidence.length > 1) {
      // Logical positions: in Arabic (RTL) "previous" sits on the right.
      const [back, fwd] = isRtl() ? ['›', '‹'] : ['‹', '›'];
      stage.insertAdjacentHTML('beforeend', `<button class="sj-lb-nav prev" type="button" aria-label="${esc(t('Previous receipt'))}">${back}</button><button class="sj-lb-nav next" type="button" aria-label="${esc(t('Next receipt'))}">${fwd}</button>`);
    }
  }

  // Zoom: tap/click toggles 2.5× and scrolls to the tapped point.
  stage.addEventListener('click', (e) => {
    if (e.target.closest('.sj-lb-nav')) {
      show(idx + (e.target.classList.contains('next') ? 1 : -1));
      return;
    }
    if (e.target.tagName !== 'IMG' || swiped) return;
    const img = e.target;
    const r = img.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width;
    const fy = (e.clientY - r.top) / r.height;
    const zoomed = stage.classList.toggle('zoomed');
    if (zoomed) {
      requestAnimationFrame(() => {
        stage.scrollLeft = img.offsetWidth * fx - stage.clientWidth / 2;
        stage.scrollTop = img.offsetHeight * fy - stage.clientHeight / 2;
      });
    }
  });

  // Swipe between receipts (when not zoomed).
  let sx = 0, sy = 0, swiped = false;
  stage.addEventListener('touchstart', (e) => {
    swiped = false;
    if (e.touches.length !== 1) return;
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
  }, { passive: true });
  stage.addEventListener('touchend', (e) => {
    if (stage.classList.contains('zoomed') || e.changedTouches.length !== 1 || d.evidence.length < 2) return;
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      swiped = true;
      show(idx + ((dx < 0) !== isRtl() ? 1 : -1));
      setTimeout(() => { swiped = false; }, 350);
    }
  });

  const onKey = (e) => {
    const step = isRtl() ? -1 : 1;
    if (e.key === 'ArrowRight') show(idx + step);
    else if (e.key === 'ArrowLeft') show(idx - step);
  };
  document.addEventListener('keydown', onKey);
  const layer = openLayer(el, { onClose: () => document.removeEventListener('keydown', onKey) });
  el.querySelector('.sj-close').addEventListener('click', () => layer.close());
  el.querySelector('.sj-close').focus();
  show(idx);
  return layer;
}

// ---------------------------------------------------------------------------
// Submission form (create / parent edit / admin edit)
//
// opts: {
//   mode: 'create' | 'edit' | 'admin',
//   initial?: { parent_name, contact_phone, bus_number, district, parent_notes, admin_notes,
//               students:[..], payments:[{id, amount, payment_date, transaction_reference}],
//               evidence:[{id, payment_id, url, mime_type, removed?, hidden?}] },
//   buses: [{ bus_key, bus_label, districts:[..] }],
//   districts: [ 'Madinaty', ... ],
//   onSubmit: async (FormData, setStatus) => void,
//   onCancel?: () => void,
// }
// ---------------------------------------------------------------------------

const PER_PAYMENT_FILES = 5;
const MAX_NEW_FILES = 10;

export function submissionForm(root, opts) {
  const init = opts.initial || {};
  const isCreate = opts.mode === 'create';
  const isAdmin = opts.mode === 'admin';
  const knownDistricts = [...new Set((opts.districts || []).filter(Boolean))];
  const busMap = new Map((opts.buses || []).map((b) => [b.bus_key, b]));

  const state = {
    students: (init.students && init.students.length ? init.students : ['']).slice(),
    payments: (init.payments && init.payments.length ? init.payments : [{ amount: '' }]).map((p) => ({
      id: p.id || null,
      amount: p.amount !== undefined && p.amount !== '' ? String(p.amount) : '',
      payment_date: p.payment_date || '',
      transaction_reference: p.transaction_reference || '',
      files: [],
      key: Math.random().toString(36).slice(2),
    })),
    existing: (init.evidence || []).filter((e) => isAdmin || !e.removed),
    remove: new Set(),
    districtAuto: false,
  };

  root.innerHTML = `
    <form class="sj-form" novalidate>
      <div class="sj-note sj-note-info">
        <div class="sj-vis">
          <div><b>${esc(t('Visible to other parents with the SJAS Bus password'))}</b>
            <ul>${['Parent name', 'Student names', 'Bus number & district', 'Amount paid (each payment, date & reference)', 'Uploaded payment screenshots'].map((x) => `<li>${esc(t(x))}</li>`).join('')}</ul></div>
          <div><b>${esc(t('Private — administrator only'))}</b>
            <ul>${['Contact phone', 'Edit PIN', 'Notes you add', 'Internal review notes'].map((x) => `<li>${esc(t(x))}</li>`).join('')}</ul></div>
        </div>
      </div>

      <div class="sj-field"><label for="f-parent">${esc(t('Parent full name'))} <span class="sj-req">*</span></label>
        <input id="f-parent" name="parent_name" autocomplete="name" maxlength="120" required></div>

      <div class="sj-field"><label for="f-phone">${esc(t('Contact phone'))} <span class="sj-opt">${esc(t('(optional · private)'))}</span></label>
        <input id="f-phone" name="contact_phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="40" placeholder="010 1234 5678" dir="ltr">
        <div class="sj-help">${esc(t('Only the administrator can see this, in case they need to reach you.'))}</div></div>

      <div class="sj-row">
        <div class="sj-field"><label for="f-bus">${esc(t('Bus number'))} <span class="sj-req">*</span></label>
          <input id="f-bus" name="bus_number" maxlength="40" required placeholder="${esc(t('e.g. 37'))}" autocomplete="off">
          <div class="sj-help" data-bus-help></div></div>
        <div class="sj-field"><label for="f-district">${esc(t('District'))} <span class="sj-req">*</span></label>
          <input id="f-district" name="district" maxlength="60" required placeholder="${esc(t('e.g. Madinaty'))}" autocomplete="off" list="sj-district-list">
          ${isRtl() ? `<div class="sj-help">${esc(t('Please write the district in English (e.g. Madinaty) so families on the same bus are grouped together.'))}</div>` : ''}
          <datalist id="sj-district-list">${knownDistricts.map((d) => `<option value="${esc(d)}"></option>`).join('')}</datalist>
          <div class="sj-help" data-district-help></div>
          <div class="sj-chips" data-district-chips></div></div>
      </div>

      <div class="sj-field"><span class="sj-label">${esc(t('Students'))} <span class="sj-req">*</span></span>
        <div data-students></div>
        <button type="button" class="sj-linkbtn" data-add-student>${esc(t('+ Add another student'))}</button></div>

      <div class="sj-section">
        <h3>${esc(t('Payments to the bus company'))}</h3>
        <div class="sj-note sj-note-warn"><b>${esc(t('Before uploading screenshots'))}</b>
          ${esc(t('Please crop or cover anything not needed — especially bank balances, account / card numbers and unrelated transactions. The amount, date, and reference are enough. Other parents with the password will be able to see these screenshots.'))}</div>
        <p class="sj-help" style="margin-top:0">${esc(t('Paid in installments? Add each one separately with its own screenshot(s). Accepted: JPG, PNG, HEIC.'))}</p>
        <div data-payments></div>
        <button type="button" class="sj-btn sj-btn-sm" data-add-payment>${esc(t('+ Add another payment'))}</button>
        <div class="sj-formtotal"><span>${esc(t('Total you paid'))}</span><span class="sj-num" data-total>${esc(egp(0))}</span></div>
      </div>

      <div class="sj-section">
        <div class="sj-field"><label for="f-notes">${esc(t('Notes'))} <span class="sj-opt">${esc(t('(optional · administrator only)'))}</span></label>
          <textarea id="f-notes" name="parent_notes" maxlength="1000"></textarea></div>
        ${isAdmin ? `<div class="sj-field"><label for="f-admin-notes">Admin notes <span class="sj-opt">(internal)</span></label>
          <textarea id="f-admin-notes" name="admin_notes" maxlength="4000"></textarea></div>` : ''}
        ${isCreate ? `<label class="sj-check"><input type="checkbox" name="consent" required>
          <span>${esc(t("I understand that my name, my children's names, bus number, district, amounts paid and payment screenshots will be visible to other parents who have the SJAS Bus access password."))}</span></label>` : ''}
      </div>

      <div class="sj-note sj-note-err" data-error hidden role="alert"></div>
      <div class="sj-formfoot">
        ${opts.onCancel ? `<button type="button" class="sj-btn" data-cancel>${esc(t('Cancel'))}</button>` : ''}
        <button type="submit" class="sj-btn sj-btn-primary" data-submit>${esc(isCreate ? t('Submit my payment') : t('Save changes'))}</button>
      </div>
    </form>`;

  const form = root.querySelector('form');
  const $ = (sel) => form.querySelector(sel);
  $('#f-parent').value = init.parent_name || '';
  $('#f-phone').value = init.contact_phone || '';
  $('#f-bus').value = init.bus_number || '';
  $('#f-district').value = init.district || '';
  $('#f-notes').value = init.parent_notes || '';
  if (isAdmin) $('#f-admin-notes').value = init.admin_notes || '';

  // ----- Students
  const studentsEl = $('[data-students]');
  function renderStudents() {
    studentsEl.innerHTML = state.students.map((s, i) => `
      <div class="sj-inline" style="margin-bottom:8px">
        <input class="sj-input" data-student="${i}" maxlength="80" placeholder="${esc(t('Student {n} name', { n: i + 1 }))}" aria-label="${esc(t('Student {n} name', { n: i + 1 }))}" value="${esc(s)}">
        ${state.students.length > 1 ? `<button type="button" class="sj-iconbtn" data-rm-student="${i}" aria-label="${esc(t('Remove student {n}', { n: i + 1 }))}">×</button>` : ''}
      </div>`).join('');
  }
  studentsEl.addEventListener('input', (e) => {
    const i = e.target.dataset.student;
    if (i !== undefined) state.students[i] = e.target.value;
  });
  studentsEl.addEventListener('click', (e) => {
    const i = e.target.dataset.rmStudent;
    if (i === undefined) return;
    state.students.splice(Number(i), 1);
    renderStudents();
  });
  $('[data-add-student]').addEventListener('click', () => {
    if (state.students.length >= 10) return;
    state.students.push('');
    renderStudents();
    studentsEl.querySelector(`[data-student="${state.students.length - 1}"]`)?.focus();
  });
  renderStudents();

  // ----- Bus & district assistance
  const busHelp = $('[data-bus-help]');
  const distHelp = $('[data-district-help]');
  const distChips = $('[data-district-chips]');
  function updateBus() {
    const raw = $('#f-bus').value;
    const key = busKey(raw);
    distChips.innerHTML = '';
    if (!raw.trim()) { busHelp.textContent = ''; return; }
    const bus = busMap.get(key);
    busHelp.textContent = t('Listed as: {label}', { label: tBus(bus ? bus.bus_label : busLabel(raw)) });
    const dists = bus?.districts?.filter(Boolean) || [];
    const distInput = $('#f-district');
    if (dists.length && (!distInput.value.trim() || state.districtAuto)) {
      distInput.value = dists[0];
      state.districtAuto = true;
      distHelp.className = 'sj-help sj-good';
      distHelp.textContent = t('Filled in from other {bus} families — change it if yours is different.', { bus: tBus(bus.bus_label) });
    }
    const others = dists.filter((x) => x !== distInput.value);
    if (others.length) {
      distChips.innerHTML = `<span class="sj-help" style="margin:0">${esc(t('Also on {bus}:', { bus: tBus(bus.bus_label) }))}</span>` +
        others.map((x) => `<button type="button" class="sj-chip" data-pick="${esc(x)}">${esc(x)}</button>`).join('');
    }
  }
  function updateDistrict() {
    const input = $('#f-district');
    const v = input.value.trim();
    distHelp.className = 'sj-help';
    distHelp.textContent = '';
    if (!v) return;
    const m = matchDistrict(v, knownDistricts);
    if (!m || m.district === v) return;
    if (m.exact) {
      distHelp.className = 'sj-help sj-good';
      distHelp.textContent = t('Will be listed as "{d}" (same spelling as other families).', { d: m.district });
    } else {
      distHelp.innerHTML = `${esc(t('Did you mean'))} <button type="button" class="sj-chip" data-pick="${esc(m.district)}">${esc(m.district)}</button>?`;
    }
  }
  $('#f-bus').addEventListener('input', updateBus);
  $('#f-district').addEventListener('input', () => { state.districtAuto = false; updateDistrict(); });
  $('#f-district').addEventListener('blur', () => {
    const m = matchDistrict($('#f-district').value, knownDistricts);
    if (m?.exact) $('#f-district').value = m.district;
  });
  form.addEventListener('click', (e) => {
    const pick = e.target.closest('[data-pick]');
    if (!pick) return;
    $('#f-district').value = pick.dataset.pick;
    state.districtAuto = false;
    distHelp.className = 'sj-help';
    distHelp.textContent = '';
    updateBus();
  });
  if (init.bus_number) busHelp.textContent = t('Listed as: {label}', { label: tBus(busMap.get(busKey(init.bus_number))?.bus_label || busLabel(init.bus_number)) });

  // ----- Payments
  const paymentsEl = $('[data-payments]');
  const totalEl = $('[data-total]');
  const parseAmt = (s) => {
    const n = Number(String(s).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[,\s]/g, ''));
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  function updateTotal() {
    totalEl.textContent = egp(state.payments.reduce((t, p) => t + parseAmt(p.amount), 0));
  }
  function existingFor(p, i) {
    // Screenshots not tied to a current payment are shown under Payment 1.
    return state.existing.filter((e) => (p.id && e.payment_id === p.id) || (i === 0 && !state.payments.some((q) => q.id && q.id === e.payment_id)));
  }
  function renderPayments() {
    paymentsEl.innerHTML = state.payments.map((p, i) => {
      const ex = existingFor(p, i);
      const thumbs = ex.map((e) => {
        const removed = state.remove.has(e.id) || e.removed;
        return `<div class="sj-thumb ${removed ? 'sj-removed' : ''}">${e.url ? `<img src="${esc(e.url)}" alt="" loading="lazy">` : esc(t('Image'))}
          ${e.removed ? '' : `<button type="button" data-toggle-ex="${esc(e.id)}" aria-label="${esc(removed ? t('Keep screenshot') : t('Remove screenshot'))}">${removed ? '↺' : '×'}</button>`}</div>`;
      }).join('') + p.files.map((f, j) => `<div class="sj-thumb">${f.preview ? `<img src="${esc(f.preview)}" alt="">` : 'HEIC'}
          <button type="button" data-rm-file="${i}:${j}" aria-label="${esc(t('Remove new screenshot'))}">×</button></div>`).join('');
      const canAdd = p.files.length < PER_PAYMENT_FILES;
      return `<div class="sj-payment" data-pay="${i}">
        <div class="sj-payment-head"><b>${esc(t('Payment {n}', { n: i + 1 }))}</b>
          ${state.payments.length > 1 ? `<button type="button" class="sj-btn sj-btn-ghost sj-btn-sm sj-btn-danger" data-rm-payment="${i}">${esc(t('Remove'))}</button>` : ''}</div>
        <div class="sj-row">
          <div class="sj-field"><label for="amt-${p.key}">${esc(t('Amount paid'))} <span class="sj-req">*</span></label>
            <div class="sj-amount"><span>${esc(t('EGP'))}</span><input id="amt-${p.key}" data-f="amount" inputmode="decimal" placeholder="10,000" value="${esc(p.amount)}" autocomplete="off"></div></div>
          <div class="sj-field"><label for="date-${p.key}">${esc(t('Payment date'))} <span class="sj-opt">${esc(t('(optional)'))}</span></label>
            <input id="date-${p.key}" data-f="payment_date" type="date" min="2020-01-01" max="${new Date().toISOString().slice(0, 10)}" value="${esc(p.payment_date)}"></div>
        </div>
        <div class="sj-field"><label for="ref-${p.key}">${esc(t('Transaction reference number'))} <span class="sj-opt">${esc(t('(optional)'))}</span></label>
          <input id="ref-${p.key}" data-f="transaction_reference" maxlength="80" value="${esc(p.transaction_reference)}" autocomplete="off" placeholder="${esc(t('e.g. 504812345678'))}" dir="ltr">
          <div class="sj-help">${esc(t('The number shown on the receipt — not the method (“InstaPay”, “Cash”). Leave empty if there is none.'))}</div></div>
        <span class="sj-label">${esc(t('Payment screenshot(s)'))}${isCreate && i === 0 ? ' <span class="sj-req">*</span>' : ''}</span>
        <div class="sj-files">${thumbs}
          ${canAdd ? `<label class="sj-addfile"><input type="file" data-file="${i}" accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif,.jpg,.jpeg,.png" multiple><span style="font-size:1.25rem">＋</span>${esc(t('Add screenshot'))}</label>` : ''}
        </div>
        <div class="sj-help" data-file-msg="${i}"></div>
      </div>`;
    }).join('');
    updateTotal();
  }
  paymentsEl.addEventListener('input', (e) => {
    const card = e.target.closest('[data-pay]');
    const f = e.target.dataset.f;
    if (!card || !f) return;
    state.payments[card.dataset.pay][f] = e.target.value;
    if (f === 'amount') updateTotal();
  });
  paymentsEl.addEventListener('click', (e) => {
    const t = e.target;
    if (t.dataset.rmPayment !== undefined) {
      const i = Number(t.dataset.rmPayment);
      const p = state.payments[i];
      const ex = p.id ? state.existing.filter((x) => x.payment_id === p.id && !x.removed && !state.remove.has(x.id)) : [];
      if ((p.amount || p.files.length || ex.length) && !confirm(t(ex.length ? 'Remove Payment {n} and its screenshots?' : 'Remove Payment {n}?', { n: i + 1 }))) return;
      ex.forEach((x) => state.remove.add(x.id));
      state.payments.splice(i, 1);
      renderPayments();
    } else if (t.dataset.rmFile) {
      const [i, j] = t.dataset.rmFile.split(':').map(Number);
      const [f] = state.payments[i].files.splice(j, 1);
      if (f?.preview) URL.revokeObjectURL(f.preview);
      renderPayments();
    } else if (t.dataset.toggleEx) {
      const id = t.dataset.toggleEx;
      state.remove.has(id) ? state.remove.delete(id) : state.remove.add(id);
      renderPayments();
    }
  });
  paymentsEl.addEventListener('change', async (e) => {
    const i = e.target.dataset.file;
    if (i === undefined) return;
    const p = state.payments[i];
    const msg = paymentsEl.querySelector(`[data-file-msg="${i}"]`);
    const picked = [...e.target.files];
    e.target.value = '';
    const room = Math.min(PER_PAYMENT_FILES - p.files.length, MAX_NEW_FILES - state.payments.reduce((t, q) => t + q.files.length, 0));
    if (room <= 0) { msg.textContent = t('You can add up to {a} screenshots per payment and {b} per save.', { a: PER_PAYMENT_FILES, b: MAX_NEW_FILES }); return; }
    msg.textContent = t('Preparing images…');
    const errors = [];
    for (const file of picked.slice(0, room)) {
      try { p.files.push(await prepareImage(file)); } catch (err) { errors.push(err.message); }
    }
    if (picked.length > room) errors.push(t('Only {n} more screenshot(s) could be added here.', { n: room }));
    renderPayments();
    const m = paymentsEl.querySelector(`[data-file-msg="${i}"]`);
    if (m) m.textContent = errors.join(' ');
  });
  $('[data-add-payment]').addEventListener('click', () => {
    if (state.payments.length >= 24) return;
    state.payments.push({ id: null, amount: '', payment_date: '', transaction_reference: '', files: [], key: Math.random().toString(36).slice(2) });
    renderPayments();
    paymentsEl.querySelector(`[data-pay="${state.payments.length - 1}"] input`)?.focus();
  });
  renderPayments();

  // ----- Submit
  const errEl = $('[data-error]');
  const submitBtn = $('[data-submit]');
  $('[data-cancel]')?.addEventListener('click', () => opts.onCancel());

  function fail(message, focusEl) {
    errEl.textContent = message;
    errEl.hidden = false;
    (focusEl || errEl).scrollIntoView({ behavior: 'smooth', block: 'center' });
    focusEl?.focus?.({ preventScroll: true });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.hidden = true;
    const parent = $('#f-parent').value.trim();
    const bus = $('#f-bus').value.trim();
    const district = $('#f-district').value.trim();
    const students = state.students.map((s) => s.trim()).filter(Boolean);
    if (parent.length < 2) return fail(t('Please enter the parent full name.'), $('#f-parent'));
    if (!bus) return fail(t('Please enter the bus number.'), $('#f-bus'));
    if (!district) return fail(t('Please enter the district (e.g. Madinaty).'), $('#f-district'));
    if (!students.length) return fail(t('Please enter at least one student name.'), studentsEl.querySelector('input'));
    for (let i = 0; i < state.payments.length; i++) {
      if (!parseAmt(state.payments[i].amount)) {
        return fail(t('Please enter the amount for Payment {n}.', { n: i + 1 }), paymentsEl.querySelector(`[data-pay="${i}"] [data-f="amount"]`));
      }
    }
    const newFiles = state.payments.reduce((t, p) => t + p.files.length, 0);
    const keptExisting = state.existing.filter((x) => !x.removed && !state.remove.has(x.id)).length;
    if (!isAdmin && newFiles + keptExisting === 0) return fail(t('Please attach at least one payment screenshot.'), paymentsEl.querySelector('.sj-addfile'));
    if (isCreate && !form.consent.checked) return fail(t('Please tick the box to confirm you understand what other parents can see.'), form.consent);

    const data = {
      parent_name: parent,
      contact_phone: $('#f-phone').value.trim(),
      bus_number: bus,
      district,
      parent_notes: $('#f-notes').value.trim(),
      students,
      payments: state.payments.map((p) => ({
        id: p.id || undefined,
        amount: String(parseAmt(p.amount)),
        payment_date: p.payment_date || null,
        transaction_reference: p.transaction_reference.trim() || null,
      })),
      remove_evidence: [...state.remove],
      consent: isCreate ? form.consent.checked : undefined,
    };
    if (isAdmin) data.admin_notes = $('#f-admin-notes').value.trim();
    const fd = new FormData();
    const meta = [];
    state.payments.forEach((p, i) => p.files.forEach((f) => {
      fd.append('files', f.blob, f.name);
      meta.push({ payment_index: i, original_sha256: f.originalSha });
    }));
    fd.set('data', JSON.stringify(data));
    fd.set('files_meta', JSON.stringify(meta));

    const label = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="sj-spin"></span> ${esc(newFiles ? t('Uploading…') : t('Saving…'))}`;
    try {
      await opts.onSubmit(fd);
    } catch (err) {
      fail(err.message || t('Something went wrong. Please try again.'));
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = label;
    }
  });

  if (!isCreate) updateDistrict();
}

// ---------------------------------------------------------------------------
// Excel export (SheetJS, loaded on demand from cdnjs with SRI)
// ---------------------------------------------------------------------------

const XLSX_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
const XLSX_SRI = 'sha384-vtjasyidUo0kW94K5MXDXntzOJpQgBKXmE7e2Ga4LG0skTTLeBi97eFAXsqewJjw';
let xlsxPromise = null;
function loadXlsx() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  xlsxPromise ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = XLSX_SRC;
    s.integrity = XLSX_SRI;
    s.crossOrigin = 'anonymous';
    s.referrerPolicy = 'no-referrer';
    s.onload = () => resolve(window.XLSX);
    s.onerror = () => { xlsxPromise = null; reject(new Error(t('Could not load the Excel exporter. Please try again.'))); };
    document.head.appendChild(s);
  });
  return xlsxPromise;
}

/**
 * sheets: [{ name, header: [..], rows: [[..]], money: [colIndex..], widths: [..], totalRow?: [..] }]
 * Money columns get "#,##0.##" formatting; a totalRow's money cells become SUM formulas.
 */
export async function downloadExcel(filename, sheets) {
  const XLSX = await loadXlsx();
  const wb = XLSX.utils.book_new();
  for (const sh of sheets) {
    const aoa = [sh.header, ...sh.rows];
    if (sh.totalRow) aoa.push(sh.totalRow);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const last = aoa.length; // 1-based row number of final row
    for (const c of sh.money || []) {
      const col = XLSX.utils.encode_col(c);
      for (let r = 2; r <= last; r++) {
        const cell = ws[`${col}${r}`];
        if (cell && cell.t === 'n') cell.z = '#,##0.##';
      }
      if (sh.totalRow && sh.rows.length) {
        const cell = ws[`${col}${last}`];
        if (cell && cell.t === 'n') cell.f = `SUM(${col}2:${col}${last - 1})`;
      }
    }
    ws['!cols'] = (sh.widths || sh.header.map(() => 16)).map((w) => ({ wch: w }));
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, sh.rows.length), c: sh.header.length - 1 } }) };
    XLSX.utils.book_append_sheet(wb, ws, sh.name.slice(0, 31));
  }
  XLSX.writeFile(wb, filename, { compression: true });
}

export const today = () => new Date().toISOString().slice(0, 10);

export function busSheets(data) {
  return [
    {
      name: 'By bus',
      header: ['Bus', 'District(s)', 'Families', 'Students', 'Total paid (EGP)'],
      rows: data.buses.map((b) => [b.bus_label, (b.districts || []).join(', '), b.families, b.students, Number(b.total_amount)]),
      totalRow: ['TOTAL', '', data.summary.families, data.summary.students, Number(data.summary.total_amount)],
      money: [4],
      widths: [14, 28, 10, 10, 18],
    },
    {
      name: 'By district',
      header: ['District', 'Buses', 'Families', 'Students', 'Total paid (EGP)'],
      rows: data.districts.map((d) => [d.district, (d.buses || []).join(', '), d.families, d.students, Number(d.total_amount)]),
      totalRow: ['TOTAL', '', data.summary.families, data.summary.students, Number(data.summary.total_amount)],
      money: [4],
      widths: [22, 26, 10, 10, 18],
    },
  ];
}
