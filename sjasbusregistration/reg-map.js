// SJAS Bus Registration — maps (Leaflet + OpenStreetMap, search via Nominatim).
// No API keys and no personal data are sent to map providers: only map tiles
// for the visible area and the words typed into Search.

import { esc, GREATER_CAIRO, isFar, loadCss, loadScript, openLayer, toast } from './reg-common.js?v=16';
import { getLang, t } from './reg-i18n.js?v=16';

const CDN = 'https://cdnjs.cloudflare.com/ajax/libs';

export async function loadLeaflet() {
  await Promise.all([
    loadCss(`${CDN}/leaflet/1.9.4/leaflet.min.css`, 'sha384-c6Rcwz4e4CITMbu/NBmnNS8yN2sC3cUElMEMfP3vqqKFp7GOYaaBBCqmaWBjmkjb'),
    loadScript(`${CDN}/leaflet/1.9.4/leaflet.min.js`, 'sha384-NElt3Op+9NBMCYaef5HxeJmU4Xeard/Lku8ek6hoPTvYkQPh3zLIrJP7KiRocsxO'),
  ]);
  return window.L;
}

export async function loadMarkerCluster() {
  await loadLeaflet();
  await Promise.all([
    loadCss(`${CDN}/leaflet.markercluster/1.5.3/MarkerCluster.css`, 'sha384-pmjIAcz2bAn0xukfxADbZIb3t8oRT9Sv0rvO+BR5Csr6Dhqq+nZs59P0pPKQJkEV'),
    loadCss(`${CDN}/leaflet.markercluster/1.5.3/MarkerCluster.Default.css`, 'sha384-wgw+aLYNQ7dlhK47ZPK7FRACiq7ROZwgFNg0m04avm4CaXS+Z9Y7nMu8yNjBKYC+'),
    loadScript(`${CDN}/leaflet.markercluster/1.5.3/leaflet.markercluster.js`, 'sha384-eXVCORTRlv4FUUgS/xmOyr66XBVraen8ATNLMESp92FKXLAMiKkerixTiBvXriZr'),
  ]);
  return window.L;
}

export function addTiles(L, map) {
  return L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
  }).addTo(map);
}

