// SJAS Bus Registration — administrator dashboard (English / Arabic).
// Full data (names, phones, exact pins) is loaded only with the admin session.

import {
  api, appleMapsUrl, copyText, downloadExcel, esc, fmtDate, fmtDateTime, googleMapsUrl, num,
  openModal, session, toast, today, tokenFrom,
} from './reg-common.js?v=16';
import { registrationForm } from './reg-form.js?v=16';
import { addTiles, loadMarkerCluster, renderPreview } from './reg-map.js?v=16';
import { hull, summarise } from './reg-cluster.js?v=16';
import { cleanupFleet, initFleet, renderBuses, renderRoutes, renderSettings } from './reg-fleet.js?v=16';
import { getLang, initLang, setLang, t } from './reg-i18n.js?v=16';
import './reg-admin-i18n.js?v=16';

const ADMIN_KEY = 'busreg.admin';
const app = document.getElementById('rg-app');
const signoutBtn = document.getElementById('rg-signout');
const langBtn = document.getElementById('rg-lang');
const tt = (key, vars) => esc(t(key, vars));

// The admin page keeps its own language choice (separate from the parents' page).
initLang({ key: 'busreg.adminlang', title: 'SJAS Bus Registration — Admin' });
function updateLangBtn() {
  langBtn.textContent = getLang() === 'ar' ? 'English' : 'العربية';
  langBtn.lang = getLang() === 'ar' ? 'en' : 'ar';
}
updateLangBtn();
langBtn.addEventListener('click', () => {
  const open = [...document.querySelectorAll('.sj-modal-panel .sj-close')];
  if (open.length && !confirm(t('Switching language closes the open window. Continue?'))) return;
  open.reverse().forEach((b) => b.click());
  setLang(getLang() === 'ar' ? 'en' : 'ar');
  updateLangBtn();
  if (!token()) renderGate(); else if (data) renderDashboard(); else load();
});

const ui = { tab: 'regs', area: 'all', q: '', status: 'visible', sort: 'date', clusterOn: false, eps: 500 };
let data = null;
let mapState = null;

const token = () => tokenFrom(session, ADMIN_KEY);

function signOut() {
  session.del(ADMIN_KEY);
  data = null;
  renderGate();
}
signoutBtn.addEventListener('click', signOut);

async function call(path, opts = {}) {
  try {
    return await api(path, { token: token(), ...opts });
  } catch (err) {
    if (err.status === 401) {
      signOut();
      throw new Error(t('Admin session ended. Please sign in again.'));
    }
    throw err;
  }
}

const REASON = {
  same_phone: 'Same phone number',
  same_student_same_area: 'Same student name in the same area',
  same_parent_same_area: 'Same parent name in the same area',
  same_location_same_family: 'Pins within 30 m and same family details',
  outside_egypt: 'Pickup point is outside Egypt',
};
const reasonText = (r) => (REASON[r] ? t(REASON[r]) : r);
const STATUS_BADGE = {
  get active() { return `<span class="sj-badge sj-badge-ok">${tt('Active')}</span>`; },
  get hidden() { return `<span class="sj-badge sj-badge-warn">${tt('Hidden')}</span>`; },
  get deleted() { return `<span class="sj-badge sj-badge-danger">${tt('Deleted')}</span>`; },
};
const statusText = (s) => t({ active: 'Active', hidden: 'Hidden', deleted: 'Deleted' }[s] || s);
const actorText = (a) => t({ parent: 'Parent', admin: 'Admin', system: 'System' }[a] || a);
const yesNo = (v) => t(v ? 'Yes' : 'No');

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

function renderGate() {
  signoutBtn.hidden = true;
  app.innerHTML = `
    <div class="sj-gate"><form class="sj-card" autocomplete="off">
      <h1>${tt('Registration admin')}</h1>
      <p>${tt("Administrator access only. This password is separate from the parents' access password.")}</p>
      <div class="sj-field"><label for="pw">${tt('Admin password')}</label>
        <input id="pw" type="password" autocomplete="current-password" required autofocus dir="ltr"></div>
      <button class="sj-btn sj-btn-primary sj-btn-block" type="submit">${tt('Sign in')}</button>
      <div class="sj-err" role="alert"></div>
    </form></div>`;
  const form = app.querySelector('form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button');
    const err = form.querySelector('.sj-err');
    err.textContent = '';
    btn.disabled = true;
    btn.innerHTML = '<span class="sj-spin"></span>';
    try {
      session.set(ADMIN_KEY, await api('/auth/admin', { method: 'POST', body: { password: form.pw.value } }));
      await load();
    } catch (ex) {
      err.textContent = t(ex.message);
      btn.disabled = false;
      btn.textContent = t('Sign in');
    }
  });
}

// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------

async function load() {
  app.innerHTML = `<div class="sj-loading">${tt('Loading…')}</div>`;
  try {
    data = await call('/admin/overview?deleted=1');
    renderDashboard();
  } catch (err) {
    if (!token()) return;
    app.innerHTML = `<div class="sj-empty" style="margin-top:24px"><p>${tt(err.message)}</p><button class="sj-btn" data-retry>${tt('Try again')}</button></div>`;
    app.querySelector('[data-retry]').addEventListener('click', load);
  }
}

async function refresh() {
  data = await call('/admin/overview?deleted=1');
  renderDashboard();
}

const activeRows = () => data.rows.filter((r) => r.status === 'active');
const inArea = (r) => ui.area === 'all' || r.area_id === ui.area;
const hasPin = (r) => typeof r.latitude === 'number' && typeof r.longitude === 'number';
const listedAreas = () => data.areas.filter((a) => a.is_listed && !a.merged_into_id);
const areaName = (id) => data.areas.find((a) => a.id === id)?.name || '—';

