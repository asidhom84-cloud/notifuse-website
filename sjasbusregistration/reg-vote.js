// SJAS Bus Registration — "Vote for a bus leader" (public page, no password).
// One vote per phone per bus; voting again replaces it. The server unifies similar
// names. Everyone sees every bus's names and vote counts — never voters or phones.

import { api, esc, local, num, toast } from './reg-common.js?v=23';
import { getLang, initLang, setLang, t } from './reg-i18n.js?v=23';
import './reg-vote-i18n.js?v=23';

const ME_KEY = 'busreg.voter'; // this device only: name + phone, to save retyping
const app = document.getElementById('rg-app');
const langBtn = document.getElementById('rg-lang');
const tt = (k, v) => esc(t(k, v));
const state = { info: null, pick: null, form: {} };

initLang({ key: 'busreg.lang', title: 'Vote for a bus leader' });
const updateLangBtn = () => { langBtn.textContent = getLang() === 'ar' ? 'English' : 'العربية'; langBtn.lang = getLang() === 'ar' ? 'en' : 'ar'; };
updateLangBtn();
langBtn.addEventListener('click', () => { keepForm(); setLang(getLang() === 'ar' ? 'en' : 'ar'); updateLangBtn(); render(); });

// Same bus-number rule as the server: "Bus 7", "باص ٧", "#7" -> "7".
const busKey = (s) => {
  const x = String(s || '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).toLowerCase()
    .replace(/\b(bus|no|number|num|nr)\b\.?/g, ' ').replace(/(باص|اتوبيس|أتوبيس|الباص|رقم|نمرة|نمره)/g, ' ').replace(/[#:.]/g, ' ')
    .replace(/\s*[-/\\&+,]\s*/g, '/').replace(/\s+/g, ' ').trim().replace(/^\/+|\/+$/g, '');
  return /^[\d/ ]+$/.test(x) && /\d/.test(x) ? [...new Set(x.match(/\d+/g).map((n) => String(Number(n))))].join('/') : x.replace(/\s+/g, '');
};
const busOf = (value) => state.info?.buses.find((b) => b.key === busKey(value)) || null;

function keepForm() {
  const f = app.querySelector('form');
  if (f) state.form = { bus: f.bus.value, candidate: f.candidate.value, name: f.voter.value, phone: f.phone.value };
}

async function load() {
  try {
    state.info = await api('/vote/info');
  } catch (err) {
    app.innerHTML = `<div class="sj-empty" style="margin-top:24px"><p>${esc(err.message)}</p><button class="sj-btn" data-retry>${tt('Try again')}</button></div>`;
    app.querySelector('[data-retry]').addEventListener('click', load);
    return;
  }
  if (!state.form.name) {
    let me = null;
    try { me = local.get(ME_KEY); } catch { /* ignore */ }
    state.form = { bus: new URLSearchParams(location.search).get('bus') || '', candidate: '', name: me?.name || '', phone: me?.phone || '' };
  }
  render();
}

const chips = (bus) => (bus?.candidates.length
  ? `${bus.area ? `<p class="sj-help" style="margin:6px 0 0">${tt('Bus {bus}', { bus: bus.label })} · <bdi>${esc(bus.area)}</bdi></p>` : ''}<div class="sj-chips">${bus.candidates.map((c) => `<button type="button" class="sj-chip ${state.pick === c.id ? 'sj-chip-on' : ''}" data-pick="${esc(c.id)}" title="${c.current ? tt('Current delegate') : ''}">${c.current ? '⭐ ' : ''}<bdi>${esc(c.name)}</bdi><span class="sj-chip-n">${num(c.votes)}</span></button>`).join('')}</div>
    ${bus.candidates.some((c) => c.current) ? `<p class="sj-help" style="margin:4px 0 0">⭐ ${tt('Current delegate — tap to confirm, or write another name.')}</p>` : ''}`
  : '');

function render() {
  const info = state.info, f = state.form;
  const bus = busOf(f.bus);
  app.innerHTML = `
    <form class="sj-card sj-formcard sj-form" style="margin-top:20px" novalidate>
      <h2>🗳 ${tt('Vote for a bus leader')}</h2>
      ${info.open ? '' : `<div class="sj-note sj-note-warn">${tt('Voting is closed.')}</div>`}
      <div class="sj-field"><label for="v-bus">${tt('Bus number')}</label>
        <input id="v-bus" name="bus" maxlength="30" value="${esc(f.bus || '')}" placeholder="${tt('e.g. 37')}" inputmode="text"></div>
      <div class="sj-field"><label for="v-cand">${tt('I vote for')}</label>
        <input id="v-cand" name="candidate" maxlength="120" value="${esc(f.candidate || '')}" placeholder="${tt('Name')}"
          autocomplete="off" autocorrect="off" autocapitalize="words" spellcheck="false" data-lpignore="true" data-1p-ignore data-form-type="other" role="combobox" aria-autocomplete="list" aria-controls="v-sugg">
        <div id="v-sugg" data-sugg role="listbox"></div>
        <div data-chips>${chips(bus)}</div></div>
      <div class="sj-row">
        <div class="sj-field"><label for="v-name">${tt('Your name')}</label><input id="v-name" name="voter" autocomplete="name" maxlength="120" value="${esc(f.name || '')}"></div>
        <div class="sj-field"><label for="v-phone">${tt('Your phone number')}</label><input id="v-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" dir="ltr" maxlength="40" value="${esc(f.phone || '')}" placeholder="01xxxxxxxxx"></div>
      </div>
      <div class="sj-note sj-note-err" data-err hidden></div>
      <button type="submit" class="sj-btn sj-btn-primary sj-btn-block" ${info.open ? '' : 'disabled'}>${tt('Send my vote')}</button>
      <p class="sj-help" style="margin:8px 0 0">${tt('One vote per phone for each bus. Voting again changes your vote. Your phone number is never shown.')}</p>
    </form>
    <section class="sj-card sj-formcard" data-all>
      <h2>${tt('All buses')}</h2>
      <p class="sj-help" style="margin-top:0">⭐ ${tt('Current delegate')} · ${tt('the number is the votes so far.')}</p>
      ${info.buses.length ? info.buses.map((b) => `<div style="padding:10px 0;border-top:1px solid var(--line)">
        <button type="button" class="sj-linkbtn" data-bus="${esc(b.label)}"><b>${tt('Bus {bus}', { bus: b.label })}</b></button>${b.area ? ` <span class="sj-small"><bdi>${esc(b.area)}</bdi></span>` : ''}
        <span class="sj-small sj-muted"> · ${tt(b.votes === 1 ? '1 vote' : '{n} votes', { n: num(b.votes) })}</span>
        <div style="margin-top:4px">${b.candidates.map((c, i) => `<span style="display:inline-block;margin:2px 12px 2px 0">${i === 0 && b.candidates.length > 1 && c.votes > b.candidates[1].votes ? '🏆 ' : ''}${c.current ? '⭐ ' : ''}<bdi>${esc(c.name)}</bdi> <b class="sj-num">${num(c.votes)}</b></span>`).join('')}</div>
      </div>`).join('') : `<p class="sj-muted">${tt('No votes yet.')}</p>`}
    </section>`;
  const form = app.querySelector('form');
  form.bus.addEventListener('input', () => { state.pick = null; paintChips(); });
  form.candidate.addEventListener('input', () => {
    const c = busOf(form.bus.value)?.candidates.find((x) => x.id === state.pick);
    if (c && c.name !== form.candidate.value) { state.pick = null; paintChips(); }
    paintSuggestions();
  });
  form.candidate.addEventListener('focus', paintSuggestions);
  form.candidate.addEventListener('blur', () => setTimeout(() => { const el = app.querySelector('[data-sugg]'); if (el) el.innerHTML = ''; }, 200));
  app.querySelector('[data-sugg]').addEventListener('mousedown', (e) => e.preventDefault());
  app.querySelector('[data-sugg]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-sname]');
    if (!b) return;
    form.candidate.value = b.dataset.sname;
    const here = busOf(form.bus.value)?.candidates.find((x) => x.id === b.dataset.sid);
    state.pick = here ? here.id : null;
    app.querySelector('[data-sugg]').innerHTML = '';
    paintChips();
  });
  app.querySelector('[data-chips]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pick]');
    if (!b) return;
    const c = busOf(form.bus.value).candidates.find((x) => x.id === b.dataset.pick);
    state.pick = c.id;
    form.candidate.value = c.name;
    paintChips();
  });
  app.querySelector('[data-all]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-bus]');
    if (!b) return;
    form.bus.value = b.dataset.bus;
    state.pick = null;
    paintChips();
    form.scrollIntoView({ behavior: 'smooth' });
    form.candidate.focus();
  });
  form.addEventListener('submit', submit);
}

