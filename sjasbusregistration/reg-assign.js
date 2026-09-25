// SJAS Bus Registration — automatic bus assignment (admin, in-browser, deterministic).
//
// Families (one registration = one unit, never split) are grouped by real pickup
// distance (DBSCAN), oversized groups are cut along their longest direction into
// balanced pieces, groups are packed onto buses (nearby buses first, otherwise the
// smallest empty bus that fits), leftovers go to the nearest bus with seats, and a
// short smoothing pass moves edge families to a clearly closer bus. Buses are
// filled to their TARGET seats (capacity − spare seats) and NEVER beyond capacity.
// Locked families and locked buses are never touched. Nothing is saved here.

import { distanceM } from './reg-common.js?v=19';
import { dbscan, clusterName } from './reg-cluster.js?v=19';
import { orderStops } from './reg-route.js?v=19';

export const targetSeats = (bus, pct) => Math.max(0, bus.capacity - (bus.reserve_seats ?? Math.ceil((bus.capacity * (pct || 0)) / 100)));

const centroid = (fams) => (fams.length
  ? { lat: fams.reduce((s, f) => s + f.lat, 0) / fams.length, lng: fams.reduce((s, f) => s + f.lng, 0) / fams.length }
  : null);
const weight = (fams) => fams.reduce((s, f) => s + f.students, 0);
const byCode = (a, b) => a.code.localeCompare(b.code);

/** Split a group into k geographically contiguous, student-balanced pieces. */
function splitGroup(fams, maxSeats) {
  const W = weight(fams);
  const k = Math.max(2, Math.ceil(W / maxSeats));
  const c = centroid(fams);
  const kx = 111320 * Math.cos((c.lat * Math.PI) / 180), ky = 110540;
  const pts = fams.map((f) => ({ f, x: (f.lng - c.lng) * kx, y: (f.lat - c.lat) * ky }));
  let cxx = 0, cyy = 0, cxy = 0;
  for (const p of pts) { cxx += p.x * p.x; cyy += p.y * p.y; cxy += p.x * p.y; }
  const theta = 0.5 * Math.atan2(2 * cxy, cxx - cyy); // main direction of spread
  pts.sort((a, b) => (a.x * Math.cos(theta) + a.y * Math.sin(theta)) - (b.x * Math.cos(theta) + b.y * Math.sin(theta)) || byCode(a.f, b.f));
  const pieces = [];
  let cur = [], acc = 0;
  for (const p of pts) {
    const boundary = (pieces.length + 1) * (W / k);
    if (cur.length && pieces.length < k - 1 && acc + p.f.students / 2 > boundary) { pieces.push(cur); cur = []; }
    cur.push(p.f);
    acc += p.f.students;
  }
  if (cur.length) pieces.push(cur);
  // A piece can still be too big (large families); split it again.
  return pieces.flatMap((pc) => (weight(pc) > maxSeats && pc.length > 1 ? splitGroup(pc, maxSeats) : [pc]));
}

/**
 * input: {
 *   families: [{ code, lat, lng, students, area, has_pin }],              // active registrations
 *   buses:    [{ id, bus_number, capacity, reserve_seats, active, assignments_locked, start_lat, start_lng }],
 *   current:  Map(code -> { bus_id, locked }),
 *   settings: { default_reserve_pct, cluster_distance_m, merge_distance_km },
 * }
 */
