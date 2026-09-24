// SJAS Bus Registration — parent page.
//
// SCHOOL-WIDE = anonymous only (totals, students by area, demand bubbles).
// SAME BUS    = the family's own bus route + other families' details ONLY as each
//               family chose to share them. The server decides the bus from the
//               PIN-verified session; the page can never ask for another bus.

import { api, ApiError, copyText, esc, fmtDate, local, num, session, toast, tokenFrom } from './reg-common.js?v=5';
import { registrationForm } from './reg-form.js?v=5';
import { getLang, initLang, setLang, t } from './reg-i18n.js?v=5';
import { renderDemandMap, renderMyBusRoute } from './reg-mybus.js?v=5';

const VIEWER_KEY = 'busreg.viewer';
const EDITOR_KEY = 'busreg.editor'; // 45 min, can edit (sessionStorage)
const MYBUS_KEY = 'busreg.mybus';   // 30 days, read-only (this device)
const app = document.getElementById('rg-app');
const signoutBtn = document.getElementById('rg-signout');
const langBtn = document.getElementById('rg-lang');

let summary = null;
let demand = null;
let areas = null;

initLang();
function updateLangBtn() {
  langBtn.textContent = getLang() === 'ar' ? 'English' : 'العربية';
  langBtn.lang = getLang() === 'ar' ? 'en' : 'ar';
}
updateLangBtn();
langBtn.addEventListener('click', () => {
  const typing = [...app.querySelectorAll('.sj-form input, .sj-form textarea')].some((el) => el.type !== 'checkbox' && el.value);
  if (typing && !confirm(t('Switching language will clear what you typed. Continue?'))) return;
  setLang(getLang() === 'ar' ? 'en' : 'ar');
  updateLangBtn();
  route();
});

const viewerToken = () => tokenFrom(local, VIEWER_KEY);
const editorToken = () => tokenFrom(session, EDITOR_KEY);
const mybusToken = () => tokenFrom(local, MYBUS_KEY);
const familyToken = () => editorToken() || mybusToken();

function signOut() {
  local.del(VIEWER_KEY);
  session.del(EDITOR_KEY);
  summary = null;
  demand = null;
  location.hash = '';
  renderGate();
}
signoutBtn.addEventListener('click', signOut);

async function call(path, opts = {}) {
  try {
    return await api(path, { token: viewerToken(), ...opts });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401 && !opts.token) {
      signOut();
      throw new ApiError(401, t('Your session has ended. Please enter the password again.'));
    }
    throw err;
  }
}

/** Calls made with the family's own session (edit or read-only "My bus"). */
async function familyCall(path, opts = {}) {
  const token = opts.token || familyToken();
  try {
    return await api(path, { ...opts, token });
  } catch (err) {
    if (err.status === 401) { session.del(EDITOR_KEY); local.del(MYBUS_KEY); }
    throw err;
  }
}

async function loadAreas() {
  if (!areas) areas = (await call('/areas')).areas;
  return areas;
}

// ---------------------------------------------------------------------------
// Password gate
// ---------------------------------------------------------------------------