export function pinIcon(L, color = '#0e7490') {
  return L.divIcon({
    className: 'rg-pin',
    html: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="${color}" stroke="#fff" stroke-width="1.5" d="M12 1.5a7.5 7.5 0 0 0-7.5 7.5c0 5.6 7.5 13.5 7.5 13.5s7.5-7.9 7.5-13.5A7.5 7.5 0 0 0 12 1.5z"/><circle cx="12" cy="9" r="2.8" fill="#fff"/></svg>`,
    iconSize: [34, 34],
    iconAnchor: [17, 33], // the pin's tip marks the exact point
  });
}

const isWhatsApp = () => /WhatsApp/i.test(navigator.userAgent || '');

/**
 * Full-screen pickup-point picker.
 * opts: { initial?: {latitude, longitude, location_accuracy_m, location_source}, center?: {lat, lng}, startWithGps?: boolean }
 * Resolves to { latitude, longitude, location_accuracy_m, location_source, far_confirmed } or null (cancelled).
 */
export async function openPicker(opts = {}) {
  let L;
  try {
    L = await loadLeaflet();
  } catch {
    toast(t('The map could not be loaded. Please check your connection and try again.'), 4000);
    return null;
  }

  return new Promise((resolve) => {
    let done = false;
    const el = document.createElement('div');
    el.className = 'rg-picker';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.innerHTML = `
      <div class="rg-picker-head"><h2>${esc(t('Choose pickup point'))}</h2>
        <button type="button" class="sj-close" data-close aria-label="${esc(t('Close'))}">×</button></div>
      <form class="rg-search" data-search>
        <input type="search" enterkeyhint="search" placeholder="${esc(t('Search a place, compound or street'))}" aria-label="${esc(t('Search'))}">
        <button type="submit" class="sj-btn sj-btn-sm">${esc(t('Search'))}</button>
        <div class="rg-results" hidden></div>
      </form>
      <div class="rg-map"></div>
      <div class="rg-picker-foot">
        <div class="rg-status" role="status"></div>
        <div class="rg-hint">${esc(t('Please make sure the pin is on your preferred bus pickup point.'))} ${esc(t('If you are not currently at the pickup location, move the pin to the correct place.'))}</div>
        <div class="rg-picker-actions">
          <button type="button" class="sj-btn" data-gps>${esc(t('📍 My location'))}</button>
          <button type="button" class="sj-btn sj-btn-primary" data-confirm disabled>${esc(t('Confirm pickup point'))}</button>
        </div>
      </div>`;

    const status = el.querySelector('.rg-status');
    const confirmBtn = el.querySelector('[data-confirm]');
    const results = el.querySelector('.rg-results');
    const setStatus = (msg, kind = '') => { status.textContent = msg; status.className = `rg-status ${kind}`; };

    let watchId = null;
    const stopGps = () => { if (watchId != null) { navigator.geolocation.clearWatch(watchId); watchId = null; } };

    const layer = openLayer(el, {
      onClose: () => {
        stopGps();
        map.remove();
        if (!done) resolve(null);
      },
    });

    const init = opts.initial && opts.initial.latitude != null ? opts.initial : null;
    const start = init ? [init.latitude, init.longitude] : opts.center ? [opts.center.lat, opts.center.lng] : [GREATER_CAIRO.lat, GREATER_CAIRO.lng];
    const map = L.map(el.querySelector('.rg-map'), { zoomControl: true }).setView(start, init ? 17 : opts.center ? 14 : GREATER_CAIRO.zoom);
    addTiles(L, map);
    setTimeout(() => map.invalidateSize(), 150);

    let marker = null;
    let circle = null;
    let source = init?.location_source || null;
    let accuracy = init?.location_accuracy_m ?? null;

    function place(latlng, src, acc) {
      source = src;
      accuracy = acc ?? null;
      if (!marker) {
        marker = L.marker(latlng, { draggable: true, icon: pinIcon(L), autoPan: true, keyboard: true }).addTo(map);
        // Dragging keeps the original source (e.g. GPS that was fine-tuned by hand).
        marker.on('dragend', () => { if (circle) { circle.remove(); circle = null; } });
      } else {
        marker.setLatLng(latlng);
      }
      if (circle) { circle.remove(); circle = null; }
      if (acc != null && src === 'gps') {
        circle = L.circle(latlng, { radius: acc, color: '#0e7490', weight: 1, fillOpacity: 0.08, interactive: false }).addTo(map);
      }
      confirmBtn.disabled = false;
    }

    if (init) place([init.latitude, init.longitude], init.location_source || 'map', init.location_accuracy_m);
    else setStatus(t('Tap the map to place the pin, then drag it to the exact spot.'));

    map.on('click', (e) => {
      stopGps();
      place(e.latlng, 'map', null);
      setStatus(t('Please make sure the pin is on your preferred bus pickup point.'), 'ok');
    });

    // --- GPS: best reading within ~15 s, stop early when accurate enough.
    function startGps() {
      if (!('geolocation' in navigator)) {
        setStatus(t('Your location could not be found. Tap the map to choose the pickup point instead.'), 'err');
        return;
      }
      stopGps();
      setStatus(t('Getting your location…'));
      let best = null;
      const finish = () => {
        stopGps();
        if (!best) {
          setStatus(t('Your location could not be found. Tap the map to choose the pickup point instead.') + (isWhatsApp() ? ` ${t('Tip: inside WhatsApp, location may be blocked. You can also open this page in Safari or Chrome.')}` : ''), 'err');
        }
      };
      const timer = setTimeout(finish, 15000);
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude, accuracy: acc } = pos.coords;
          if (best && acc >= best.acc) return;
          best = { lat: latitude, lng: longitude, acc: Math.round(acc) };
          place([latitude, longitude], 'gps', best.acc);
          map.setView([latitude, longitude], Math.max(map.getZoom(), 17));
          if (best.acc > 100) setStatus(t('Location is approximate (±{m} m). Please move the pin to the exact pickup point.', { m: best.acc }), 'warn');
          else setStatus(t('Location found (±{m} m). Drag the pin if needed.', { m: best.acc }), 'ok');
          if (best.acc <= 30) { clearTimeout(timer); stopGps(); }
        },
        (err) => {
          clearTimeout(timer);
          stopGps();
          const tip = isWhatsApp() ? ` ${t('Tip: inside WhatsApp, location may be blocked. You can also open this page in Safari or Chrome.')}` : '';
          setStatus((err.code === 1
            ? t('Location permission was not allowed. No problem — tap the map to choose the pickup point.')
            : t('Your location could not be found. Tap the map to choose the pickup point instead.')) + tip, 'err');
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
      );
    }
    el.querySelector('[data-gps]').addEventListener('click', startGps);
    if (opts.startWithGps) startGps();

    // --- Search (Nominatim): only on explicit Search, max ~1 request/second.
    let lastSearch = 0;
    el.querySelector('[data-search]').addEventListener('submit', async (e) => {
      e.preventDefault();
      const q = e.currentTarget.querySelector('input').value.trim();
      if (q.length < 2) return;
      const wait = 1100 - (Date.now() - lastSearch);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      lastSearch = Date.now();
      results.hidden = false;
      results.innerHTML = `<div class="none">${esc(t('Searching…'))}</div>`;
      try {
        const params = new URLSearchParams({
          q, format: 'jsonv2', countrycodes: 'eg', limit: '6', viewbox: '30.9,30.4,31.95,29.75', bounded: '0',
          'accept-language': getLang() === 'ar' ? 'ar,en' : 'en,ar',
        });
        const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(String(res.status));
        const list = await res.json();
        if (!Array.isArray(list) || !list.length) {
          results.innerHTML = `<div class="none">${esc(t('No places found. Try another name, or move the map and tap the spot.'))}</div>`;
          return;
        }
        results.innerHTML = list.map((r, i) => `<button type="button" data-i="${i}">${esc(r.display_name)}</button>`).join('');
        results.onclick = (ev) => {
          const b = ev.target.closest('[data-i]');
          if (!b) return;
          const r = list[Number(b.dataset.i)];
          const ll = [Number(r.lat), Number(r.lon)];
          stopGps();
          map.setView(ll, 17);
          place(ll, 'search', null);
          results.hidden = true;
          setStatus(t('Please make sure the pin is on your preferred bus pickup point.'), 'ok');
        };
      } catch {
        results.innerHTML = `<div class="none">${esc(t('Search is unavailable right now. Move the map and tap the spot instead.'))}</div>`;
      }
    });
    map.on('movestart', () => { results.hidden = true; });

    el.querySelector('[data-close]').addEventListener('click', () => layer.close());
    confirmBtn.addEventListener('click', () => {
      if (!marker) return;
      const ll = marker.getLatLng();
      const lat = Math.round(ll.lat * 1e6) / 1e6;
      const lng = Math.round(ll.lng * 1e6) / 1e6;
      let farConfirmed = false;
      if (isFar(lat, lng)) {
        if (!confirm(t('This location appears far from the expected service area. Please confirm the pin.'))) return;
        farConfirmed = true;
      }
      done = true;
      resolve({ latitude: lat, longitude: lng, location_accuracy_m: accuracy, location_source: source || 'map', far_confirmed: farConfirmed });
      layer.close();
    });
  });
}

/** Small non-interactive preview of a chosen point. */
export async function renderPreview(el, loc) {
  const L = await loadLeaflet();
  if (el._map) { el._map.remove(); el._map = null; }
  const map = L.map(el, {
    dragging: false, zoomControl: false, scrollWheelZoom: false, doubleClickZoom: false,
    boxZoom: false, keyboard: false, touchZoom: false, tap: false,
  }).setView([loc.latitude, loc.longitude], 16);
  addTiles(L, map);
  L.marker([loc.latitude, loc.longitude], { icon: pinIcon(L), interactive: false }).addTo(map);
  el._map = map;
  setTimeout(() => map.invalidateSize(), 100);
  return map;
}
