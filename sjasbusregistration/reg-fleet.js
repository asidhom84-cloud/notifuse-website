// SJAS Bus Registration — admin: fleet, bus assignment, routes, settings, driver sheets.

import { appleMapsUrl, distanceM, downloadExcel, esc, fmtDateTime, googleMapsUrl, num, openModal, toast, today } from './reg-common.js?v=15';
import { addTiles, loadLeaflet, openPicker, pinIcon } from './reg-map.js?v=15';
import { hull, PALETTE } from './reg-cluster.js?v=15';
import { autoAssign, suggestAreaBuses, targetSeats } from './reg-assign.js?v=15';
import { etaOffsets, googleDirectionsLinks, orderStops } from './reg-route.js?v=15';
import { t } from './reg-i18n.js?v=15';

let ctx = null;          // { call, getRows, openDetail, refreshAll }
let fleet = null;        // /admin/fleet payload
let preview = null;      // pending auto-assignment preview
let map = null;
const ui = { bus: 'all', routeBus: null };
let editing = null;      // route editor state

export function initFleet(context) { ctx = context; }
export function cleanupFleet() { killMap(); }

async function loadFleet() { fleet = await ctx.call('/admin/fleet'); return fleet; }
// Existing buses plus, while a fleet suggestion is previewed, the suggested new ones.
const allBuses = () => [...fleet.buses, ...(preview?.virtual || [])];
const busById = (id) => allBuses().find((b) => b.id === id);
const busColor = (id) => {
  const i = allBuses().findIndex((b) => b.id === id);
  return i < 0 ? '#98a2b3' : PALETTE[i % PALETTE.length];
};
const tt = (key, vars) => esc(t(key, vars));
const km = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} ${t('km')}` : `${Math.round(m)} ${t('m')}`);
const mins = (s) => `${Math.round(s / 60)} ${t('min')}`;
const students = (n) => t(n === 1 ? '1 student' : '{n} students', { n });

/** Server messages that carry values. */
function apiMsg(msg) {
  const m = /^Over capacity: bus (.+) would carry (\d+) students \(capacity (\d+)\)$/.exec(msg || '');
  return m ? t('Over capacity: {bus} would carry {n} students (capacity {c})', { bus: m[1], n: m[2], c: m[3] }) : t(msg);
}

/** Assignment reasons are stored in English; show them in the admin's language. */
function reasonLabel(r) {
  if (!r) return '';
  let m;
  if ((m = /^Joined automatically: same area, (\d+) m from nearest family on this bus$/.exec(r))) return t('Joined automatically: same area, {m} m from the nearest family on this bus', { m: m[1] });
  if ((m = /^Joined automatically: (\d+) m from nearest family on this bus$/.exec(r))) return t('Joined automatically: {m} m from the nearest family on this bus', { m: m[1] });
  if ((m = /^Area: (.*)$/.exec(r))) return t('Area: {area}', { area: m[1] });
  if ((m = /^Area bus \((.*)\)$/.exec(r))) return t('Area bus ({area})', { area: m[1] });
  if ((m = /^Cluster (\S+), part (\d+) of (\d+)$/.exec(r))) return t('Cluster {name}, part {i} of {n}', { name: m[1], i: m[2], n: m[3] });
  if ((m = /^Cluster (\S+)$/.exec(r))) return t('Cluster {name}', { name: m[1] });
  return t(r);
}
const families = () => ctx.getRows().filter((r) => r.status === 'active').map((r) => ({
  code: r.registration_code, parent: r.parent_name, lat: r.latitude, lng: r.longitude, students: r.student_count,
  area: r.area_name, area_id: r.area_id, has_pin: typeof r.latitude === 'number', row: r,
}));
const assignmentMap = () => new Map(fleet.assignments.map((a) => [a.registration_code, a]));
function killMap() { if (map) { map.remove(); map = null; } }

// ===========================================================================
// BUSES: fleet + assignment
// ===========================================================================

export async function renderBuses(panel) {
  killMap();
  panel.innerHTML = `<div class="sj-loading">${tt('Loading fleet…')}</div>`;
  try { await loadFleet(); } catch (e) { panel.innerHTML = `<div class="sj-note sj-note-err">${tt(e.message)}</div>`; return; }
  const fams = families();
  const amap = assignmentMap();
  const next = preview ? preview.next : null;
  const busOf = (code) => (preview?.area ? next.get(code)?.bus_id ?? amap.get(code)?.bus_id : next ? next.get(code)?.bus_id ?? (amap.get(code)?.locked || busById(amap.get(code)?.bus_id)?.assignments_locked ? amap.get(code)?.bus_id : null) : amap.get(code)?.bus_id) || null;
  const assigned = fams.filter((f) => amap.get(f.code));
  const needsReview = fleet.assignments.filter((a) => a.needs_review);
  const lastRun = fleet.runs.find((r) => !r.undone_at);
  const pct = fleet.settings.default_reserve_pct;

  const stats = preview ? new Map(preview.stats.map((s) => [s.bus_id, s])) : null;
  const card = (b) => {
    const s = stats?.get(b.id);
    const used = s ? s.students : b.students, famCount = s ? s.families : b.families;
    const free = b.capacity - used;
    const seatsLine = tt('{used} / {cap} students', { used: num(used), cap: num(b.capacity) });
    const route = fleet.routes.filter((r) => r.bus_id === b.id);
    const appr = route.find((r) => r.status === 'approved'), draft = route.find((r) => r.status === 'draft');
    if (b.virtual) {
      return `<div class="rg-cluster" style="--c:${busColor(b.id)};cursor:default;border-style:dashed">
      <b>${esc(b.bus_number)} <span class="sj-badge sj-badge-warn">${tt('suggested — not created yet')}</span></b>
      ${seatsLine} · <b style="display:inline">${tt('{n} free', { n: num(free) })}</b><br>
      <span class="sj-small sj-muted">${tt('{n} families', { n: num(famCount) })}${s?.areas ? ` · ${esc(s.areas)}` : ''}${s?.route_m ? ` · ${tt('route ~{d}', { d: km(s.route_m) })}` : ''}</span>
      ${s?.far ? `<br><span class="sj-small" style="color:var(--danger)">${tt('{n} family(ies) far from the others — check their area', { n: num(s.far) })}</span>` : ''}
      <div class="sj-inline" style="margin-top:6px"><button type="button" class="sj-btn sj-btn-sm sj-btn-primary" data-create-one="${esc(b.id)}">${tt('Create this bus')}</button>
        <button type="button" class="sj-btn sj-btn-sm" data-show-bus="${esc(b.id)}">${tt('Map')}</button></div></div>`;
    }
    return `<div class="rg-cluster" style="--c:${busColor(b.id)};cursor:default">
      <b>${esc(b.bus_number)}${b.active ? '' : ` <span class="sj-badge">${tt('inactive')}</span>`}${b.assignments_locked ? ' 🔒' : ''}</b>
      ${seatsLine} · <b style="display:inline;color:${free < 0 ? 'var(--danger)' : 'inherit'}">${tt('{n} free', { n: num(free) })}</b><br>
      <span class="sj-small sj-muted">${tt('{n} families', { n: num(famCount) })}${s?.spread_p90_m != null ? ` · ${tt('spread {d} (90%)', { d: km(s.spread_p90_m) })}` : ''}${targetSeats(b, pct) < b.capacity ? ` · ${tt('target {n}', { n: targetSeats(b, pct) })}` : ''}</span><br>
      <span class="sj-small">${appr ? `<span class="sj-badge ${appr.stale ? 'sj-badge-warn' : 'sj-badge-ok'}">${tt(appr.stale ? 'Route v{v} needs review' : 'Route v{v} approved', { v: appr.version })}</span>` : draft ? `<span class="sj-badge sj-badge-warn">${tt('Draft route v{v}', { v: draft.version })}</span>` : `<span class="sj-badge">${tt('No route')}</span>`}</span>
      <div class="sj-inline" style="margin-top:6px;flex-wrap:wrap">
        <button type="button" class="sj-btn sj-btn-sm sj-btn-primary" data-fams-bus="${esc(b.id)}">${tt('Families')}</button>
        <button type="button" class="sj-btn sj-btn-sm" data-edit-bus="${esc(b.id)}">${tt('Edit')}</button>
        <button type="button" class="sj-btn sj-btn-sm" data-lock-bus="${esc(b.id)}">${tt(b.assignments_locked ? 'Unlock' : 'Lock')}</button>
        <button type="button" class="sj-btn sj-btn-sm" data-show-bus="${esc(b.id)}">${tt('Map')}</button>
        <button type="button" class="sj-btn sj-btn-sm" data-route-bus="${esc(b.id)}">${tt('Route')}</button>
      </div></div>`;
  };

  panel.innerHTML = `
    <div class="sj-actions" style="margin-top:0">
      <button type="button" class="sj-btn" data-add-bus>+ ${tt('Add bus')}</button>
      ${preview
        ? `<button type="button" class="sj-btn sj-btn-primary" data-apply>${tt('Apply {n} change(s)', { n: num(preview.changes.length) })}</button><button type="button" class="sj-btn" data-cancel-preview>${tt('Discard preview')}</button>`
        : `<button type="button" class="sj-btn sj-btn-primary" data-auto ${fleet.buses.some((b) => b.active) ? '' : 'disabled'}>⚙ ${tt('Auto-assign (preview)')}</button>
           <button type="button" class="sj-btn" data-suggest>✨ ${tt('Suggest area buses ({n} seats each)', { n: num(fleet.settings.default_bus_capacity || 26) })}</button>`}
      ${lastRun && !preview ? `<button type="button" class="sj-btn" data-undo="${esc(lastRun.id)}">↶ ${tt('Undo last change ({time})', { time: fmtDateTime(lastRun.created_at) })}</button>` : ''}
    </div>
    ${preview?.area ? `<div class="sj-note sj-note-info"><b>${tt('Area bus suggestion — nothing is saved yet.')}</b>
      ${tt('One bus per area, not filled up: {n} new bus(es) of {seats} seats', { n: num(preview.virtual.length), seats: num(preview.virtual[0]?.capacity || fleet.settings.default_bus_capacity || 26) })}
      ${preview.stats.some((st) => st.joined) ? `· ${tt('{n} families join existing area buses', { n: num(preview.stats.reduce((n, st) => n + (st.joined || 0), 0)) })} ` : ''}·
      ${tt('{n} families placed.', { n: num(preview.summary.newly_assigned) })} ${tt('Duplicate spellings of the same place (pins close together) share one bus; an area splits only when it passes one bus.')}
      ${tt('Create buses one at a time (“Create this bus”) or all at once (“Apply”). Merging area names in the Areas tab makes this more precise.')}
      ${tt('After creating, new registrations from the same area join that bus automatically.')}</div>` : ''}
    ${preview && !preview.area ? `<div class="sj-note sj-note-info"><b>${tt('Preview — nothing is saved yet.')}</b>
      ${tt('{a} newly assigned · {m} moved · {u} unassigned ({s} students).', { a: num(preview.summary.newly_assigned), m: num(preview.summary.moved), u: num(preview.summary.unassigned), s: num(preview.summary.unassigned_students) })}
      ${tt('Locked families and locked buses are unchanged. No bus goes over its capacity.')}</div>` : ''}
    ${ctx.openDuplicatePairs() ? `<div class="sj-note sj-note-warn">${tt('{n} possible duplicate registration(s) are unresolved — they may use seats twice. Review them in the Duplicates tab first.', { n: ctx.openDuplicatePairs() })}</div>` : ''}
    <p class="sj-help" style="margin-top:0">${fleet.settings.auto_join_enabled
      ? tt("New registrations join a nearby bus automatically (a family within {near} m, or their area's bus within {area} m; seats permitting).", { near: num(fleet.settings.auto_join_max_m), area: num(fleet.settings.auto_join_area_max_m) })
      : tt('Automatic joining is off.')}
      ${tt('{a} of {n} families assigned · {np} without a pin · spare seats {pct}% · clustering {c} m', { a: num(assigned.length), n: num(fams.length), np: num(fams.filter((f) => !f.has_pin).length), pct, c: fleet.settings.cluster_distance_m })}</p>
    <div class="rg-clusters">${allBuses().map(card).join('') || `<div class="sj-empty">${tt('No buses yet. Add your fleet first.')}</div>`}</div>
    <div class="rg-maptools" style="margin-top:14px">
      <label>${tt('Show')} <select data-busfilter><option value="all">${tt('All buses')}</option><option value="none">${tt('Unassigned only')}</option>
        ${allBuses().map((b) => `<option value="${esc(b.id)}">${esc(b.bus_number)}</option>`).join('')}</select></label>
      <span class="sj-small sj-muted">${tt('Tap a family to move, lock or unassign it.')}</span>
    </div>
    <div class="rg-adminmap" style="height:56vh"></div>
    ${needsReview.length ? `<div class="sj-section"><h3>${tt('Needs review ({n}) — family moved its pickup point after assignment', { n: needsReview.length })}</h3>
      ${needsReview.map((a) => `<div class="sj-inline" style="margin-bottom:6px;flex-wrap:wrap"><b>${esc(a.registration_code)}</b> ${tt('on {bus}', { bus: busById(a.bus_id)?.bus_number || '?' })}
        <button type="button" class="sj-btn sj-btn-sm" data-open="${esc(a.registration_code)}">${tt('Open')}</button>
        <button type="button" class="sj-btn sj-btn-sm" data-confirm="${esc(a.registration_code)}">${tt('Keep on this bus')}</button></div>`).join('')}</div>` : ''}
    ${preview?.unassigned.length ? `<div class="sj-section"><h3>${tt('Not assigned in this preview')}</h3>${preview.unassigned.map((u) => `<div class="sj-small">${esc(u.code)} · ${esc(students(u.students))} — ${esc(reasonLabel(u.reason))}</div>`).join('')}</div>` : ''}`;

  // --- map
  const L = await loadLeaflet();
  if (!panel.isConnected) return;
  const sel = panel.querySelector('[data-busfilter]');
  sel.value = ui.bus;
  map = L.map(panel.querySelector('.rg-adminmap')).setView([30.08, 31.55], 11);
  addTiles(L, map);
  const school = [Number(fleet.settings.school_lat), Number(fleet.settings.school_lng)];
  L.marker(school, { icon: L.divIcon({ className: '', html: `<div class="rg-centroid">🏫 ${tt('School')}</div>`, iconSize: [70, 20], iconAnchor: [35, 10] }) }).addTo(map);
  const pts = [];
  const byBus = new Map();
  for (const f of fams.filter((x) => x.has_pin)) {
    const bid = busOf(f.code);
    if (ui.bus === 'none' ? bid : ui.bus !== 'all' && bid !== ui.bus) continue;
    const color = bid ? busColor(bid) : '#98a2b3';
    const a = amap.get(f.code);
    const label = bid ? esc(busById(bid)?.bus_number.replace(/^bus\s*/i, '') || '?') : '?';
    const m = L.marker([f.lat, f.lng], {
      icon: L.divIcon({ className: '', html: `<div class="rg-dot" style="background:${color};width:26px;height:26px;${a?.locked ? 'outline:3px solid #101828;' : ''}${a?.needs_review ? 'outline:3px dashed #b42318;' : ''}">${label}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] }),
    }).addTo(map);
    m.bindPopup(() => familyPopup(f, bid, a));
    pts.push([f.lat, f.lng]);
    if (bid) { if (!byBus.has(bid)) byBus.set(bid, []); byBus.get(bid).push(f); }
  }
  for (const [bid, list] of byBus) {
    const h = hull(list.map((f) => ({ lat: f.lat, lng: f.lng })));
    if (h.length >= 3) L.polygon(h, { color: busColor(bid), weight: 2, fillOpacity: 0.06, interactive: false }).addTo(map);
  }
  if (pts.length) map.fitBounds([...pts, school], { padding: [30, 30], maxZoom: 15 });
  setTimeout(() => map && map.invalidateSize(), 100);

  map.on('popupopen', (e) => {
    const el = e.popup.getElement();
    el.querySelector('[data-open]')?.addEventListener('click', (ev) => ctx.openDetail(ev.target.dataset.open));
    el.querySelector('[data-move-go]')?.addEventListener('click', async (ev) => {
      const code = ev.target.dataset.moveGo;
      const target = el.querySelector('[data-move]').value || null;
      await manualChange(code, target, el.querySelector('[data-lockbox]').checked);
    });
  });

  // --- actions
  panel.onclick = async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    try {
      if (b.dataset.addBus !== undefined) return busDialog(null);
      if (b.dataset.editBus) return busDialog(busById(b.dataset.editBus));
      if (b.dataset.famsBus) return familiesDialog(busById(b.dataset.famsBus), () => { preview = null; renderBuses(panel); });
      if (b.dataset.lockBus) {
        const bus = busById(b.dataset.lockBus);
        await ctx.call(`/admin/buses/${bus.id}`, { method: 'POST', body: { assignments_locked: !bus.assignments_locked } });
        return renderBuses(panel);
      }
      if (b.dataset.showBus) { ui.bus = b.dataset.showBus; return renderBuses(panel); }
      if (b.dataset.routeBus) { ui.routeBus = b.dataset.routeBus; return ctx.switchTab('routes'); }
      if (b.dataset.open) return ctx.openDetail(b.dataset.open);
      if (b.dataset.confirm) {
        await ctx.call('/admin/assignments/confirm', { method: 'POST', body: { registration_code: b.dataset.confirm } });
        toast(t('Kept on the same bus'));
        return renderBuses(panel);
      }
      if (b.dataset.auto !== undefined) {
        preview = autoAssign({ families: fams, buses: fleet.buses, current: new Map(fleet.assignments.map((a) => [a.registration_code, a])), settings: fleet.settings });
        if (!preview.changes.length) { preview = null; toast(t('Nothing to change — current assignments already match the suggestion.')); }
        return renderBuses(panel);
      }
      if (b.dataset.suggest !== undefined) {
        preview = makeAreaSuggestion();
        if (!preview.changes.length) { preview = null; toast(t('Nothing to suggest — every family with a pin already has a bus.')); }
        ui.bus = 'all';
        return renderBuses(panel);
      }
      if (b.dataset.createOne) {
        const v = preview.virtual.find((x) => x.id === b.dataset.createOne);
        const changes = preview.changes.filter((c) => c.bus_id === v.id);
        if (!confirm(t('Create {bus} ({seats} seats) and assign its {n} families?', { bus: v.bus_number, seats: v.capacity, n: changes.length }))) return;
        b.disabled = true;
        const r = await ctx.call('/admin/buses', { method: 'POST', body: { bus_number: v.bus_number, capacity: v.capacity } });
        await ctx.call('/admin/assignments/apply', { method: 'POST', body: { kind: 'auto', changes: changes.map((c) => ({ ...c, bus_id: r.id })), params: fleet.settings, summary: { area_bus: v.bus_number, newly_assigned: changes.length } } });
        toast(t('{bus} created', { bus: v.bus_number }));
        await loadFleet();
        preview = makeAreaSuggestion();
        if (!preview.changes.length) preview = null;
        return renderBuses(panel);
      }
      if (b.dataset.cancelPreview !== undefined) { preview = null; ui.bus = 'all'; return renderBuses(panel); }
      if (b.dataset.apply !== undefined) {
        const virtual = preview.virtual || [];
        if (virtual.length && !confirm(t('Create {n} new bus(es) ({names}) with {seats} seats each, and assign {f} families?', { n: virtual.length, names: virtual.map((v) => v.bus_number).join(', '), seats: virtual[0].capacity, f: preview.changes.filter((c) => c.bus_id).length }))) return;
        b.disabled = true;
        const ids = new Map();
        for (const v of virtual) {
          const r = await ctx.call('/admin/buses', { method: 'POST', body: { bus_number: v.bus_number, capacity: v.capacity } });
          ids.set(v.id, r.id);
        }
        const changes = preview.changes.map((c) => (ids.has(c.bus_id) ? { ...c, bus_id: ids.get(c.bus_id) } : c));
        await ctx.call('/admin/assignments/apply', { method: 'POST', body: { kind: 'auto', changes, params: fleet.settings, summary: { ...preview.summary, buses_created: virtual.length } } });
        toast(t('Applied {n} change(s)', { n: preview.changes.length }));
        preview = null;
        return renderBuses(panel);
      }
      if (b.dataset.undo) {
        if (!confirm(t('Undo the most recent assignment change? All assignments return to exactly how they were before it.'))) return;
        await ctx.call('/admin/assignments/undo', { method: 'POST', body: { run_id: b.dataset.undo } });
        toast(t('Undone'));
        return renderBuses(panel);
      }
    } catch (err) { toast(t(err.message), 5000); b.disabled = false; }
  };
  sel.addEventListener('change', () => { ui.bus = sel.value; renderBuses(panel); });

  function makeAreaSuggestion() {
    return suggestAreaBuses({
      families: families(), buses: fleet.buses, current: assignmentMap(), settings: fleet.settings,
      capacity: Number(fleet.settings.default_bus_capacity) || 26,
      school: { lat: Number(fleet.settings.school_lat), lng: Number(fleet.settings.school_lng) },
      areaMaxM: fleet.settings.auto_join_area_max_m || 5000,
    });
  }

  async function manualChange(code, busId, locked) {
    const body = { kind: 'manual', changes: [{ registration_code: code, bus_id: busId, locked: busId ? locked : false, reason: 'Manual', source: 'manual' }] };
    try {
      await ctx.call('/admin/assignments/apply', { method: 'POST', body });
    } catch (err) {
      if (err.code === 'over_capacity' && confirm(`${apiMsg(err.message)}\n\n${t('Assign anyway? The bus will be shown as over capacity.')}`)) {
        await ctx.call('/admin/assignments/apply', { method: 'POST', body: { ...body, allow_over_capacity: true } });
      } else if (err.code !== 'over_capacity') return toast(t(err.message), 5000);
      else return;
    }
    toast(t('Saved'));
    preview = null;
    renderBuses(panel);
  }
}