function renderGate() {
  signoutBtn.hidden = true;
  app.innerHTML = `
    <div class="sj-gate"><form class="sj-card" autocomplete="off">
      <h1>${esc(t('SJAS Bus Registration'))}</h1>
      <p>${esc(t('School bus registration and pickup location'))}. ${esc(t('Enter the access password shared with parents.'))}</p>
      <div class="sj-field"><label for="pw">${esc(t('Access password'))}</label>
        <input id="pw" type="password" autocomplete="current-password" required autofocus dir="ltr"></div>
      <button class="sj-btn sj-btn-primary sj-btn-block" type="submit">${esc(t('Enter'))}</button>
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
      local.set(VIEWER_KEY, await api('/auth/viewer', { method: 'POST', body: { password: form.pw.value } }));
      await route();
    } catch (ex) {
      err.textContent = ex.message;
      btn.disabled = false;
      btn.textContent = t('Enter');
      form.pw.select();
    }
  });
}

// ---------------------------------------------------------------------------
// Home: anonymous school-wide view
// ---------------------------------------------------------------------------

function renderHome() {
  signoutBtn.hidden = false;
  const s = summary;
  const areaList = s.areas.length || s.other_students
    ? `<ul class="sj-arealist">${s.areas.map((a) => `<li><span>${esc(a.name)}</span><span class="n">${esc(t('{n} students registered', { n: num(a.students) }))}</span></li>`).join('')}
        ${s.other_students ? `<li><span>${esc(t('Other areas'))}</span><span class="n">${esc(t('{n} students registered', { n: num(s.other_students) }))}</span></li>` : ''}</ul>`
    : `<p class="sj-muted" style="margin:0">${esc(t('No registrations yet — be the first.'))}</p>`;
  app.innerHTML = `
    <section class="sj-hero">
      <h1>${esc(t('SJAS Bus Registration'))}</h1>
      <p>${esc(t('School bus registration and pickup location'))}</p>
    </section>
    <section class="sj-stats" style="grid-template-columns:1fr 1fr">
      <div class="sj-stat sj-stat-total" style="grid-column:auto;order:0"><div class="k">${esc(t('Families registered'))}</div><div class="v">${num(s.families)}</div></div>
      <div class="sj-stat sj-stat-total" style="grid-column:auto;order:0"><div class="k">${esc(t('Students registered'))}</div><div class="v">${num(s.students)}</div></div>
    </section>
    <div class="sj-hero-cta">
      ${mybusToken() ? `<a class="sj-btn sj-btn-primary" href="#status">🚌 ${esc(t('My bus & status'))}</a>` : ''}
      <a class="sj-btn ${mybusToken() ? '' : 'sj-btn-primary'}" href="#register">＋ ${esc(t('Register my family'))}</a>
      <a class="sj-btn" href="#edit">${esc(t('Edit my registration'))}</a>
    </div>
    <section class="sj-card" style="margin-bottom:16px">
      <h3 style="margin:0 0 4px">${esc(t('Where students are registered'))}</h3>
      <p class="sj-help" style="margin:0 0 10px">${esc(t('Anonymous groups of 3 or more families. No names or exact locations are shown.'))}</p>
      <div class="rg-preview" style="height:320px" data-demand></div>
    </section>
    <section class="sj-card" style="margin-bottom:16px">
      <h3 style="margin:0 0 10px">${esc(t('Students by area'))}</h3>
      ${areaList}
    </section>
    <p class="sj-help">${esc(t('Only totals are shown here. Names, phone numbers, addresses and pickup locations are never shown school-wide. After buses are assigned, families on the same bus can see their bus route and whatever each family chose to share.'))}</p>`;
  if (demand) renderDemandMap(app.querySelector('[data-demand]'), demand).catch(() => {});
}

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

async function renderRegister() {
  signoutBtn.hidden = false;
  const list = await loadAreas();
  app.innerHTML = `
    <div style="padding:16px 0"><a href="#" class="sj-linkbtn">${esc(t('← Back'))}</a></div>
    <div class="sj-card sj-formcard">
      <h2>${esc(t('Register my family'))}</h2>
      <div data-form></div>
    </div>`;
  registrationForm(app.querySelector('[data-form]'), {
    mode: 'create',
    areas: list,
    onCancel: () => { location.hash = ''; },
    onSubmit: async (payload) => {
      const res = await call('/registrations', { method: 'POST', body: payload });
      summary = null;
      demand = null;
      renderSaved(res);
    },
  });
  window.scrollTo(0, 0);
}

function renderSaved(res) {
  const url = `${location.origin}/sjasbusregistration/`;
  const msg = t('SJAS Bus Registration\nRegistration ID: {id}\nEdit PIN: {pin}\n{url}', { id: res.registration_code, pin: res.pin, url });
  app.innerHTML = `
    <div class="sj-card sj-formcard sj-success" style="margin-top:24px">
      <div class="sj-tick" aria-hidden="true">✓</div>
      <h2>${esc(t('Registration saved successfully'))}</h2>
      <div class="sj-secret" dir="ltr">
        <div><span>${esc(t('Registration ID'))}</span><b>${esc(res.registration_code)}</b></div>
        <div><span>${esc(t('Private Edit PIN'))}</span><b>${esc(res.pin)}</b></div>
      </div>
      ${res.bus ? `<div class="sj-note sj-note-info" style="text-align:start">${esc(t('You have been placed on bus {bus}, near other registered families. The school may still adjust bus assignments.', { bus: res.bus }))}</div>` : ''}
      <div class="sj-note sj-note-warn" style="text-align:start">${esc(t('Keep these details safe if you need to update your registration later. The PIN will not be shown again.'))}</div>
      <div class="sj-formfoot" style="justify-content:center">
        <button type="button" class="sj-btn" data-copy>${esc(t('Copy details'))}</button>
        <a class="sj-btn" href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener noreferrer">${esc(t('Send to myself on WhatsApp'))}</a>
        <button type="button" class="sj-btn sj-btn-primary" data-done>${esc(t('Done'))}</button>
      </div>
    </div>`;
  app.querySelector('[data-copy]').addEventListener('click', async () => toast((await copyText(msg)) ? t('Copied') : t('Could not copy — please write them down')));
  app.querySelector('[data-done]').addEventListener('click', () => { location.hash = ''; route(); });
  window.scrollTo(0, 0);
}

// ---------------------------------------------------------------------------
// Registration ID + PIN → edit session (45 min) + read-only "My bus" session (30 days)
// ---------------------------------------------------------------------------

function renderPinLogin(next) {
  signoutBtn.hidden = false;
  app.innerHTML = `
    <div style="padding:16px 0"><a href="#" class="sj-linkbtn">${esc(t('← Back'))}</a></div>
    <form class="sj-card sj-formcard" style="max-width:420px" autocomplete="off">
      <h2>${esc(next === 'status' ? t('My bus & status') : t('Edit my registration'))}</h2>
      <p class="sj-muted" style="margin-top:0">${esc(t('Enter the Registration ID and Edit PIN you received when you registered.'))}</p>
      <div class="sj-field"><label for="e-id">${esc(t('Registration ID'))}</label><input id="e-id" name="rid" placeholder="REG-0042" autocapitalize="characters" required dir="ltr"></div>
      <div class="sj-field"><label for="e-pin">${esc(t('Edit PIN'))}</label><input id="e-pin" name="pin" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="${esc(t('6 digits'))}" required dir="ltr"></div>
      <button class="sj-btn sj-btn-primary sj-btn-block" type="submit">${esc(t('Continue'))}</button>
      <div class="sj-err" role="alert"></div>
      <p class="sj-help">${esc(t('This phone will remember your bus details for 30 days (view only). Use “Sign out of this device” on a shared phone.'))}</p>
      <p class="sj-help">${esc(t('Lost your PIN? Ask the administrator to reset it.'))}</p>
    </form>`;
  const form = app.querySelector('form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button');
    const err = form.querySelector('.sj-err');
    err.textContent = '';
    btn.disabled = true;
    btn.innerHTML = '<span class="sj-spin"></span>';
    try {
      const res = await call('/auth/edit', { method: 'POST', body: { registration: form.rid.value, pin: form.pin.value.trim() } });
      session.set(EDITOR_KEY, { token: res.token, expires_at: res.expires_at });
      if (res.mybus) local.set(MYBUS_KEY, res.mybus);
      if (next === 'status') await renderStatus(); else await renderEditForm();
    } catch (ex) {
      err.textContent = ex.message;
      btn.disabled = false;
      btn.textContent = t('Continue');
    }
  });
}

function signOutDevice() {
  if (!confirm(t('Remove your registration details from this phone? You will need your Registration ID and PIN again.'))) return;
  session.del(EDITOR_KEY);
  local.del(MYBUS_KEY);
  toast(t('Signed out of this device'));
  location.hash = '';
  route();
}

// Private, read-only status. Counts come pre-filtered from the server (hidden below 3 families).
function statusCard(me) {
  const st = me.status_info || {};
  const more = esc(t('More registrations may be added in your area.'));
  const bus = st.bus;
  const r = st.route;
  let routeHtml = '';
  if (bus) {
    if (!r || r.state === 'preparing') routeHtml = `<b>${esc(t('Being prepared'))}</b>`;
    else if (r.state === 'being_added') routeHtml = `<b>${esc(t('Being added to the route'))}</b><br><span class="sj-muted">${esc(t('Your family has been placed on this bus. Your stop will be added when the route is next updated.'))}</span>`;
    else if (r.state === 'needs_review') routeHtml = `<b>${esc(t('Needs review'))}</b><br><span class="sj-muted">${esc(t('Your pickup point changed after bus assignment. The administrator will update your bus or route.'))}</span>`;
    else routeHtml = `<b>${esc(t('Approved'))}</b><br>${esc(t('Your stop: {n} of {total}', { n: r.my_stop, total: r.stops_total }))}${r.eta ? `<br>${esc(t('Estimated pickup {time}', { time: r.eta }))}` : ''}
      <br><a class="sj-btn sj-btn-sm sj-btn-primary" style="margin-top:8px" href="#mybus">🗺 ${esc(t('View my bus route'))}</a>`;
  }
  return `<section class="rg-status-card">
    <h3>${esc(t('My transportation status'))}</h3>
    ${me.sharing_prompt_pending ? `<div class="sj-note sj-note-warn" style="margin-top:0"><b>${esc(t('New: sharing with your bus group'))}</b>${esc(t("You can now choose whether families on your bus can see your pickup point, first name, children's first names or phone. Nothing is shared until you choose."))}
      <br><a class="sj-btn sj-btn-sm" style="margin-top:6px" href="#edit">${esc(t('Review sharing options'))}</a></div>` : ''}
    <dl class="sj-kv">
      <dt>${esc(t('Area'))}</dt><dd>${esc(st.area || me.area_name || '—')}</dd>
      <dt>${esc(t('Students in your area'))}</dt><dd>${st.area_students != null ? esc(t('{n} students are currently registered in your area.', { n: num(st.area_students) })) : more}</dd>
      <dt>${esc(t('Near your pickup point'))}</dt><dd>${st.nearby_students != null ? esc(t('{n} other students are registered within about 1 km of your pickup point.', { n: num(st.nearby_students) })) : more}</dd>
      <dt>${esc(t('Bus assignment'))}</dt><dd>${bus
        ? `<b><bdi>${esc(bus.number)}</bdi></b><br>${esc(t('{n} students assigned', { n: num(bus.students_assigned) }))} · ${esc(t('Capacity {n}', { n: num(bus.capacity) }))} · ${esc(t('{n} seats available', { n: num(bus.free_seats) }))}`
        : `<b>${esc(t('Not assigned yet'))}</b><br><span class="sj-muted">${esc(t('Bus assignments are still being prepared.'))}</span>`}</dd>
      ${bus ? `<dt>${esc(t('Route'))}</dt><dd>${routeHtml}</dd>` : ''}
    </dl>
  </section>`;
}

async function renderStatus() {
  if (!familyToken()) return renderPinLogin('status');
  let me;
  try {
    me = await familyCall('/my/status');
  } catch (err) {
    if (err.status === 401) return renderPinLogin('status');
    throw err;
  }
  signoutBtn.hidden = false;
  app.innerHTML = `
    <div style="padding:16px 0;display:flex;gap:12px;flex-wrap:wrap;justify-content:space-between">
      <a href="#" class="sj-linkbtn">${esc(t('← Back'))}</a>
      <button type="button" class="sj-linkbtn" data-signout-device>${esc(t('Sign out of this device'))}</button></div>
    <div class="sj-card sj-formcard">
      <h2><bdi>${esc(me.registration_code)}</bdi></h2>
      ${me.status !== 'active' ? `<div class="sj-note sj-note-warn">${esc(t('This registration is currently hidden by the administrator.'))}</div>` : ''}
      ${statusCard(me)}
      <a class="sj-btn" href="#edit">${esc(t('Edit my registration'))}</a>
    </div>`;
  app.querySelector('[data-signout-device]').addEventListener('click', signOutDevice);
  window.scrollTo(0, 0);
}

async function renderMyBus() {
  if (!familyToken()) return renderPinLogin('status');
  app.innerHTML = `<div class="sj-loading">${esc(t('Loading…'))}</div>`;
  let r;
  try {
    r = await familyCall('/my/route');
  } catch (err) {
    if (err.status === 401) return renderPinLogin('status');
    throw err;
  }
  signoutBtn.hidden = false;
  const back = `<div style="padding:16px 0"><a href="#status" class="sj-linkbtn">${esc(t('← Back'))}</a></div>`;
  if (r.state !== 'approved') {
    app.innerHTML = `${back}<div class="sj-card sj-formcard"><h2>${esc(t('My bus route'))}</h2>
      <p>${esc(r.state === 'not_assigned' ? t('Bus assignments are still being prepared.') : r.state === 'being_added'
        ? t('Your family has been placed on this bus. Your stop will be added when the route is next updated.') : r.state === 'needs_review'
        ? t('Your pickup point changed after bus assignment. The administrator will update your bus or route.') : t('Your bus route is being prepared.'))}</p></div>`;
    return;
  }
  const kids = (n) => esc(n === 1 ? t('1 student') : t('{n} students', { n }));
  const stopLine = (s) => `<li class="${s.you ? 'rg-you' : ''}"><b>${esc(t('Stop {n}', { n: s.n }))}</b>${s.you ? ` — <b>${esc(t('YOU'))}</b>` : ''}${s.parent ? ` · <bdi>${esc(s.parent)}</bdi>` : ''}${s.children ? ` · ${s.children.map((c) => `<bdi>${esc(c)}</bdi>`).join(', ')}` : ''} · ${kids(s.students)}${s.you && s.eta ? ` · ${esc(t('Estimated pickup {time}', { time: s.eta }))}` : ''}</li>`;
  app.innerHTML = `${back}
    <div class="sj-card sj-formcard">
      <h2><bdi>${esc(r.bus.number)}</bdi> — ${esc(t('Morning route'))}</h2>
      <p class="sj-muted" style="margin-top:0">${esc(t('{n} students', { n: num(r.students_on_route) }))} · ${esc(t('{n} stops', { n: r.stops_total }))} · ${esc(t('Your stop: {n} of {total}', { n: r.my_stop, total: r.stops_total }))}${r.eta ? ` · ${esc(t('Estimated pickup {time}', { time: r.eta }))}` : ''}</p>
      <div class="rg-preview" style="height:60vh;min-height:320px" data-route></div>
      <p class="sj-help">${esc(t('Only families assigned to this bus can see this route. Grey stops are approximate because those families keep their exact pickup point private.'))}</p>
      <h3>${esc(t('Stops'))}</h3>
      <ol class="rg-stoplist">${r.stops.map(stopLine).join('')}<li><b>🏫 <bdi>${esc(r.school.name)}</bdi></b>${r.arrival_time ? ` · ${esc(r.arrival_time)}` : ''}</li></ol>
      ${r.roster.length ? `<h3>${esc(t('Families on your bus who chose to share'))}</h3>
        <ul class="rg-roster">${r.roster.map((f) => `<li>${f.parent ? `<b><bdi>${esc(f.parent)}</bdi></b>` : ''}${f.children ? ` ${f.children.map((c) => `<bdi>${esc(c)}</bdi>`).join(', ')}` : ''}${f.phone ? ` · <a href="tel:${esc(f.phone)}" dir="ltr">${esc(f.phone)}</a>` : ''}${f.stop ? ` · ${esc(t('Stop {n}', { n: f.stop }))}` : ''}</li>`).join('')}</ul>` : ''}
    </div>`;
  renderMyBusRoute(app.querySelector('[data-route]'), r).catch(() => {});
  window.scrollTo(0, 0);
}

async function renderEditForm() {
  const token = editorToken();
  if (!token) return renderPinLogin('edit');
  let mine;
  try {
    mine = await api('/my', { token });
  } catch (err) {
    session.del(EDITOR_KEY);
    if (err.status === 401) return renderPinLogin('edit');
    throw err;
  }
  const list = await loadAreas();
  let status = null;
  try { status = await familyCall('/my/status', { token }); } catch { /* status is optional here */ }
  app.innerHTML = `
    <div style="padding:16px 0;display:flex;gap:12px;flex-wrap:wrap;justify-content:space-between">
      <a href="#" class="sj-linkbtn">${esc(t('← Back'))}</a>
      <span><button type="button" class="sj-linkbtn" data-end>${esc(t('Finish editing'))}</button> · <button type="button" class="sj-linkbtn" data-signout-device>${esc(t('Sign out of this device'))}</button></span></div>
    <div class="sj-card sj-formcard">
      <h2>${esc(t('Edit {code}', { code: mine.registration_code }))}</h2>
      ${mine.status === 'hidden' ? `<div class="sj-note sj-note-warn">${esc(t('This registration is currently hidden by the administrator.'))}</div>` : ''}
      ${status ? statusCard(status) : ''}
      <div data-form></div>
    </div>
    <div class="sj-card sj-formcard" data-removal></div>`;
  app.querySelector('[data-end]').addEventListener('click', () => { session.del(EDITOR_KEY); location.hash = ''; });
  app.querySelector('[data-signout-device]').addEventListener('click', signOutDevice);
  registrationForm(app.querySelector('[data-form]'), {
    mode: 'edit',
    initial: mine,
    areas: list,
    onCancel: () => { location.hash = ''; },
    onSubmit: async (payload) => {
      try {
        await api('/my', { method: 'POST', token, body: payload });
      } catch (err) {
        if (err.status === 401) {
          session.del(EDITOR_KEY);
          throw new Error(t('Your edit session expired. Please enter your Registration ID and PIN again.'));
        }
        throw err;
      }
      summary = null;
      demand = null;
      toast(t('Changes saved'));
      location.hash = mybusToken() ? '#status' : '';
    },
  });
  if (mine.sharing_prompt_pending) setTimeout(() => app.querySelector('[data-sharing]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
  renderRemoval(app.querySelector('[data-removal]'), mine, token);
  if (!mine.sharing_prompt_pending) window.scrollTo(0, 0);
}

function renderRemoval(box, mine, token) {
  box.innerHTML = mine.removal_requested_at
    ? `<h3 style="margin:0 0 6px">${esc(t('Removal requested'))}</h3>
       <p class="sj-muted" style="margin:0 0 12px">${esc(t('You asked the administrator to remove this registration on {date}.', { date: fmtDate(mine.removal_requested_at) }))}</p>
       <button type="button" class="sj-btn sj-btn-sm" data-cancel-r>${esc(t('Cancel my request'))}</button>`
    : `<h3 style="margin:0 0 6px">${esc(t('Need this registration removed?'))}</h3>
       <p class="sj-muted" style="margin:0 0 10px">${esc(t('Parents cannot delete registrations. You can ask the administrator to remove it — for example if you registered twice.'))}</p>
       <div class="sj-field"><label for="r-reason">${esc(t('Reason'))} <span class="sj-opt">${esc(t('(optional · administrator only)'))}</span></label>
         <textarea id="r-reason" maxlength="500"></textarea></div>
       <button type="button" class="sj-btn sj-btn-sm sj-btn-danger" data-request-r>${esc(t('Request removal'))}</button>`;
  const send = async (body, done) => {
    try {
      await api('/my/removal', { method: 'POST', token, body });
      mine.removal_requested_at = body.cancel ? null : new Date().toISOString();
      toast(done);
      renderRemoval(box, mine, token);
    } catch (err) { toast(err.message); }
  };
  box.querySelector('[data-cancel-r]')?.addEventListener('click', () => send({ cancel: true }, t('Request cancelled')));
  box.querySelector('[data-request-r]')?.addEventListener('click', () => {
    if (confirm(t('Ask the administrator to remove this registration?'))) send({ reason: box.querySelector('#r-reason').value }, t('Removal request sent to the administrator'));
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

async function route() {
  try {
    // A family's own pages work with their PIN session alone (no shared password needed).
    if (location.hash === '#status' && familyToken()) return await renderStatus();
    if (location.hash === '#mybus' && familyToken()) return await renderMyBus();
    if (!viewerToken()) return renderGate();
    if (location.hash === '#register') return await renderRegister();
    if (location.hash === '#edit') return editorToken() ? await renderEditForm() : renderPinLogin('edit');
    if (location.hash === '#status' || location.hash === '#mybus') return renderPinLogin('status');
    if (!summary) {
      app.innerHTML = `<div class="sj-loading">${esc(t('Loading…'))}</div>`;
      [summary, demand] = await Promise.all([call('/summary'), call('/demand').catch(() => null)]);
    }
    renderHome();
  } catch (err) {
    if (!viewerToken() && !familyToken()) return renderGate();
    app.innerHTML = `<div class="sj-empty" style="margin-top:24px"><p>${esc(err.message)}</p><button class="sj-btn" type="button" data-retry>${esc(t('Try again'))}</button></div>`;
    app.querySelector('[data-retry]').addEventListener('click', route);
  }
}

window.addEventListener('hashchange', route);
route();
