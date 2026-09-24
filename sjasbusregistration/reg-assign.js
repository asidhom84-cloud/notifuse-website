// SJAS Bus Registration — automatic bus assignment (admin, in-browser, deterministic).
//
// Families (one registration = one unit, never split) are grouped by real pickup
// distance (DBSCAN), oversized groups are cut along their longest direction into
// balanced pieces, groups are packed onto buses (nearby buses first, otherwise the
// smallest empty bus that fits), leftovers go to the nearest bus with seats, and a
// short smoothing pass moves edge families to a clearly closer bus. Buses are
// filled to their TARGET seats (capacity − spare seats) and NEVER beyond capacity.
// Locked families and locked buses are never touched. Nothing is saved here.

import { distanceM } from './reg-common.js?v=4';
import { dbscan, clusterName } from './reg-cluster.js?v=4';

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
