// SJAS Bus Registration — suggested morning route order (admin, in-browser).
//
// Morning route: [optional depot] → pickup stops → school (always last).
// 1. Build an order backwards from the school, always to the nearest remaining stop
//    (so the route ENDS at the school and starts wherever is most efficient).
// 2. Improve it: reverse any section / swap / move single stops while the total
//    road time drops (asymmetric road times, so one-way streets are respected).
// Locked stops keep their exact position; only unlocked stops are re-ordered.

/**
 * dur: square matrix (seconds) over nodes [stop0..stopN-1, school, depot?]
 * locked: Map(position -> stopIndex) for stops that must stay at a position
 * returns an array of stop indices in visiting order.
 */
export function orderStops(dur, nStops, { hasDepot = false, locked = new Map() } = {}) {
  const SCHOOL = nStops, DEPOT = nStops + 1;
  const lockedStops = new Set(locked.values());
  const freeStops = [...Array(nStops).keys()].filter((i) => !lockedStops.has(i));

  const cost = (seq) => {
    let c = hasDepot ? dur[DEPOT][seq[0]] : 0;
    for (let i = 0; i < seq.length - 1; i++) c += dur[seq[i]][seq[i + 1]];
    return c + dur[seq[seq.length - 1]][SCHOOL];
  };

  // 1. Backward nearest neighbour from the school.
  const rest = new Set(freeStops);
  const back = [];
  let cur = SCHOOL;
  while (rest.size) {
    let best = null;
    for (const j of rest) if (best === null || dur[j][cur] < dur[best][cur] || (dur[j][cur] === dur[best][cur] && j < best)) best = j;
    back.unshift(best);
    rest.delete(best);
    cur = best;
  }
  const seq = [];
  let k = 0;
  for (let pos = 0; pos < nStops; pos++) seq.push(locked.has(pos) ? locked.get(pos) : back[k++]);
  if (nStops < 3) return seq;

  const isFree = (pos) => !locked.has(pos);
  let best = cost(seq);
  for (let iter = 0; iter < 200; iter++) {
    let improved = false;
    // 2-opt: reverse seq[i..j] when it contains no locked positions.
    for (let i = 0; i < nStops - 1; i++) {
      if (!isFree(i)) continue;
      for (let j = i + 1; j < nStops && isFree(j); j++) {
        const cand = [...seq.slice(0, i), ...seq.slice(i, j + 1).reverse(), ...seq.slice(j + 1)];
        const c = cost(cand);
        if (c < best - 0.5) { seq.splice(0, nStops, ...cand); best = c; improved = true; }
      }
    }
    // Swap two unlocked positions.
    for (let i = 0; i < nStops; i++) {
      if (!isFree(i)) continue;
      for (let j = i + 1; j < nStops; j++) {
        if (!isFree(j)) continue;
        const cand = [...seq];
        [cand[i], cand[j]] = [cand[j], cand[i]];
        const c = cost(cand);
        if (c < best - 0.5) { seq.splice(0, nStops, ...cand); best = c; improved = true; }
      }
    }
    // Move one stop within a run of unlocked positions.
    for (let i = 0; i < nStops; i++) {
      if (!isFree(i)) continue;
      for (let j = 0; j < nStops; j++) {
        if (i === j) continue;
        const lo = Math.min(i, j), hi = Math.max(i, j);
        let ok = true;
        for (let p = lo; p <= hi; p++) if (!isFree(p)) { ok = false; break; }
        if (!ok) continue;
        const cand = [...seq];
        const [x] = cand.splice(i, 1);
        cand.splice(j, 0, x);
        const c = cost(cand);
        if (c < best - 0.5) { seq.splice(0, nStops, ...cand); best = c; improved = true; }
      }
    }
    if (!improved) break;
  }
  return seq;
}

/**
 * Pickup time offsets (seconds before school arrival) for each stop in order.
 * legs: road legs in visiting order, [depot→s1?], s1→s2, …, sN→school.
 */
export function etaOffsets(legs, nStops, { hasDepot, trafficFactor = 1.5, dwellSeconds = 90 }) {
  const stopLegs = hasDepot ? legs.slice(1) : legs; // leg i = stop i → next
  const offsets = new Array(nStops).fill(0);
  let acc = 0;
  for (let i = nStops - 1; i >= 0; i--) {
    acc += (stopLegs[i]?.duration_s || 0) * trafficFactor + dwellSeconds;
    offsets[i] = Math.round(acc);
  }
  return offsets;
}

/** Google Maps directions links (max 9 waypoints per link), for driver sheets. */
export function googleDirectionsLinks(points) {
  const links = [];
  for (let i = 0; i < points.length - 1; i += 10) {
    const chunk = points.slice(i, i + 11);
    if (chunk.length < 2) break;
    const fmt = (p) => `${p[0]},${p[1]}`;
    const url = new URL('https://www.google.com/maps/dir/');
    url.searchParams.set('api', '1');
    url.searchParams.set('origin', fmt(chunk[0]));
    url.searchParams.set('destination', fmt(chunk[chunk.length - 1]));
    if (chunk.length > 2) url.searchParams.set('waypoints', chunk.slice(1, -1).map(fmt).join('|'));
    url.searchParams.set('travelmode', 'driving');
    links.push(url.toString());
  }
  return links;
}