function familyPopup(f, bid, a) {
  return `<div class="rg-popup"><b>${esc(f.code)} · ${esc(f.parent)}</b><br>${esc(students(f.students))} · ${esc(f.area)}<br>
    ${tt('Bus')}: <b>${bid ? esc(busById(bid)?.bus_number) : tt('not assigned')}</b>${a?.reason ? ` <span style="color:#667085">(${esc(reasonLabel(a.reason))})</span>` : ''}${a?.needs_review ? `<br><b style="color:#b42318">${tt('Needs review: pickup moved')}</b>` : ''}
    <div style="margin-top:6px">${tt('Move to')} <select data-move style="font-size:13px"><option value="">— ${tt('Unassign')} —</option>
      ${fleet.buses.filter((b) => b.active).map((b) => `<option value="${esc(b.id)}" ${b.id === bid ? 'selected' : ''}>${esc(b.bus_number)} (${tt('{n} free', { n: b.capacity - b.students })})</option>`).join('')}</select>
      <label style="font-size:12px"><input type="checkbox" data-lockbox ${a?.locked || !a ? 'checked' : ''}> ${tt('lock')}</label></div>
    <div class="acts"><button type="button" data-move-go="${esc(f.code)}">${tt('Save')}</button><button type="button" data-open="${esc(f.code)}">${tt('Open')}</button></div></div>`;
}

