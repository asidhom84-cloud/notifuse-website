// SJAS Bus Registration — admin: fleet, bus assignment, routes, settings, driver sheets.

import { appleMapsUrl, downloadExcel, esc, fmtDateTime, googleMapsUrl, num, openModal, toast, today } from './reg-common.js?v=6';
import { addTiles, loadLeaflet, openPicker, pinIcon } from './reg-map.js?v=6';
import { hull, PALETTE } from './reg-cluster.js?v=6';
import { autoAssign, suggestFleet, targetSeats } from './reg-assign.js?v=6';
import { etaOffsets, googleDirectionsLinks, orderStops } from './reg-route.js?v=6';

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
const km = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);
const mins = (s) => `${Math.round(s / 60)} min`;
const families = () => ctx.getRows().filter((r) => r.status === 'active').map((r) => ({
  code: r.registration_code, parent: r.parent_name, lat: r.latitude, lng: r.longitude, students: r.student_count,
  area: r.area_name, has_pin: typeof r.latitude === 'number', row: r,
}));
const assignmentMap = () => new Map(fleet.assignments.map((a) => [a.registration_code, a]));
function killMap() { if (map) { map.remove(); map = null; } }

// ===========================================================================
// BUSES: fleet + assignment
// ===========================================================================

export async function renderBuses(panel) {
  killMap();
  panel.innerHTML = '<div class="sj-loading">Loading fleet…</div>';
  try { await loadFleet(); } catch (e) { panel.innerHTML = `<div class="sj-note sj-note-err">${esc(e.message)}</div>`; return; }
  const fams = families();
  const amap = assignmentMap();
  const next = preview ? preview.next : null;
  const busOf = (code) => (next ? next.get(code)?.bus_id ?? (amap.get(code)?.locked || busById(amap.get(code)?.bus_id)?.assignments_locked ? amap.get(code)?.bus_id : null) : amap.get(code)?.bus_id) || null;
  const assigned = fams.filter((f) => amap.get(f.code));
  const needsReview = fleet.assignments.filter((a) => a.needs_review);
  const lastRun = fleet.runs.find((r) => !r.undone_at);
  const pct = fleet.settings.default_reserve_pct;

  const stats = preview ? new Map(preview.stats.map((s) => [s.bus_id, s])) : null;
  const card = (b) => {
    const s = stats?.get(b.id);
    const students = s ? s.students : b.students, famCount = s ? s.families : b.families;
    const free = b.capacity - students;
    const route = fleet.routes.filter((r) => r.bus_id === b.id);
    const appr = route.find((r) => r.status === 'approved'), draft = route.find((r) => r.status === 'draft');
    if (b.virtual) {
      return `<div class="rg-cluster" style="--c:${busColor(b.id)};cursor:default;border-style:dashed">
      <b>${esc(b.bus_number)} <span class="sj-badge sj-badge-warn">suggested — not created yet</span></b>
      ${num(students)} / ${num(b.capacity)} students · <b style="display:inline">${num(free)} free</b><br>
      <span class="sj-small sj-muted">${num(famCount)} families${s?.route_m ? ` · route ~${km(s.route_m)}` : ''}${s?.areas ? ` · ${esc(s.areas)}` : ''}</span>
      <div class="sj-inline" style="margin-top:6px"><button type="button" class="sj-btn sj-btn-sm" data-show-bus="${esc(b.id)}">Map</button></div></div>`;
    }
    return `<div class="rg-cluster" style="--c:${busColor(b.id)};cursor:default">
      <b>${esc(b.bus_number)}${b.active ? '' : ' <span class="sj-badge">inactive</span>'}${b.assignments_locked ? ' 🔒' : ''}</b>
      ${num(students)} / ${num(b.capacity)} students · <b style="display:inline;color:${free < 0 ? 'var(--danger)' : 'inherit'}">${num(free)} free</b><br>
      <span class="sj-small sj-muted">${num(famCount)} families${s ? ` · spread ${km(s.spread_p90_m)} (90%)` : ''}${targetSeats(b, pct) < b.capacity ? ` · target ${targetSeats(b, pct)}` : ''}</span><br>
      <span class="sj-small">${appr ? `<span class="sj-badge ${appr.stale ? 'sj-badge-warn' : 'sj-badge-ok'}">Route v${appr.version} ${appr.stale ? 'needs review' : 'approved'}</span>` : draft ? `<span class="sj-badge sj-badge-warn">Draft route v${draft.version}</span>` : '<span class="sj-badge">No route</span>'}</span>
      <div class="sj-inline" style="margin-top:6px;flex-wrap:wrap">
        <button type="button" class="sj-btn sj-btn-sm" data-edit-bus="${esc(b.id)}">Edit</button>
        <button type="button" class="sj-btn sj-btn-sm" data-lock-bus="${esc(b.id)}">${b.assignments_locked ? 'Unlock' : 'Lock'}</button>
        <button type="button" class="sj-btn sj-btn-sm" data-show-bus="${esc(b.id)}">Map</button>
        <button type="button" class="sj-btn sj-btn-sm" data-route-bus="${esc(b.id)}">Route</button>
      </div></div>`;
  };

  panel.innerHTML = `
    <div class="sj-actions" style="margin-top:0">
      <button type="button" class="sj-btn" data-add-bus>+ Add bus</button>
      ${preview
        ? `<button type="button" class="sj-btn sj-btn-primary" data-apply>Apply ${num(preview.changes.length)} change(s)</button><button type="button" class="sj-btn" data-cancel-preview>Discard preview</button>`
        : `<button type="button" class="sj-btn sj-btn-primary" data-auto ${fleet.buses.some((b) => b.active) ? '' : 'disabled'}>⚙ Auto-assign (preview)</button>
           <button type="button" class="sj-btn" data-suggest="0">✨ Suggest buses (${num(fleet.settings.default_bus_capacity || 26)} seats each)</button>`}
      ${lastRun && !preview ? `<button type="button" class="sj-btn" data-undo="${esc(lastRun.id)}">↶ Undo last change (${esc(fmtDateTime(lastRun.created_at))})</button>` : ''}
    </div>
    ${preview?.virtual?.length ? `<div class="sj-note sj-note-info"><b>Suggestion — nothing is saved yet.</b>
      ${num(preview.virtual.length)} new bus(es) of ${num(preview.virtual[0].capacity)} seats (${preview.virtual.map((v) => esc(v.bus_number)).join(', ')}) would seat
      ${num(preview.summary.newly_assigned + preview.summary.moved)} families. Rename buses and add drivers after creating them.
      Applying creates these buses and assigns the families; you can undo the assignment afterwards.
      Estimated route length (straight-line, before road routing): ${preview.stats.map((st) => `${esc(st.bus_number)} ~${km(st.route_m || 0)}`).join(' · ')}.
      <div class="sj-inline" style="margin-top:6px">
        ${preview.extra > 0 ? `<button type="button" class="sj-btn sj-btn-sm" data-suggest="${preview.extra - 1}">− 1 bus</button>` : ''}
        <button type="button" class="sj-btn sj-btn-sm" data-suggest="${preview.extra + 1}">+ 1 bus</button></div></div>` : ''}
    ${preview ? `<div class="sj-note sj-note-info"><b>Preview — nothing is saved yet.</b>
      ${num(preview.summary.newly_assigned)} newly assigned · ${num(preview.summary.moved)} moved · ${num(preview.summary.unassigned)} unassigned (${num(preview.summary.unassigned_students)} students).
      Locked families and locked buses are unchanged. No bus goes over its capacity.</div>` : ''}
    ${ctx.openDuplicatePairs() ? `<div class="sj-note sj-note-warn">${ctx.openDuplicatePairs()} possible duplicate registration(s) are unresolved — they may use seats twice. Review them in the Duplicates tab first.</div>` : ''}
    <p class="sj-help" style="margin-top:0">${fleet.settings.auto_join_enabled ? `New registrations join a nearby bus automatically (within ${num(fleet.settings.auto_join_max_m)} m, seats permitting). ` : 'Automatic joining is off. '}${num(assigned.length)} of ${num(fams.length)} families assigned · ${num(fams.filter((f) => !f.has_pin).length)} without a pin · spare seats ${pct}% · clustering ${fleet.settings.cluster_distance_m} m</p>
    <div class="rg-clusters">${allBuses().map(card).join('') || '<div class="sj-empty">No buses yet. Add your fleet first.</div>'}</div>
    <div class="rg-maptools" style="margin-top:14px">
      <label>Show <select data-busfilter><option value="all">All buses</option><option value="none">Unassigned only</option>
        ${allBuses().map((b) => `<option value="${esc(b.id)}">${esc(b.bus_number)}</option>`).join('')}</select></label>
      <span class="sj-small sj-muted">Tap a family to move, lock or unassign it.</span>
    </div>
    <div class="rg-adminmap" style="height:56vh"></div>
    ${needsReview.length ? `<div class="sj-section"><h3>Needs review (${needsReview.length}) — family moved its pickup point after assignment</h3>
      ${needsReview.map((a) => `<div class="sj-inline" style="margin-bottom:6px;flex-wrap:wrap"><b>${esc(a.registration_code)}</b> on ${esc(busById(a.bus_id)?.bus_number || '?')}
        <button type="button" class="sj-btn sj-btn-sm" data-open="${esc(a.registration_code)}">Open</button>
        <button type="button" class="sj-btn sj-btn-sm" data-confirm="${esc(a.registration_code)}">Keep on this bus</button></div>`).join('')}</div>` : ''}
    ${preview?.unassigned.length ? `<div class="sj-section"><h3>Not assigned in this preview</h3>${preview.unassigned.map((u) => `<div class="sj-small">${esc(u.code)} · ${u.students} student(s) — ${esc(u.reason)}</div>`).join('')}</div>` : ''}`;

  // --- map
  const L = await loadLeaflet();
  if (!panel.isConnected) return;
  const sel = panel.querySelector('[data-busfilter]');
  sel.value = ui.bus;
  map = L.map(panel.querySelector('.rg-adminmap')).setView([30.08, 31.55], 11);
  addTiles(L, map);
  const school = [Number(fleet.settings.school_lat), Number(fleet.settings.school_lng)];
  L.marker(school, { icon: L.divIcon({ className: '', html: '<div class="rg-centroid">🏫 School</div>', iconSize: [70, 20], iconAnchor: [35, 10] }) }).addTo(map);
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
        toast('Kept on the same bus');
        return renderBuses(panel);
      }
      if (b.dataset.auto !== undefined) {
        preview = autoAssign({ families: fams, buses: fleet.buses, current: new Map(fleet.assignments.map((a) => [a.registration_code, a])), settings: fleet.settings });
        if (!preview.changes.length) { preview = null; toast('Nothing to change — current assignments already match the suggestion.'); }
        return renderBuses(panel);
      }
      if (b.dataset.suggest !== undefined) {
        const capacity = Number(fleet.settings.default_bus_capacity) || 26;
        const school = { lat: Number(fleet.settings.school_lat), lng: Number(fleet.settings.school_lng) };
        preview = suggestFleet({ families: fams, buses: fleet.buses, current: new Map(fleet.assignments.map((a) => [a.registration_code, a])), settings: fleet.settings, capacity, school, extra: Number(b.dataset.suggest) || 0 });
        const areaOf = new Map(fams.map((f) => [f.code, f.area]));
        for (const st of preview.stats) {
          const counts = new Map();
          for (const [code, n] of preview.next) if (n.bus_id === st.bus_id) counts.set(areaOf.get(code), (counts.get(areaOf.get(code)) || 0) + 1);
          st.areas = [...counts].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([a, c]) => `${a} ${c}`).join(', ');
        }
        if (!preview.changes.length) { preview = null; toast('Nothing to suggest — every family with a pin already has a seat.'); }
        ui.bus = 'all';
        return renderBuses(panel);
      }
      if (b.dataset.cancelPreview !== undefined) { preview = null; ui.bus = 'all'; return renderBuses(panel); }
      if (b.dataset.apply !== undefined) {
        const virtual = preview.virtual || [];
        if (virtual.length && !confirm(`Create ${virtual.length} new bus(es) (${virtual.map((v) => v.bus_number).join(', ')}) with ${virtual[0].capacity} seats each, and assign ${preview.changes.filter((c) => c.bus_id).length} families?`)) return;
        b.disabled = true;
        const ids = new Map();
        for (const v of virtual) {
          const r = await ctx.call('/admin/buses', { method: 'POST', body: { bus_number: v.bus_number, capacity: v.capacity } });
          ids.set(v.id, r.id);
        }
        const changes = preview.changes.map((c) => (ids.has(c.bus_id) ? { ...c, bus_id: ids.get(c.bus_id) } : c));
        await ctx.call('/admin/assignments/apply', { method: 'POST', body: { kind: 'auto', changes, params: fleet.settings, summary: { ...preview.summary, buses_created: virtual.length } } });
        toast(`Applied ${preview.changes.length} change(s)`);
        preview = null;
        return renderBuses(panel);
      }
      if (b.dataset.undo) {
        if (!confirm('Undo the most recent assignment change? All assignments return to exactly how they were before it.')) return;
        await ctx.call('/admin/assignments/undo', { method: 'POST', body: { run_id: b.dataset.undo } });
        toast('Undone');
        return renderBuses(panel);
      }
    } catch (err) { toast(err.message, 5000); b.disabled = false; }
  };
  sel.addEventListener('change', () => { ui.bus = sel.value; renderBuses(panel); });

  async function manualChange(code, busId, locked) {
    const body = { kind: 'manual', changes: [{ registration_code: code, bus_id: busId, locked: busId ? locked : false, reason: 'Manual', source: 'manual' }] };
    try {
      await ctx.call('/admin/assignments/apply', { method: 'POST', body });
    } catch (err) {
      if (err.code === 'over_capacity' && confirm(`${err.message}\n\nAssign anyway? The bus will be shown as over capacity.`)) {
        await ctx.call('/admin/assignments/apply', { method: 'POST', body: { ...body, allow_over_capacity: true } });
      } else if (err.code !== 'over_capacity') return toast(err.message, 5000);
      else return;
    }
    toast('Saved');
    preview = null;
    renderBuses(panel);
  }
}

