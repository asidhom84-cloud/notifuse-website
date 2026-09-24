// SJAS Bus — administrator dashboard.
import {
  api, busSheets, downloadExcel, egp, esc, fmtDate, fmtDateTime, num, openLightbox, openModal,
  session, submissionForm, toast, today, tokenFrom,
} from './sjas-common.js?v=7';

const ADMIN_KEY = 'sjas.admin';
const app = document.getElementById('sj-app');
const signoutBtn = document.getElementById('sj-signout');

const ui = { tab: 'subs', q: '', status: 'visible', sort: 'order' };
let data = null;

const token = () => tokenFrom(session, ADMIN_KEY);

function signOut() {
  session.del(ADMIN_KEY);
  data = null;
  renderGate();
}
signoutBtn.addEventListener('click', signOut);

async function call(path, opts = {}) {
  try {
    return await api(path, { token: token(), ...opts });
  } catch (err) {
    if (err.status === 401) {
      signOut();
      throw new Error('Admin session ended. Please sign in again.');
    }
    throw err;
  }
}

const FLAG_LABEL = {
  possible_duplicate_family: 'Possible duplicate family',
  duplicate_evidence: 'Possible duplicate evidence',
  duplicate_reference: 'Duplicate transaction reference',
};
const REASON_LABEL = {
  same_student_same_bus: 'Same student name on the same bus',
  same_parent_name: 'Same parent name',
  same_contact_phone: 'Same contact phone',
};
function flagText(f) {
  const d = f.detail || {};
  if (f.kind === 'possible_duplicate_family') {
    return `${REASON_LABEL[d.reason] || d.reason}${d.student ? ` — “${d.student}”` : ''}${d.bus ? ` on ${d.bus}` : ''}. If both parents submitted for the same children, the grand total is double-counted.`;
  }
  if (f.kind === 'duplicate_evidence') return 'An identical screenshot file appears in both submissions.';
  if (f.kind === 'duplicate_reference') return `Same payment reference “${d.reference || ''}” used in both submissions.`;
  return '';
}

const STATUS_BADGE = {
  active: '<span class="sj-badge sj-badge-ok">Active</span>',
  hidden: '<span class="sj-badge sj-badge-warn">Hidden</span>',
  deleted: '<span class="sj-badge sj-badge-danger">Deleted</span>',
};

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