/**
 * Manually manage one bus: see its families, remove them, and add families from a list
 * (families from the bus's area and nearest pickups first). Saved as one manual change
 * (undoable); a full bus needs an explicit "assign anyway".
 */
function familiesDialog(bus, onDone) {
  const all = families().filter((f) => f.has_pin);
  const amap = assignmentMap();
  const onBus = () => all.filter((f) => amap.get(f.code)?.bus_id === bus.id);
  const members = onBus();
  const key = (x) => String(x || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const busName = key(bus.bus_number);
  const areaCount = new Map();
  for (const f of members) areaCount.set(f.area_id, (areaCount.get(f.area_id) || 0) + 1);
  const homeArea = [...areaCount].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const centre = members.length
    ? { lat: members.reduce((n, f) => n + f.lat, 0) / members.length, lng: members.reduce((n, f) => n + f.lng, 0) / members.length }
    : bus.start_lat != null ? { lat: bus.start_lat, lng: bus.start_lng } : null;
  const sameArea = (f) => (homeArea ? f.area_id === homeArea : busName.includes(key(f.area)));
  const dist = (f) => (centre ? distanceM(centre.lat, centre.lng, f.lat, f.lng) : null);
  const state = { q: '', show: 'unassigned', picked: new Set(), lock: true };

  const body = document.createElement('div');
  const modal = openModal(t('Families on {bus}', { bus: bus.bus_number }), body, { wide: true });
  const used = () => onBus().reduce((n, f) => n + f.students, 0);
  const pickedStudents = () => all.filter((f) => state.picked.has(f.code)).reduce((n, f) => n + f.students, 0);

  const draw = () => {
    const q = key(state.q);
    const candidates = all
      .filter((f) => amap.get(f.code)?.bus_id !== bus.id)
      .filter((f) => state.show === 'all' || !amap.get(f.code))
      .filter((f) => !q || key(`${f.code} ${f.parent} ${f.area}`).includes(q))
      .map((f) => ({ f, same: sameArea(f), d: dist(f) }))
      .sort((a, b) => (b.same - a.same) || ((a.d ?? 1e12) - (b.d ?? 1e12)) || a.f.area.localeCompare(b.f.area) || a.f.code.localeCompare(b.f.code));
    const after = used() + pickedStudents();
    body.innerHTML = `
      <p class="sj-help" style="margin-top:0">${tt('{used} / {cap} students', { used: num(used()), cap: num(bus.capacity) })} · ${tt('{n} families', { n: num(onBus().length) })}</p>
      <div class="sj-section" style="margin-top:0"><h3>${tt('On this bus ({n})', { n: onBus().length })}</h3>
        ${onBus().length ? `<div class="sj-tablewrap"><table class="sj-table"><tbody>${onBus().map((f) => `<tr>
          <td class="sj-code">${esc(f.code)}</td><td>${esc(f.parent)}</td><td>${esc(students(f.students))}</td><td>${esc(f.area)}</td>
          <td class="r"><button type="button" class="sj-btn sj-btn-sm sj-btn-ghost" data-remove="${esc(f.code)}">${tt('Remove')}</button></td></tr>`).join('')}</tbody></table></div>`
          : `<p class="sj-muted">${tt('No families on this bus yet.')}</p>`}</div>
      <div class="sj-section"><h3>${tt('Add families')}</h3>
        <div class="sj-toolbar">
          <input class="sj-input" data-q placeholder="${tt('Search ID, parent or area')}" value="${esc(state.q)}" style="flex:1;min-width:180px">
          <select data-show><option value="unassigned">${tt('Families without a bus')}</option><option value="all">${tt('All families (moves them from their bus)')}</option></select>
        </div>
        <p class="sj-help" style="margin-top:4px">${tt("Families from this bus's area and nearest pickup points are listed first.")}
          ${candidates.some((c) => c.same) ? `<button type="button" class="sj-btn sj-btn-sm" data-pick-area>${tt('Select all from this area ({n})', { n: candidates.filter((c) => c.same).length })}</button>` : ''}</p>
        <div class="sj-tablewrap" style="max-height:45vh;overflow:auto"><table class="sj-table">
          <thead><tr><th></th><th>${tt('ID')}</th><th>${tt('Parent')}</th><th>${tt('Students')}</th><th>${tt('Area')}</th><th>${tt('Distance')}</th><th>${tt('Current bus')}</th></tr></thead>
          <tbody>${candidates.map(({ f, same, d }) => `<tr class="sj-clickable" data-pick="${esc(f.code)}">
            <td><input type="checkbox" data-pickbox="${esc(f.code)}" ${state.picked.has(f.code) ? 'checked' : ''} aria-label="${esc(f.code)}"></td>
            <td class="sj-code">${esc(f.code)}</td><td>${esc(f.parent)}</td><td>${esc(students(f.students))}</td>
            <td>${esc(f.area)}${same ? ` <span class="sj-badge sj-badge-ok">${tt('same area')}</span>` : ''}</td>
            <td class="sj-num">${d != null ? km(d) : '—'}</td>
            <td>${amap.get(f.code) ? esc(busById(amap.get(f.code).bus_id)?.bus_number || '?') : `<span class="sj-muted">${tt('none')}</span>`}</td></tr>`).join('')
            || `<tr><td colspan="7" class="sj-muted">${tt('No families match.')}</td></tr>`}</tbody></table></div>
        <label class="sj-check" style="display:flex;margin-top:10px"><input type="checkbox" data-lock ${state.lock ? 'checked' : ''}> <span>${tt('Lock them on this bus (auto-assign will not move them)')}</span></label>
        <div class="sj-formfoot">
          <span class="sj-small ${after > bus.capacity ? '' : 'sj-muted'}" style="${after > bus.capacity ? 'color:var(--danger)' : ''}">${tt('After adding: {used} / {cap} students', { used: num(after), cap: num(bus.capacity) })}</span>
          <button type="button" class="sj-btn sj-btn-primary" data-add ${state.picked.size ? '' : 'disabled'}>${tt('Add selected ({n})', { n: state.picked.size })}</button>
        </div></div>`;
    body.querySelector('[data-show]').value = state.show;
    const qi = body.querySelector('[data-q]');
    qi.addEventListener('input', () => { state.q = qi.value; const pos = qi.selectionStart; draw(); const n = body.querySelector('[data-q]'); n.focus(); n.setSelectionRange(pos, pos); });
    body.querySelector('[data-show]').addEventListener('change', (e) => { state.show = e.target.value; draw(); });
    body.querySelector('[data-lock]').addEventListener('change', (e) => { state.lock = e.target.checked; });
  };

  const save = async (changes, summary) => {
    const req = { kind: 'manual', changes, summary };
    try {
      await ctx.call('/admin/assignments/apply', { method: 'POST', body: req });
    } catch (err) {
      if (err.code !== 'over_capacity') throw err;
      if (!confirm(`${apiMsg(err.message)}\n\n${t('Assign anyway? The bus will be shown as over capacity.')}`)) return false;
      await ctx.call('/admin/assignments/apply', { method: 'POST', body: { ...req, allow_over_capacity: true } });
    }
    await loadFleet();
    amap.clear();
    for (const [k, v] of assignmentMap()) amap.set(k, v);
    return true;
  };

  body.onclick = async (e) => {
    if (e.target.closest('[data-pick-area]')) {
      all.filter((f) => amap.get(f.code)?.bus_id !== bus.id && (state.show === 'all' || !amap.get(f.code)) && sameArea(f)).forEach((f) => state.picked.add(f.code));
      return draw();
    }
    const row = e.target.closest('[data-pick]');
    if (row && !e.target.closest('button')) {
      const code = row.dataset.pick;
      if (state.picked.has(code)) state.picked.delete(code); else state.picked.add(code);
      return draw();
    }
    const b = e.target.closest('button');
    if (!b) return;
    try {
      if (b.dataset.remove) {
        if (!confirm(t('Remove {code} from {bus}? The family becomes unassigned and will not be placed on a bus automatically.', { code: b.dataset.remove, bus: bus.bus_number }))) return;
        b.disabled = true;
        await save([{ registration_code: b.dataset.remove, bus_id: null, locked: false, reason: 'Manual', source: 'manual' }], { manual_remove: bus.bus_number });
        toast(t('Removed'));
        return draw();
      }
      if (b.dataset.add !== undefined) {
        const codes = [...state.picked];
        b.disabled = true;
        const ok = await save(codes.map((code) => ({ registration_code: code, bus_id: bus.id, locked: state.lock, reason: 'Manual', source: 'manual' })), { manual_add: bus.bus_number, families: codes.length });
        if (!ok) { b.disabled = false; return; }
        state.picked.clear();
        toast(t('{n} family(ies) added to {bus}', { n: codes.length, bus: bus.bus_number }));
        return draw();
      }
    } catch (err) { toast(apiMsg(err.message), 6000); b.disabled = false; }
  };
  const close = modal.close;
  modal.close = (...a) => { close(...a); onDone(); };
  draw();
}

function busDialog(bus) {
  const body = document.createElement('div');
  const v = (k) => esc(bus?.[k] ?? '');
  body.innerHTML = `<form class="sj-form" novalidate>
    <div class="sj-row">
      <div class="sj-field"><label>${tt('Bus number / name')} *</label><input name="bus_number" maxlength="30" value="${v('bus_number')}" required></div>
      <div class="sj-field"><label>${tt('Capacity (student seats)')} *</label><input name="capacity" type="number" min="1" max="100" value="${bus ? v('capacity') : esc(fleet.settings.default_bus_capacity ?? 26)}" required></div>
    </div>
    <div class="sj-field"><label>${tt('Reserved seats')} <span class="sj-opt">(${tt('optional — overrides the default spare-seat %')})</span></label><input name="reserve_seats" type="number" min="0" max="100" value="${v('reserve_seats')}"></div>
    <div class="sj-row">
      <div class="sj-field"><label>${tt('Driver name')}</label><input name="driver_name" maxlength="80" value="${v('driver_name')}"></div>
      <div class="sj-field"><label>${tt('Driver phone')}</label><input name="driver_phone" maxlength="40" value="${v('driver_phone')}" dir="ltr"></div>
    </div>
    <div class="sj-row">
      <div class="sj-field"><label>${tt('Supervisor name')}</label><input name="supervisor_name" maxlength="80" value="${v('supervisor_name')}"></div>
      <div class="sj-field"><label>${tt('Supervisor phone')}</label><input name="supervisor_phone" maxlength="40" value="${v('supervisor_phone')}" dir="ltr"></div>
    </div>
    <div class="sj-field"><label>${tt('Driver start point')} <span class="sj-opt">(${tt('optional')})</span></label>
      <div class="sj-inline" style="flex-wrap:wrap"><span data-start dir="auto">${bus?.start_lat != null ? `${bus.start_lat.toFixed(5)}, ${bus.start_lng.toFixed(5)}` : tt('Not set — routes start at the most efficient first stop')}</span>
        <button type="button" class="sj-btn sj-btn-sm" data-pick-start>${tt('Set on map')}</button><button type="button" class="sj-btn sj-btn-sm" data-clear-start>${tt('Clear')}</button></div></div>
    <div class="sj-field"><label>${tt('Notes')}</label><textarea name="notes" maxlength="1000">${v('notes')}</textarea></div>
    <label class="sj-check"><input type="checkbox" name="active" ${bus ? (bus.active ? 'checked' : '') : 'checked'}> <span>${tt('Active (available for assignment)')}</span></label>
    <div class="sj-note sj-note-err" data-err hidden></div>
    <div class="sj-formfoot">${bus ? `<button type="button" class="sj-btn sj-btn-danger" data-del>${tt('Delete bus')}</button>` : ''}<button type="submit" class="sj-btn sj-btn-primary">${tt('Save')}</button></div>
  </form>`;
  const modal = openModal(bus ? t('Edit {bus}', { bus: bus.bus_number }) : t('Add bus'), body);
  const form = body.querySelector('form');
  let start = bus?.start_lat != null ? { lat: bus.start_lat, lng: bus.start_lng } : null;
  body.querySelector('[data-pick-start]').addEventListener('click', async () => {
    const r = await openPicker({ initial: start ? { latitude: start.lat, longitude: start.lng, location_source: 'map' } : null, center: { lat: Number(fleet.settings.school_lat), lng: Number(fleet.settings.school_lng) } });
    if (r) { start = { lat: r.latitude, lng: r.longitude }; body.querySelector('[data-start]').textContent = `${start.lat.toFixed(5)}, ${start.lng.toFixed(5)}`; }
  });
  body.querySelector('[data-clear-start]').addEventListener('click', () => { start = null; body.querySelector('[data-start]').textContent = t('Not set'); });
  body.querySelector('[data-del]')?.addEventListener('click', async () => {
    const n = bus.families || 0;
    if (!confirm(n
      ? `${t('Delete {bus}?', { bus: bus.bus_number })}\n\n${t('Its {n} family(ies) go back to "not assigned" (they can join another bus automatically or be placed by you). Its routes are deleted too.', { n })}`
      : t('Delete {bus}?', { bus: bus.bus_number }))) return;
    try {
      const r = await ctx.call(`/admin/buses/${bus.id}`, { method: 'POST', body: { action: 'delete', unassign: true } });
      modal.close();
      toast(r.unassigned ? t('{bus} deleted · {n} family(ies) unassigned', { bus: bus.bus_number, n: r.unassigned }) : t('{bus} deleted', { bus: bus.bus_number }));
      ctx.switchTab('buses');
    } catch (e) { toast(t(e.message), 5000); }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(form));
    const payload = { ...fd, active: form.active.checked, start_lat: start?.lat ?? null, start_lng: start?.lng ?? null };
    try {
      await ctx.call(bus ? `/admin/buses/${bus.id}` : '/admin/buses', { method: 'POST', body: payload });
      modal.close();
      toast(t('Bus saved'));
      ctx.switchTab('buses');
    } catch (err) {
      const el = body.querySelector('[data-err]');
      el.textContent = t(err.message);
      el.hidden = false;
    }
  });
}