function openPairs(flags) {
  const groups = new Map();
  for (const f of flags) {
    const codes = [f.registration?.code, f.related?.code].filter(Boolean).sort();
    const key = `${f.resolved_at ? 'r' : 'o'}|${f.kind}|${codes.join('|')}`;
    if (!groups.has(key)) groups.set(key, { key, kind: f.kind, resolved: !!f.resolved_at, a: f.registration, b: f.related, flags: [] });
    groups.get(key).flags.push(f);
  }
  return [...groups.values()];
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

function renderDashboard() {
  signoutBtn.hidden = false;
  const act = activeRows();
  const withPin = act.filter(hasPin).length;
  const areasRepresented = new Set(act.map((r) => r.area_id)).size;
  const dupPairs = openPairs(data.flags.filter((f) => !f.resolved_at)).length;
  const removals = data.rows.filter((r) => r.removal_requested_at && r.status !== 'deleted').length;
  const card = (k, v, extra = '', goto = '') => goto
    ? `<button type="button" class="sj-stat sj-stat-link ${extra}" data-goto="${goto}"><div class="k">${k} →</div><div class="v">${v}</div></button>`
    : `<div class="sj-stat ${extra}"><div class="k">${k}</div><div class="v">${v}</div></div>`;
  app.innerHTML = `
    <section class="sj-hero"><h1>${tt('SJAS Bus Registration')}<small>${tt('Administrator dashboard')}</small></h1>
      <p>${tt('Counts include active registrations only.')} <b>${tt('Confidential:')}</b> ${tt("contains children's pickup locations.")}</p></section>
    <section class="sj-stats" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">
      ${card(tt('Families registered'), num(act.length), 'sj-stat-total')}
      ${card(tt('Students registered'), num(act.reduce((n, r) => n + r.student_count, 0)), 'sj-stat-total')}
      ${card(tt('Areas represented'), num(areasRepresented), '', 'areas')}
      ${card(tt('With pickup coordinates'), num(withPin), '', 'map')}
      ${card(tt('Missing coordinates'), num(act.length - withPin), act.length - withPin ? 'sj-stat-warn' : '', 'regs-missing')}
      ${card(tt('Possible duplicates'), num(dupPairs), dupPairs ? 'sj-stat-warn' : '', 'dups')}
      ${card(tt('Removal requests'), num(removals), removals ? 'sj-stat-warn' : '', 'removals')}
    </section>
    <div class="sj-actions">
      <button type="button" class="sj-btn sj-btn-primary" data-excel>⬇ ${tt('Export Excel')}</button>
      <button type="button" class="sj-btn" data-reload>↻ ${tt('Refresh')}</button>
      <a class="sj-btn" href="/sjasbusregistration/" target="_blank" rel="noopener">${tt("Open parents' page")}</a>
    </div>
    <div class="sj-toolbar" style="align-items:center">
      <label class="sj-label" for="area-filter" style="margin:0">${tt('Area')}</label>
      <select id="area-filter" style="flex:0 1 260px">
        <option value="all">${tt('All areas')}</option>
        ${data.areas.filter((a) => !a.merged_into_id).map((a) => `<option value="${esc(a.id)}">${esc(a.name)}${a.is_listed ? '' : ` (${tt('not approved')})`}</option>`).join('')}
      </select>
      <span class="rg-maptotal" data-areatotal></span>
    </div>
    <div class="sj-tabs" role="tablist">
      ${[['regs', tt('Registrations')], ['map', tt('Map')], ['buses', tt('Buses')], ['routes', tt('Routes')], ['areas', tt('Areas')], ['dups', `${tt('Duplicates')}${dupPairs ? ` <span class="sj-badge sj-badge-warn">${dupPairs}</span>` : ''}`], ['removals', `${tt('Removal requests')}${removals ? ` <span class="sj-badge sj-badge-danger">${removals}</span>` : ''}`]]
        .map(([k, label]) => `<button class="sj-tab" role="tab" data-tab="${k}" aria-selected="${ui.tab === k}">${label}</button>`).join('')}
    </div>
    <div id="rg-panel"></div>
    <p class="sj-foot">${tt('Updated {time}', { time: fmtDateTime(data.generated_at) })} · <button type="button" class="sj-linkbtn" data-settings>${tt('Route & assignment settings')}</button></p>`;
  app.querySelector('[data-settings]').addEventListener('click', () => switchTab('settings'));

  const areaSel = app.querySelector('#area-filter');
  areaSel.value = data.areas.some((a) => a.id === ui.area) ? ui.area : 'all';
  areaSel.addEventListener('change', () => { ui.area = areaSel.value; updateAreaTotal(); renderPanel(); });
  app.querySelector('.sj-tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (tab) switchTab(tab.dataset.tab);
  });
  app.querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.goto === 'regs-missing') { ui.status = 'missing'; switchTab('regs'); } else switchTab(b.dataset.goto);
  }));
  app.querySelector('[data-excel]').addEventListener('click', exportExcel);
  app.querySelector('[data-reload]').addEventListener('click', () => refresh().then(() => toast(t('Refreshed'))).catch((e) => toast(t(e.message))));
  updateAreaTotal();
  renderPanel();
}

function updateAreaTotal() {
  const rows = activeRows().filter(inArea);
  app.querySelector('[data-areatotal]').textContent = t('{f} families · {s} students', { f: num(rows.length), s: num(rows.reduce((n, r) => n + r.student_count, 0)) });
}