export function autoAssign({ families, buses, current, settings }) {
  const pct = settings.default_reserve_pct || 0;
  const merge = (settings.merge_distance_km || 3) * 1000;
  const eps = settings.cluster_distance_m || 500;
  const S = new Map(buses.filter((b) => b.active).map((b) => [b.id, { bus: b, target: targetSeats(b, pct), cap: b.capacity, members: [], fixed: [] }]));

  // 1. Fixed seats: locked families, families on locked buses, and pin-less families already on a bus.
  const free = [];
  const unassigned = [];
  for (const f of [...families].sort(byCode)) {
    const cur = current.get(f.code);
    const st = cur ? S.get(cur.bus_id) : null;
    if (cur && st && (cur.locked || st.bus.assignments_locked || !f.has_pin)) { st.fixed.push(f); continue; }
    if (!f.has_pin) { unassigned.push({ ...f, reason: 'No pickup pin' }); continue; }
    free.push(f);
  }
  const used = (st) => weight(st.fixed) + weight(st.members);
  const all = (st) => [...st.fixed, ...st.members];
  const open = () => [...S.values()].filter((st) => !st.bus.assignments_locked).sort((a, b) => a.bus.bus_number.localeCompare(b.bus.bus_number, 'en', { numeric: true }));
  const place = (st, fams, reason) => { for (const f of fams) st.members.push({ ...f, reason }); };
  const remTarget = (st) => st.target - used(st);
  const remCap = (st) => st.cap - used(st);
  const dist = (a, b) => (a && b ? distanceM(a.lat, a.lng, b.lat, b.lng) : Infinity);
  const busCenter = (st) => centroid(all(st)) || (st.bus.start_lat != null ? { lat: st.bus.start_lat, lng: st.bus.start_lng } : null);

  // 2. Geographic groups.
  const labels = dbscan(free.map((f) => ({ lat: f.lat, lng: f.lng })), eps, 3);
  const clusters = new Map();
  const singles = [];
  labels.forEach((l, i) => { if (l === -1) singles.push(free[i]); else { if (!clusters.has(l)) clusters.set(l, []); clusters.get(l).push(free[i]); } });
  const named = [...clusters.values()].sort((a, b) => weight(b) - weight(a) || byCode(a[0], b[0])).map((g, i) => ({ fams: g, name: `Cluster ${clusterName(i)}` }));

  // 3. Split groups bigger than the largest remaining target.
  const maxTarget = Math.max(0, ...open().map(remTarget));
  const groups = [];
  for (const g of named) {
    if (maxTarget > 0 && weight(g.fams) > maxTarget) {
      const parts = splitGroup(g.fams, maxTarget);
      parts.forEach((p, i) => groups.push({ fams: p, reason: `${g.name}, part ${i + 1} of ${parts.length}` }));
    } else groups.push({ fams: g.fams, reason: g.name });
  }
  groups.sort((a, b) => weight(b.fams) - weight(a.fams) || byCode(a.fams[0], b.fams[0]));

  // 4. Pack groups: nearby bus with target seats → smallest empty bus that fits → any nearby bus up to capacity.
  const choose = (w, center, limit) => {
    const fits = open().filter((st) => limit(st) >= w);
    const busy = fits.filter((st) => all(st).length).map((st) => ({ st, d: dist(busCenter(st), center) })).sort((a, b) => a.d - b.d);
    if (busy.length && busy[0].d <= merge) return busy[0].st;
    const empty = fits.filter((st) => !all(st).length).sort((a, b) => a.target - b.target || dist(busCenter(a), center) - dist(busCenter(b), center));
    if (empty.length) return empty[0];
    return busy.length ? busy[0].st : null;
  };
  for (const g of groups) {
    const w = weight(g.fams), c = centroid(g.fams);
    const st = choose(w, c, remTarget) || choose(w, c, remCap);
    if (st) place(st, g.fams, g.reason);
    else singles.push(...g.fams);
  }

  // 5. Leftover and isolated families: nearest bus with seats.
  singles.sort((a, b) => b.students - a.students || byCode(a, b));
  for (const f of singles) {
    const st = choose(f.students, f, remTarget) || choose(f.students, f, remCap);
    if (st) place(st, [f], 'Nearest bus with free seats');
    else unassigned.push({ ...f, reason: 'No bus has enough free seats' });
  }

  // 6. Smoothing: move an edge family to a clearly closer bus (never over capacity/target).
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const st of open()) {
      for (const f of [...st.members].sort(byCode)) {
        const others = st.members.filter((m) => m !== f);
        const d0 = dist(centroid([...st.fixed, ...others]), f);
        let best = null;
        for (const o of open()) {
          if (o === st || !all(o).length || remTarget(o) < f.students) continue;
          const d1 = dist(busCenter(o), f);
          if (d1 < 0.8 * d0 && (!best || d1 < best.d)) best = { o, d: d1 };
        }
        if (best) {
          st.members.splice(st.members.indexOf(f), 1);
          best.o.members.push({ ...f, reason: 'Moved to reduce spread' });
          moved = true;
        }
      }
    }
    if (!moved) break;
  }

  // Result: per-family target bus, per-bus stats, changes vs current.
  const next = new Map();
  for (const st of S.values()) for (const f of st.members) next.set(f.code, { bus_id: st.bus.id, reason: f.reason });
  const changes = [];
  for (const f of free) {
    const cur = current.get(f.code);
    const n = next.get(f.code);
    if ((cur?.bus_id || null) !== (n?.bus_id || null)) {
      changes.push({ registration_code: f.code, bus_id: n?.bus_id || null, reason: n?.reason || 'No bus has enough free seats', source: 'auto', locked: false });
    }
  }
  const stats = [...S.values()].map((st) => {
    const fams = all(st);
    const c = centroid(fams);
    const ds = fams.map((f) => dist(c, f)).sort((a, b) => a - b);
    return {
      bus_id: st.bus.id, bus_number: st.bus.bus_number, capacity: st.cap, target: st.target,
      families: fams.length, students: used(st), free: st.cap - used(st),
      spread_max_m: ds.length ? Math.round(ds[ds.length - 1]) : 0,
      spread_p90_m: ds.length ? Math.round(ds[Math.min(ds.length - 1, Math.floor(ds.length * 0.9))]) : 0,
      locked: st.bus.assignments_locked,
    };
  });
  const summary = {
    moved: changes.filter((c) => c.bus_id && current.get(c.registration_code)).length,
    newly_assigned: changes.filter((c) => c.bus_id && !current.get(c.registration_code)).length,
    unassigned: unassigned.length,
    unassigned_students: weight(unassigned),
    over_capacity: stats.filter((s) => s.students > s.capacity).length, // always 0 by construction
  };
  return { next, changes, unassigned, stats, summary };
}