// ===========================================================================
// ROUTES
// ===========================================================================

export async function renderRoutes(panel) {
  killMap();
  panel.innerHTML = `<div class="sj-loading">${tt('Loading routes…')}</div>`;
  try { await loadFleet(); } catch (e) { panel.innerHTML = `<div class="sj-note sj-note-err">${tt(e.message)}</div>`; return; }
  const buses = fleet.buses.filter((b) => b.families > 0);
  if (!buses.length) { panel.innerHTML = `<div class="sj-empty">${tt('Assign families to buses first (Buses tab).')}</div>`; return; }
  if (!ui.routeBus || !buses.some((b) => b.id === ui.routeBus)) ui.routeBus = buses[0].id;
  const bus = busById(ui.routeBus);
  const saved = await ctx.call(`/admin/routes/${bus.id}`);
  const summary = fleet.routes.filter((r) => r.bus_id === bus.id);
  const stale = { draft: summary.find((r) => r.status === 'draft')?.stale, approved: summary.find((r) => r.status === 'approved')?.stale };
  if (!editing || editing.busId !== bus.id) editing = fromSaved(bus, saved.draft || saved.approved, saved.draft ? 'draft' : saved.approved ? 'approved' : null);

  const fams = new Map(families().map((f) => [f.code, f]));
  const onBus = fleet.assignments.filter((a) => a.bus_id === bus.id).map((a) => fams.get(a.registration_code)).filter((f) => f && f.has_pin);
  const missing = onBus.filter((f) => !editing.stops.some((s) => s.code === f.code));
  const extra = editing.stops.filter((s) => !fams.get(s.code) || !onBus.some((f) => f.code === s.code));

  const arrival = String(fleet.settings.school_arrival_time).slice(0, 5);
  panel.innerHTML = `
    <div class="rg-maptools">
      <label>${tt('Bus')} <select data-bus>${buses.map((b) => `<option value="${esc(b.id)}" ${b.id === bus.id ? 'selected' : ''}>${esc(b.bus_number)} (${tt('{n} families', { n: b.families })})</option>`).join('')}</select></label>
      <span class="sj-small">${saved.approved ? `<span class="sj-badge ${stale.approved ? 'sj-badge-warn' : 'sj-badge-ok'}">${tt('Approved v{v}', { v: saved.approved.version })}${stale.approved ? ` — ${tt('needs review')}` : ''}</span>` : `<span class="sj-badge">${tt('No approved route')}</span>`}
        ${saved.draft ? ` <span class="sj-badge sj-badge-warn">${tt('Draft v{v}', { v: saved.draft.version })}${stale.draft ? ` — ${tt('out of date')}` : ''}</span>` : ''}
        ${editing.dirty ? ` <span class="sj-badge sj-badge-danger">${tt('Unsaved changes')}</span>` : ''}</span>
    </div>
    <div class="sj-actions" style="margin-top:0">
      <button type="button" class="sj-btn sj-btn-primary" data-gen>${tt('Generate suggested route')}</button>
      <button type="button" class="sj-btn" data-reopt ${editing.stops.length ? '' : 'disabled'}>${tt('Re-optimise unlocked stops')}</button>
      <button type="button" class="sj-btn" data-line ${editing.stops.length ? '' : 'disabled'}>${tt('Update road line')}</button>
      <button type="button" class="sj-btn" data-save ${editing.stops.length && editing.geometry.length ? '' : 'disabled'}>${tt('Save draft')}</button>
      <button type="button" class="sj-btn" data-approve ${saved.draft && !editing.dirty ? '' : 'disabled'}>${tt('Approve route')}</button>
      <button type="button" class="sj-btn" data-sheet ${editing.stops.length ? '' : 'disabled'}>⬇ ${tt('Driver sheet')}</button>
    </div>
    <div class="rg-maptools" style="margin:0 0 8px">
      <span class="sj-small"><b>${tt('Driver start point:')}</b> ${bus.start_lat != null ? `<span dir="ltr">${bus.start_lat.toFixed(5)}, ${bus.start_lng.toFixed(5)}</span>` : tt('not set — the trip starts at the first stop')}</span>
      <button type="button" class="sj-btn sj-btn-sm" data-set-start>${tt(bus.start_lat != null ? 'Change start point' : 'Set start point')}</button>
      ${bus.start_lat != null ? `<button type="button" class="sj-btn sj-btn-sm" data-clear-start>${tt('Remove')}</button>` : ''}
    </div>
    ${editing.stops.length && editing.geometry.length && (editing.start?.[0] ?? null) !== (bus.start_lat ?? null) ? `<div class="sj-note sj-note-warn">${tt('The start point changed since this route was calculated. Click “Re-optimise unlocked stops” (or Generate) to update the route and times.')}</div>` : ''}
    ${(() => {
      const trip = tripTimes();
      if (!trip) return '';
      return `<div class="sj-note sj-note-info rg-trip" style="margin-top:0"><b>${tt('Trip:')}</b>
        ${editing.start ? `${tt('driver leaves the start point at')} <b>${trip.depart}</b> (${tt('{d}, ~{t} to the first stop', { d: km(trip.toFirstM), t: mins(trip.toFirstS) })}) · ` : ''}${tt('first pickup')} <b>${trip.firstPickup || '—'}</b> ·
        ${tt('arrives at school')} <b>${esc(arrival)}</b>${editing.est_total_s ? ` · ${tt('total ~{t}', { t: mins(editing.est_total_s) })}` : ''}</div>`;
    })()}
    ${missing.length || extra.length ? `<div class="sj-note sj-note-warn">${tt('The families on this bus changed since this route was made')}
      (${tt('{n} not on the route', { n: missing.length })}${extra.length ? `, ${tt('{n} no longer on the bus', { n: extra.length })}` : ''}). ${tt('Generate or re-optimise, then save.')}</div>` : ''}
    ${editing.provider === 'straight' ? `<div class="sj-note sj-note-warn">${tt('Road routing was unavailable — distances are straight-line estimates. Try "Update road line" again later.')}</div>` : ''}
    <p class="sj-help" style="margin-top:0">${tt('{s} stops · {n} students · capacity {c}', { s: num(editing.stops.length), n: num(editing.stops.reduce((n, st) => n + (fams.get(st.code)?.students || 0), 0)), c: bus.capacity })}
      ${editing.distance_m ? ` · ${km(editing.distance_m)}` : ''}${editing.est_total_s ? ` · ${tt('about {t} incl. traffic ×{f} and {d}s per stop', { t: mins(editing.est_total_s), f: fleet.settings.traffic_factor, d: fleet.settings.dwell_seconds })}` : ''}
      · ${tt('ends at {school} (arrival {time})', { school: fleet.settings.school_name, time: arrival })}</p>
    <div style="display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:12px" class="rg-routegrid">
      <div class="rg-adminmap" style="height:62vh"></div>
      <div data-list style="max-height:62vh;overflow:auto"></div>
    </div>`;

  const L = await loadLeaflet();
  if (!panel.isConnected) return;
  map = L.map(panel.querySelector('.rg-adminmap')).setView([30.08, 31.55], 12);
  addTiles(L, map);
  drawRoute(L, fams, bus);
  renderStopList(panel.querySelector('[data-list]'), fams, panel);

  panel.querySelector('[data-bus]').addEventListener('change', (e) => { ui.routeBus = e.target.value; editing = null; renderRoutes(panel); });
  panel.onclick = async (e) => {
    const b = e.target.closest('button');
    if (!b || b.closest('[data-list]')) return;
    const label = b.textContent;
    try {
      if (b.dataset.gen !== undefined || b.dataset.reopt !== undefined) {
        const keepLocks = b.dataset.reopt !== undefined;
        b.disabled = true; b.innerHTML = `<span class="sj-spin"></span> ${tt('Calculating…')}`;
        await optimise(bus, onBus, keepLocks);
        await refreshLine(bus, fams);
        return renderRoutes(panel);
      }
      if (b.dataset.line !== undefined) {
        b.disabled = true; b.innerHTML = '<span class="sj-spin"></span>';
        await refreshLine(bus, fams);
        return renderRoutes(panel);
      }
      if (b.dataset.save !== undefined) {
        b.disabled = true;
        await ctx.call(`/admin/routes/${bus.id}`, { method: 'POST', body: {
          stops: editing.stops.map((s) => ({ registration_code: s.code, locked: s.locked, leg_distance_m: s.leg_distance_m, leg_duration_s: s.leg_duration_s, eta_offset_s: s.eta_offset_s })),
          geometry: editing.geometry, start_lat: editing.start?.[0] ?? null, start_lng: editing.start?.[1] ?? null,
          total_distance_m: editing.distance_m, total_duration_s: editing.duration_s, est_total_s: editing.est_total_s, provider: editing.provider,
        } });
        editing.dirty = false;
        toast(t('Draft saved'));
        return renderRoutes(panel);
      }
      if (b.dataset.approve !== undefined) {
        if (!confirm(t('Approve this route for {bus}? Parents on this bus will then see their stop number, estimated pickup time and the bus route map.', { bus: bus.bus_number }))) return;
        await ctx.call(`/admin/routes/${bus.id}/approve`, { method: 'POST', body: {} });
        editing = null;
        toast(t('Route approved'));
        return renderRoutes(panel);
      }
      if (b.dataset.sheet !== undefined) return driverSheet(bus, fams);
      if (b.dataset.setStart !== undefined || b.dataset.clearStart !== undefined) {
        let start = null;
        if (b.dataset.setStart !== undefined) {
          const r = await openPicker({
            initial: bus.start_lat != null ? { latitude: bus.start_lat, longitude: bus.start_lng, location_source: 'map' } : null,
            center: { lat: Number(fleet.settings.school_lat), lng: Number(fleet.settings.school_lng) },
          });
          if (!r) return;
          start = { lat: r.latitude, lng: r.longitude };
        } else if (!confirm(t('Remove the start point of {bus}? The trip will start at the first stop.', { bus: bus.bus_number }))) return;
        await ctx.call(`/admin/buses/${bus.id}`, { method: 'POST', body: { start_lat: start?.lat ?? null, start_lng: start?.lng ?? null } });
        bus.start_lat = start?.lat ?? null;
        bus.start_lng = start?.lng ?? null;
        if (editing.stops.length) {
          b.disabled = true; b.innerHTML = `<span class="sj-spin"></span> ${tt('Updating route…')}`;
          await optimise(bus, onBus, true);
          await refreshLine(bus, fams);
        }
        toast(t(start ? 'Start point saved — save the draft and approve to publish the new times' : 'Start point removed'));
        return renderRoutes(panel);
      }
    } catch (err) { toast(t(err.message), 6000); b.disabled = false; b.textContent = label; }
  };
}

