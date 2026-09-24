// SJAS Bus Registration — geographic demand clustering (admin only, in-browser).
//
// DBSCAN on real distances between pickup pins:
//   - two families are neighbours if their pins are within `epsM` metres;
//   - a cluster is at least `minFamilies` families connected through neighbours;
//   - everyone else is "isolated".
// Nothing is stored; changing the distance simply recomputes. Deterministic:
// points are processed in registration-number order.

import { distanceM } from './reg-common.js?v=3';

/** points: [{ lat, lng, ...}] → labels: cluster index (0..k-1) or -1 for isolated. */
export function dbscan(points, epsM = 500, minFamilies = 3) {
  const n = points.length;
  const labels = new Array(n).fill(undefined);
  // Grid index (cell ≈ eps) so neighbour search stays fast for thousands of points.
  const dLat = epsM / 111320;
  const cells = new Map();
  const cellOf = (p) => {
    const dLng = epsM / (111320 * Math.cos((p.lat * Math.PI) / 180));
    return [Math.floor(p.lat / dLat), Math.floor(p.lng / dLng)];
  };
  points.forEach((p, i) => {
    const [a, b] = cellOf(p);
    const k = `${a}:${b}`;
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k).push(i);
  });
  const neighbours = (i) => {
    const p = points[i];
    const [a, b] = cellOf(p);
    const out = [];
    for (let x = a - 1; x <= a + 1; x++) {
      for (let y = b - 1; y <= b + 1; y++) {
        for (const j of cells.get(`${x}:${y}`) || []) {
          if (distanceM(p.lat, p.lng, points[j].lat, points[j].lng) <= epsM) out.push(j);
        }
      }
    }
    return out;
  };

  let cluster = 0;
  for (let i = 0; i < n; i++) {
    if (labels[i] !== undefined) continue;
    const nb = neighbours(i);
    if (nb.length < minFamilies) { labels[i] = -1; continue; }
    labels[i] = cluster;
    const queue = nb.filter((j) => j !== i);
    for (let q = 0; q < queue.length; q++) {
      const j = queue[q];
      if (labels[j] === -1) labels[j] = cluster; // border point
      if (labels[j] !== undefined) continue;
      labels[j] = cluster;
      const nb2 = neighbours(j);
      if (nb2.length >= minFamilies) for (const k of nb2) if (labels[k] === undefined || labels[k] === -1) queue.push(k);
    }
    cluster++;
  }
  return labels;
}

/** Convex hull (monotone chain) of [{lat,lng}] → [[lat,lng], ...]. */
export function hull(pts) {
  const p = pts.map((x) => [x.lng, x.lat]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p.map(([x, y]) => [y, x]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  const upper = [];
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)].map(([x, y]) => [y, x]);
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const clusterName = (i) => (i < 26 ? LETTERS[i] : LETTERS[Math.floor(i / 26) - 1] + LETTERS[i % 26]);

export const PALETTE = ['#0e7490', '#c2410c', '#7c3aed', '#15803d', '#be123c', '#a16207', '#1d4ed8', '#0f766e', '#9333ea', '#b45309', '#4d7c0f', '#db2777'];

/**
 * rows: admin rows with latitude/longitude/student_count/area_name.
 * Returns { clusters: [{ name, color, rows, families, students, center, dominantArea, mismatches, share }], isolated: {rows, families, students} }
 * Clusters are sorted by students (largest = A).
 */
export function summarise(rows, epsM) {
  const pts = rows.map((r) => ({ lat: r.latitude, lng: r.longitude, r }));
  const labels = dbscan(pts, epsM, 3);
  const groups = new Map();
  const isolated = [];
  labels.forEach((l, i) => {
    if (l === -1) isolated.push(pts[i].r);
    else { if (!groups.has(l)) groups.set(l, []); groups.get(l).push(pts[i].r); }
  });
  const totalFamilies = rows.length || 1;
  const clusters = [...groups.values()]
    .map((g) => {
      const students = g.reduce((n, r) => n + r.student_count, 0);
      const byArea = new Map();
      for (const r of g) byArea.set(r.area_name, (byArea.get(r.area_name) || 0) + 1);
      const dominantArea = [...byArea].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))[0][0];
      return {
        rows: g,
        families: g.length,
        students,
        center: { lat: g.reduce((s, r) => s + r.latitude, 0) / g.length, lng: g.reduce((s, r) => s + r.longitude, 0) / g.length },
        dominantArea,
        mismatches: g.filter((r) => r.area_name !== dominantArea),
        share: g.length / totalFamilies,
      };
    })
    .sort((a, b) => b.students - a.students || b.families - a.families);
  clusters.forEach((c, i) => { c.name = clusterName(i); c.color = PALETTE[i % PALETTE.length]; });
  return {
    clusters,
    isolated: { rows: isolated, families: isolated.length, students: isolated.reduce((n, r) => n + r.student_count, 0) },
  };
}