function switchTab(tab) {
  ui.tab = tab;
  app.querySelectorAll('.sj-tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  renderPanel();
  document.getElementById('rg-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderPanel() {
  const panel = document.getElementById('rg-panel');
  panel.onclick = null;
  if (mapState) { mapState.map.remove(); mapState = null; }
  cleanupFleet();
  if (ui.tab === 'map') return renderMap(panel);
  if (ui.tab === 'buses') return renderBuses(panel);
  if (ui.tab === 'routes') return renderRoutes(panel);
  if (ui.tab === 'settings') return renderSettings(panel);
  if (ui.tab === 'areas') return renderAreas(panel);
  if (ui.tab === 'dups') return renderDups(panel);
  if (ui.tab === 'removals') return renderRemovals(panel);
  renderRegs(panel);
}

// ---------------------------------------------------------------------------
// Registrations table
// ---------------------------------------------------------------------------

function renderRegs(panel) {
  panel.innerHTML = `
    <div class="sj-toolbar">
      <div class="sj-search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input type="search" placeholder="${tt('Search ID, parent, student, phone')}" value="${esc(ui.q)}" aria-label="${tt('Search')}"></div>
      <select data-status aria-label="${tt('Status')}">
        <option value="visible">${tt('Active + hidden')}</option><option value="active">${tt('Active')}</option><option value="hidden">${tt('Hidden')}</option>
        <option value="deleted">${tt('Deleted')}</option><option value="missing">${tt('Missing coordinates')}</option><option value="all">${tt('All')}</option>
      </select>
      <select data-sort aria-label="${tt('Sort')}">
        <option value="date">${tt('Registration date (oldest first)')}</option><option value="date_desc">${tt('Registration date (newest first)')}</option>
        <option value="area">${tt('Area')}</option><option value="parent">${tt('Parent A–Z')}</option><option value="updated">${tt('Last updated')}</option>
      </select>
    </div>
    <div data-list></div>`;
  const q = panel.querySelector('input');
  const st = panel.querySelector('[data-status]');
  const so = panel.querySelector('[data-sort]');
  st.value = ui.status;
  so.value = ui.sort;
  q.addEventListener('input', () => { ui.q = q.value; renderRegList(panel); });
  st.addEventListener('change', () => { ui.status = st.value; renderRegList(panel); });
  so.addEventListener('change', () => { ui.sort = so.value; renderRegList(panel); });
  renderRegList(panel);
}

function renderRegList(panel) {
  const q = ui.q.trim().toLowerCase();
  const qDigits = q.replace(/\D/g, '');
  const openFlagCodes = new Set(data.flags.filter((f) => !f.resolved_at).flatMap((f) => [f.registration?.code, f.related?.code]).filter(Boolean));
  let rows = data.rows.filter(inArea).filter((r) => {
    switch (ui.status) {
      case 'visible': return r.status !== 'deleted';
      case 'missing': return r.status === 'active' && !hasPin(r);
      case 'all': return true;
      default: return r.status === ui.status;
    }
  });
  if (q) {
    rows = rows.filter((r) => [r.registration_code, r.parent_name, ...(r.student_names || [])].join(' ').toLowerCase().includes(q)
      || (qDigits.length >= 3 && String(r.phone).replace(/\D/g, '').includes(qDigits)));
  }
  const sorts = {
    date: (a, b) => a.registration_number - b.registration_number,
    date_desc: (a, b) => b.registration_number - a.registration_number,
    area: (a, b) => String(a.area_name).localeCompare(String(b.area_name)) || a.registration_number - b.registration_number,
    parent: (a, b) => a.parent_name.localeCompare(b.parent_name),
    updated: (a, b) => new Date(b.updated_at) - new Date(a.updated_at),
  };
  rows.sort(sorts[ui.sort] || sorts.date);
  panel.querySelector('[data-list]').innerHTML = rows.length ? `
    <div class="sj-tablewrap"><table class="sj-table">
      <thead><tr><th>${tt('ID')}</th><th>${tt('Parent')}</th><th>${tt('Phone')}</th><th>${tt('Students')}</th><th class="r">${tt('Count')}</th><th>${tt('Area')}</th><th>${tt('Location')}</th><th>${tt('Submitted')}</th><th>${tt('Updated')}</th></tr></thead>
      <tbody>${rows.map((r) => `<tr class="sj-clickable" tabindex="0" data-open="${esc(r.registration_code)}">
        <td class="sj-code">${esc(r.registration_code)}${r.status !== 'active' ? `<span class="sj-sub">${STATUS_BADGE[r.status]}</span>` : ''}</td>
        <td class="sj-parent">${esc(r.parent_name)}
          ${openFlagCodes.has(r.registration_code) ? `<span class="sj-sub"><span class="sj-badge sj-badge-warn">⚑ ${tt('possible duplicate')}</span></span>` : ''}
          ${r.removal_requested_at ? `<span class="sj-sub"><span class="sj-badge sj-badge-danger">${tt('Removal requested')}</span></span>` : ''}</td>
        <td class="sj-num"><a href="tel:${esc(r.phone)}" dir="ltr">${esc(r.phone)}</a></td>
        <td>${r.students.map((s) => esc(s.name) + (s.grade ? ` <span class="sj-muted">(${esc(s.grade)})</span>` : '')).join('<br>')}</td>
        <td class="r sj-num">${r.student_count}</td>
        <td>${esc(r.area_name)}${r.area_listed ? '' : ` <span class="sj-badge sj-badge-warn">${tt('new')}</span>`}</td>
        <td>${hasPin(r) ? `<span class="sj-badge sj-badge-ok">✓ ${tt('pin')}</span>${r.far_confirmed ? ` <span class="sj-badge sj-badge-warn">${tt('far')}</span>` : ''}<span class="sj-sub">${tt(r.location_source || '')}${r.location_accuracy_m ? ` ±${Math.round(r.location_accuracy_m)} ${tt('m')}` : ''}</span>` : `<span class="sj-badge sj-badge-danger">${tt('missing')}</span>`}</td>
        <td class="sj-num">${esc(fmtDate(r.created_at))}</td>
        <td class="sj-num">${esc(fmtDateTime(r.updated_at))}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="4" class="sj-totallabel">${tt('{n} registrations shown', { n: rows.length })}</td><td class="r sj-num">${num(rows.reduce((n, r) => n + r.student_count, 0))}</td><td colspan="4"></td></tr></tfoot>
    </table></div>` : `<div class="sj-empty">${tt('No registrations match.')}</div>`;
  panel.querySelectorAll('[data-open]').forEach((tr) => {
    tr.addEventListener('click', (e) => { if (!e.target.closest('a')) openDetail(tr.dataset.open); });
    tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') openDetail(tr.dataset.open); });
  });
}

// ---------------------------------------------------------------------------
// Map + demand clusters
// ---------------------------------------------------------------------------

function popupHtml(r) {
  const lat = r.latitude, lng = r.longitude;
  return `<div class="rg-popup">
    <b>${esc(r.registration_code)} · ${esc(r.parent_name)}</b><br>
    📞 <a href="tel:${esc(r.phone)}" dir="ltr">${esc(r.phone)}</a><br>
    ${r.students.map((s) => esc(s.name) + (s.grade ? ` (${esc(s.grade)})` : '')).join(', ')} — ${tt(r.student_count === 1 ? '1 student' : '{n} students', { n: r.student_count })}<br>
    ${tt('Area')}: ${esc(r.area_name)}<br>
    ${[r.building, r.street, r.landmark].filter(Boolean).map(esc).join(' · ') || `<span style="color:#667085">${tt('No address details')}</span>`}
    ${r.pickup_notes ? `<br>${tt('Notes')}: ${esc(r.pickup_notes)}` : ''}
    <br><span style="color:#667085">${lat.toFixed(6)}, ${lng.toFixed(6)}</span>
    <div class="acts">
      <a href="tel:${esc(r.phone)}">${tt('Call')}</a>
      <a href="${esc(googleMapsUrl(lat, lng))}" target="_blank" rel="noopener noreferrer">Google Maps</a>
      <a href="${esc(appleMapsUrl(lat, lng))}" target="_blank" rel="noopener noreferrer">Apple Maps</a>
      <button type="button" data-copy="${lat.toFixed(6)}, ${lng.toFixed(6)}">${tt('Copy coordinates')}</button>
      <button type="button" data-open="${esc(r.registration_code)}">${tt('Edit')}</button>
    </div></div>`;
}

async function renderMap(panel) {
  const rows = activeRows().filter(inArea).filter(hasPin);
  panel.innerHTML = `
    <div class="rg-maptools">
      <label><input type="checkbox" data-cl ${ui.clusterOn ? 'checked' : ''}> ${tt('Show demand clusters')}</label>
      <label>${tt('Distance')} <select data-eps>${[300, 500, 800, 1200].map((m) => `<option value="${m}" ${ui.eps === m ? 'selected' : ''}>${m >= 1000 ? `${m / 1000} ${tt('km')}` : `${m} ${tt('m')}`}</option>`).join('')}</select></label>
      <span class="sj-muted sj-small">${tt('{n} pins shown', { n: num(rows.length) })}${ui.area !== 'all' ? ` — ${esc(areaName(ui.area))}` : ''}</span>
    </div>
    <div class="rg-adminmap"></div>
    <div data-clusters></div>`;
  panel.querySelector('[data-cl]').addEventListener('change', (e) => { ui.clusterOn = e.target.checked; renderPanel(); });
  panel.querySelector('[data-eps]').addEventListener('change', (e) => { ui.eps = Number(e.target.value); ui.clusterOn = true; renderPanel(); });

  let L;
  try {
    L = await loadMarkerCluster();
  } catch {
    panel.querySelector('.rg-adminmap').innerHTML = `<div class="sj-empty">${tt('The map could not be loaded.')}</div>`;
    return;
  }
  if (ui.tab !== 'map' || !panel.isConnected) return;
  const map = L.map(panel.querySelector('.rg-adminmap')).setView([30.06, 31.42], 11);
  addTiles(L, map);
  mapState = { map };
  const bounds = [];

  const dot = (r, color, ring) => L.marker([r.latitude, r.longitude], {
    icon: L.divIcon({
      className: '',
      html: `<div class="rg-dot" style="background:${color};width:${22 + Math.min(r.student_count, 5) * 3}px;height:${22 + Math.min(r.student_count, 5) * 3}px;${ring ? 'outline:3px solid #b42318;' : ''}">${r.student_count}</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    }),
    title: `${r.registration_code} · ${r.parent_name}`,
  }).bindPopup(popupHtml(r));

  const clustersEl = panel.querySelector('[data-clusters]');
  if (!ui.clusterOn) {
    const group = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 50 });
    for (const r of rows) { group.addLayer(dot(r, '#0e7490', false)); bounds.push([r.latitude, r.longitude]); }
    map.addLayer(group);
    clustersEl.innerHTML = `<p class="sj-help">${tt('Tip: turn on "Show demand clusters" to group nearby pickup points by real distance.')}</p>`;
  } else {
    const res = summarise(rows, ui.eps);
    for (const c of res.clusters) {
      const mismatch = new Set(ui.area === 'all' ? c.mismatches.map((r) => r.registration_code) : []);
      for (const r of c.rows) { dot(r, c.color, mismatch.has(r.registration_code)).addTo(map); bounds.push([r.latitude, r.longitude]); }
      const h = hull(c.rows.map((r) => ({ lat: r.latitude, lng: r.longitude })));
      if (h.length >= 3) L.polygon(h, { color: c.color, weight: 2, fillOpacity: 0.08, interactive: false }).addTo(map);
      L.marker([c.center.lat, c.center.lng], {
        icon: L.divIcon({ className: '', html: `<div class="rg-centroid" style="background:${c.color}">${c.name} · ${c.students}</div>`, iconSize: [60, 20], iconAnchor: [30, 10] }),
        interactive: false,
      }).addTo(map);
    }
    for (const r of res.isolated.rows) { dot(r, '#667085', false).addTo(map); bounds.push([r.latitude, r.longitude]); }
    const big = res.clusters.some((c) => c.share > 0.4 && res.clusters.length + res.isolated.families > 3);
    clustersEl.innerHTML = `
      ${big ? `<div class="sj-note sj-note-warn">${tt('One cluster contains a large share of the families. Try a smaller clustering distance for more detailed grouping.')}</div>` : ''}
      <div class="rg-clusters">
        ${res.clusters.map((c, i) => `<button type="button" class="rg-cluster" style="--c:${c.color}" data-ci="${i}">
          <b>${tt('Cluster {name}', { name: c.name })}</b>${tt('{f} families · {s} students', { f: num(c.families), s: num(c.students) })}<br>
          <span class="sj-muted sj-small">${tt('Mostly {area}', { area: c.dominantArea })}</span>
          ${ui.area === 'all' && c.mismatches.length ? `<br><span class="sj-badge sj-badge-warn">${tt('{n} area mismatch(es)', { n: c.mismatches.length })}</span>` : ''}</button>`).join('')}
        <div class="rg-cluster" style="--c:#667085;cursor:default"><b>${tt('Isolated')}</b>${tt('{f} families · {s} students', { f: num(res.isolated.families), s: num(res.isolated.students) })}<br>
          <span class="sj-muted sj-small">${tt('Not within {m} m of 2+ other families', { m: ui.eps })}</span></div>
      </div>
      <p class="sj-help">${tt("Clusters use the actual pins, not the typed area. Red rings = family's chosen area differs from their cluster's main area. Nothing is saved or assigned.")}</p>`;
    clustersEl.onclick = (e) => {
      const b = e.target.closest('[data-ci]');
      if (!b) return;
      const c = res.clusters[Number(b.dataset.ci)];
      map.fitBounds(c.rows.map((r) => [r.latitude, r.longitude]), { padding: [40, 40], maxZoom: 17 });
    };
  }
  if (bounds.length) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
  setTimeout(() => map.invalidateSize(), 100);

  map.on('popupopen', (e) => {
    const el = e.popup.getElement();
    el.querySelector('[data-copy]')?.addEventListener('click', async (ev) => toast(t((await copyText(ev.target.dataset.copy)) ? 'Coordinates copied' : 'Could not copy')));
    el.querySelector('[data-open]')?.addEventListener('click', (ev) => openDetail(ev.target.dataset.open));
  });
}