function fromSaved(bus, route, status) {
  if (!route) return { busId: bus.id, stops: [], geometry: [], dirty: false, status: null };
  return {
    busId: bus.id, status, dirty: false,
    stops: route.stops.filter((s) => s.registration_code).map((s) => ({ code: s.registration_code, locked: s.locked, leg_distance_m: s.leg_distance_m, leg_duration_s: s.leg_duration_s, eta_offset_s: s.eta_offset_s })),
    geometry: route.geometry || [], distance_m: route.total_distance_m, duration_s: route.total_duration_s, est_total_s: route.est_total_s, provider: route.provider,
    start: route.start_lat != null ? [Number(route.start_lat), Number(route.start_lng)] : null,
  };
}

async function optimise(bus, onBus, keepLocks) {
  const byCode = new Map(onBus.map((f) => [f.code, f]));
  const current = keepLocks ? editing.stops.filter((s) => byCode.has(s.code)) : [];
  const codes = [...new Set([...current.map((s) => s.code), ...onBus.map((f) => f.code)])];
  const stops = codes.map((c) => byCode.get(c));
  const school = [Number(fleet.settings.school_lat), Number(fleet.settings.school_lng)];
  const hasDepot = bus.start_lat != null;
  const points = [...stops.map((f) => [f.lat, f.lng]), school, ...(hasDepot ? [[bus.start_lat, bus.start_lng]] : [])];
  if (points.length > 90) throw new Error(t('Too many stops for one route (max 88).'));
  const m = await ctx.call('/admin/routing/matrix', { method: 'POST', body: { points } });
  const locked = new Map();
  if (keepLocks) current.forEach((s, pos) => { if (s.locked) locked.set(pos, codes.indexOf(s.code)); });
  const order = orderStops(m.durations, stops.length, { hasDepot, locked });
  const lockedCodes = new Set(current.filter((s) => s.locked).map((s) => s.code));
  editing.stops = order.map((i) => ({ code: stops[i].code, locked: lockedCodes.has(stops[i].code) }));
  editing.provider = m.provider;
  editing.dirty = true;
}

