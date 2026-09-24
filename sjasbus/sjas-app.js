// SJAS Bus — parent-facing shared ledger.
import {
  api, ApiError, busKey, busSheets, copyText, downloadExcel, egp, esc, fmtDate, local, num,
  openLightbox, plural, session, submissionForm, toast, today, tokenFrom,
} from './sjas-common.js?v=4';

const VIEWER_KEY = 'sjas.viewer';
const EDITOR_KEY = 'sjas.editor';
const app = document.getElementById('sj-app');
const totalbar = document.getElementById('sj-totalbar');
const signoutBtn = document.getElementById('sj-signout');

const ui = { tab: 'records', q: '', sort: 'order', filter: null };
let data = null;

const viewerToken = () => tokenFrom(local, VIEWER_KEY);

function signOut() {
  local.del(VIEWER_KEY);
  session.del(EDITOR_KEY);
  data = null;
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
      throw new ApiError(401, 'Your session has ended. Please enter the password again.');
    }
    throw err;
  }
}

function setTotalbar(label, value) {
  const show = !!label;
  totalbar.hidden = !show;
  document.body.classList.toggle('sj-has-totalbar', show);
  if (show) {
    totalbar.querySelector('[data-sub]').textContent = label;
    totalbar.querySelector('[data-v]').textContent = egp(value);
  }
}

// ---------------------------------------------------------------------------
// Password gate
// ---------------------------------------------------------------------------