// ---------------------------------------------------------------------------
// Areas
// ---------------------------------------------------------------------------

function renderAreas(panel) {
  const act = activeRows();
  const stats = new Map();
  for (const r of act) {
    const s = stats.get(r.area_id) || { families: 0, students: 0, pin: 0 };
    s.families++; s.students += r.student_count; if (hasPin(r)) s.pin++;
    stats.set(r.area_id, s);
  }
  const areas = data.areas.filter((a) => !a.merged_into_id)
    .map((a) => ({ ...a, ...(stats.get(a.id) || { families: 0, students: 0, pin: 0 }) }))
    .sort((a, b) => b.students - a.students || a.name.localeCompare(b.name));
  const merged = data.areas.filter((a) => a.merged_into_id);
  panel.innerHTML = `
    <div class="sj-inline" style="margin-bottom:10px;flex-wrap:wrap"><button type="button" class="sj-btn sj-btn-sm" data-add>+ ${tt('Add area')}</button>
      <span class="sj-help" style="margin:0">${tt('Parents see approved areas in their list. Areas typed by parents stay "not approved" until you approve or merge them.')}</span></div>
    <div class="sj-tablewrap"><table class="sj-table">
      <thead><tr><th>${tt('Area')}</th><th class="r">${tt('Families')}</th><th class="r">${tt('Students')}</th><th class="r">${tt('With pin')}</th><th class="r">${tt('Missing pin')}</th><th>${tt('Status')}</th><th>${tt('Actions')}</th></tr></thead>
      <tbody>${areas.map((a) => `<tr>
        <td class="sj-parent"><button type="button" class="sj-linkbtn" data-filter="${esc(a.id)}">${esc(a.name)}</button><span class="sj-sub">${tt('added by {who}', { who: t({ seed: 'setup', parent: 'parent', admin: 'admin' }[a.created_by] || a.created_by) })}</span></td>
        <td class="r sj-num">${num(a.families)}</td><td class="r sj-num">${num(a.students)}</td>
        <td class="r sj-num">${num(a.pin)}</td><td class="r sj-num">${a.families - a.pin ? `<b style="color:var(--danger)">${a.families - a.pin}</b>` : 0}</td>
        <td>${a.is_listed ? `<span class="sj-badge sj-badge-ok">${tt('Approved')}</span>` : `<span class="sj-badge sj-badge-warn">${tt('Not approved')}</span>`}</td>
        <td><div class="sj-inline" style="flex-wrap:wrap">
          <button type="button" class="sj-btn sj-btn-sm" data-act="${a.is_listed ? 'unlist' : 'list'}" data-id="${esc(a.id)}">${tt(a.is_listed ? 'Hide from list' : 'Approve')}</button>
          <button type="button" class="sj-btn sj-btn-sm" data-act="rename" data-id="${esc(a.id)}">${tt('Rename')}</button>
          <button type="button" class="sj-btn sj-btn-sm" data-act="merge" data-id="${esc(a.id)}">${tt('Merge into…')}</button></div></td></tr>`).join('')}</tbody>
      <tfoot><tr><td class="sj-totallabel">${tt('TOTAL')}</td><td class="r sj-num">${num(act.length)}</td><td class="r sj-num">${num(act.reduce((n, r) => n + r.student_count, 0))}</td><td colspan="4"></td></tr></tfoot>
    </table></div>
    ${merged.length ? `<p class="sj-help">${tt('Merged:')} ${merged.map((m) => `${esc(m.name)} → ${esc(areaName(m.merged_into_id))}`).join(' · ')}</p>` : ''}`;
  panel.onclick = async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.filter) {
      ui.area = b.dataset.filter;
      app.querySelector('#area-filter').value = ui.area;
      updateAreaTotal();
      return switchTab('map');
    }
    try {
      if (b.dataset.add !== undefined) {
        const name = prompt(t('New area name (shown to parents):'));
        if (!name) return;
        await call('/admin/areas', { method: 'POST', body: { action: 'create', name } });
      } else if (b.dataset.act === 'rename') {
        const name = prompt(t('New name for this area:'), areaName(b.dataset.id));
        if (!name) return;
        await call(`/admin/areas/${b.dataset.id}`, { method: 'POST', body: { action: 'rename', name } });
      } else if (b.dataset.act === 'merge') {
        const choices = data.areas.filter((a) => !a.merged_into_id && a.id !== b.dataset.id);
        const pick = prompt(`${t('Merge "{area}" into which area? Type the exact name:', { area: areaName(b.dataset.id) })}\n${choices.map((a) => `• ${a.name}`).join('\n')}`);
        if (!pick) return;
        const target = choices.find((a) => a.name.toLowerCase() === pick.trim().toLowerCase());
        if (!target) return toast(t('No area with that exact name.'));
        if (!confirm(t('Move every registration from "{from}" to "{to}"? Each change is recorded in the audit log.', { from: areaName(b.dataset.id), to: target.name }))) return;
        const res = await call(`/admin/areas/${b.dataset.id}`, { method: 'POST', body: { action: 'merge', target_id: target.id } });
        toast(t('Merged — {n} registration(s) moved', { n: res.moved }));
      } else if (b.dataset.act) {
        await call(`/admin/areas/${b.dataset.id}`, { method: 'POST', body: { action: b.dataset.act } });
      } else return;
      await refresh();
    } catch (err) { toast(t(err.message)); }
  };
}