function familyPopup(f, bid, a) {
  return `<div class="rg-popup"><b>${esc(f.code)} · ${esc(f.parent)}</b><br>${f.students} student(s) · ${esc(f.area)}<br>
    Bus: <b>${bid ? esc(busById(bid)?.bus_number) : 'not assigned'}</b>${a?.reason ? ` <span style="color:#667085">(${esc(a.reason)})</span>` : ''}${a?.needs_review ? '<br><b style="color:#b42318">Needs review: pickup moved</b>' : ''}
    <div style="margin-top:6px">Move to <select data-move style="font-size:13px"><option value="">— Unassign —</option>
      ${fleet.buses.filter((b) => b.active).map((b) => `<option value="${esc(b.id)}" ${b.id === bid ? 'selected' : ''}>${esc(b.bus_number)} (${b.capacity - b.students} free)</option>`).join('')}</select>
      <label style="font-size:12px"><input type="checkbox" data-lockbox ${a?.locked || !a ? 'checked' : ''}> lock</label></div>
    <div class="acts"><button type="button" data-move-go="${esc(f.code)}">Save</button><button type="button" data-open="${esc(f.code)}">Open</button></div></div>`;
}

function busDialog(bus) {
  const body = document.createElement('div');
  const v = (k) => esc(bus?.[k] ?? '');
  body.innerHTML = `<form class="sj-form" novalidate>
    <div class="sj-row">
      <div class="sj-field"><label>Bus number / name *</label><input name="bus_number" maxlength="30" value="${v('bus_number')}" required></div>
      <div class="sj-field"><label>Capacity (student seats) *</label><input name="capacity" type="number" min="1" max="100" value="${bus ? v('capacity') : esc(fleet.settings.default_bus_capacity ?? 26)}" required></div>
    </div>
    <div class="sj-field"><label>Reserved seats <span class="sj-opt">(optional — overrides the default spare-seat %)</span></label><input name="reserve_seats" type="number" min="0" max="100" value="${v('reserve_seats')}"></div>
    <div class="sj-row">
      <div class="sj-field"><label>Driver name</label><input name="driver_name" maxlength="80" value="${v('driver_name')}"></div>
      <div class="sj-field"><label>Driver phone</label><input name="driver_phone" maxlength="40" value="${v('driver_phone')}" dir="ltr"></div>
    </div>
    <div class="sj-row">
      <div class="sj-field"><label>Supervisor name</label><input name="supervisor_name" maxlength="80" value="${v('supervisor_name')}"></div>
      <div class="sj-field"><label>Supervisor phone</label><input name="supervisor_phone" maxlength="40" value="${v('supervisor_phone')}" dir="ltr"></div>
    </div>
    <div class="sj-field"><label>Start point / depot <span class="sj-opt">(optional)</span></label>
      <div class="sj-inline" style="flex-wrap:wrap"><span data-start>${bus?.start_lat != null ? `${bus.start_lat.toFixed(5)}, ${bus.start_lng.toFixed(5)}` : 'Not set — routes start at the most efficient first stop'}</span>
        <button type="button" class="sj-btn sj-btn-sm" data-pick-start>Set on map</button><button type="button" class="sj-btn sj-btn-sm" data-clear-start>Clear</button></div></div>
    <div class="sj-field"><label>Notes</label><textarea name="notes" maxlength="1000">${v('notes')}</textarea></div>
    <label class="sj-check"><input type="checkbox" name="active" ${bus ? (bus.active ? 'checked' : '') : 'checked'}> <span>Active (available for assignment)</span></label>
    <div class="sj-note sj-note-err" data-err hidden></div>
    <div class="sj-formfoot">${bus ? '<button type="button" class="sj-btn sj-btn-danger" data-del>Delete bus</button>' : ''}<button type="submit" class="sj-btn sj-btn-primary">Save</button></div>
  </form>`;
  const modal = openModal(bus ? `Edit ${bus.bus_number}` : 'Add bus', body);
  const form = body.querySelector('form');
  let start = bus?.start_lat != null ? { lat: bus.start_lat, lng: bus.start_lng } : null;
  body.querySelector('[data-pick-start]').addEventListener('click', async () => {
    const r = await openPicker({ initial: start ? { latitude: start.lat, longitude: start.lng, location_source: 'map' } : null, center: { lat: Number(fleet.settings.school_lat), lng: Number(fleet.settings.school_lng) } });
    if (r) { start = { lat: r.latitude, lng: r.longitude }; body.querySelector('[data-start]').textContent = `${start.lat.toFixed(5)}, ${start.lng.toFixed(5)}`; }
  });
  body.querySelector('[data-clear-start]').addEventListener('click', () => { start = null; body.querySelector('[data-start]').textContent = 'Not set'; });
  body.querySelector('[data-del]')?.addEventListener('click', async () => {
    if (!confirm(`Delete ${bus.bus_number}? Only possible when no family is assigned to it.`)) return;
    try { await ctx.call(`/admin/buses/${bus.id}`, { method: 'POST', body: { action: 'delete' } }); modal.close(); ctx.switchTab('buses'); } catch (e) { toast(e.message, 5000); }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(form));
    const payload = { ...fd, active: form.active.checked, start_lat: start?.lat ?? null, start_lng: start?.lng ?? null };
    try {
      await ctx.call(bus ? `/admin/buses/${bus.id}` : '/admin/buses', { method: 'POST', body: payload });
      modal.close();
      toast('Bus saved');
      ctx.switchTab('buses');
    } catch (err) {
      const el = body.querySelector('[data-err]');
      el.textContent = err.message;
      el.hidden = false;
    }
  });
}