async function refreshLine(bus, fams) {
  const school = [Number(fleet.settings.school_lat), Number(fleet.settings.school_lng)];
  const hasDepot = bus.start_lat != null;
  const points = [...(hasDepot ? [[bus.start_lat, bus.start_lng]] : []), ...editing.stops.map((s) => [fams.get(s.code).lat, fams.get(s.code).lng]), school];
  const p = await ctx.call('/admin/routing/path', { method: 'POST', body: { points } });
  const offsets = etaOffsets(p.legs, editing.stops.length, { hasDepot, trafficFactor: Number(fleet.settings.traffic_factor), dwellSeconds: fleet.settings.dwell_seconds });
  const stopLegs = hasDepot ? p.legs.slice(1) : p.legs;
  editing.stops = editing.stops.map((s, i) => ({ ...s, leg_distance_m: stopLegs[i]?.distance_m ?? null, leg_duration_s: stopLegs[i]?.duration_s ?? null, eta_offset_s: offsets[i] }));
  editing.geometry = p.geometry;
  editing.start = hasDepot ? [bus.start_lat, bus.start_lng] : null;
  editing.distance_m = p.distance_m;
  editing.duration_s = p.duration_s;
  editing.est_total_s = Math.round(p.duration_s * Number(fleet.settings.traffic_factor) + editing.stops.length * fleet.settings.dwell_seconds);
  editing.provider = p.provider;
  editing.dirty = true;
}