/** Estimated morning route length (m): straight-line legs, stops ordered by the route optimiser. */
export function routeLengthM(fams, school) {
  if (!fams.length) return 0;
  const pts = [...fams, school];
  const d = pts.map((a) => pts.map((b) => distanceM(a.lat, a.lng, b.lat, b.lng)));
  const order = orderStops(d, fams.length);
  let m = d[order[order.length - 1]][fams.length];
  for (let i = 0; i < order.length - 1; i++) m += d[order[i]][order[i + 1]];
  return m;
}

/**
 * Area buses (suggestion): one bus per area, growing as families register.
 *  1. Families not on a bus join an EXISTING bus that already serves their area
 *     (its most common area) if their pin is within areaMaxM of one of its
 *     families and seats remain — same rule the server uses for new registrations.
 *  2. The rest are grouped by area. Groups for different spellings of the same
 *     place (pins ≤ mergeM apart on average) are combined while they fit one bus.
 *  3. A group bigger than one bus is split geographically ("Bus Madinaty 1", "… 2").
 * New buses are virtual (id "new:N", name "Bus <area>") until the admin creates
 * them. Buses are NOT filled to capacity — small areas get small buses for now.
 * Nothing is saved here.
 */
export function suggestAreaBuses({ families, buses, current, settings, capacity, school, mergeM = 2000, areaMaxM = 5000 }) {
  const pct = settings.default_reserve_pct || 0;
  const seats = targetSeats({ capacity, reserve_seats: null }, pct);
  const famByCode = new Map(families.map((f) => [f.code, f]));
  const next = new Map();
  const unassigned = families.filter((f) => !f.has_pin && !current.get(f.code)).map((f) => ({ ...f, reason: 'No pickup pin' }));

  // 1. Existing buses serving an area.
  const open = buses.filter((b) => b.active && !b.assignments_locked).map((b) => {
    const members = [...current].filter(([, a]) => a.bus_id === b.id).map(([code]) => famByCode.get(code)).filter(Boolean);
    const counts = new Map();
    for (const f of members) counts.set(f.area_id, (counts.get(f.area_id) || 0) + 1);
    const home = [...counts].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;
    return { bus: b, members, home, used: weight(members), target: targetSeats(b, pct) };
  });
  const free = families.filter((f) => f.has_pin && !current.get(f.code)).sort((a, b) => b.students - a.students || byCode(a, b));
  const rest = [];
  for (const f of free) {
    const options = open
      .filter((o) => o.home && o.home === f.area_id && o.used + f.students <= o.target)
      .map((o) => ({ o, d: Math.min(...o.members.filter((m) => m.has_pin).map((m) => distanceM(f.lat, f.lng, m.lat, m.lng))) }))
      .filter((x) => x.d <= areaMaxM)
      .sort((a, b) => a.d - b.d);
    if (options.length) {
      const o = options[0].o;
      o.used += f.students;
      o.members.push(f);
      next.set(f.code, { bus_id: o.bus.id, reason: `Area bus (${f.area})` });
    } else rest.push(f);
  }

  // 2. Group the rest by area, then combine duplicate spellings of the same place.
  const byArea = new Map();
  for (const f of rest) {
    if (!byArea.has(f.area_id)) byArea.set(f.area_id, { names: new Map(), fams: [] });
    const g = byArea.get(f.area_id);
    g.fams.push(f);
    g.names.set(f.area, (g.names.get(f.area) || 0) + 1);
  }
  let groups = [...byArea.values()].map((g) => ({ fams: g.fams, name: [...g.names].sort((a, b) => b[1] - a[1])[0][0] }))
    .sort((a, b) => weight(b.fams) - weight(a.fams) || a.name.localeCompare(b.name));
  for (let merged = true; merged;) {
    merged = false;
    outer: for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const a = groups[i], b = groups[j];
        const ca = centroid(a.fams), cb = centroid(b.fams);
        if (distanceM(ca.lat, ca.lng, cb.lat, cb.lng) <= mergeM && weight(a.fams) + weight(b.fams) <= seats) {
          a.fams = [...a.fams, ...b.fams];
          a.also = [...(a.also || []), b.name, ...(b.also || [])];
          groups.splice(j, 1);
          merged = true;
          break outer;
        }
      }
    }
  }

  // 3. Split areas bigger than one bus; name the new buses.
  const key = (x) => String(x).toLowerCase().replace(/\s+/g, '');
  const taken = new Set(buses.map((b) => key(b.bus_number)));
  const uniqueName = (base) => {
    let name = base.slice(0, 30), n = 2;
    while (taken.has(key(name))) name = `${base.slice(0, 26)} ${n++}`;
    taken.add(key(name));
    return name;
  };
  const virtual = [];
  const stats = [];
  for (const g of groups) {
    const parts = weight(g.fams) > seats && g.fams.length > 1 ? splitGroup(g.fams, seats) : [g.fams];
    parts.forEach((p, i) => {
      const id = `new:${virtual.length + 1}`;
      const bus_number = uniqueName(`Bus ${g.name}${parts.length > 1 ? ` ${i + 1}` : ''}`);
      virtual.push({ id, bus_number, capacity, reserve_seats: null, active: true, assignments_locked: false, virtual: true });
      for (const f of p) next.set(f.code, { bus_id: id, reason: `Area: ${f.area}` });
      const c = centroid(p);
      const ds = p.map((f) => distanceM(c.lat, c.lng, f.lat, f.lng)).sort((a, b) => a - b);
      stats.push({
        bus_id: id, bus_number, capacity, target: seats, families: p.length, students: weight(p), free: capacity - weight(p),
        spread_max_m: Math.round(ds[ds.length - 1]), spread_p90_m: Math.round(ds[Math.min(ds.length - 1, Math.floor(ds.length * 0.9))]),
        route_m: school ? Math.round(routeLengthM(p, school)) : 0, locked: false,
        areas: [g.name, ...(g.also || [])].join(' + '), far: ds.filter((d) => d > areaMaxM).length,
      });
    });
  }
  for (const o of open) {
    const joined = [...next].filter(([, n]) => n.bus_id === o.bus.id).length;
    stats.push({ bus_id: o.bus.id, bus_number: o.bus.bus_number, capacity: o.bus.capacity, target: o.target, families: o.members.length, students: o.used, free: o.bus.capacity - o.used, joined, locked: false });
  }
  const changes = [...next].map(([code, n]) => ({ registration_code: code, bus_id: n.bus_id, reason: n.reason, source: 'auto', locked: false }));
  const summary = { moved: 0, newly_assigned: changes.length, unassigned: unassigned.length, unassigned_students: weight(unassigned), over_capacity: 0, new_buses: virtual.length };
  return { next, changes, unassigned, stats, summary, virtual, area: true };
}