// ---------------------------------------------------------------------------
// Duplicates / removal requests
// ---------------------------------------------------------------------------

function renderDups(panel) {
  const groups = openPairs(data.flags);
  const open = groups.filter((g) => !g.resolved);
  const done = groups.filter((g) => g.resolved);
  const card = (g) => `<div class="sj-flag ${g.resolved ? 'resolved' : ''}">
    <h4>⚑ ${tt(g.kind === 'location_outside_egypt' ? 'Pickup point outside Egypt' : 'Possible duplicate registration')}</h4>
    <ul style="margin:4px 0 0;padding-inline-start:20px">${g.flags.map((f) => `<li>${esc(reasonText(f.reason))}${f.detail?.student ? ` — “${esc(f.detail.student)}”` : ''}${f.detail?.distance_m != null ? ` (${tt('{m} m apart', { m: f.detail.distance_m })})` : ''}</li>`).join('')}</ul>
    <div class="sj-inline" style="flex-wrap:wrap">
      ${g.a ? `<button type="button" class="sj-btn sj-btn-sm" data-open="${esc(g.a.code)}">${esc(g.a.code)} · ${esc(g.a.parent_name)}</button>` : ''}
      ${g.b ? `<span class="sj-muted">↔</span><button type="button" class="sj-btn sj-btn-sm" data-open="${esc(g.b.code)}">${esc(g.b.code)} · ${esc(g.b.parent_name)}</button>` : ''}
    </div>
    <div class="sj-inline" style="flex-wrap:wrap">${g.resolved
      ? `<span class="sj-small sj-muted">${tt('Reviewed {time}', { time: fmtDateTime(g.flags[0].resolved_at) })}${g.flags[0].admin_note ? ` — ${esc(g.flags[0].admin_note)}` : ''}</span>`
      : `<input class="sj-input" style="flex:1;min-width:180px" placeholder="${tt('Note (optional)')}" data-note="${esc(g.key)}">
         <button type="button" class="sj-btn sj-btn-sm" data-resolve="${esc(g.key)}">${tt('Mark reviewed')}</button>`}</div></div>`;
  panel.innerHTML = `
    <p class="sj-help" style="margin-top:0">${tt('Warnings only — registrations are never blocked. Open both, hide the duplicate if it is one, then mark reviewed.')}</p>
    ${open.length ? open.map(card).join('') : `<div class="sj-empty">${tt('Nothing to review.')} 🎉</div>`}
    ${done.length ? `<details style="margin-top:16px"><summary class="sj-muted" style="cursor:pointer">${tt('Reviewed ({n})', { n: done.length })}</summary><div style="margin-top:10px">${done.map(card).join('')}</div></details>` : ''}`;
  panel.onclick = async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.open) return openDetail(b.dataset.open);
    const g = groups.find((x) => x.key === b.dataset.resolve);
    if (!g) return;
    b.disabled = true;
    try {
      const note = panel.querySelector(`[data-note="${CSS.escape(g.key)}"]`)?.value || '';
      for (const f of g.flags) await call(`/admin/flags/${f.id}`, { method: 'POST', body: { resolved: true, note } });
      await refresh();
    } catch (err) { toast(t(err.message)); b.disabled = false; }
  };
}

