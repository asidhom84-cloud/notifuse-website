// SJAS Bus Registration — parent page.
// Parents see only anonymous totals; their own record only after Registration ID + PIN.

import { api, ApiError, copyText, esc, fmtDate, local, num, session, toast, tokenFrom } from './reg-common.js?v=2';
import { registrationForm } from './reg-form.js?v=2';
import { getLang, initLang, setLang, t } from './reg-i18n.js?v=2';

const VIEWER_KEY = 'busreg.viewer';
const EDITOR_KEY = 'busreg.editor';
const app = document.getElementById('rg-app');
const signoutBtn = document.getElementById('rg-signout');
const langBtn = document.getElementById('rg-lang');

let summary = null;
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

function signOut() {
  local.del(VIEWER_KEY);
  session.del(EDITOR_KEY);
  summary = null;
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
// Home: anonymous totals only
// ---------------------------------------------------------------------------

function renderHome() {
  signoutBtn.hidden = false;
  const s = summary;
  const areaList = s.areas.length || s.other_students
    ? `<ul class="sj-arealist">${s.areas.map((a) => `<li><span>${esc(a.name)}</span><span class="n">${esc(t('{n} students', { n: num(a.students) }))}</span></li>`).join('')}
        ${s.other_students ? `<li><span>${esc(t('Other areas'))}</span><span class="n">${esc(t('{n} students', { n: num(s.other_students) }))}</span></li>` : ''}</ul>`
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
      <a class="sj-btn sj-btn-primary" href="#register">＋ ${esc(t('Register my family'))}</a>
      <a class="sj-btn" href="#edit">${esc(t('Edit my registration'))}</a>
    </div>
    <section class="sj-card" style="margin-bottom:16px">
      <h3 style="margin:0 0 10px">${esc(t('Students by area'))}</h3>
      ${areaList}
    </section>
    <p class="sj-help">${esc(t('Only anonymous totals are shown here. Names, phone numbers and pickup locations are never visible to other parents.'))}</p>`;
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
// Edit (Registration ID + PIN → session for that one registration)
// ---------------------------------------------------------------------------

function renderEditLogin() {
  signoutBtn.hidden = false;
  app.innerHTML = `
    <div style="padding:16px 0"><a href="#" class="sj-linkbtn">${esc(t('← Back'))}</a></div>
    <form class="sj-card sj-formcard" style="max-width:420px" autocomplete="off">
      <h2>${esc(t('Edit my registration'))}</h2>
      <p class="sj-muted" style="margin-top:0">${esc(t('Enter the Registration ID and Edit PIN you received when you registered.'))}</p>
      <div class="sj-field"><label for="e-id">${esc(t('Registration ID'))}</label><input id="e-id" name="rid" placeholder="REG-0042" autocapitalize="characters" required dir="ltr"></div>
      <div class="sj-field"><label for="e-pin">${esc(t('Edit PIN'))}</label><input id="e-pin" name="pin" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="${esc(t('6 digits'))}" required dir="ltr"></div>
      <button class="sj-btn sj-btn-primary sj-btn-block" type="submit">${esc(t('Continue'))}</button>
      <div class="sj-err" role="alert"></div>
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
      session.set(EDITOR_KEY, await call('/auth/edit', { method: 'POST', body: { registration: form.rid.value, pin: form.pin.value.trim() } }));
      await renderEditForm();
    } catch (ex) {
      err.textContent = ex.message;
      btn.disabled = false;
      btn.textContent = t('Continue');
    }
  });
}

async function renderEditForm() {
  const token = tokenFrom(session, EDITOR_KEY);
  if (!token) return renderEditLogin();
  let mine;
  try {
    mine = await api('/my', { token });
  } catch (err) {
    session.del(EDITOR_KEY);
    if (err.status === 401) return renderEditLogin();
    throw err;
  }
  const list = await loadAreas();
  app.innerHTML = `
    <div style="padding:16px 0;display:flex;gap:12px;flex-wrap:wrap;justify-content:space-between">
      <a href="#" class="sj-linkbtn">${esc(t('← Back'))}</a>
      <button type="button" class="sj-linkbtn" data-end>${esc(t('Finish editing'))}</button></div>
    <div class="sj-card sj-formcard">
      <h2>${esc(t('Edit {code}', { code: mine.registration_code }))}</h2>
      ${mine.status === 'hidden' ? `<div class="sj-note sj-note-warn">${esc(t('This registration is currently hidden by the administrator.'))}</div>` : ''}
      <div data-form></div>
    </div>
    <div class="sj-card sj-formcard" data-removal></div>`;
  app.querySelector('[data-end]').addEventListener('click', () => { session.del(EDITOR_KEY); location.hash = ''; });
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
      toast(t('Changes saved'));
      location.hash = '';
    },
  });
  renderRemoval(app.querySelector('[data-removal]'), mine, token);
  window.scrollTo(0, 0);
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
  if (!viewerToken()) return renderGate();
  try {
    if (location.hash === '#register') return await renderRegister();
    if (location.hash === '#edit') return tokenFrom(session, EDITOR_KEY) ? await renderEditForm() : renderEditLogin();
    if (!summary) {
      app.innerHTML = `<div class="sj-loading">${esc(t('Loading…'))}</div>`;
      summary = await call('/summary');
    }
    renderHome();
  } catch (err) {
    if (!viewerToken()) return renderGate();
    app.innerHTML = `<div class="sj-empty" style="margin-top:24px"><p>${esc(err.message)}</p><button class="sj-btn" type="button" data-retry>${esc(t('Try again'))}</button></div>`;
    app.querySelector('[data-retry]').addEventListener('click', route);
  }
}

window.addEventListener('hashchange', route);
route();