function renderGate() {
  signoutBtn.hidden = true;
  setTotalbar(null);
  app.innerHTML = `
    <div class="sj-gate"><form class="sj-card" autocomplete="off">
      <h1>SJAS Bus</h1>
      <p>Payment Reconciliation — a shared record of bus payments submitted by parents. Enter the access password shared in the parents' group.</p>
      <div class="sj-field"><label for="pw">Access password</label>
        <input id="pw" type="password" autocomplete="current-password" required autofocus></div>
      <button class="sj-btn sj-btn-primary sj-btn-block" type="submit">Enter</button>
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
      const res = await api('/auth/viewer', { method: 'POST', body: { password: form.pw.value } });
      local.set(VIEWER_KEY, res);
      await route();
    } catch (ex) {
      err.textContent = ex.message;
      btn.disabled = false;
      btn.textContent = 'Enter';
      form.pw.select();
    }
  });
}

// ---------------------------------------------------------------------------
// Ledger
// ---------------------------------------------------------------------------

async function loadData() {
  data = await call('/ledger');
  return data;
}

const SORTS = {
  order: (a, b) => a.submission_number - b.submission_number,
  parent: (a, b) => a.parent_name.localeCompare(b.parent_name, 'en', { sensitivity: 'base' }) || a.submission_number - b.submission_number,
  bus: (a, b) => a.bus_label.localeCompare(b.bus_label, 'en', { numeric: true, sensitivity: 'base' }) || a.submission_number - b.submission_number,
  amount_desc: (a, b) => Number(b.amount_total) - Number(a.amount_total) || a.submission_number - b.submission_number,
  amount_asc: (a, b) => Number(a.amount_total) - Number(b.amount_total) || a.submission_number - b.submission_number,
};

function filteredRows() {
  const q = ui.q.trim().toLowerCase();
  const qBus = q ? busKey(q) : '';
  let rows = data.rows.slice();
  if (ui.filter?.type === 'bus') rows = rows.filter((r) => r.bus_key === ui.filter.key);
  if (ui.filter?.type === 'district') rows = rows.filter((r) => (r.district || '') === ui.filter.key);
  if (q) {
    rows = rows.filter((r) => {
      const hay = [r.submission_code, r.parent_name, r.bus_label, r.district, ...(r.student_names || [])].join(' ').toLowerCase();
      return hay.includes(q) || (qBus && r.bus_key === qBus);
    });
  }
  return rows.sort(SORTS[ui.sort] || SORTS.order);
}

function renderLedger() {
  signoutBtn.hidden = false;
  const s = data.summary;
  app.innerHTML = `
    <section class="sj-hero">
      <h1>SJAS Bus<small>Payment Reconciliation</small></h1>
      <p>A shared record of bus payments submitted by parents.</p>
    </section>
    <section class="sj-stats" aria-label="Summary">
      <div class="sj-stat"><div class="k">Families submitted</div><div class="v">${num(s.families)}</div></div>
      <div class="sj-stat"><div class="k">Students represented</div><div class="v">${num(s.students)}</div></div>
      <div class="sj-stat sj-stat-total"><div class="k">Total documented payments</div><div class="v">${esc(egp(s.total_amount))}</div></div>
    </section>
    <div class="sj-actions">
      <a class="sj-btn sj-btn-primary" href="#add">＋ Add My Payment</a>
      <a class="sj-btn" href="#edit">Edit my submission</a>
      <button type="button" class="sj-btn" data-excel>⬇ Download Excel</button>
    </div>
    <div class="sj-tabs" role="tablist" aria-label="Views">
      <button class="sj-tab" role="tab" data-tab="records" aria-selected="${ui.tab === 'records'}">All records</button>
      <button class="sj-tab" role="tab" data-tab="bus" aria-selected="${ui.tab === 'bus'}">By bus</button>
      <button class="sj-tab" role="tab" data-tab="district" aria-selected="${ui.tab === 'district'}">By district</button>
    </div>
    <div id="sj-panel"></div>
    <p class="sj-foot">Amounts are as reported by each parent, with their payment screenshots.<br>Updated ${esc(fmtDate(data.generated_at))} · Mobile numbers and edit PINs are never shown here.</p>`;

  app.querySelector('.sj-tabs').addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]');
    if (!t) return;
    ui.tab = t.dataset.tab;
    app.querySelectorAll('.sj-tab').forEach((b) => b.setAttribute('aria-selected', String(b === t)));
    renderPanel();
  });
  app.querySelector('[data-excel]').addEventListener('click', exportExcel);
  renderPanel();
}

function renderPanel() {
  const panel = document.getElementById('sj-panel');
  if (ui.tab === 'bus') return renderGroups(panel, 'bus');
  if (ui.tab === 'district') return renderGroups(panel, 'district');
  renderRecords(panel);
}

function renderRecords(panel) {
  panel.innerHTML = `
    <div class="sj-toolbar">
      <div class="sj-search">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input type="search" placeholder="Search parent, student, bus or district" aria-label="Search" value="${esc(ui.q)}">
      </div>
      <select aria-label="Sort">
        <option value="order">Order added (SJAS number)</option>
        <option value="parent">Parent name A–Z</option>
        <option value="bus">Bus number</option>
        <option value="amount_desc">Amount paid (high–low)</option>
        <option value="amount_asc">Amount paid (low–high)</option>
      </select>
    </div>
    ${ui.filter ? `<div class="sj-filterchip">${esc(ui.filter.label)}<button type="button" aria-label="Clear filter" data-clear>×</button></div>` : ''}
    <div data-list></div>`;
  const input = panel.querySelector('input');
  const select = panel.querySelector('select');
  select.value = ui.sort;
  input.addEventListener('input', () => { ui.q = input.value; renderList(panel); });
  select.addEventListener('change', () => { ui.sort = select.value; renderList(panel); });
  panel.querySelector('[data-clear]')?.addEventListener('click', () => { ui.filter = null; renderRecords(panel); });
  renderList(panel);
}

function proofBtn(r, long) {
  const n = r.evidence_count;
  if (!n) return `<button type="button" class="sj-proof" disabled>No receipts</button>`;
  return `<button type="button" class="sj-proof" data-proof="${esc(r.submission_code)}" aria-label="View ${n} payment receipt${n === 1 ? '' : 's'} for ${esc(r.parent_name)}">📎 ${long ? `View ${plural(n, 'payment receipt')}` : n}</button>`;
}

function renderList(panel) {
  const list = panel.querySelector('[data-list]');
  const rows = filteredRows();
  const all = data.rows.length;
  const filtered = rows.length !== all;
  const shownTotal = rows.reduce((t, r) => t + Number(r.amount_total), 0);
  const grand = Number(data.summary.total_amount);
  const scopeLabel = ui.filter ? `${ui.filter.label} total` : filtered ? `Showing ${rows.length} of ${all}` : 'All families';
  setTotalbar(scopeLabel, filtered ? shownTotal : grand);

  if (!all) {
    list.innerHTML = `<div class="sj-empty"><p><b>No payments have been submitted yet.</b></p><p>Be the first — it takes about two minutes.</p><a class="sj-btn sj-btn-primary" href="#add">＋ Add My Payment</a></div>`;
    return;
  }
  if (!rows.length) {
    list.innerHTML = `<div class="sj-empty">No records match your search.</div>`;
    return;
  }

  const students = (r) => (r.student_names || []).map(esc).join(', ');
  const tfoot = filtered
    ? `<tr><td colspan="4" class="sj-totallabel">TOTAL — ${esc(ui.filter ? ui.filter.label : `${rows.length} of ${all} families`)}</td><td class="r sj-amt">${esc(egp(shownTotal))}</td><td></td></tr>
       <tr><td colspan="4" class="sj-totallabel">TOTAL DOCUMENTED PAYMENTS — ALL FAMILIES</td><td class="r sj-amt">${esc(egp(grand))}</td><td></td></tr>`
    : `<tr><td colspan="4" class="sj-totallabel">TOTAL DOCUMENTED PAYMENTS</td><td class="r sj-amt">${esc(egp(grand))}</td><td></td></tr>`;

  list.innerHTML = `
    <div class="sj-tablewrap sj-ledgertable">
      <table class="sj-table">
        <thead><tr><th>#</th><th>Parent</th><th>Students</th><th>Bus</th><th class="r">Amount Paid</th><th class="c">Proof</th></tr></thead>
        <tbody>${rows.map((r) => `<tr>
          <td class="sj-code">${esc(r.submission_code)}</td>
          <td class="sj-parent">${esc(r.parent_name)}</td>
          <td>${students(r)}</td>
          <td>${esc(r.bus_label)}<span class="sj-sub">${esc(r.district || '')}</span></td>
          <td class="r sj-amt">${esc(egp(r.amount_total))}</td>
          <td class="c">${proofBtn(r, false)}</td></tr>`).join('')}</tbody>
        <tfoot>${tfoot}</tfoot>
      </table>
    </div>
    <div class="sj-cards">
      ${rows.map((r) => `<article class="sj-lcard">
        <div class="sj-code">${esc(r.submission_code)}</div>
        <div class="sj-parent">${esc(r.parent_name)}</div>
        <div class="sj-meta">${(r.student_names || []).map(esc).join(' · ')} — ${esc(r.bus_label)}${r.district ? `, ${esc(r.district)}` : ''}</div>
        <div class="sj-amt">${esc(egp(r.amount_total))}</div>
        ${proofBtn(r, true)}
      </article>`).join('')}
      ${filtered ? `<div class="sj-cardtotal" style="margin-bottom:10px"><span>TOTAL — ${esc(ui.filter ? ui.filter.label : `${rows.length} of ${all}`)}</span><span class="sj-num">${esc(egp(shownTotal))}</span></div>` : ''}
      <div class="sj-cardtotal"><span>TOTAL DOCUMENTED PAYMENTS</span><span class="sj-num">${esc(egp(grand))}</span></div>
    </div>`;
}

function renderGroups(panel, type) {
  const isBus = type === 'bus';
  const groups = isBus ? data.buses : data.districts;
  const s = data.summary;
  setTotalbar('All families', s.total_amount);
  if (!groups.length) {
    panel.innerHTML = `<div class="sj-empty">No records yet.</div>`;
    return;
  }
  const sub = (g) => isBus ? (g.districts || []).join(', ') : (g.buses || []).join(', ');
  const key = (g) => isBus ? g.bus_key : g.district;
  const label = (g) => isBus ? g.bus_label : g.district || 'No district';
  panel.innerHTML = `
    <p class="sj-help" style="margin-top:0">Tap a ${isBus ? 'bus' : 'district'} to see its families.</p>
    <div class="sj-tablewrap">
      <table class="sj-table">
        <thead><tr><th>${isBus ? 'Bus' : 'District'}</th><th>${isBus ? 'District(s)' : 'Buses'}</th><th class="r">Families</th><th class="r">Students</th><th class="r">Total paid</th></tr></thead>
        <tbody>${groups.map((g) => `<tr class="sj-clickable" tabindex="0" data-key="${esc(key(g))}" data-label="${esc(label(g))}">
          <td class="sj-parent">${esc(label(g))}</td><td>${esc(sub(g))}</td>
          <td class="r sj-num">${num(g.families)}</td><td class="r sj-num">${num(g.students)}</td>
          <td class="r sj-amt">${esc(egp(g.total_amount))}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="2" class="sj-totallabel">TOTAL DOCUMENTED PAYMENTS</td><td class="r sj-num">${num(s.families)}</td><td class="r sj-num">${num(s.students)}</td><td class="r sj-amt">${esc(egp(s.total_amount))}</td></tr></tfoot>
      </table>
    </div>`;
  const open = (tr) => {
    ui.filter = { type, key: tr.dataset.key, label: tr.dataset.label };
    ui.tab = 'records';
    ui.q = '';
    renderLedger();
    window.scrollTo({ top: document.getElementById('sj-panel').offsetTop - 70, behavior: 'smooth' });
  };
  panel.querySelectorAll('tr[data-key]').forEach((tr) => {
    tr.addEventListener('click', () => open(tr));
    tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(tr); });
  });
}