/** Driver's trip: departure from the start point (if set), first pickup, and the drive to the first stop. */
function tripTimes() {
  if (!editing?.stops.length || editing.est_total_s == null) return null;
  const first = editing.stops[0].eta_offset_s;
  const stopKm = editing.stops.reduce((n, s) => n + (s.leg_distance_m || 0), 0);
  return {
    firstPickup: first != null ? etaLabel(first) : null,
    depart: editing.start ? etaLabel(editing.est_total_s) : (first != null ? etaLabel(first) : null),
    toFirstM: editing.start && editing.distance_m ? Math.max(0, editing.distance_m - stopKm) : 0,
    toFirstS: editing.start && first != null ? Math.max(0, editing.est_total_s - first) : 0,
  };
}

function etaLabel(offset) {
  if (offset == null) return '';
  const [h, m] = String(fleet.settings.school_arrival_time).split(':').map(Number);
  const x = h * 60 + m - Math.round(offset / 60);
  return `${String(Math.floor(((x % 1440) + 1440) % 1440 / 60)).padStart(2, '0')}:${String(((x % 60) + 60) % 60).padStart(2, '0')}`;
}

function drawRoute(L, fams, bus) {
  const school = [Number(fleet.settings.school_lat), Number(fleet.settings.school_lng)];
  const pts = [school];
  L.marker(school, { icon: L.divIcon({ className: '', html: `<div class="rg-centroid">🏫 ${esc(fleet.settings.school_name)}</div>`, iconSize: [160, 20], iconAnchor: [80, 10] }) }).addTo(map);
  // Driver start point = stop "0", labelled with the departure time.
  const start = editing.start || (bus.start_lat != null ? [bus.start_lat, bus.start_lng] : null);
  if (start) {
    const trip = tripTimes();
    const leave = editing.start && trip?.depart ? trip.depart : null;
    L.marker(start, { zIndexOffset: 500, icon: L.divIcon({ className: '', html: '<div class="rg-dot" style="background:#15803d;width:30px;height:30px;border:3px solid #fff">0</div>', iconSize: [30, 30], iconAnchor: [15, 15] }) })
      .bindTooltip(`${tt('Start')}${leave ? ` · ${tt('leave {time}', { time: leave })}` : ''}`, { permanent: true, direction: 'top', offset: [0, -14] })
      .bindPopup(`<div class="rg-popup"><b>0 · ${tt('Driver start point')}</b><br>${leave ? `${tt('Leave at')} <b>${leave}</b><br>${tt('{d} · ~{t} to stop 1', { d: km(trip.toFirstM), t: mins(trip.toFirstS) })}<br>` : `${tt('Generate or re-optimise the route to get the departure time.')}<br>`}
        <a href="${esc(googleMapsUrl(start[0], start[1]))}" target="_blank" rel="noopener noreferrer">Google Maps</a></div>`)
      .addTo(map);
    pts.push(start);
  }
  if (editing.geometry.length) L.polyline(editing.geometry, { color: busColor(bus.id), weight: 5, opacity: 0.8 }).addTo(map);
  editing.stops.forEach((s, i) => {
    const f = fams.get(s.code);
    if (!f) return;
    pts.push([f.lat, f.lng]);
    L.marker([f.lat, f.lng], { icon: L.divIcon({ className: '', html: `<div class="rg-dot" style="background:${busColor(bus.id)};width:26px;height:26px;${s.locked ? 'outline:3px solid #101828;' : ''}">${i + 1}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] }) })
      .bindPopup(`<div class="rg-popup"><b>${tt('Stop {n}', { n: i + 1 })} · ${esc(f.code)} · ${esc(f.parent)}</b><br>${esc(students(f.students))}${s.eta_offset_s != null ? ` · ${tt('pickup ~{time}', { time: etaLabel(s.eta_offset_s) })}` : ''}<br>
        <a href="${esc(googleMapsUrl(f.lat, f.lng))}" target="_blank" rel="noopener noreferrer">Google Maps</a> · <a href="${esc(appleMapsUrl(f.lat, f.lng))}" target="_blank" rel="noopener noreferrer">Apple Maps</a></div>`)
      .addTo(map);
  });
  map.fitBounds(pts, { padding: [30, 30], maxZoom: 15 });
  setTimeout(() => map && map.invalidateSize(), 100);
}

function renderStopList(el, fams, panel) {
  const trip = tripTimes();
  const startRow = editing.start && trip ? `<div class="sj-card" style="padding:8px 10px;margin-bottom:6px;display:flex;gap:8px;align-items:center;border-color:#15803d">
    <b style="min-width:26px;color:#15803d">0</b>
    <div style="flex:1;min-width:0"><b>${tt('Driver start point')}</b><br><span class="sj-small sj-muted">${tt('leave ~{time}', { time: trip.depart })} · ${tt('next {d}', { d: km(trip.toFirstM) })} (~${mins(trip.toFirstS)})</span></div></div>` : '';
  el.innerHTML = editing.stops.length ? `${startRow}<ol style="list-style:none;margin:0;padding:0">${editing.stops.map((s, i) => {
    const f = fams.get(s.code);
    return `<li draggable="true" data-i="${i}" class="sj-card" style="padding:8px 10px;margin-bottom:6px;display:flex;gap:8px;align-items:center;${s.locked ? 'border-color:#101828' : ''}">
      <b style="min-width:26px">${i + 1}</b>
      <div style="flex:1;min-width:0"><b>${esc(s.code)}</b> · ${esc(f?.parent || '?')}<br><span class="sj-small sj-muted">${f ? esc(students(f.students)) : '?'}${s.eta_offset_s != null ? ` · ~${etaLabel(s.eta_offset_s)}` : ''}${s.leg_distance_m != null ? ` · ${tt('next {d}', { d: km(s.leg_distance_m) })}` : ''}</span></div>
      <button type="button" class="sj-iconbtn" style="width:34px;height:34px;font-size:1rem" data-up="${i}" aria-label="${tt('Earlier')}">▲</button>
      <button type="button" class="sj-iconbtn" style="width:34px;height:34px;font-size:1rem" data-down="${i}" aria-label="${tt('Later')}">▼</button>
      <button type="button" class="sj-iconbtn" style="width:34px;height:34px;font-size:1rem" data-lock="${i}" aria-label="${tt('Lock position')}">${s.locked ? '🔒' : '🔓'}</button>
      <button type="button" class="sj-iconbtn" style="width:34px;height:34px;font-size:1rem" data-rm="${i}" aria-label="${tt('Remove from bus')}">×</button></li>`;
  }).join('')}</ol><p class="sj-help">${tt('Drag or use ▲▼ to reorder. 🔒 keeps a stop in place when re-optimising. × removes the family from this bus. After reordering, use “Update road line”, then “Save draft”.')}</p>`
    : `<div class="sj-empty">${tt('No route yet. Click “Generate suggested route”.')}</div>`;
  const move = (from, to) => {
    if (to < 0 || to >= editing.stops.length) return;
    const [x] = editing.stops.splice(from, 1);
    editing.stops.splice(to, 0, x);
    editing.dirty = true;
    renderRoutes(panel);
  };
  el.onclick = async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.up) return move(Number(b.dataset.up), Number(b.dataset.up) - 1);
    if (b.dataset.down) return move(Number(b.dataset.down), Number(b.dataset.down) + 1);
    if (b.dataset.lock) { const s = editing.stops[Number(b.dataset.lock)]; s.locked = !s.locked; editing.dirty = true; return renderRoutes(panel); }
    if (b.dataset.rm) {
      const s = editing.stops[Number(b.dataset.rm)];
      if (!confirm(t('Remove {code} from this bus? The family becomes unassigned (you can assign it to another bus in the Buses tab).', { code: s.code }))) return;
      try {
        await ctx.call('/admin/assignments/apply', { method: 'POST', body: { kind: 'manual', changes: [{ registration_code: s.code, bus_id: null, reason: 'Removed from route', source: 'manual' }] } });
        editing.stops.splice(Number(b.dataset.rm), 1);
        editing.dirty = true;
        renderRoutes(panel);
      } catch (err) { toast(t(err.message), 5000); }
    }
  };
  let dragFrom = null;
  el.querySelectorAll('li[draggable]').forEach((li) => {
    li.addEventListener('dragstart', () => { dragFrom = Number(li.dataset.i); });
    li.addEventListener('dragover', (ev) => ev.preventDefault());
    li.addEventListener('drop', (ev) => { ev.preventDefault(); if (dragFrom != null) move(dragFrom, Number(li.dataset.i)); dragFrom = null; });
  });
}

async function driverSheet(bus, fams) {
  const rows = editing.stops.map((s, i) => {
    const f = fams.get(s.code);
    const r = f?.row || {};
    return [i + 1, etaLabel(s.eta_offset_s), s.code, r.parent_name || '', r.phone || '',
      (r.students || []).map((x) => x.name + (x.grade ? ` (${x.grade})` : '')).join(', '), f?.students ?? '', r.area_name || '',
      r.building || '', r.street || '', r.landmark || '', r.pickup_notes || '', f ? googleMapsUrl(f.lat, f.lng) : ''];
  });
  const trip = tripTimes();
  if (editing.start && trip) rows.unshift([0, trip.depart, t('Driver start point — leave'), '', '', '', '', '', '', '', '', t('{d} to stop 1', { d: km(trip.toFirstM) }), googleMapsUrl(editing.start[0], editing.start[1])]);
  const school = [Number(fleet.settings.school_lat), Number(fleet.settings.school_lng)];
  const pts = [...(editing.start ? [editing.start] : []), ...editing.stops.map((s) => [fams.get(s.code).lat, fams.get(s.code).lng]), school];
  const links = googleDirectionsLinks(pts);
  const arrival = String(fleet.settings.school_arrival_time).slice(0, 5);
  await downloadExcel(`Driver-sheet-${bus.bus_number.replace(/\W+/g, '-')}-${today()}.xlsx`, [
    {
      name: bus.bus_number,
      header: ['Stop', 'Pickup ~', 'Registration', 'Parent', 'Phone', 'Students', 'Count', 'Area', 'Building/Villa', 'Street', 'Landmark', 'Notes', 'Map'].map((h) => t(h)),
      rows: [
        ...rows,
        [],
        [t('School'), arrival, fleet.settings.school_name],
        [],
        [t('Bus'), bus.bus_number, t('Capacity {n}', { n: bus.capacity }), `${t('Driver:')} ${bus.driver_name || '—'} ${bus.driver_phone || ''}`, `${t('Supervisor:')} ${bus.supervisor_name || '—'} ${bus.supervisor_phone || ''}`],
        [t('Route'), t(editing.status || 'unsaved'), editing.distance_m ? km(editing.distance_m) : '', editing.est_total_s ? t('about {t}', { t: mins(editing.est_total_s) }) : '',
          trip ? `${editing.start ? `${t('Leave start {time}', { time: trip.depart })} · ` : ''}${t('First pickup {time}', { time: trip.firstPickup || '—' })} · ${t('School {time}', { time: arrival })}` : ''],
        ...links.map((l, i) => [t('Directions {i}/{n}', { i: i + 1, n: links.length }), l]),
      ],
      widths: [6, 8, 11, 22, 15, 34, 6, 14, 18, 16, 20, 24, 36],
    },
  ], { banner: t("CONFIDENTIAL — FOR THE BUS DRIVER / SUPERVISOR ONLY. Contains children's pickup locations and parent phone numbers.") });
}

// ===========================================================================
// SETTINGS
// ===========================================================================

export async function renderSettings(panel) {
  killMap();
  await loadFleet();
  const s = fleet.settings;
  panel.innerHTML = `<form class="sj-card sj-formcard" style="max-width:720px" novalidate>
    <h2>${tt('Route & assignment settings')}</h2>
    <div class="sj-field"><label>${tt('School (morning destination)')}</label><input name="school_name" value="${esc(s.school_name)}" maxlength="120"></div>
    <div class="sj-field"><span class="sj-label">${tt('School location')}</span>
      <div class="sj-inline" style="flex-wrap:wrap"><span data-school dir="ltr">${Number(s.school_lat).toFixed(6)}, ${Number(s.school_lng).toFixed(6)}</span>
        <button type="button" class="sj-btn sj-btn-sm" data-move-school>${tt('Change on map')}</button></div>
      <div class="rg-preview" style="height:200px"></div></div>
    <div class="sj-row">
      <div class="sj-field"><label>${tt('School arrival time')}</label><input name="school_arrival_time" type="time" value="${esc(String(s.school_arrival_time).slice(0, 5))}"></div>
      <div class="sj-field"><label>${tt('Default seats per bus')}</label><input name="default_bus_capacity" type="number" min="1" max="100" value="${s.default_bus_capacity ?? 26}"></div>
    </div>
    <div class="sj-row">
      <div class="sj-field"><label>${tt('Default spare seats (%)')}</label><input name="default_reserve_pct" type="number" min="0" max="50" value="${s.default_reserve_pct}"></div>
    </div>
    <div class="sj-row">
      <div class="sj-field"><label>${tt('Time per stop (seconds)')}</label><input name="dwell_seconds" type="number" min="0" max="900" value="${s.dwell_seconds}"></div>
      <div class="sj-field"><label>${tt('Traffic factor (× free-flow time)')}</label><input name="traffic_factor" type="number" step="0.1" min="1" max="4" value="${s.traffic_factor}"></div>
    </div>
    <div class="sj-row">
      <div class="sj-field"><label>${tt('Grouping distance for auto-assign (m)')}</label><input name="cluster_distance_m" type="number" min="100" max="3000" value="${s.cluster_distance_m}"></div>
      <div class="sj-field"><label>${tt('Share a bus if groups are within (km)')}</label><input name="merge_distance_km" type="number" step="0.5" min="0.5" max="30" value="${s.merge_distance_km}"></div>
    </div>
    <div class="sj-field"><label class="sj-check" style="display:flex"><input type="checkbox" name="auto_join_enabled" ${s.auto_join_enabled ? 'checked' : ''}>
      <span>${tt('Put new registrations on a nearby bus automatically')}</span></label>
      <div class="sj-help">${tt("When a family registers (or edits before being assigned), it joins a bus that has a family close by, or else the bus serving its area (the most common area among that bus's families) if it is within the second distance — only if that bus has seats for the whole family (spare seats respected). Never over capacity; locked and inactive buses are skipped; families you placed or removed yourself are never re-assigned automatically.")}</div></div>
    <div class="sj-row">
      <div class="sj-field"><label>${tt('Join any bus with a family within (m)')}</label><input name="auto_join_max_m" type="number" min="100" max="5000" step="50" value="${s.auto_join_max_m ?? 1000}"></div>
      <div class="sj-field"><label>${tt("Join the bus serving the family's area within (m, 0 = off)")}</label><input name="auto_join_area_max_m" type="number" min="0" max="20000" step="500" value="${s.auto_join_area_max_m ?? 5000}"></div>
    </div>
    <div class="sj-field"><label>${tt('Routing service')}</label><select name="routing_provider">
      <option value="osrm">${tt('OSRM (recommended — realistic Cairo driving times)')}</option>
      <option value="valhalla">${tt('Valhalla (estimates slow speeds in Cairo — times come out too long)')}</option>
      <option value="straight">${tt('Straight-line estimate only (no external service)')}</option></select>
      <div class="sj-help">${tt('Road times are for empty roads; the traffic factor above adds morning traffic (with OSRM, about 1.2–1.4 is typical). Only coordinates are sent, through the server — never names, phones or IDs. If the chosen service fails, the other is tried automatically.')}</div></div>
    <div class="sj-formfoot"><button type="submit" class="sj-btn sj-btn-primary">${tt('Save settings')}</button></div></form>`;
  const form = panel.querySelector('form');
  form.routing_provider.value = s.routing_provider;
  let school = { lat: Number(s.school_lat), lng: Number(s.school_lng) };
  const L = await loadLeaflet();
  const prev = panel.querySelector('.rg-preview');
  const drawSchool = () => {
    if (prev._map) prev._map.remove();
    const m = L.map(prev, { zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false }).setView([school.lat, school.lng], 15);
    addTiles(L, m);
    L.marker([school.lat, school.lng], { icon: pinIcon(L, '#15803d') }).addTo(m);
    prev._map = m;
  };
  drawSchool();
  panel.querySelector('[data-move-school]').addEventListener('click', async () => {
    const r = await openPicker({ initial: { latitude: school.lat, longitude: school.lng, location_source: 'map' } });
    if (r && confirm(t('Change the school location? All morning routes will end at the new point (existing routes keep their saved line until regenerated).'))) {
      school = { lat: r.latitude, lng: r.longitude };
      panel.querySelector('[data-school]').textContent = `${school.lat.toFixed(6)}, ${school.lng.toFixed(6)}`;
      drawSchool();
    }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(form));
    try {
      await ctx.call('/admin/settings', { method: 'POST', body: { ...fd, auto_join_enabled: form.auto_join_enabled.checked, school_lat: school.lat, school_lng: school.lng } });
      toast(t('Settings saved'));
    } catch (err) { toast(t(err.message), 5000); }
  });
}