function renderRemovals(panel) {
  const rows = data.rows.filter((r) => r.removal_requested_at && r.status !== 'deleted');
  panel.innerHTML = rows.length ? rows.map((r) => `<div class="sj-flag">
    <h4>${tt('Remove')} ${esc(r.registration_code)} · ${esc(r.parent_name)}</h4>
    <div class="sj-small sj-muted">${tt('Requested {time} (verified with Edit PIN)', { time: fmtDateTime(r.removal_requested_at) })}</div>
    <div>${r.removal_reason ? `“${esc(r.removal_reason)}”` : `<span class="sj-muted">${tt('No reason given.')}</span>`}</div>
    <div class="sj-inline" style="flex-wrap:wrap">
      <button type="button" class="sj-btn sj-btn-sm" data-open="${esc(r.registration_code)}">${tt('Open')}</button>
      <button type="button" class="sj-btn sj-btn-sm" data-hide="${esc(r.registration_code)}">${tt('Hide registration')}</button>
      <button type="button" class="sj-btn sj-btn-sm sj-btn-ghost" data-dismiss="${esc(r.registration_code)}">${tt('Dismiss request')}</button>
    </div></div>`).join('') : `<div class="sj-empty">${tt('No open removal requests.')}</div>`;
  panel.onclick = async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    try {
      if (b.dataset.open) return openDetail(b.dataset.open);
      if (b.dataset.hide) {
        if (!confirm(t('Hide {code}? It will no longer count in totals. You can restore it later.', { code: b.dataset.hide }))) return;
        await call(`/admin/registration/${b.dataset.hide}/status`, { method: 'POST', body: { status: 'hidden' } });
      } else if (b.dataset.dismiss) {
        await call(`/admin/registration/${b.dataset.dismiss}/removal-dismiss`, { method: 'POST', body: {} });
      } else return;
      await refresh();
    } catch (err) { toast(t(err.message)); }
  };
}

// ---------------------------------------------------------------------------
// Registration detail
// ---------------------------------------------------------------------------

const fmtLoc = (v) => (v && v.latitude != null ? `${Number(v.latitude).toFixed(6)}, ${Number(v.longitude).toFixed(6)}` : '—');

const onOff = (v) => t(v ? 'on' : 'off');

function describeAudit(a) {
  const o = a.old_value, n = a.new_value;
  switch (a.action) {
    case 'create': return tt('Registered ({n} student(s), {area})', { n: (n?.students || []).length, area: n?.area || '' });
    case 'update': return tt('Details updated');
    case 'location_change': return `<b>${tt('Pickup moved')}${n?.moved_m != null ? ` ${num(n.moved_m)} ${tt('m')}` : ''}</b>: ${fmtLoc(o)} → ${fmtLoc(n)}`;
    case 'area_change': return `${tt('Area')}: ${esc(o)} → ${esc(n)}`;
    case 'area_renamed': return `${tt('Area renamed')}: ${esc(o)} → ${esc(n)}`;
    case 'area_merged': return `${tt('Area merged')}: ${esc(o)} → ${esc(n)}`;
    case 'phone_change': return `${tt('Phone')}: ${esc(o)} → ${esc(n)}`;
    case 'students_change': return `${tt('Students')}: ${esc((o || []).map((s) => s.name).join(', '))} → ${esc((n || []).map((s) => s.name).join(', '))}`;
    case 'status_change': return `${tt('Status')}: ${esc(statusText(o))} → ${esc(statusText(n))}`;
    case 'pin_reset': return tt('Edit PIN reset (old PIN and edit sessions stopped working)');
    case 'removal_requested': return `${tt('Parent requested removal')}${n?.reason ? `: “${esc(n.reason)}”` : ''}`;
    case 'removal_cancelled': return tt('Parent cancelled removal request');
    case 'removal_dismissed': return tt('Removal request dismissed');
    case 'admin_notes': return tt('Admin note updated');
    case 'sharing_change': return tt('Sharing with same-bus parents: pickup {p}, first name {f}, children {c}, phone {ph}', { p: onOff(n?.share_pickup), f: onOff(n?.share_parent_name), c: onOff(n?.share_student_names), ph: onOff(n?.share_phone) });
    case 'bus_assignment': return `${tt('Bus')}: ${esc(o || t('none'))} → ${esc(n?.bus || t('none'))}${n?.kind === 'bus_deleted' ? ` (${tt('bus deleted')})` : n?.kind === 'join' ? ` (${tt('joined automatically')})` : n?.reason ? ` (${esc(n.reason)})` : ''}`;
    case 'assignment_confirmed': return tt('Bus assignment confirmed after pickup move');
    case 'sessions_revoked': return tt('Parent signed out all devices');
    case 'flag_resolved': return tt('Duplicate warning reviewed');
    case 'flag_reopened': return tt('Duplicate warning reopened');
    default: return esc(a.action);
  }
}

async function openDetail(code) {
  const body = document.createElement('div');
  body.innerHTML = `<div class="sj-loading">${tt('Loading…')}</div>`;
  const modal = openModal(code, body, { wide: true });
  const reload = async () => {
    try {
      renderDetail(body, await call(`/admin/registration/${encodeURIComponent(code)}`), modal, reload);
    } catch (err) {
      body.innerHTML = `<div class="sj-note sj-note-err">${tt(err.message)}</div>`;
    }
  };
  await reload();
}