// ===========================================================================
// ROUTES
// ===========================================================================

export async function renderRoutes(panel) {
  killMap();
  panel.innerHTML = '<div class="sj-loading">Loading routes…</div>';
  try { await loadFleet(); } catch (e) { panel.innerHTML = `<div class="sj-note sj-note-err">${esc(e.message)}</div>`; return; }
  const buses = fleet.buses.filter((b) => b.families > 0);
  if (!buses.length) { panel.innerHTML = '<div class="sj-empty">Assign families to buses first (Buses tab).</div>'; return; }
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

  panel.innerHTML = `
    <div class="rg-maptools">
      <label>Bus <select data-bus>${buses.map((b) => `<option value="${esc(b.id)}" ${b.id === bus.id ? 'selected' : ''}>${esc(b.bus_number)} (${b.families} families)</option>`).join('')}</select></label>
      <span class="sj-small">${saved.approved ? `<span class="sj-badge ${stale.approved ? 'sj-badge-warn' : 'sj-badge-ok'}">Approved v${saved.approved.version}${stale.approved ? ' — needs review' : ''}</span>` : '<span class="sj-badge">No approved route</span>'}
        ${saved.draft ? ` <span class="sj-badge sj-badge-warn">Draft v${saved.draft.version}${stale.draft ? ' — out of date' : ''}</span>` : ''}
        ${editing.dirty ? ' <span class="sj-badge sj-badge-danger">Unsaved changes</span>' : ''}</span>
    </div>
    <div class="sj-actions" style="margin-top:0">
      <button type="button" class="sj-btn sj-btn-primary" data-gen>Generate suggested route</button>
      <button type="button" class="sj-btn" data-reopt ${editing.stops.length ? '' : 'disabled'}>Re-optimise unlocked stops</button>
      <button type="button" class="sj-btn" data-line ${editing.stops.length ? '' : 'disabled'}>Update road line</button>
      <button type="button" class="sj-btn" data-save ${editing.stops.length && editing.geometry.length ? '' : 'disabled'}>Save draft</button>
      <button type="button" class="sj-btn" data-approve ${saved.draft && !editing.dirty ? '' : 'disabled'}>Approve route</button>
      <button type="button" class="sj-btn" data-sheet ${editing.stops.length ? '' : 'disabled'}>⬇ Driver sheet</button>
    </div>
    ${missing.length || extra.length ? `<div class="sj-note sj-note-warn">The families on this bus changed since this route was made
      (${missing.length} not on the route${extra.length ? `, ${extra.length} no longer on the bus` : ''}). Generate or re-optimise, then save.</div>` : ''}
    ${editing.provider === 'straight' ? '<div class="sj-note sj-note-warn">Road routing was unavailable — distances are straight-line estimates. Try "Update road line" again later.</div>' : ''}
    <p class="sj-help" style="margin-top:0">${num(editing.stops.length)} stops · ${num(editing.stops.reduce((n, s) => n + (fams.get(s.code)?.students || 0), 0))} students · capacity ${bus.capacity}
      ${editing.distance_m ? ` · ${km(editing.distance_m)}` : ''}${editing.est_total_s ? ` · about ${mins(editing.est_total_s)} incl. traffic ×${fleet.settings.traffic_factor} and ${fleet.settings.dwell_seconds}s per stop` : ''}
      · ends at ${esc(fleet.settings.school_name)} (arrival ${esc(String(fleet.settings.school_arrival_time).slice(0, 5))})</p>
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
        b.disabled = true; b.innerHTML = '<span class="sj-spin"></span> Calculating…';
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
          geometry: editing.geometry, start_lat: bus.start_lat, start_lng: bus.start_lng,
          total_distance_m: editing.distance_m, total_duration_s: editing.duration_s, est_total_s: editing.est_total_s, provider: editing.provider,
        } });
        editing.dirty = false;
        toast('Draft saved');
        return renderRoutes(panel);
      }
      if (b.dataset.approve !== undefined) {
        if (!confirm(`Approve this route for ${bus.bus_number}? Parents on this bus will then see their stop number, estimated pickup time and the bus route map.`)) return;
        await ctx.call(`/admin/routes/${bus.id}/approve`, { method: 'POST', body: {} });
        editing = null;
        toast('Route approved');
        return renderRoutes(panel);
      }
      if (b.dataset.sheet !== undefined) return driverSheet(bus, fams);
    } catch (err) { toast(err.message, 6000); b.disabled = false; b.textContent = label; }
  };
}

function fromSaved(bus, route, status) {
  if (!route) return { busId: bus.id, stops: [], geometry: [], dirty: false, status: null };
  return {
    busId: bus.id, status, dirty: false,
    stops: route.stops.filter((s) => s.registration_code).map((s) => ({ code: s.registration_code, locked: s.locked, leg_distance_m: s.leg_distance_m, leg_duration_s: s.leg_duration_s, eta_offset_s: s.eta_offset_s })),
    geometry: route.geometry || [], distance_m: route.total_distance_m, duration_s: route.total_duration_s, est_total_s: route.est_total_s, provider: route.provider,
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
  if (points.length > 90) throw new Error('Too many stops for one route (max 88).');
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
  editing.distance_m = p.distance_m;
  editing.duration_s = p.duration_s;
  editing.est_total_s = Math.round(p.duration_s * Number(fleet.settings.traffic_factor) + editing.stops.length * fleet.settings.dwell_seconds);
  editing.provider = p.provider;
  editing.dirty = true;
}

function etaLabel(offset) {
  if (offset == null) return '';
  const [h, m] = String(fleet.settings.school_arrival_time).split(':').map(Number);
  const t = h * 60 + m - Math.round(offset / 60);
  return `${String(Math.floor(((t % 1440) + 1440) % 1440 / 60)).padStart(2, '0')}:${String(((t % 60) + 60) % 60).padStart(2, '0')}`;
}

function drawRoute(L, fams, bus) {
  const school = [Number(fleet.settings.school_lat), Number(fleet.settings.school_lng)];
  const pts = [school];
  L.marker(school, { icon: L.divIcon({ className: '', html: `<div class="rg-centroid">🏫 ${esc(fleet.settings.school_name)}</div>`, iconSize: [160, 20], iconAnchor: [80, 10] }) }).addTo(map);
  if (bus.start_lat != null) {
    L.marker([bus.start_lat, bus.start_lng], { icon: L.divIcon({ className: '', html: '<div class="rg-centroid" style="background:#15803d">Start</div>', iconSize: [50, 20], iconAnchor: [25, 10] }) }).addTo(map);
    pts.push([bus.start_lat, bus.start_lng]);
  }
  if (editing.geometry.length) L.polyline(editing.geometry, { color: busColor(bus.id), weight: 5, opacity: 0.8 }).addTo(map);
  editing.stops.forEach((s, i) => {
    const f = fams.get(s.code);
    if (!f) return;
    pts.push([f.lat, f.lng]);
    L.marker([f.lat, f.lng], { icon: L.divIcon({ className: '', html: `<div class="rg-dot" style="background:${busColor(bus.id)};width:26px;height:26px;${s.locked ? 'outline:3px solid #101828;' : ''}">${i + 1}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] }) })
      .bindPopup(`<div class="rg-popup"><b>Stop ${i + 1} · ${esc(f.code)} · ${esc(f.parent)}</b><br>${f.students} student(s)${s.eta_offset_s != null ? ` · pickup ~${etaLabel(s.eta_offset_s)}` : ''}<br>
        <a href="${esc(googleMapsUrl(f.lat, f.lng))}" target="_blank" rel="noopener noreferrer">Google Maps</a> · <a href="${esc(appleMapsUrl(f.lat, f.lng))}" target="_blank" rel="noopener noreferrer">Apple Maps</a></div>`)
      .addTo(map);
  });
  map.fitBounds(pts, { padding: [30, 30], maxZoom: 15 });
  setTimeout(() => map && map.invalidateSize(), 100);
}