// Evidence viewer
app.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-proof]');
  if (!btn) return;
  const code = btn.dataset.proof;
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="sj-spin"></span>';
  const fetchIt = async () => {
    const d = await call(`/evidence/${encodeURIComponent(code)}`);
    return {
      ...d,
      title: `${d.parent_name} · ${d.submission_code}`,
      subtitle: `${d.students.join(', ')} — ${d.bus_label}${d.district ? `, ${d.district}` : ''} — ${egp(d.amount_total)}`,
    };
  };
  try {
    openLightbox(await fetchIt(), { reload: fetchIt });
  } catch (err) {
    toast(err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
});

async function exportExcel(e) {
  const btn = e.currentTarget;
  const label = btn.textContent;
  btn.disabled = true;
  btn.innerHTML = '<span class="sj-spin"></span> Preparing…';
  try {
    const x = await call('/export');
    const s = x.summary;
    await downloadExcel(`SJAS-Bus-Payments-${today()}.xlsx`, [
      {
        name: 'Ledger',
        header: ['Submission ID', 'Parent', 'Students', 'No. of students', 'Bus', 'District', 'Amount paid (EGP)', 'Payments', 'Screenshots', 'Submitted', 'Last updated'],
        rows: x.rows.map((r) => [r.submission_code, r.parent_name, (r.student_names || []).join(', '), r.student_count, r.bus_label, r.district || '', Number(r.amount_total), r.payment_count, r.evidence_count, fmtDate(r.created_at), fmtDate(r.updated_at)]),
        totalRow: ['TOTAL DOCUMENTED PAYMENTS', `${s.families} families`, '', s.students, '', '', Number(s.total_amount), s.payments, '', '', ''],
        money: [6],
        widths: [14, 24, 28, 10, 10, 16, 18, 10, 11, 12, 12],
      },
      {
        name: 'Payments',
        header: ['Submission ID', 'Parent', 'Bus', 'District', 'Payment #', 'Amount (EGP)', 'Payment date', 'Reference'],
        rows: x.payments.map((p) => [p.submission_code, p.parent_name, p.bus_label, p.district || '', p.payment_no, Number(p.amount), fmtDate(p.payment_date), p.transaction_reference || '']),
        totalRow: ['TOTAL', '', '', '', '', Number(s.total_amount), '', ''],
        money: [5],
        widths: [14, 24, 10, 16, 10, 16, 14, 22],
      },
      ...busSheets(x),
      {
        name: 'Summary',
        header: ['Item', 'Value'],
        rows: [
          ['Families submitted', s.families],
          ['Students represented', s.students],
          ['Total documented payments (EGP)', Number(s.total_amount)],
          ['Payment records', s.payments],
          ['Exported', new Date().toLocaleString('en-GB')],
          ['Note', 'Amounts are as reported by parents. Contact details are not included.'],
        ],
        widths: [34, 60],
      },
    ]);
  } catch (err) {
    toast(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}

// ---------------------------------------------------------------------------
// Add payment
// ---------------------------------------------------------------------------

function knownDistricts() {
  return (data?.districts || []).map((d) => d.district).filter(Boolean);
}

function renderAdd() {
  setTotalbar(null);
  signoutBtn.hidden = false;
  app.innerHTML = `
    <div style="padding:16px 0"><a href="#" class="sj-linkbtn">← Back to the ledger</a></div>
    <div class="sj-card sj-formcard">
      <h2>Add my payment</h2>
      <p class="sj-muted" style="margin-top:0">Record what you paid to the bus company, with the payment screenshot(s).</p>
      <div data-form></div>
    </div>`;
  submissionForm(app.querySelector('[data-form]'), {
    mode: 'create',
    buses: data?.buses,
    districts: knownDistricts(),
    onCancel: () => { location.hash = ''; },
    onSubmit: async (fd) => {
      const res = await call('/submissions', { method: 'POST', form: fd });
      data = null;
      renderSaved(res);
    },
  });
  window.scrollTo(0, 0);
}

function renderSaved(res) {
  const url = `${location.origin}/sjasbus/`;
  const msg = `SJAS Bus payment record\nSubmission ID: ${res.submission_code}\nEdit PIN: ${res.pin}\n${url}`;
  app.innerHTML = `
    <div class="sj-card sj-formcard sj-success" style="margin-top:24px">
      <div class="sj-tick" aria-hidden="true">✓</div>
      <h2>Your submission has been saved.</h2>
      <p class="sj-muted">It now appears in the shared ledger.</p>
      <div class="sj-secret">
        <div><span>Submission ID</span><b>${esc(res.submission_code)}</b></div>
        <div><span>Edit PIN</span><b>${esc(res.pin)}</b></div>
      </div>
      <div class="sj-note sj-note-warn" style="text-align:left"><b>Please save these details now.</b>
        You need both to edit your information later. The PIN will not be shown again — keep it private.</div>
      <div class="sj-formfoot" style="justify-content:center">
        <button type="button" class="sj-btn" data-copy>Copy details</button>
        <a class="sj-btn" href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener noreferrer">Send to myself on WhatsApp</a>
        <button type="button" class="sj-btn sj-btn-primary" data-done>I've saved them — view ledger</button>
      </div>
    </div>`;
  app.querySelector('[data-copy]').addEventListener('click', async () => toast((await copyText(msg)) ? 'Copied' : 'Could not copy — please write them down'));
  app.querySelector('[data-done]').addEventListener('click', () => { location.hash = ''; route(); });
  window.scrollTo(0, 0);
}

// ---------------------------------------------------------------------------
// Edit my submission (Submission ID + PIN)
// ---------------------------------------------------------------------------

function renderEditLogin() {
  setTotalbar(null);
  signoutBtn.hidden = false;
  app.innerHTML = `
    <div style="padding:16px 0"><a href="#" class="sj-linkbtn">← Back to the ledger</a></div>
    <form class="sj-card sj-formcard" style="max-width:420px" autocomplete="off">
      <h2>Edit my submission</h2>
      <p class="sj-muted" style="margin-top:0">Enter the Submission ID and Edit PIN you received when you submitted.</p>
      <div class="sj-field"><label for="e-id">Submission ID</label><input id="e-id" name="sid" placeholder="SJAS-0017" autocapitalize="characters" required></div>
      <div class="sj-field"><label for="e-pin">Edit PIN</label><input id="e-pin" name="pin" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="6 digits" required></div>
      <button class="sj-btn sj-btn-primary sj-btn-block" type="submit">Continue</button>
      <div class="sj-err" role="alert"></div>
      <p class="sj-help">Lost your PIN? Ask the administrator to reset it.</p>
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
      const res = await call('/auth/edit', { method: 'POST', body: { submission: form.sid.value, pin: form.pin.value.trim() } });
      session.set(EDITOR_KEY, res);
      await renderEditForm();
    } catch (ex) {
      err.textContent = ex.message;
      btn.disabled = false;
      btn.textContent = 'Continue';
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
  if (!data) await loadData();
  app.innerHTML = `
    <div style="padding:16px 0;display:flex;gap:12px;flex-wrap:wrap;justify-content:space-between"><a href="#" class="sj-linkbtn">← Back to the ledger</a>
      <button type="button" class="sj-linkbtn" data-end>Finish editing</button></div>
    <div class="sj-card sj-formcard">
      <h2>Edit ${esc(mine.submission_code)}</h2>
      ${mine.status === 'hidden' ? '<div class="sj-note sj-note-warn">This submission is currently hidden from the ledger by the administrator.</div>' : ''}
      <div data-form></div>
    </div>
    <div class="sj-card sj-formcard" data-withdraw></div>`;
  renderWithdraw(app.querySelector('[data-withdraw]'), mine, token);
  app.querySelector('[data-end]').addEventListener('click', () => { session.del(EDITOR_KEY); location.hash = ''; });
  submissionForm(app.querySelector('[data-form]'), {
    mode: 'edit',
    initial: mine,
    buses: data?.buses,
    districts: knownDistricts(),
    onCancel: () => { location.hash = ''; },
    onSubmit: async (fd) => {
      try {
        await api('/my', { method: 'POST', token, form: fd });
      } catch (err) {
        if (err.status === 401) { session.del(EDITOR_KEY); throw new Error('Your edit session expired. Please enter your Submission ID and PIN again.'); }
        throw err;
      }
      data = null;
      toast('Changes saved');
      location.hash = '';
    },
  });
  window.scrollTo(0, 0);
}

function renderWithdraw(box, mine, token) {
  const requested = !!mine.withdrawal_requested_at;
  box.innerHTML = requested
    ? `<h3 style="margin:0 0 6px">Removal requested</h3>
       <p class="sj-muted" style="margin:0 0 12px">You asked the administrator to remove this submission on ${esc(fmtDate(mine.withdrawal_requested_at))}. It stays in the ledger until the administrator acts on it.</p>
       <button type="button" class="sj-btn sj-btn-sm" data-cancel-w>Cancel my request</button>`
    : `<h3 style="margin:0 0 6px">Need this record removed?</h3>
       <p class="sj-muted" style="margin:0 0 10px">Parents cannot delete submissions. You can ask the administrator to withdraw it — for example if it was submitted twice.</p>
       <div class="sj-field"><label for="w-reason">Reason <span class="sj-opt">(optional · administrator only)</span></label>
         <textarea id="w-reason" maxlength="500" placeholder="e.g. My husband already submitted SJAS-0012 for the same children"></textarea></div>
       <button type="button" class="sj-btn sj-btn-sm sj-btn-danger" data-request-w>Request removal</button>`;
  const send = async (body, done) => {
    try {
      await api('/my/withdraw', { method: 'POST', token, body });
      mine.withdrawal_requested_at = body.cancel ? null : new Date().toISOString();
      toast(done);
      renderWithdraw(box, mine, token);
    } catch (err) { toast(err.message); }
  };
  box.querySelector('[data-cancel-w]')?.addEventListener('click', () => send({ cancel: true }, 'Request cancelled'));
  box.querySelector('[data-request-w]')?.addEventListener('click', () => {
    if (confirm('Ask the administrator to remove this submission?')) send({ reason: box.querySelector('#w-reason').value }, 'Removal request sent to the administrator');
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

async function route() {
  if (!viewerToken()) return renderGate();
  const hash = location.hash;
  try {
    if (hash === '#add') {
      if (!data) await loadData();
      return renderAdd();
    }
    if (hash === '#edit') {
      if (tokenFrom(session, EDITOR_KEY)) return await renderEditForm();
      return renderEditLogin();
    }
    if (!data) {
      app.innerHTML = '<div class="sj-loading">Loading…</div>';
      await loadData();
    }
    renderLedger();
  } catch (err) {
    if (!viewerToken()) return renderGate();
    app.innerHTML = `<div class="sj-empty" style="margin-top:24px"><p>${esc(err.message)}</p><button class="sj-btn" type="button" data-retry>Try again</button></div>`;
    app.querySelector('[data-retry]').addEventListener('click', route);
  }
}

window.addEventListener('hashchange', () => {
  // Ignore hash-less history entries pushed by modals.
  route();
});
route();