function renderDetail(body, d, modal, reload) {
  modal.setTitle(`${d.registration_code} · ${d.parent_name}`);
  const pin = hasPin(d);
  body.innerHTML = `
    <div class="sj-inline" style="flex-wrap:wrap;margin-bottom:12px">${STATUS_BADGE[d.status] || ''}
      ${d.removal_requested_at ? `<span class="sj-badge sj-badge-danger">${tt('Removal requested')}</span>` : ''}
      ${d.pin_locked_until && new Date(d.pin_locked_until) > new Date() ? `<span class="sj-badge sj-badge-warn">${tt('PIN locked')}</span>` : ''}</div>
    <div class="sj-inline" style="flex-wrap:wrap;margin-bottom:14px">
      <button type="button" class="sj-btn sj-btn-sm sj-btn-primary" data-act="edit">${tt('Edit registration')}</button>
      ${d.status === 'active' ? `<button type="button" class="sj-btn sj-btn-sm" data-act="hidden">${tt('Hide')}</button>` : `<button type="button" class="sj-btn sj-btn-sm" data-act="active">${tt('Restore')}</button>`}
      ${d.status !== 'deleted' ? `<button type="button" class="sj-btn sj-btn-sm sj-btn-danger" data-act="deleted">${tt('Delete')}</button>` : ''}
      <button type="button" class="sj-btn sj-btn-sm" data-act="pin">${tt('Reset edit PIN')}</button>
      ${d.removal_requested_at ? `<button type="button" class="sj-btn sj-btn-sm sj-btn-ghost" data-act="dismiss">${tt('Dismiss removal request')}</button>` : ''}
    </div>
    ${d.removal_requested_at ? `<div class="sj-note sj-note-warn"><b>${tt('Removal requested {time}', { time: fmtDateTime(d.removal_requested_at) })}</b>${d.removal_reason ? esc(d.removal_reason) : tt('No reason given.')}</div>` : ''}
    <dl class="sj-kv">
      <dt>${tt('Parent')}</dt><dd><b>${esc(d.parent_name)}</b></dd>
      <dt>${tt('Phone')}</dt><dd><a href="tel:${esc(d.phone)}" dir="ltr">${esc(d.phone)}</a></dd>
      <dt>${tt('Students ({n})', { n: d.student_count })}</dt><dd>${d.students.map((s) => esc(s.name) + (s.grade ? ` <span class="sj-muted">(${esc(s.grade)})</span>` : '')).join('<br>')}</dd>
      <dt>${tt('Area')}</dt><dd>${esc(d.area_name)}${d.area_entered !== d.area_name ? ` <span class="sj-muted">(${tt('entered as “{name}”', { name: d.area_entered })})</span>` : ''}</dd>
      <dt>${tt('Address')}</dt><dd>${[d.building, d.street, d.landmark].filter(Boolean).map(esc).join(' · ') || '—'}</dd>
      <dt>${tt('Pickup notes')}</dt><dd>${d.pickup_notes ? esc(d.pickup_notes) : '—'}</dd>
      <dt>${tt('Shared with same-bus parents')}</dt><dd>${[['share_pickup', 'pickup point'], ['share_parent_name', 'first name'], ['share_student_names', "children's first names"], ['share_phone', 'phone']].map(([k, l]) => `${d[k] ? '✓' : '✗'} ${tt(l)}`).join(' · ')}${d.sharing_prompt_pending ? ` <span class="sj-badge sj-badge-warn">${tt('not yet reviewed by parent')}</span>` : ''}<br><span class="sj-muted sj-small">${tt('Parent-to-parent only. Driver sheets always include what is needed to run the bus.')}</span></dd>
      <dt>${tt('Pickup point')}</dt><dd>${pin ? `<span dir="ltr">${d.latitude.toFixed(6)}, ${d.longitude.toFixed(6)}</span> · ${tt(d.location_source || '')}${d.location_accuracy_m ? ` ±${Math.round(d.location_accuracy_m)} ${tt('m')}` : ''}${d.far_confirmed ? ` · <span class="sj-badge sj-badge-warn">${tt('far — confirmed by parent')}</span>` : ''}
        <br><a href="${esc(googleMapsUrl(d.latitude, d.longitude))}" target="_blank" rel="noopener noreferrer">Google Maps</a> · <a href="${esc(appleMapsUrl(d.latitude, d.longitude))}" target="_blank" rel="noopener noreferrer">Apple Maps</a>` : `<span class="sj-badge sj-badge-danger">${tt('missing')}</span>`}</dd>
      <dt>${tt('Registered')}</dt><dd>${esc(fmtDateTime(d.created_at))}</dd>
      <dt>${tt('Last updated')}</dt><dd>${esc(fmtDateTime(d.updated_at))}</dd>
    </dl>
    ${pin ? '<div class="rg-preview" style="height:220px"></div>' : ''}
    <div class="sj-section"><h3>${tt('Admin note')} <span class="sj-opt">(${tt('internal')})</span></h3>
      <textarea class="sj-input" data-notes maxlength="4000">${esc(d.admin_notes || '')}</textarea>
      <div style="margin-top:8px"><button type="button" class="sj-btn sj-btn-sm" data-act="notes">${tt('Save note')}</button></div></div>
    ${d.flags.length ? `<div class="sj-section"><h3>${tt('Warnings')}</h3>${d.flags.map((f) => `<div class="sj-flag ${f.resolved_at ? 'resolved' : ''}">
      <h4>⚑ ${esc(reasonText(f.reason))}</h4>
      ${[f.registration, f.related].filter((x) => x && x.code !== d.registration_code).map((x) => `<div class="sj-small">${tt('Other registration:')} <b>${esc(x.code)}</b> · ${esc(x.parent_name)}</div>`).join('')}
      ${f.resolved_at ? `<div class="sj-small sj-muted">${tt('Reviewed {time}', { time: fmtDateTime(f.resolved_at) })}</div>` : `<button type="button" class="sj-btn sj-btn-sm" data-flag="${esc(f.id)}">${tt('Mark reviewed')}</button>`}</div>`).join('')}</div>` : ''}
    <div class="sj-section"><h3>${tt('Audit history')}</h3>
      ${d.audit.length ? `<div class="sj-tablewrap"><table class="sj-table sj-audit"><thead><tr><th>${tt('When')}</th><th>${tt('By')}</th><th>${tt('Change')}</th></tr></thead>
        <tbody>${d.audit.map((a) => `<tr><td class="sj-num">${esc(fmtDateTime(a.created_at))}</td><td>${esc(actorText(a.actor))}</td><td>${describeAudit(a)}</td></tr>`).join('')}</tbody></table></div>` : `<p class="sj-muted">${tt('No entries.')}</p>`}
    </div>`;
  if (pin) renderPreview(body.querySelector('.rg-preview'), d).catch(() => {});

  body.onclick = async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    try {
      const code = d.registration_code;
      if (b.dataset.act === 'edit') return renderEdit(body, d, reload);
      if (['hidden', 'active', 'deleted'].includes(b.dataset.act)) {
        const msg = { hidden: 'Hide this registration? It will no longer count in totals.', active: 'Restore this registration?', deleted: 'Delete this registration? It is kept for the audit trail and can be restored.' }[b.dataset.act];
        if (!confirm(t(msg))) return;
        await call(`/admin/registration/${code}/status`, { method: 'POST', body: { status: b.dataset.act } });
      } else if (b.dataset.act === 'pin') {
        if (!confirm(t('Generate a new edit PIN? The old PIN and any open edit session stop working immediately.'))) return;
        const r = await call(`/admin/registration/${code}/reset-pin`, { method: 'POST', body: {} });
        alert(t('New edit PIN for {code}: {pin}\n\nGive it privately to the parent. It will not be shown again.', { code: r.registration_code, pin: r.pin }));
      } else if (b.dataset.act === 'dismiss') {
        await call(`/admin/registration/${code}/removal-dismiss`, { method: 'POST', body: {} });
      } else if (b.dataset.act === 'notes') {
        await call(`/admin/registration/${code}/notes`, { method: 'POST', body: { admin_notes: body.querySelector('[data-notes]').value } });
        toast(t('Note saved'));
      } else if (b.dataset.flag) {
        await call(`/admin/flags/${b.dataset.flag}`, { method: 'POST', body: { resolved: true } });
      } else return;
      await reload();
      refresh();
    } catch (err) { toast(t(err.message)); }
  };
}

