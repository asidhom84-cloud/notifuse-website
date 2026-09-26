// SJAS Bus Registration — shared helpers (parent + admin pages).
// Independent copy: nothing here imports from /sjasbus. No secrets live here;
// every request is authorised server-side by busreg-api.

import { t } from './reg-i18n.js?v=20';

const PROD_API = 'https://onfoclxqgiuzsdsybnyi.supabase.co/functions/v1/busreg-api';
const IS_LOCAL = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
// Override only on localhost so a crafted link can never point the live page elsewhere.
export const API = (IS_LOCAL && new URLSearchParams(location.search).get('api')) || PROD_API;

// ---------------------------------------------------------------------------
// Storage (wrapped: private windows / in-app browsers may throw)
// ---------------------------------------------------------------------------

function safeStore(kind) {
  return {
    get(key) { try { const v = window[kind].getItem(key); return v ? JSON.parse(v) : null; } catch { return null; } },
    set(key, value) { try { window[kind].setItem(key, JSON.stringify(value)); } catch { /* ignore */ } },
    del(key) { try { window[kind].removeItem(key); } catch { /* ignore */ } },
  };
}
export const local = safeStore('localStorage');
export const session = safeStore('sessionStorage');

export function tokenFrom(store, key) {
  const v = store.get(key);
  if (!v || !v.token || !v.expires_at || new Date(v.expires_at) <= new Date()) {
    store.del(key);
    return null;
  }
  return v.token;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api(path, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (token) headers['x-busreg-token'] = token;
  if (body) headers['content-type'] = 'application/json';
  let res;
  try {
    res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, t('Could not reach the server. Please check your connection and try again.'));
  }
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok) throw new ApiError(res.status, t((data && data.error) || `Request failed (${res.status})`), data && data.code);
  return data;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const nf = new Intl.NumberFormat('en-US');
export const num = (n) => nf.format(Number(n) || 0);

