// SJAS Bus Registration — the registration form (parent create/edit + admin edit).

import { esc, matchArea } from './reg-common.js?v=17';
import { t } from './reg-i18n.js?v=17';
import { openPicker, renderPreview } from './reg-map.js?v=17';

const NEW_AREA = '__new__';

/**
 * opts: {
 *   mode: 'create' | 'edit' | 'admin',
 *   initial?: registration (from /my or admin detail),
 *   areas: [{ id, name, center_lat, center_lng }],   // listed areas
 *   onSubmit: async (payload) => void,                 // throw to show an error
 *   onCancel?: () => void,
 * }
 */
export function registrationForm(root, opts) {
  const init = opts.initial || {};
  const isCreate = opts.mode === 'create';
  const isAdmin = opts.mode === 'admin';
  const areas = opts.areas || [];
  const listedIds = new Set(areas.map((a) => a.id));

  const state = {
    students: (init.students && init.students.length ? init.students : [{ name: '', grade: '' }]).map((s) => ({ name: s.name || '', grade: s.grade || '' })),
    location: init.latitude != null ? {
      latitude: init.latitude, longitude: init.longitude,
      location_accuracy_m: init.location_accuracy_m ?? null, location_source: init.location_source || 'map',
      far_confirmed: !!init.far_confirmed,
    } : null,
    areaMode: init.area_id && !listedIds.has(init.area_id) ? 'new' : 'list',
  };

  root.innerHTML = `
    <form class="sj-form" novalidate>
      <p class="sj-help" style="margin-top:0">${esc(t('Your details are seen only by the transportation administrators.'))}</p>
      <div class="sj-row">
        <div class="sj-field"><label for="f-parent">${esc(t('Parent full name'))} <span class="sj-req">*</span></label>
          <input id="f-parent" maxlength="120" autocomplete="name" required></div>
        <div class="sj-field"><label for="f-phone">${esc(t('Phone number'))} <span class="sj-req">*</span></label>
          <input id="f-phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="40" dir="ltr" placeholder="010 1234 5678" required></div>
      </div>

      <div class="sj-field"><span class="sj-label">${esc(t('Students'))} <span class="sj-req">*</span></span>
        <div data-students></div>
        <div class="sj-inline" style="justify-content:space-between;flex-wrap:wrap">
          <button type="button" class="sj-linkbtn" data-add-student>${esc(t('+ Add student'))}</button>
          <span class="sj-help" style="margin:0" data-count></span>
        </div></div>

      <div class="sj-field"><label for="f-area">${esc(t('Area / district'))} <span class="sj-req">*</span></label>
        <div data-area-list>
          <select id="f-area">
            <option value="">${esc(t('Choose your area'))}</option>
            ${areas.map((a) => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('')}
            <option value="${NEW_AREA}">${esc(t('+ My area is not listed'))}</option>
          </select></div>
        <div data-area-new hidden>
          <div class="sj-inline"><input class="sj-input" id="f-area-new" maxlength="60" placeholder="${esc(t('Type your area'))}" autocomplete="off">
            ${areas.length ? `<button type="button" class="sj-btn sj-btn-sm" data-area-back>${esc(t('Back to the list'))}</button>` : ''}</div>
          <div class="sj-help" data-area-hint></div></div>
      </div>

      <div class="sj-section">
        <h3>${esc(t('Pickup location'))} <span class="sj-req">*</span></h3>
        <p class="sj-help" style="margin-top:-4px">${esc(t('Required. Choose where the bus should pick up your children.'))}</p>
        <div class="rg-loc" data-loc></div>
      </div>

      <div class="sj-section">
        <h3>${esc(t('Optional address details'))}</h3>
        <div class="sj-row">
          <div class="sj-field"><label for="f-building">${esc(t('Building / villa / compound'))}</label>
            <input id="f-building" maxlength="120" placeholder="${esc(t('e.g. Building 12, gate 2'))}"></div>
          <div class="sj-field"><label for="f-street">${esc(t('Street'))}</label><input id="f-street" maxlength="120"></div>
        </div>
        <div class="sj-field"><label for="f-landmark">${esc(t('Landmark'))}</label>
          <input id="f-landmark" maxlength="200" placeholder="${esc(t('e.g. near the mosque'))}"></div>
        <div class="sj-field"><label for="f-notes">${esc(t('Pickup notes'))}</label>
          <textarea id="f-notes" maxlength="500" placeholder="${esc(t('e.g. please call when you arrive'))}"></textarea></div>
      </div>

      <div class="sj-section" data-sharing>
        <h3>${esc(t('Sharing with your bus group'))}</h3>
        <div class="sj-note sj-note-info" style="margin-top:0">
          <b>${esc(t('Who can see this?'))}</b>
          ${esc(t('Only families assigned to the same bus as you, once buses are assigned.'))}
          ${esc(t("Parents assigned to other buses cannot see your pickup point, name, children's names or phone number."))}
        </div>
        ${[['f-share-pickup', 'Allow my pickup point to appear on my bus\'s shared route'],
           ['f-share-parent', 'Show my first name to parents on my bus'],
           ['f-share-students', "Show my children's first names to parents on my bus"],
           ['f-share-phone', 'Show my phone number to parents on my bus']]
          .map(([id, label]) => `<label class="sj-check" style="margin-bottom:10px"><input type="checkbox" id="${id}"><span>${esc(t(label))}</span></label>`).join('')}
        <p class="sj-help">${esc(t('Your pickup location is always visible to the administrator for route planning, even if you choose not to share it with other parents. The bus driver and supervisor receive the details needed to run the bus.'))}</p>
      </div>

      <div class="sj-section">
        ${isAdmin ? `<div class="sj-field"><label for="f-admin-notes">Admin notes <span class="sj-opt">(internal)</span></label>
          <textarea id="f-admin-notes" maxlength="4000"></textarea></div>` : ''}
        <p class="sj-help">${esc(t('Maps are provided by OpenStreetMap. Their servers see which part of the map is shown or searched — never your name, phone or children.'))}</p>
        ${isCreate ? `<label class="sj-check"><input type="checkbox" id="f-consent">
          <span>${esc(t('I agree that my contact details, student information and selected pickup location may be used by the transportation administrators for school bus planning.'))}</span></label>` : ''}
      </div>

      <div class="sj-note sj-note-err" data-error hidden role="alert"></div>
      <div class="sj-formfoot">
        ${opts.onCancel ? `<button type="button" class="sj-btn" data-cancel>${esc(t('Cancel'))}</button>` : ''}
        <button type="submit" class="sj-btn sj-btn-primary" data-submit>${esc(isCreate ? t('Submit registration') : t('Save changes'))}</button>
      </div>
    </form>`;

  const form = root.querySelector('form');
  const $ = (s) => form.querySelector(s);
  $('#f-parent').value = init.parent_name || '';
  $('#f-phone').value = init.phone || '';
  $('#f-building').value = init.building || '';
  $('#f-street').value = init.street || '';
  $('#f-landmark').value = init.landmark || '';
  $('#f-notes').value = init.pickup_notes || '';
  if (isAdmin) $('#f-admin-notes').value = init.admin_notes || '';
  // Pickup sharing: ON for new registrations; otherwise the family's saved choice.
  $('#f-share-pickup').checked = isCreate ? true : init.share_pickup === true;
  $('#f-share-parent').checked = init.share_parent_name === true;
  $('#f-share-students').checked = init.share_student_names === true;
  $('#f-share-phone').checked = init.share_phone === true;

  // ----- Students
  const studentsEl = $('[data-students]');
  const countEl = $('[data-count]');
  function renderStudents() {
    studentsEl.innerHTML = state.students.map((s, i) => `
      <div class="rg-student">
        <input class="sj-input" data-sn="${i}" maxlength="80" value="${esc(s.name)}"
          placeholder="${esc(t('Student {n} full name', { n: i + 1 }))}" aria-label="${esc(t('Student {n} full name', { n: i + 1 }))}">
        <input class="sj-input" style="min-width:0" data-sg="${i}" maxlength="30" value="${esc(s.grade)}"
          placeholder="${esc(t('Grade / class'))}" aria-label="${esc(t('Grade / class'))} ${esc(t('(optional)'))}">
        ${state.students.length > 1 ? `<button type="button" class="sj-iconbtn" data-rm="${i}" aria-label="${esc(t('Remove student {n}', { n: i + 1 }))}">×</button>` : '<span></span>'}
      </div>`).join('');
    updateCount();
  }
  function updateCount() {
    countEl.textContent = t('Number of students: {n}', { n: state.students.filter((s) => s.name.trim()).length });
  }
  studentsEl.addEventListener('input', (e) => {
    const { sn, sg } = e.target.dataset;
    if (sn !== undefined) { state.students[sn].name = e.target.value; updateCount(); }
    if (sg !== undefined) state.students[sg].grade = e.target.value;
  });
  studentsEl.addEventListener('click', (e) => {
    const i = e.target.dataset.rm;
    if (i === undefined) return;
    state.students.splice(Number(i), 1);
    renderStudents();
  });
  $('[data-add-student]').addEventListener('click', () => {
    if (state.students.length >= 10) return;
    state.students.push({ name: '', grade: '' });
    renderStudents();
    studentsEl.querySelector(`[data-sn="${state.students.length - 1}"]`)?.focus();
  });
  renderStudents();

  // ----- Area
  const areaSelect = $('#f-area');
  const areaNew = $('#f-area-new');
  const areaHint = $('[data-area-hint]');
  function setAreaMode(mode) {
    state.areaMode = mode;
    $('[data-area-list]').hidden = mode === 'new';
    $('[data-area-new]').hidden = mode !== 'new';
    if (mode === 'new') areaNew.focus();
  }
  if (state.areaMode === 'new') {
    areaNew.value = init.area_name || '';
    setAreaMode('new');
  } else if (init.area_id) {
    areaSelect.value = init.area_id;
  }
  if (!areas.length) setAreaMode('new');
  areaSelect.addEventListener('change', () => { if (areaSelect.value === NEW_AREA) { areaSelect.value = ''; setAreaMode('new'); } });
  $('[data-area-back]')?.addEventListener('click', () => setAreaMode('list'));
  areaNew.addEventListener('input', () => {
    const m = matchArea(areaNew.value, areas);
    areaHint.innerHTML = m ? `<button type="button" class="sj-chip" data-use-area="${esc(m.area.id)}">${esc(t('Did you mean {area}?', { area: m.area.name }))}</button>` : '';
  });
  areaHint.addEventListener('click', (e) => {
    const b = e.target.closest('[data-use-area]');
    if (!b) return;
    areaSelect.value = b.dataset.useArea;
    areaNew.value = '';
    areaHint.innerHTML = '';
    setAreaMode('list');
  });
  const selectedAreaCenter = () => {
    const a = areas.find((x) => x.id === areaSelect.value);
    return a && a.center_lat != null ? { lat: Number(a.center_lat), lng: Number(a.center_lng) } : null;
  };

  // ----- Pickup location
  const locEl = $('[data-loc]');
  async function renderLocation() {
    const loc = state.location;
    locEl.classList.toggle('done', !!loc);
    if (!loc) {
      locEl.innerHTML = `<div class="rg-locbtns">
          <button type="button" class="sj-btn sj-btn-primary" data-pick="gps">${esc(t('📍 Use my current location'))}</button>
          <button type="button" class="sj-btn" data-pick="map">${esc(t('🗺 Choose location on map'))}</button></div>`;
      return;
    }
    const how = loc.location_source === 'gps'
      ? t('From your phone location (±{m} m)', { m: Math.round(loc.location_accuracy_m ?? 0) })
      : loc.location_source === 'search' ? t('Found by search') : t('Chosen on the map');
    locEl.innerHTML = `<div class="rg-locok">${esc(t('✅ Pickup location selected'))}</div>
      <div class="rg-preview"></div>
      <div class="sj-inline" style="justify-content:space-between;flex-wrap:wrap">
        <span class="rg-locmeta">${esc(how)} · <span dir="ltr">${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}</span></span>
        <button type="button" class="sj-btn sj-btn-sm" data-pick="adjust">${esc(t('Adjust pin'))}</button></div>`;
    try { await renderPreview(locEl.querySelector('.rg-preview'), loc); } catch { /* preview is optional */ }
  }
  locEl.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-pick]');
    if (!b) return;
    const res = await openPicker({
      initial: b.dataset.pick === 'adjust' ? state.location : null,
      center: selectedAreaCenter(),
      startWithGps: b.dataset.pick === 'gps',
    });
    if (res) {
      state.location = res;
      renderLocation();
    }
  });
  renderLocation();

  // ----- Submit
  const errEl = $('[data-error]');
  const submitBtn = $('[data-submit]');
  $('[data-cancel]')?.addEventListener('click', () => opts.onCancel());
  const fail = (msg, focusEl) => {
    errEl.textContent = msg;
    errEl.hidden = false;
    (focusEl || errEl).scrollIntoView({ behavior: 'smooth', block: 'center' });
    focusEl?.focus?.({ preventScroll: true });
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.hidden = true;
    const parent = $('#f-parent').value.trim();
    const phone = $('#f-phone').value.trim();
    const students = state.students.map((s) => ({ name: s.name.trim(), grade: s.grade.trim() })).filter((s) => s.name);
    if (parent.length < 2) return fail(t('Please enter the parent full name.'), $('#f-parent'));
    if (phone.replace(/[^\d٠-٩]/g, '').length < 8) return fail(t('Please enter a valid phone number.'), $('#f-phone'));
    if (!students.length) return fail(t('Please enter at least one student name.'), studentsEl.querySelector('input'));
    const areaId = state.areaMode === 'list' ? areaSelect.value : '';
    const areaName = state.areaMode === 'new' ? areaNew.value.trim() : '';
    if (!areaId && areaName.length < 2) return fail(t('Please choose your area.'), state.areaMode === 'new' ? areaNew : areaSelect);
    if (!state.location && !isAdmin) return fail(t('Please choose the pickup location.'), locEl.querySelector('button'));
    if (isCreate && !$('#f-consent').checked) return fail(t('Please tick the consent box to continue.'), $('#f-consent'));

    const payload = {
      parent_name: parent,
      phone,
      area_id: areaId || null,
      area_name: areaId ? null : areaName,
      students,
      ...(state.location || {}),
      building: $('#f-building').value.trim(),
      street: $('#f-street').value.trim(),
      landmark: $('#f-landmark').value.trim(),
      pickup_notes: $('#f-notes').value.trim(),
      consent: isCreate ? true : undefined,
      share_pickup: $('#f-share-pickup').checked,
      share_parent_name: $('#f-share-parent').checked,
      share_student_names: $('#f-share-students').checked,
      share_phone: $('#f-share-phone').checked,
    };
    if (isAdmin) payload.admin_notes = $('#f-admin-notes').value.trim();

    const label = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="sj-spin"></span> ${esc(t('Saving…'))}`;
    try {
      try {
        await opts.onSubmit(payload);
      } catch (err) {
        // Server says the pin is far from the service area: confirm once, then retry.
        if (err.code === 'far_location' && confirm(t('This location appears far from the expected service area. Please confirm the pin.'))) {
          state.location = { ...state.location, far_confirmed: true };
          await opts.onSubmit({ ...payload, far_confirmed: true });
        } else if (err.code !== 'far_location') {
          throw err;
        }
      }
    } catch (err) {
      fail(err.message || t('Something went wrong. Please try again.'));
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = label;
    }
  });
}