function renderEdit(body, d, reload) {
  body.onclick = null;
  body.innerHTML = `<div class="sj-note sj-note-info" style="margin-top:0">${tt('Editing as administrator. Every change is recorded in the audit history, including old and new pickup coordinates.')}</div><div data-form></div>`;
  const areas = listedAreas();
  registrationForm(body.querySelector('[data-form]'), {
    mode: 'admin',
    initial: d,
    areas,
    onCancel: () => reload(),
    onSubmit: async (payload) => {
      await call(`/admin/registration/${d.registration_code}`, { method: 'POST', body: payload });
      toast(t('Saved'));
      await reload();
      refresh();
    },
  });
}

// ---------------------------------------------------------------------------
// Excel export
// ---------------------------------------------------------------------------

async function exportExcel(e) {
  const btn = e.currentTarget;
  const label = btn.textContent;
  btn.disabled = true;
  btn.innerHTML = `<span class="sj-spin"></span> ${tt('Preparing…')}`;
  try {
    const x = await call('/admin/export');
    const codeName = new Map(x.rows.map((r) => [r.registration_code, r.parent_name]));
    const H = (list) => list.map((h) => t(h));
    const flagKind = (k) => t(k === 'location_outside_egypt' ? 'Pickup point outside Egypt' : 'Possible duplicate registration');
    await downloadExcel(`SJAS-Bus-Registrations-${today()}.xlsx`, [
      {
        name: t('Registrations'),
        header: H(['Registration ID', 'Status', 'Parent', 'Phone', 'Student names', 'Student count', 'Grades', 'Area', 'Area (as entered)', 'Latitude', 'Longitude', 'Coordinates', 'Google Maps', 'Apple Maps', 'Location source', 'Accuracy (m)', 'Building/Villa/Compound', 'Street', 'Landmark', 'Pickup notes', 'Shares pickup (same bus)', 'Shares first name (same bus)', "Shares children's names (same bus)", 'Shares phone (same bus)', 'Removal requested', 'Admin notes', 'Created', 'Updated']),
        rows: x.rows.map((r) => {
          const pin = hasPin(r);
          return [r.registration_code, statusText(r.status), r.parent_name, r.phone, r.students.map((s) => s.name).join(', '), r.student_count, r.students.map((s) => s.grade || '').join(', '),
            r.area_name, r.area_entered, pin ? r.latitude : '', pin ? r.longitude : '', pin ? `${r.latitude.toFixed(6)}, ${r.longitude.toFixed(6)}` : '',
            pin ? googleMapsUrl(r.latitude, r.longitude) : '', pin ? appleMapsUrl(r.latitude, r.longitude) : '', t(r.location_source || ''), r.location_accuracy_m ?? '',
            r.building || '', r.street || '', r.landmark || '', r.pickup_notes || '', yesNo(r.share_pickup), yesNo(r.share_parent_name), yesNo(r.share_student_names), yesNo(r.share_phone), r.removal_requested_at ? fmtDateTime(r.removal_requested_at) : '', r.admin_notes || '',
            fmtDateTime(r.created_at), fmtDateTime(r.updated_at)];
        }),
        widths: [12, 9, 24, 16, 30, 8, 14, 16, 16, 11, 11, 22, 36, 40, 10, 10, 22, 18, 22, 28, 10, 10, 12, 10, 16, 24, 17, 17],
      },
      {
        name: t('Students'),
        header: H(['Registration ID', 'Status', 'Parent', 'Phone', 'Student', 'Grade/Class', 'Area']),
        rows: x.rows.flatMap((r) => r.students.map((s) => [r.registration_code, statusText(r.status), r.parent_name, r.phone, s.name, s.grade || '', r.area_name])),
        widths: [12, 9, 24, 16, 26, 12, 16],
      },
      {
        name: t('Areas'),
        header: H(['Area', 'Approved', 'Families (active)', 'Students (active)', 'With pin', 'Missing pin', 'Merged into']),
        rows: x.areas.map((a) => {
          const rs = x.rows.filter((r) => r.status === 'active' && r.area_id === a.id);
          return [a.name, yesNo(a.is_listed), rs.length, rs.reduce((n, r) => n + r.student_count, 0), rs.filter(hasPin).length, rs.filter((r) => !hasPin(r)).length,
            a.merged_into_id ? (x.areas.find((m) => m.id === a.merged_into_id)?.name || '') : ''];
        }),
        widths: [20, 9, 14, 14, 9, 11, 18],
      },
      {
        name: t('Duplicate warnings'),
        header: H(['Type', 'Reason', 'Registration', 'Parent', 'Related registration', 'Related parent', 'Raised', 'Reviewed', 'Note']),
        rows: x.flags.map((f) => [flagKind(f.kind), reasonText(f.reason), f.registration?.code || '', f.registration?.parent_name || '', f.related?.code || '', f.related?.parent_name || '',
          fmtDateTime(f.created_at), f.resolved_at ? fmtDateTime(f.resolved_at) : '', f.admin_note || '']),
        widths: [20, 36, 12, 22, 14, 22, 17, 17, 28],
      },
      {
        name: t('Audit log'),
        header: H(['When', 'Registration', 'Parent', 'By', 'Action', 'Field', 'Previous value', 'New value']),
        rows: x.audit.map((a) => [fmtDateTime(a.created_at), a.registration_code || '', codeName.get(a.registration_code) || '', actorText(a.actor), a.action, a.field || '',
          a.old_value == null ? '' : JSON.stringify(a.old_value), a.new_value == null ? '' : JSON.stringify(a.new_value)]),
        widths: [17, 12, 22, 8, 18, 10, 60, 60],
      },
    ], { banner: t('CONFIDENTIAL — CONTAINS CHILD PICKUP LOCATION DATA') });
  } catch (err) {
    toast(t(err.message));
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}

initFleet({
  call,
  getRows: () => data.rows,
  openDetail: (code) => openDetail(code),
  switchTab: (tab) => switchTab(tab),
  openDuplicatePairs: () => openPairs(data.flags.filter((f) => !f.resolved_at && f.kind === 'possible_duplicate')).length,
});

if (token()) load(); else renderGate();