function renderStopList(el, fams, panel) {
  el.innerHTML = editing.stops.length ? `<ol style="list-style:none;margin:0;padding:0">${editing.stops.map((s, i) => {
    const f = fams.get(s.code);
    return `<li draggable="true" data-i="${i}" class="sj-card" style="padding:8px 10px;margin-bottom:6px;display:flex;gap:8px;align-items:center;${s.locked ? 'border-color:#101828' : ''}">
      <b style="min-width:26px">${i + 1}</b>
      <div style="flex:1;min-width:0"><b>${esc(s.code)}</b> · ${esc(f?.parent || '?')}<br><span class="sj-small sj-muted">${f?.students ?? '?'} student(s)${s.eta_offset_s != null ? ` · ~${etaLabel(s.eta_offset_s)}` : ''}${s.leg_distance_m != null ? ` · next ${km(s.leg_distance_m)}` : ''}</span></div>
      <button type="button" class="sj-iconbtn" style="width:34px;height:34px;font-size:1rem" data-up="${i}" aria-label="Earlier">▲</button>
      <button type="button" class="sj-iconbtn" style="width:34px;height:34px;font-size:1rem" data-down="${i}" aria-label="Later">▼</button>
      <button type="button" class="sj-iconbtn" style="width:34px;height:34px;font-size:1rem" data-lock="${i}" aria-label="Lock position">${s.locked ? '🔒' : '🔓'}</button>
      <button type="button" class="sj-iconbtn" style="width:34px;height:34px;font-size:1rem" data-rm="${i}" aria-label="Remove from bus">×</button></li>`;
  }).join('')}</ol><p class="sj-help">Drag or use ▲▼ to reorder. 🔒 keeps a stop in place when re-optimising. × removes the family from this bus. After reordering, use “Update road line”, then “Save draft”.</p>`
    : '<div class="sj-empty">No route yet. Click “Generate suggested route”.</div>';
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
      if (!confirm(`Remove ${s.code} from this bus? The family becomes unassigned (you can assign it to another bus in the Buses tab).`)) return;
      try {
        await ctx.call('/admin/assignments/apply', { method: 'POST', body: { kind: 'manual', changes: [{ registration_code: s.code, bus_id: null, reason: 'Removed from route', source: 'manual' }] } });
        editing.stops.splice(Number(b.dataset.rm), 1);
        editing.dirty = true;
        renderRoutes(panel);
      } catch (err) { toast(err.message, 5000); }
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
  const school = [Number(fleet.settings.school_lat), Number(fleet.settings.school_lng)];
  const pts = [...(bus.start_lat != null ? [[bus.start_lat, bus.start_lng]] : []), ...editing.stops.map((s) => [fams.get(s.code).lat, fams.get(s.code).lng]), school];
  const links = googleDirectionsLinks(pts);
  await downloadExcel(`Driver-sheet-${bus.bus_number.replace(/\W+/g, '-')}-${today()}.xlsx`, [
    {
      name: bus.bus_number,
      header: ['Stop', 'Pickup ~', 'Registration', 'Parent', 'Phone', 'Students', 'Count', 'Area', 'Building/Villa', 'Street', 'Landmark', 'Notes', 'Map'],
      rows: [
        ...rows,
        [],
        ['School', String(fleet.settings.school_arrival_time).slice(0, 5), fleet.settings.school_name],
        [],
        ['Bus', bus.bus_number, `Capacity ${bus.capacity}`, `Driver: ${bus.driver_name || '—'} ${bus.driver_phone || ''}`, `Supervisor: ${bus.supervisor_name || '—'} ${bus.supervisor_phone || ''}`],
        ['Route', editing.status || 'unsaved', editing.distance_m ? km(editing.distance_m) : '', editing.est_total_s ? `about ${mins(editing.est_total_s)}` : ''],
        ...links.map((l, i) => [`Directions ${i + 1}/${links.length}`, l]),
      ],
      widths: [6, 8, 11, 22, 15, 34, 6, 14, 18, 16, 20, 24, 36],
    },
  ], { banner: 'CONFIDENTIAL — FOR THE BUS DRIVER / SUPERVISOR ONLY. Contains children\'s pickup locations and parent phone numbers.' });
}