function renderGate() {
  signoutBtn.hidden = true;
  app.innerHTML = `
    <div class="sj-gate"><form class="sj-card" autocomplete="off">
      <h1>SJAS Bus admin</h1>
      <p>Administrator access only. This is a separate password from the parents' access password.</p>
      <div class="sj-field"><label for="pw">Admin password</label>
        <input id="pw" type="password" autocomplete="current-password" required autofocus></div>
      <button class="sj-btn sj-btn-primary sj-btn-block" type="submit">Sign in</button>
      <div class="sj-err" role="alert"></div>
      <p class="sj-help"><a href="/sjasbus/">Go to the parents' ledger</a></p>
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
      const res = await api('/auth/admin', { method: 'POST', body: { password: form.pw.value } });
      session.set(ADMIN_KEY, res);
      await load();
    } catch (ex) {
      err.textContent = ex.message;
      btn.disabled = false;
      btn.textContent = 'Sign in';
    }
  });
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

async function load() {
  app.innerHTML = '<div class="sj-loading">Loading…</div>';
  try {
    data = await call(`/admin/overview?deleted=1`);
    renderDashboard();
  } catch (err) {
    if (!token()) return;
    app.innerHTML = `<div class="sj-empty" style="margin-top:24px"><p>${esc(err.message)}</p><button class="sj-btn" data-retry>Try again</button></div>`;
    app.querySelector('[data-retry]').addEventListener('click', load);
  }
}

async function refresh() {
  data = await call(`/admin/overview?deleted=1`);
  renderDashboard();
}

function renderDashboard() {
  signoutBtn.hidden = false;
  const s = data.summary;
  const openFlags = openPairCount();
  const withdrawals = data.rows.filter((r) => r.withdrawal_requested_at && r.status !== 'deleted').length;
  app.innerHTML = `
    <section class="sj-hero"><h1>SJAS Bus<small>Administrator dashboard</small></h1>
      <p>Totals include active submissions only (hidden and deleted records are excluded).</p></section>
    <section class="sj-stats" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">
      <div class="sj-stat"><div class="k">Families submitted</div><div class="v">${num(s.families)}</div></div>
      <div class="sj-stat"><div class="k">Students represented</div><div class="v">${num(s.students)}</div></div>
      <div class="sj-stat sj-stat-total"><div class="k">Total documented payments</div><div class="v">${esc(egp(s.total_amount))}</div></div>
      <div class="sj-stat ${openFlags ? 'sj-stat-warn' : ''}"><div class="k">Possible duplicates to review</div><div class="v">${num(openFlags)}</div></div>
      <div class="sj-stat ${withdrawals ? 'sj-stat-warn' : ''}"><div class="k">Removal requests</div><div class="v">${num(withdrawals)}</div></div>
    </section>
    <div class="sj-actions">
      <button type="button" class="sj-btn sj-btn-primary" data-excel>⬇ Download full Excel report</button>
      <button type="button" class="sj-btn" data-reload>↻ Refresh</button>
      <a class="sj-btn" href="/sjasbus/" target="_blank" rel="noopener">Open parents' ledger</a>
    </div>
    <div class="sj-tabs" role="tablist">
      <button class="sj-tab" role="tab" data-tab="subs" aria-selected="${ui.tab === 'subs'}">Submissions</button>
      <button class="sj-tab" role="tab" data-tab="flags" aria-selected="${ui.tab === 'flags'}">Review duplicates${openFlags ? ` <span class="sj-badge sj-badge-warn">${openFlags}</span>` : ''}</button>
      <button class="sj-tab" role="tab" data-tab="bus" aria-selected="${ui.tab === 'bus'}">By bus</button>
      <button class="sj-tab" role="tab" data-tab="district" aria-selected="${ui.tab === 'district'}">By district</button>
    </div>
    <div id="sj-panel"></div>
    <p class="sj-foot">Updated ${esc(fmtDateTime(data.generated_at))}</p>`;
  app.querySelector('.sj-tabs').addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]');
    if (!t) return;
    ui.tab = t.dataset.tab;
    app.querySelectorAll('.sj-tab').forEach((b) => b.setAttribute('aria-selected', String(b === t)));
    renderPanel();
  });
  app.querySelector('[data-excel]').addEventListener('click', exportExcel);
  app.querySelector('[data-reload]').addEventListener('click', () => refresh().then(() => toast('Refreshed')).catch((e) => toast(e.message)));
  renderPanel();
}

function renderPanel() {
  const panel = document.getElementById('sj-panel');
  panel.onclick = null;
  if (ui.tab === 'flags') return renderFlags(panel);
  if (ui.tab === 'bus' || ui.tab === 'district') return renderGroups(panel, ui.tab);
  renderSubs(panel);
}

function renderSubs(panel) {
  panel.innerHTML = `
    <div class="sj-toolbar">
      <div class="sj-search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
        <input type="search" placeholder="Search ID, parent, student, bus, district, phone" value="${esc(ui.q)}" aria-label="Search"></div>
      <select data-status aria-label="Status filter">
        <option value="visible">Active + hidden</option><option value="active">Active only</option>
        <option value="hidden">Hidden</option><option value="deleted">Deleted</option>
        <option value="withdrawal">Removal requested</option><option value="flagged">Has open flags</option><option value="all">All</option>
      </select>
      <select data-sort aria-label="Sort">
        <option value="order">Order added</option><option value="edited">Last edited</option>
        <option value="parent">Parent A–Z</option><option value="bus">Bus</option><option value="amount">Amount (high–low)</option>
      </select>
    </div>
    <div data-list></div>`;
  const q = panel.querySelector('input');
  const st = panel.querySelector('[data-status]');
  const so = panel.querySelector('[data-sort]');
  st.value = ui.status;
  so.value = ui.sort;
  q.addEventListener('input', () => { ui.q = q.value; renderSubList(panel); });
  st.addEventListener('change', () => { ui.status = st.value; renderSubList(panel); });
  so.addEventListener('change', () => { ui.sort = so.value; renderSubList(panel); });
  renderSubList(panel);
}

function renderSubList(panel) {
  const q = ui.q.trim().toLowerCase();
  let rows = data.rows.filter((r) => {
    switch (ui.status) {
      case 'visible': return r.status !== 'deleted';
      case 'withdrawal': return r.withdrawal_requested_at && r.status !== 'deleted';
      case 'flagged': return r.open_flags > 0;
      case 'all': return true;
      default: return r.status === ui.status;
    }
  });
  if (q) rows = rows.filter((r) => [r.submission_code, r.parent_name, r.bus_label, r.bus_number, r.district, r.contact_phone, ...(r.student_names || [])].join(' ').toLowerCase().includes(q));
  const sorts = {
    order: (a, b) => a.submission_number - b.submission_number,
    edited: (a, b) => new Date(b.updated_at) - new Date(a.updated_at),
    parent: (a, b) => a.parent_name.localeCompare(b.parent_name),
    bus: (a, b) => a.bus_label.localeCompare(b.bus_label, 'en', { numeric: true }),
    amount: (a, b) => Number(b.amount_total) - Number(a.amount_total),
  };
  rows.sort(sorts[ui.sort]);
  const total = rows.filter((r) => r.status === 'active').reduce((t, r) => t + Number(r.amount_total), 0);
  panel.querySelector('[data-list]').innerHTML = rows.length ? `
    <div class="sj-tablewrap"><table class="sj-table">
      <thead><tr><th>ID</th><th>Parent</th><th>Students</th><th>Bus / district</th><th class="r">Amount</th><th class="c">Evidence</th><th>Phone</th><th>Status</th><th>Submitted</th><th>Last edited</th></tr></thead>
      <tbody>${rows.map((r) => `<tr class="sj-clickable" tabindex="0" data-open="${esc(r.submission_code)}">
        <td class="sj-code">${esc(r.submission_code)}</td>
        <td class="sj-parent">${esc(r.parent_name)}
          ${r.open_flags ? `<span class="sj-sub"><span class="sj-badge sj-badge-warn">⚑ ${r.open_flags} flag${r.open_flags > 1 ? 's' : ''}</span></span>` : ''}
          ${r.withdrawal_requested_at && r.status !== 'deleted' ? '<span class="sj-sub"><span class="sj-badge sj-badge-danger">Removal requested</span></span>' : ''}
          ${r.admin_notes ? '<span class="sj-sub">📝 has note</span>' : ''}</td>
        <td>${(r.student_names || []).map(esc).join(', ')}</td>
        <td>${esc(r.bus_label)}<span class="sj-sub">${esc(r.district || '')}</span></td>
        <td class="r sj-amt">${esc(egp(r.amount_total))}<span class="sj-sub">${r.payment_count} payment${r.payment_count === 1 ? '' : 's'}</span></td>
        <td class="c">${r.evidence_count}</td>
        <td class="sj-num">${esc(r.contact_phone || '—')}</td>
        <td>${STATUS_BADGE[r.status] || esc(r.status)}${r.pin_locked ? '<span class="sj-sub">PIN locked</span>' : ''}</td>
        <td class="sj-num">${esc(fmtDate(r.created_at))}</td>
        <td class="sj-num">${esc(fmtDateTime(r.updated_at))}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="4" class="sj-totallabel">ACTIVE TOTAL IN THIS LIST (${rows.filter((r) => r.status === 'active').length})</td><td class="r sj-amt">${esc(egp(total))}</td><td colspan="5"></td></tr></tfoot>
    </table></div>` : '<div class="sj-empty">No submissions match.</div>';
  panel.querySelectorAll('[data-open]').forEach((tr) => {
    tr.addEventListener('click', () => openDetail(tr.dataset.open));
    tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') openDetail(tr.dataset.open); });
  });
}

// Several flags usually describe the same two records (same student, same
// phone, same screenshot...). Group them per pair so each pair is one review.
function flagGroups(flags) {
  const groups = new Map();
  for (const f of flags) {
    const codes = [f.submission?.code, f.related?.code].filter(Boolean).sort();
    const key = `${f.resolved_at ? 'r' : 'o'}|${codes.join('|')}`;
    if (!groups.has(key)) groups.set(key, { key, resolved: !!f.resolved_at, a: f.submission, b: f.related, flags: [] });
    groups.get(key).flags.push(f);
  }
  return [...groups.values()];
}

function reasonList(flags) {
  const out = [];
  const dupImages = flags.filter((f) => f.kind === 'duplicate_evidence').length;
  for (const f of flags) {
    const d = f.detail || {};
    if (f.kind === 'possible_duplicate_family') {
      if (d.reason === 'same_student_same_bus') out.push(`Same student “${d.student}” on ${d.bus}`);
      else out.push(REASON_LABEL[d.reason] || d.reason);
    } else if (f.kind === 'duplicate_reference') out.push(`Same payment reference “${d.reference || ''}”`);
  }
  if (dupImages) out.push(`${dupImages} identical screenshot${dupImages > 1 ? 's' : ''} in both records`);
  return out;
}

const openPairCount = () => flagGroups(data.flags.filter((f) => !f.resolved_at)).length;

function renderFlags(panel) {
  const groups = flagGroups(data.flags);
  const open = groups.filter((g) => !g.resolved);
  const resolved = groups.filter((g) => g.resolved);
  const card = (g) => {
    const reasons = reasonList(g.flags);
    const f0 = g.flags[0];
    return `<div class="sj-flag ${g.resolved ? 'resolved' : ''}">
    <h4>⚑ ${reasons.length >= 3 ? 'Very likely the same family submitted twice' : 'Possible duplicate'}</h4>
    <ul style="margin:4px 0 0;padding-left:20px">${reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
    <div class="sj-inline">
      ${g.a ? `<button type="button" class="sj-btn sj-btn-sm" data-open="${esc(g.a.code)}">${esc(g.a.code)} · ${esc(g.a.parent_name)}</button>` : ''}
      <span class="sj-muted">↔</span>
      ${g.b ? `<button type="button" class="sj-btn sj-btn-sm" data-open="${esc(g.b.code)}">${esc(g.b.code)} · ${esc(g.b.parent_name)}</button>` : ''}
    </div>
    <div class="sj-inline">
      ${g.resolved
        ? `<span class="sj-small sj-muted">Reviewed ${esc(fmtDateTime(f0.resolved_at))}${f0.resolution_note ? ` — ${esc(f0.resolution_note)}` : ''}</span>
           <button type="button" class="sj-btn sj-btn-sm sj-btn-ghost" data-reopen="${esc(g.key)}">Reopen</button>`
        : `<input class="sj-input" style="flex:1;min-width:180px" placeholder="Resolution note (optional), e.g. hid SJAS-0220 as duplicate" data-note="${esc(g.key)}">
           <button type="button" class="sj-btn sj-btn-sm" data-resolve="${esc(g.key)}">Mark reviewed</button>`}
    </div></div>`;
  };
  panel.innerHTML = `
    <p class="sj-help" style="margin-top:0">Each card is one pair of records. Open both, hide the duplicate (if it is one), then mark the pair reviewed.</p>
    ${open.length ? open.map(card).join('') : '<div class="sj-empty">Nothing to review. 🎉</div>'}
    ${resolved.length ? `<details style="margin-top:16px"><summary class="sj-muted" style="cursor:pointer">Reviewed (${resolved.length})</summary><div style="margin-top:10px">${resolved.map(card).join('')}</div></details>` : ''}
    <p class="sj-help">Flags are internal and never shown to parents. Parents are never blocked; review and hide duplicates if needed.</p>`;
  panel.onclick = (e) => onFlagClick(e, groups);
}

async function onFlagClick(e, groups) {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.open) return openDetail(t.dataset.open);
  const key = t.dataset.resolve || t.dataset.reopen;
  const group = groups.find((g) => g.key === key);
  if (!group) return;
  const note = t.dataset.resolve ? (document.querySelector(`[data-note="${CSS.escape(key)}"]`)?.value || '') : '';
  t.disabled = true;
  try {
    for (const f of group.flags) {
      await call(`/admin/flags/${f.id}`, { method: 'POST', body: { resolved: !!t.dataset.resolve, note } });
    }
    await refresh();
  } catch (err) { toast(err.message); t.disabled = false; }
}

function renderGroups(panel, type) {
  const isBus = type === 'bus';
  const groups = isBus ? data.buses : data.districts;
  const s = data.summary;
  panel.innerHTML = groups.length ? `
    <div class="sj-tablewrap"><table class="sj-table">
      <thead><tr><th>${isBus ? 'Bus' : 'District'}</th><th>${isBus ? 'District(s)' : 'Buses'}</th><th class="r">Families</th><th class="r">Students</th><th class="r">Total paid</th></tr></thead>
      <tbody>${groups.map((g) => `<tr>
        <td class="sj-parent">${esc(isBus ? g.bus_label : g.district)}${isBus && g.district_variants > 1 ? ' <span class="sj-badge sj-badge-warn" title="Families on this bus entered different districts">mixed districts</span>' : ''}</td>
        <td>${esc((isBus ? g.districts : g.buses || []).join(', '))}</td>
        <td class="r sj-num">${num(g.families)}</td><td class="r sj-num">${num(g.students)}</td><td class="r sj-amt">${esc(egp(g.total_amount))}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="2" class="sj-totallabel">TOTAL</td><td class="r sj-num">${num(s.families)}</td><td class="r sj-num">${num(s.students)}</td><td class="r sj-amt">${esc(egp(s.total_amount))}</td></tr></tfoot>
    </table></div>
    <p class="sj-help">Bus numbers are normalised (e.g. “Bus 037”, “bus37”, “٣٧” → Bus 37). District spellings are unified to the first spelling used (e.g. “Mdinty” → “Madinaty”). To fix a remaining mismatch, edit the submission.</p>`
    : '<div class="sj-empty">No active submissions.</div>';
}

// ---------------------------------------------------------------------------
// Submission detail
// ---------------------------------------------------------------------------

function describeAudit(a) {
  const o = a.old_value, n = a.new_value;
  switch (a.action) {
    case 'create': return `Created with total ${egp(n?.total)}`;
    case 'amount_change': return `<b>Total changed: ${esc(egp(o))} → ${esc(egp(n))}</b>`;
    case 'update': {
      const parts = [];
      for (const k of ['parent_name', 'contact_phone', 'bus_number', 'district', 'parent_notes']) {
        if ((o?.[k] ?? '') !== (n?.[k] ?? '')) parts.push(`${k.replace('_', ' ')}: “${esc(o?.[k] ?? '')}” → “${esc(n?.[k] ?? '')}”`);
      }
      if (JSON.stringify(o?.students) !== JSON.stringify(n?.students)) parts.push(`students: ${esc((o?.students || []).join(', '))} → ${esc((n?.students || []).join(', '))}`);
      if (JSON.stringify(o?.payments) !== JSON.stringify(n?.payments)) {
        const fmt = (ps) => (ps || []).map((p) => `${egp(p.amount)}${p.payment_date ? ` (${fmtDate(p.payment_date)})` : ''}${p.transaction_reference ? ` ref ${p.transaction_reference}` : ''}`).join(' + ');
        parts.push(`payments: ${esc(fmt(o?.payments))} → ${esc(fmt(n?.payments))}`);
      }
      return parts.join('<br>') || 'Saved (no visible change)';
    }
    case 'add_evidence': return `Added ${n?.evidence_ids?.length || 0} screenshot(s)`;
    case 'remove_evidence': return `Removed ${o?.evidence_ids?.length || 0} screenshot(s) (files kept)`;
    case 'status_change': return `Status: ${esc(o)} → ${esc(n)}`;
    case 'admin_notes': return 'Admin note updated';
    case 'pin_reset': return 'Edit PIN reset';
    case 'withdrawal_requested': return `Parent requested removal${n?.reason ? `: “${esc(n.reason)}”` : ''}`;
    case 'withdrawal_cancelled': return 'Parent cancelled removal request';
    case 'hide_evidence': return 'Screenshot hidden from parents';
    case 'unhide_evidence': return 'Screenshot made visible again';
    case 'restore_evidence': return 'Removed screenshot restored';
    case 'flag_resolved': return `Flag marked reviewed${n?.note ? `: ${esc(n.note)}` : ''}`;
    case 'flag_reopened': return 'Flag reopened';
    default: return esc(a.action);
  }
}

async function openDetail(code) {
  const body = document.createElement('div');
  body.innerHTML = '<div class="sj-loading">Loading…</div>';
  const modal = openModal(code, body, { wide: true });
  const reload = async () => {
    try {
      const d = await call(`/admin/submission/${encodeURIComponent(code)}`);
      renderDetail(body, d, modal, reload);
    } catch (err) {
      body.innerHTML = `<div class="sj-note sj-note-err">${esc(err.message)}</div>`;
    }
  };
  await reload();
}

function renderDetail(body, d, modal, reload) {
  modal.setTitle(`${d.submission_code} · ${d.parent_name}`);
  const payById = new Map(d.payments.map((p) => [p.id, p]));
  const openFlags = d.flags.filter((f) => !f.resolved_at);
  body.innerHTML = `
    <div class="sj-inline" style="flex-wrap:wrap;margin-bottom:14px">
      ${STATUS_BADGE[d.status] || ''}
      ${d.withdrawal_requested_at ? `<span class="sj-badge sj-badge-danger">Removal requested ${esc(fmtDate(d.withdrawal_requested_at))}</span>` : ''}
      ${d.pin_locked_until && new Date(d.pin_locked_until) > new Date() ? '<span class="sj-badge sj-badge-warn">PIN locked</span>' : ''}
      ${openFlags.length ? `<span class="sj-badge sj-badge-warn">⚑ possible duplicate of ${new Set(openFlags.map((f) => f.other?.code)).size} record(s)</span>` : ''}
    </div>
    ${d.withdrawal_requested_at ? `<div class="sj-note sj-note-warn"><b>The parent asked for this submission to be removed.</b>${d.withdrawal_reason ? esc(d.withdrawal_reason) : 'No reason given.'}</div>` : ''}
    <div class="sj-inline" style="flex-wrap:wrap;margin-bottom:16px">
      <button type="button" class="sj-btn sj-btn-sm sj-btn-primary" data-act="edit">Edit submission</button>
      ${d.status === 'active' ? '<button type="button" class="sj-btn sj-btn-sm" data-act="hidden">Hide from ledger</button>' : ''}
      ${d.status !== 'active' ? '<button type="button" class="sj-btn sj-btn-sm" data-act="active">Restore to ledger</button>' : ''}
      ${d.status !== 'deleted' ? '<button type="button" class="sj-btn sj-btn-sm sj-btn-danger" data-act="deleted">Delete</button>' : ''}
      <button type="button" class="sj-btn sj-btn-sm" data-act="pin">Reset edit PIN</button>
    </div>
    <dl class="sj-kv">
      <dt>Parent</dt><dd><b>${esc(d.parent_name)}</b></dd>
      <dt>Contact phone</dt><dd>${d.contact_phone ? `<a href="tel:${esc(d.contact_phone)}">${esc(d.contact_phone)}</a>` : '—'}</dd>
      <dt>Students</dt><dd>${d.students.map(esc).join(', ')}</dd>
      <dt>Bus</dt><dd>${esc(d.bus_label)} <span class="sj-muted">(entered as “${esc(d.bus_number)}”)</span></dd>
      <dt>District</dt><dd>${esc(d.district || '—')}</dd>
      <dt>Parent notes</dt><dd>${d.parent_notes ? esc(d.parent_notes) : '—'}</dd>
      <dt>Submitted</dt><dd>${esc(fmtDateTime(d.created_at))}</dd>
      <dt>Last edited</dt><dd>${esc(fmtDateTime(d.updated_at))}</dd>
    </dl>

    <div class="sj-section"><h3>Payments</h3>
      <div class="sj-tablewrap"><table class="sj-table">
        <thead><tr><th>#</th><th class="r">Amount</th><th>Date</th><th>Reference</th></tr></thead>
        <tbody>${d.payments.map((p) => `<tr><td>Payment ${p.number}</td><td class="r sj-amt">${esc(egp(p.amount))}</td><td>${esc(fmtDate(p.payment_date) || '—')}</td><td>${esc(p.transaction_reference || '—')}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td class="sj-totallabel">TOTAL</td><td class="r sj-amt">${esc(egp(d.amount_total))}</td><td colspan="2"></td></tr></tfoot>
      </table></div></div>

    <div class="sj-section"><h3>Evidence (${d.evidence.filter((e) => !e.removed && !e.hidden).length} visible to parents)</h3>
      ${d.evidence.length ? `<div class="sj-evgrid">${d.evidence.map((e, i) => {
        const p = payById.get(e.payment_id);
        return `<div class="sj-evitem ${e.hidden || e.removed ? 'dim' : ''}">
          <div class="img" data-view="${i}">${e.url ? `<img src="${esc(e.url)}" alt="Receipt ${i + 1}" loading="lazy">` : 'Image'}</div>
          <div class="meta">
            <span>${p ? `Payment ${p.number} · ${esc(egp(p.amount))}` : 'Not linked to a payment'}</span>
            <span class="sj-muted">${esc(fmtDateTime(e.created_at))}</span>
            ${e.removed ? `<span class="sj-badge sj-badge-danger">Removed by ${esc(e.removed_by || '')}</span><button type="button" class="sj-btn sj-btn-sm" data-ev="${esc(e.id)}" data-restore>Restore</button>`
              : e.hidden ? `<span class="sj-badge sj-badge-warn">Hidden</span><button type="button" class="sj-btn sj-btn-sm" data-ev="${esc(e.id)}" data-hide="0">Unhide</button>`
              : `<button type="button" class="sj-btn sj-btn-sm" data-ev="${esc(e.id)}" data-hide="1">Hide from parents</button>`}
          </div></div>`;
      }).join('')}</div>` : '<p class="sj-muted">No screenshots.</p>'}
    </div>

    ${d.flags.length ? `<div class="sj-section"><h3>Possible duplicates</h3>${flagGroups(d.flags.map((f) => ({ ...f, submission: f.other, related: null }))).map((g) => `<div class="sj-flag ${g.resolved ? 'resolved' : ''}">
      <h4>⚑ vs ${esc(g.a?.code || '?')} · ${esc(g.a?.parent_name || '')}</h4>
      <ul style="margin:4px 0 0;padding-left:20px">${reasonList(g.flags).map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
      <div class="sj-inline">${g.resolved ? `<span class="sj-small sj-muted">Reviewed ${esc(fmtDateTime(g.flags[0].resolved_at))}${g.flags[0].resolution_note ? ` — ${esc(g.flags[0].resolution_note)}` : ''}</span>`
        : `<button type="button" class="sj-btn sj-btn-sm" data-flag="${esc(g.flags.map((f) => f.id).join(','))}">Mark reviewed</button>`}</div></div>`).join('')}</div>` : ''}

    <div class="sj-section"><h3>Admin note <span class="sj-opt">(internal)</span></h3>
      <textarea class="sj-input" data-notes maxlength="4000">${esc(d.admin_notes || '')}</textarea>
      <div style="margin-top:8px"><button type="button" class="sj-btn sj-btn-sm" data-save-notes>Save note</button></div></div>

    <div class="sj-section"><h3>Audit log</h3>
      ${d.audit.length ? `<div class="sj-tablewrap"><table class="sj-table sj-audit"><thead><tr><th>When</th><th>By</th><th>Change</th></tr></thead>
        <tbody>${d.audit.map((a) => `<tr><td class="sj-num">${esc(fmtDateTime(a.created_at))}</td><td>${esc(a.actor)}</td><td>${describeAudit(a)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="sj-muted">No entries.</p>'}
    </div>`;

  const lightboxData = () => ({
    title: `${d.parent_name} · ${d.submission_code}`,
    subtitle: `${d.bus_label}${d.district ? `, ${d.district}` : ''} — ${egp(d.amount_total)} (admin view: includes hidden/removed)`,
    payments: d.payments,
    amount_total: d.amount_total,
    evidence: d.evidence,
  });
  body.querySelectorAll('[data-view]').forEach((el) => el.addEventListener('click', () => openLightbox(lightboxData(), { startIndex: Number(el.dataset.view) })));

  // Assigned (not added) so re-renders of the same modal body don't stack handlers.
  body.onclick = async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    try {
      if (b.dataset.act === 'edit') return renderEdit(body, d, reload);
      if (['hidden', 'active', 'deleted'].includes(b.dataset.act)) {
        const msg = { hidden: 'Hide this submission from the shared ledger? It will no longer count in the totals.', active: 'Restore this submission to the shared ledger?', deleted: 'Delete this submission? It will be removed from the ledger and totals. (It is kept in the database for the audit trail and can be restored.)' }[b.dataset.act];
        if (!confirm(msg)) return;
        b.disabled = true;
        await call(`/admin/submission/${d.submission_code}/status`, { method: 'POST', body: { status: b.dataset.act } });
        toast('Status updated');
        await reload();
        refresh();
      } else if (b.dataset.act === 'pin') {
        if (!confirm('Generate a new edit PIN? The old PIN stops working immediately.')) return;
        const r = await call(`/admin/submission/${d.submission_code}/reset-pin`, { method: 'POST' });
        alert(`New edit PIN for ${r.submission_code}: ${r.pin}\n\nGive it privately to the parent. It will not be shown again.`);
        reload();
      } else if (b.dataset.ev) {
        b.disabled = true;
        await call(`/admin/evidence/${b.dataset.ev}`, { method: 'POST', body: b.dataset.restore !== undefined ? { restore: true } : { hidden: b.dataset.hide === '1' } });
        await reload();
        refresh();
      } else if (b.dataset.flag) {
        b.disabled = true;
        for (const id of b.dataset.flag.split(',')) await call(`/admin/flags/${id}`, { method: 'POST', body: { resolved: true } });
        await reload();
        refresh();
      } else if (b.dataset.saveNotes !== undefined) {
        b.disabled = true;
        await call(`/admin/submission/${d.submission_code}/notes`, { method: 'POST', body: { admin_notes: body.querySelector('[data-notes]').value } });
        toast('Note saved');
        b.disabled = false;
        refresh();
      }
    } catch (err) {
      toast(err.message);
      b.disabled = false;
    }
  };
}

function renderEdit(body, d, reload) {
  body.innerHTML = '<div class="sj-note sj-note-info" style="margin-top:0">Editing as administrator. Every change is recorded in the audit log, including previous amounts.</div><div data-form></div>';
  submissionForm(body.querySelector('[data-form]'), {
    mode: 'admin',
    initial: d,
    buses: data.buses,
    rows: data.rows,
    districts: data.districts.map((x) => x.district).filter(Boolean),
    onCancel: () => reload(),
    onSubmit: async (fd) => {
      await call(`/admin/submission/${d.submission_code}`, { method: 'POST', form: fd });
      toast('Saved');
      await reload();
      refresh();
    },
  });
}

// ---------------------------------------------------------------------------
// Excel (full admin report)
// ---------------------------------------------------------------------------

async function exportExcel(e) {
  const btn = e.currentTarget;
  const label = btn.textContent;
  btn.disabled = true;
  btn.innerHTML = '<span class="sj-spin"></span> Preparing…';
  try {
    const x = await call('/admin/export');
    const s = x.summary;
    const active = x.rows.filter((r) => r.status === 'active');
    await downloadExcel(`SJAS-Bus-Admin-Report-${today()}.xlsx`, [
      {
        name: 'Submissions',
        header: ['Submission ID', 'Status', 'Parent', 'Contact phone', 'Students', 'No. of students', 'Bus', 'Bus (as entered)', 'District', 'Amount paid (EGP)', 'Payments', 'Screenshots', 'Open flags', 'Removal requested', 'Removal reason', 'Parent notes', 'Admin notes', 'Submitted', 'Last edited'],
        rows: x.rows.map((r) => [r.submission_code, r.status, r.parent_name, r.contact_phone || '', (r.student_names || []).join(', '), r.student_count, r.bus_label, r.bus_number, r.district || '', Number(r.amount_total), r.payment_count, r.evidence_count, r.open_flags, r.withdrawal_requested_at ? fmtDate(r.withdrawal_requested_at) : '', r.withdrawal_reason || '', r.parent_notes || '', r.admin_notes || '', fmtDateTime(r.created_at), fmtDateTime(r.updated_at)]),
        money: [9],
        widths: [14, 9, 24, 16, 28, 9, 10, 12, 16, 16, 9, 10, 9, 14, 24, 24, 24, 17, 17],
      },
      {
        name: 'Ledger (active)',
        header: ['Submission ID', 'Parent', 'Students', 'Bus', 'District', 'Amount paid (EGP)'],
        rows: active.map((r) => [r.submission_code, r.parent_name, (r.student_names || []).join(', '), r.bus_label, r.district || '', Number(r.amount_total)]),
        totalRow: ['TOTAL DOCUMENTED PAYMENTS', `${s.families} families`, `${s.students} students`, '', '', Number(s.total_amount)],
        money: [5],
        widths: [14, 24, 30, 10, 16, 18],
      },
      {
        name: 'Payments',
        header: ['Submission ID', 'Status', 'Parent', 'Bus', 'District', 'Payment #', 'Amount (EGP)', 'Payment date', 'Reference', 'Recorded'],
        rows: x.payments.map((p) => [p.submission_code, p.status, p.parent_name, p.bus_label, p.district || '', p.payment_no, Number(p.amount), fmtDate(p.payment_date), p.transaction_reference || '', fmtDateTime(p.created_at)]),
        money: [6],
        widths: [14, 9, 24, 10, 16, 10, 16, 13, 22, 17],
      },
      ...busSheets(x),
      {
        name: 'Review flags',
        header: ['Type', 'Detail', 'Submission', 'Parent', 'Related submission', 'Related parent', 'Raised', 'Reviewed', 'Review note'],
        rows: x.flags.map((f) => [FLAG_LABEL[f.kind] || f.kind, flagText(f), f.submission?.code || '', f.submission?.parent_name || '', f.related?.code || '', f.related?.parent_name || '', fmtDateTime(f.created_at), f.resolved_at ? fmtDateTime(f.resolved_at) : '', f.resolution_note || '']),
        widths: [26, 60, 14, 22, 16, 22, 17, 17, 30],
      },
      {
        name: 'Audit log',
        header: ['When', 'Submission', 'By', 'Action', 'Field', 'Previous value', 'New value'],
        rows: x.audit.map((a) => [fmtDateTime(a.created_at), a.submission_code || '', a.actor, a.action, a.field || '', a.old_value == null ? '' : JSON.stringify(a.old_value), a.new_value == null ? '' : JSON.stringify(a.new_value)]),
        widths: [17, 14, 8, 18, 12, 60, 60],
      },
      {
        name: 'Summary',
        header: ['Item', 'Value'],
        rows: [
          ['Families submitted (active)', s.families],
          ['Students represented (active)', s.students],
          ['Total documented payments (EGP, active)', Number(s.total_amount)],
          ['Payment records (active)', s.payments],
          ['Hidden submissions', x.rows.filter((r) => r.status === 'hidden').length],
          ['Deleted submissions', x.rows.filter((r) => r.status === 'deleted').length],
          ['Open review flags', x.flags.filter((f) => !f.resolved_at).length],
          ['Exported', new Date().toLocaleString('en-GB')],
          ['Confidential', 'Contains contact phones and internal notes — do not share with parents.'],
        ],
        money: [1],
        widths: [40, 70],
      },
    ]);
  } catch (err) {
    toast(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}

if (token()) load(); else renderGate();
