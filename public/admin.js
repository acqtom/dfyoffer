// Staff board: clients grouped by cohort, plus live sign-up approvals.
const fmtMonth = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
const fmtTime = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const verifyBtn = document.getElementById('verify-btn');
const verifyModal = document.getElementById('verify-modal');

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function cohortLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return `${fmtMonth.format(new Date(y, m - 1, 1))} cohort`;
}

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0].toUpperCase()).join('');
}

// ---- Clients by cohort ------------------------------------------------------
async function loadClients() {
  const res = await fetch('/api/admin/clients');
  if (res.status === 403) { location.href = '/login'; return; }
  const { clients } = await res.json();

  const byCohort = new Map();
  for (const client of clients) {
    if (!byCohort.has(client.programMonth)) byCohort.set(client.programMonth, []);
    byCohort.get(client.programMonth).push(client);
  }

  document.getElementById('admin-summary').textContent = clients.length
    ? `${clients.length} client${clients.length === 1 ? '' : 's'} across ${byCohort.size} cohort${byCohort.size === 1 ? '' : 's'}`
    : '';

  const root = document.getElementById('cohorts');
  if (!clients.length) {
    root.replaceChildren(el('p', 'admin-empty', 'No clients yet. New sign-ups show up under "Verification needed" at the top.'));
    return;
  }

  const thisMonth = monthKey(new Date());
  const sections = [...byCohort.keys()].sort().map((key) => {
    const section = el('section', 'cohort');
    const head = el('div', 'cohort-head');
    head.append(el('h2', null, cohortLabel(key)));
    const when = key === thisMonth ? 'Current' : key > thisMonth ? 'Upcoming' : 'Past';
    head.append(el('span', `cohort-when cohort-${when.toLowerCase()}`, when));
    head.append(el('span', 'cohort-count', `${byCohort.get(key).length} client${byCohort.get(key).length === 1 ? '' : 's'}`));

    const grid = el('div', 'client-grid');
    for (const client of byCohort.get(key)) {
      const card = el('a', 'client-card');
      card.href = `/admin/clients/${client.id}`;
      const avatar = el('span', 'client-avatar', initials(client.name));
      const body = el('div', 'client-body');
      body.append(
        el('strong', 'client-name', client.name),
        el('span', client.niche ? 'client-niche' : 'client-niche client-niche-empty', client.niche || 'Niche not submitted yet'),
        el('span', 'client-email', client.email),
      );
      card.append(avatar, body, el('span', 'client-arrow', '→'));
      grid.append(card);
    }
    section.append(head, grid);
    return section;
  });
  root.replaceChildren(...sections);
}

// ---- Sign-up approvals --------------------------------------------------------
let pending = [];
let seenPendingIds = null; // null until the first load, so old requests don't toast

async function loadPending() {
  const res = await fetch('/api/admin/pending');
  if (!res.ok) return;
  ({ pending } = await res.json());
  const ids = new Set(pending.map((p) => p.id));
  if (seenPendingIds) {
    for (const person of pending) {
      if (!seenPendingIds.has(person.id)) showToast(`New sign-up: ${person.name} — verification needed`);
    }
    // Someone was handled in another tab: refresh the client list too.
    if ([...seenPendingIds].some((id) => !ids.has(id))) loadClients();
  }
  seenPendingIds = ids;
  verifyBtn.hidden = pending.length === 0;
  document.getElementById('verify-count').textContent = pending.length;
  renderPending();
  if (!pending.length && verifyModal.open) verifyModal.close();
}

function renderPending() {
  const list = document.getElementById('verify-list');
  list.replaceChildren(...pending.map((person) => {
    const item = el('li', 'verify-item');
    const info = el('div', 'verify-info');
    info.append(
      el('strong', null, person.name),
      el('span', 'verify-email', person.email),
      el('span', 'verify-time', `Signed up ${fmtTime.format(new Date(person.createdAt))}`),
    );
    const actions = el('div', 'verify-actions');
    const yes = el('button', 'btn verify-yes', 'Yes');
    const no = el('button', 'btn verify-no', 'No');
    yes.type = 'button';
    no.type = 'button';
    yes.setAttribute('aria-label', `Accept ${person.name}`);
    no.setAttribute('aria-label', `Decline ${person.name}`);
    yes.addEventListener('click', () => decide(person, true, [yes, no]));
    no.addEventListener('click', () => decide(person, false, [yes, no]));
    actions.append(yes, no);
    item.append(info, actions);
    return item;
  }));
}

async function decide(person, approve, buttons) {
  buttons.forEach((b) => { b.disabled = true; });
  const res = await fetch(`/api/admin/users/${person.id}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approve }),
  });
  if (!res.ok && res.status !== 404) {
    buttons.forEach((b) => { b.disabled = false; });
    alert("Couldn't save that. Please try again.");
    return;
  }
  showToast(approve ? `${person.name} accepted — they can log in now` : `${person.name} declined`);
  seenPendingIds.delete(person.id);
  await Promise.all([loadPending(), loadClients()]);
}

let toastTimer;
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 4000);
}

verifyBtn.addEventListener('click', () => verifyModal.showModal());
document.getElementById('verify-close').addEventListener('click', () => verifyModal.close());
verifyModal.addEventListener('click', (e) => {
  if (e.target === verifyModal) verifyModal.close();
});

// Check for new sign-ups every few seconds (works on Vercel, where a
// long-lived connection would be cut off).
const PENDING_POLL_MS = 5000;
setInterval(() => {
  if (!document.hidden) loadPending();
}, PENDING_POLL_MS);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) loadPending();
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  location.href = '/login';
});

loadClients();
loadPending();