// Names already voted for: this bus first, then other buses. Matches any word start,
// Arabic/English spelling-insensitive enough for quick picking.
const fold = (s) => String(s || '').toLowerCase().normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
function paintSuggestions() {
  const form = app.querySelector('form');
  const el = app.querySelector('[data-sugg]');
  if (!form || !el) return;
  const q = fold(form.candidate.value);
  const here = busOf(form.bus.value);
  const seen = new Set();
  const rows = [];
  const add = (c, bus, same) => {
    const k = fold(c.name);
    if (seen.has(k)) return;
    const words = k.split(' ');
    if (q && !words.some((w) => w.startsWith(q.split(' ')[0])) && !k.includes(q)) return;
    seen.add(k);
    rows.push({ c, bus, same });
  };
  (here?.candidates || []).forEach((c) => add(c, here, true));
  if (q) (state.info?.buses || []).filter((b) => b !== here).forEach((b) => b.candidates.forEach((c) => add(c, b, false)));
  if (!rows.length || (!q && !here)) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="sj-card" style="padding:4px;margin-top:4px;max-height:220px;overflow:auto;box-shadow:var(--shadow)">
    ${rows.slice(0, 8).map(({ c, bus, same }) => `<button type="button" class="sj-linkbtn" data-sname="${esc(c.name)}" data-sid="${esc(c.id)}" style="display:flex;width:100%;justify-content:space-between;gap:8px;padding:8px 10px;text-decoration:none;color:inherit">
      <span>${c.current ? '⭐ ' : ''}<bdi>${esc(c.name)}</bdi></span><span class="sj-small sj-muted">${same ? tt(c.votes === 1 ? '1 vote' : '{n} votes', { n: num(c.votes) }) : tt('Bus {bus}', { bus: bus.label })}</span></button>`).join('')}</div>`;
}

function paintChips() {
  const form = app.querySelector('form');
  app.querySelector('[data-chips]').innerHTML = chips(busOf(form.bus.value));
}

async function submit(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const err = form.querySelector('[data-err]');
  err.hidden = true;
  const body = { bus: form.bus.value.trim(), candidate: form.candidate.value.trim(), name: form.voter.value.trim(), phone: form.phone.value.trim(), candidate_id: state.pick || undefined };
  const missing = !body.bus ? t('Enter the bus number.') : !body.candidate ? t('Write the name of the person you vote for.') : !body.name ? t('Please enter your name.') : !body.phone ? t('Phone number is required') : null;
  if (missing) { err.textContent = missing; err.hidden = false; return; }
  const btn = form.querySelector('[type=submit]');
  btn.disabled = true;
  btn.innerHTML = '<span class="sj-spin"></span>';
  try {
    const r = await api('/vote', { method: 'POST', body });
    try { local.set(ME_KEY, { name: body.name, phone: body.phone }); } catch { /* ignore */ }
    toast(t(r.changed ? 'Your vote was changed' : 'Thank you — your vote was counted'));
    state.form = { bus: r.bus.label, candidate: r.counted_for, name: body.name, phone: body.phone };
    state.info = await api('/vote/info');
    state.pick = busOf(r.bus.label)?.candidates.find((c) => c.name === r.counted_for)?.id || null;
    render();
    const note = document.createElement('div');
    note.className = 'sj-note sj-note-ok';
    note.textContent = `✓ ${t('Bus {bus}: your vote is for {name}.', { bus: r.bus.label, name: r.counted_for })}`;
    app.querySelector('form h2').after(note);
  } catch (ex) {
    err.textContent = ex.message;
    err.hidden = false;
    btn.disabled = false;
    btn.textContent = t('Send my vote');
  }
}

load();