export function fmtDate(v) {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function fmtDateTime(v) {
  if (!v) return '';
  const d = new Date(v);
  return `${fmtDate(v)} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
export const today = () => new Date().toISOString().slice(0, 10);

export function toast(message, ms = 2800) {
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
// Areas: "Madinaty", "Mdinty", "Madinati" match (mirrors busreg_area_key in SQL)
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

export function areaKey(s) {
  return normText(s).replace(/^(al|el|ال)\s*/, '').replace(/\s+/g, '').replace(/[aeiouyاويى]/g, '').replace(/(.)\1+/g, '$1');
}

function lev(a, b) {
  if (a === b) return 0;
  if (!a.length || !b.length) return a.length || b.length;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/** Closest listed area for a typed name: { area, exact } or null. */
export function matchArea(input, areas) {
  const k = areaKey(input);
  if (!k) return null;
  let best = null;
  for (const a of areas) {
    const ak = areaKey(a.name);
    if (ak === k) return { area: a, exact: true };
    const d = lev(ak, k);
    if (d <= (Math.max(ak.length, k.length) >= 5 ? 2 : 1) && (!best || d < best.d)) best = { area: a, exact: false, d };
  }
  return best;
}

// ---------------------------------------------------------------------------
// Geography
// ---------------------------------------------------------------------------

export const CAIRO = { lat: 30.0444, lng: 31.2357 };
export const GREATER_CAIRO = { lat: 30.06, lng: 31.42, zoom: 11 };
export const FAR_KM = 60;

export function distanceM(lat1, lng1, lat2, lng2) {
  const r = (d) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}
export const isFar = (lat, lng) => distanceM(lat, lng, CAIRO.lat, CAIRO.lng) > FAR_KM * 1000;

export const googleMapsUrl = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`;
export const appleMapsUrl = (lat, lng) => `https://maps.apple.com/?ll=${lat},${lng}&q=Pickup`;

// ---------------------------------------------------------------------------
// Layers / modals (Esc and Android back close the top one)
// ---------------------------------------------------------------------------

const stack = [];
window.addEventListener('popstate', () => { const top = stack[stack.length - 1]; if (top) top.close(true); });
document.addEventListener('keydown', (e) => { const top = stack[stack.length - 1]; if (top && e.key === 'Escape') top.close(); });

export function openLayer(el, { onClose } = {}) {
  document.body.appendChild(el);
  document.body.classList.add('sj-lock');
  const prev = document.activeElement;
  const layer = {
    closed: false,
    close(fromPop = false) {
      if (layer.closed) return;
      layer.closed = true;
      stack.splice(stack.indexOf(layer), 1);
      el.remove();
      if (!stack.length) document.body.classList.remove('sj-lock');
      if (!fromPop) history.back();
      onClose?.();
      prev?.focus?.();
    },
  };
  stack.push(layer);
  history.pushState({ busregLayer: stack.length }, '');
  return layer;
}

export function openModal(title, bodyEl, { wide = false } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'sj-modal';
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-modal', 'true');
  wrap.innerHTML = `<div class="sj-modal-panel" ${wide ? 'style="max-width:1040px"' : ''}>
    <div class="sj-modal-head"><h2></h2><span class="sj-spacer"></span><button class="sj-close" type="button" aria-label="${esc(t('Close'))}">×</button></div>
    <div class="sj-modal-body"></div></div>`;
  wrap.querySelector('h2').textContent = title;
  wrap.querySelector('.sj-modal-body').appendChild(bodyEl);
  const layer = openLayer(wrap);
  wrap.querySelector('.sj-close').addEventListener('click', () => layer.close());
  wrap.addEventListener('click', (e) => { if (e.target === wrap) layer.close(); });
  layer.el = wrap;
  layer.setTitle = (s) => { wrap.querySelector('h2').textContent = s; };
  return layer;
}

// ---------------------------------------------------------------------------
// External libraries (cdnjs, pinned with Subresource Integrity)
// ---------------------------------------------------------------------------

const loaded = new Map();
export function loadScript(src, integrity) {
  if (!loaded.has(src)) {
    loaded.set(src, new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.integrity = integrity;
      s.crossOrigin = 'anonymous';
      s.referrerPolicy = 'no-referrer';
      s.onload = resolve;
      s.onerror = () => { loaded.delete(src); reject(new Error('load failed')); };
      document.head.appendChild(s);
    }));
  }
  return loaded.get(src);
}

export function loadCss(href, integrity) {
  if (!loaded.has(href)) {
    loaded.set(href, new Promise((resolve) => {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = href;
      l.integrity = integrity;
      l.crossOrigin = 'anonymous';
      l.referrerPolicy = 'no-referrer';
      l.onload = resolve;
      l.onerror = resolve; // styles missing is not fatal
      document.head.appendChild(l);
    }));
  }
  return loaded.get(href);
}

// ---------------------------------------------------------------------------
// Excel (SheetJS)
// ---------------------------------------------------------------------------

export async function downloadExcel(filename, sheets, { banner } = {}) {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', 'sha384-vtjasyidUo0kW94K5MXDXntzOJpQgBKXmE7e2Ga4LG0skTTLeBi97eFAXsqewJjw');
  const XLSX = window.XLSX;
  const wb = XLSX.utils.book_new();
  for (const sh of sheets) {
    const top = banner ? [[banner], []] : [];
    const aoa = [...top, sh.header, ...sh.rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const headerRow = top.length; // 0-based
    ws['!cols'] = (sh.widths || sh.header.map(() => 16)).map((w) => ({ wch: w }));
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: headerRow, c: 0 }, e: { r: headerRow + Math.max(0, sh.rows.length), c: sh.header.length - 1 } }) };
    if (banner) ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: Math.min(sh.header.length - 1, 8) } }];
    XLSX.utils.book_append_sheet(wb, ws, sh.name.slice(0, 31));
  }
  XLSX.writeFile(wb, filename, { compression: true });
}
