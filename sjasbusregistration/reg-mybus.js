// SJAS Bus Registration — parent maps.
//   renderDemandMap: school-wide anonymous demand bubbles (no individual points exist in the data).
//   renderMyBusRoute: the family's OWN bus route; the server decides which bus and has already
//   applied every family's sharing choices (hidden pickups arrive displaced and anonymous).

import { esc, num } from './reg-common.js?v=5';
import { t } from './reg-i18n.js?v=5';
import { addTiles, loadLeaflet } from './reg-map.js?v=5';

const schoolIcon = (L, name) => L.divIcon({ className: '', html: `<div class="rg-centroid">🏫 <bdi>${esc(name)}</bdi></div>`, iconSize: [160, 20], iconAnchor: [80, 10] });

export async function renderDemandMap(el, demand) {
  const L = await loadLeaflet();
  if (el._map) el._map.remove();
  const school = demand.school.position;
  const map = L.map(el, { scrollWheelZoom: false }).setView(school, 11);
  el._map = map;
  addTiles(L, map);
  L.marker(school, { icon: schoolIcon(L, demand.school.name), interactive: false }).addTo(map);
  const pts = [school];
  for (const b of demand.bubbles) {
    const r = 220 + Math.sqrt(b.students) * 90;
    L.circle([b.lat, b.lng], { radius: r, color: '#0e7490', weight: 1, fillColor: '#0e7490', fillOpacity: 0.22 })
      .bindTooltip(t('{n} students near this area', { n: num(b.students) }), { direction: 'top' })
      .addTo(map);
    L.marker([b.lat, b.lng], {
      interactive: false,
      icon: L.divIcon({ className: '', html: `<div class="rg-dot" style="background:#0e7490;width:34px;height:34px;font-size:13px">${num(b.students)}</div>`, iconSize: [34, 34], iconAnchor: [17, 17] }),
    }).addTo(map);
    pts.push([b.lat, b.lng]);
  }
  if (pts.length > 1) map.fitBounds(pts, { padding: [30, 30], maxZoom: 13 });
  setTimeout(() => map.invalidateSize(), 100);
}

export async function renderMyBusRoute(el, r) {
  const L = await loadLeaflet();
  if (el._map) el._map.remove();
  const map = L.map(el).setView(r.school.position, 12);
  el._map = map;
  addTiles(L, map);
  const pts = [r.school.position];
  if (r.geometry?.length) L.polyline(r.geometry, { color: '#0e7490', weight: 5, opacity: 0.75, interactive: false }).addTo(map);
  L.marker(r.school.position, { icon: schoolIcon(L, r.school.name), interactive: false }).addTo(map);
  if (r.start) {
    L.marker(r.start, { interactive: false, icon: L.divIcon({ className: '', html: `<div class="rg-centroid" style="background:#15803d">${esc(t('Start'))}</div>`, iconSize: [60, 20], iconAnchor: [30, 10] }) }).addTo(map);
    pts.push(r.start);
  }
  for (const s of r.stops) {
    if (!s.position) continue;
    pts.push(s.position);
    const size = s.you ? 40 : 28;
    const style = s.you
      ? 'background:#c2410c;border:3px solid #fff;font-size:12px'
      : s.approximate ? 'background:#98a2b3;border:2px dashed #fff' : 'background:#0e7490';
    const m = L.marker(s.position, {
      zIndexOffset: s.you ? 1000 : 0,
      icon: L.divIcon({ className: '', html: `<div class="rg-dot" style="${style};width:${size}px;height:${size}px">${s.you ? esc(t('YOU')) : s.n}</div>`, iconSize: [size, size], iconAnchor: [size / 2, size / 2] }),
    }).addTo(map);
    const lines = [`<b>${esc(t('Stop {n}', { n: s.n }))}${s.you ? ` — ${esc(t('YOU'))}` : ''}</b>`];
    if (s.parent) lines.push(`<bdi>${esc(s.parent)}</bdi>`);
    if (s.children) lines.push(s.children.map((c) => `<bdi>${esc(c)}</bdi>`).join(', '));
    if (s.phone) lines.push(`<a href="tel:${esc(s.phone)}" dir="ltr">${esc(s.phone)}</a>`);
    lines.push(esc(s.students === 1 ? t('1 student') : t('{n} students', { n: s.students })));
    if (s.you && s.eta) lines.push(esc(t('Estimated pickup {time}', { time: s.eta })));
    if (s.approximate) lines.push(`<span style="color:#667085">${esc(t('Approximate position — this family keeps its exact pickup point private.'))}</span>`);
    m.bindPopup(`<div class="rg-popup">${lines.join('<br>')}</div>`);
  }
  map.fitBounds(pts, { padding: [30, 30], maxZoom: 15 });
  setTimeout(() => map.invalidateSize(), 100);
}