// ===========================================================================
// SETTINGS
// ===========================================================================

export async function renderSettings(panel) {
  killMap();
  await loadFleet();
  const s = fleet.settings;
  panel.innerHTML = `<form class="sj-card sj-formcard" style="max-width:720px" novalidate>
    <h2>Route & assignment settings</h2>
    <div class="sj-field"><label>School (morning destination)</label><input name="school_name" value="${esc(s.school_name)}" maxlength="120"></div>
    <div class="sj-field"><span class="sj-label">School location</span>
      <div class="sj-inline" style="flex-wrap:wrap"><span data-school dir="ltr">${Number(s.school_lat).toFixed(6)}, ${Number(s.school_lng).toFixed(6)}</span>
        <button type="button" class="sj-btn sj-btn-sm" data-move-school>Change on map</button></div>
      <div class="rg-preview" style="height:200px"></div></div>
    <div class="sj-row">
      <div class="sj-field"><label>School arrival time</label><input name="school_arrival_time" type="time" value="${esc(String(s.school_arrival_time).slice(0, 5))}"></div>
      <div class="sj-field"><label>Default seats per bus</label><input name="default_bus_capacity" type="number" min="1" max="100" value="${s.default_bus_capacity ?? 26}"></div>
    </div>
    <div class="sj-row">
      <div class="sj-field"><label>Default spare seats (%)</label><input name="default_reserve_pct" type="number" min="0" max="50" value="${s.default_reserve_pct}"></div>
    </div>
    <div class="sj-row">
      <div class="sj-field"><label>Time per stop (seconds)</label><input name="dwell_seconds" type="number" min="0" max="900" value="${s.dwell_seconds}"></div>
      <div class="sj-field"><label>Traffic factor (× free-flow time)</label><input name="traffic_factor" type="number" step="0.1" min="1" max="4" value="${s.traffic_factor}"></div>
    </div>
    <div class="sj-row">
      <div class="sj-field"><label>Grouping distance for auto-assign (m)</label><input name="cluster_distance_m" type="number" min="100" max="3000" value="${s.cluster_distance_m}"></div>
      <div class="sj-field"><label>Share a bus if groups are within (km)</label><input name="merge_distance_km" type="number" step="0.5" min="0.5" max="30" value="${s.merge_distance_km}"></div>
    </div>
    <div class="sj-field"><label class="sj-check" style="display:flex"><input type="checkbox" name="auto_join_enabled" ${s.auto_join_enabled ? 'checked' : ''}>
      <span>Put new registrations on a nearby bus automatically</span></label>
      <div class="sj-help">When a family registers (or edits before being assigned), it joins the bus whose nearest family is within the distance below — only if that bus has seats for the whole family (spare seats respected). Never over capacity; locked and inactive buses are skipped; families you placed or removed yourself are never re-assigned automatically.</div></div>
    <div class="sj-field"><label>Nearby distance for automatic joining (m)</label><input name="auto_join_max_m" type="number" min="100" max="5000" step="50" value="${s.auto_join_max_m ?? 1000}"></div>
    <div class="sj-field"><label>Routing service</label><select name="routing_provider">
      <option value="valhalla">Valhalla (OpenStreetMap, free public server)</option>
      <option value="osrm">OSRM (OpenStreetMap, free public server)</option>
      <option value="straight">Straight-line estimate only (no external service)</option></select>
      <div class="sj-help">Only coordinates are sent, through the server — never names, phones or IDs. If the chosen service fails, the other is tried automatically.</div></div>
    <div class="sj-formfoot"><button type="submit" class="sj-btn sj-btn-primary">Save settings</button></div></form>`;
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
    if (r && confirm('Change the school location? All morning routes will end at the new point (existing routes keep their saved line until regenerated).')) {
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
      toast('Settings saved');
    } catch (err) { toast(err.message, 5000); }
  });
}
