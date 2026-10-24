// The program runs from sign-up to the end of the cohort month.
// Days are numbered from the cohort month: day 1 is the 1st, day 0 the day
// before, -1 the day before that, and so on. startDay/endDay are inclusive.
//   Onboarding + Offer Translation Report: sign-up day → 2 days later (48 hours)
//   Build:                                 the day after → the day before the 1st
//   Sprint · Days 1–14:                    1st → 14th (kickoff call on the 1st)
//   Sprint · Days 15–end:                  15th → end of the month (call on the 14th)
//   Performance & Scale Call:              the last day — a flag on the timeline,
//                                          since it falls inside the stage before
// Each stage's call is on its callDay, or its last day if it has none.

// The client's build tasks, shown in both Build and Sprint · Days 1–14 (due by
// day 14). Same keys in both stages, so ticking one ticks it in both.
const BUILD_ACTIONS = [
  { key: 'film-videos', title: 'Film your VSL, confirmation page video, and FAQ videos' },
  {
    key: 'embeds',
    title: 'Send all of your embed resources',
    subtitle: 'VSL, FAQs, confirmation page video, form',
    embedForm: true,
  },
  { key: 'film-ads', title: 'Film your ads', button: 'Watch how to', video: 'film-ads' },
  { key: 'page-live', title: 'Get your page live with your domain', button: 'Watch now', video: 'page-live', fixedButton: true },
];

// What we do in Sprint · Days 15–end.
const OPTIMISE_STEPS = [
  { key: 'review-sales', title: 'Review your sales process' },
  { key: 'improve-metrics', title: 'Show you how to improve sales metrics' },
  { key: 'funnel-adjustments', title: 'Make funnel adjustments (if needed)' },
  { key: 'review-ads', title: 'Review ad performance' },
  { key: 'double-down', title: 'Double down on winning ads' },
];

// signupDay: the day the account was created, numbered as above.
function phasesFor(daysInMonth, signupDay) {
  // Onboarding and Build must finish before the 1st. Someone who signs up a day
  // or two before (or whose cohort is moved earlier) gets them squeezed in.
  const onboardStart = Math.min(signupDay, -1);
  const onboardEnd = Math.min(onboardStart + 2, -1);
  return [
    { name: 'Onboarding + Offer Translation Report', timelineName: 'Onboarding', short: 'Start', call: 'Onboarding call',
      startDay: onboardStart, endDay: onboardEnd,
      goal: 'Funnel Audit, Onboarding & Offer Translation Report',
      form: { key: 'onboarding', title: 'Fill your form', minutes: 5 },
      resources: ONBOARDING_RESOURCES,
      actions: [
        { key: 'join-slack', title: 'Join the Slack', subtitle: 'Join, then tick the box once you\u2019re in',
          button: 'Join Slack →', href: SLACK_INVITE },
      ],
      weDo: [
        { key: 'review-form', title: 'Review your form info' },
        { key: 'review-funnel', title: 'Audit your funnel and offer' },
        { key: 'private-slack', title: 'Make your private Slack chat' },
        { key: 'offer-report', title: 'Complete your offer translation report' },
      ] },
    { name: 'Build', short: 'Build', call: 'End-of-build call', startDay: onboardEnd + 1, endDay: 0,
      goal: 'Cold Funnel Set Up Complete, New Ad Scripts Ready',
      resources: [
        ...WEEK1_RESOURCES,
        // A PDF staff upload on Templates; clients download it.
        { key: 'editor-sop', title: 'Editor SOP', kind: 'pdf', type: 'file' },
      ],
      weDo: WEEK1_RESOURCES.map((r) => ({ key: `build-${r.key}`, title: r.title })),
      actions: BUILD_ACTIONS,
      actionsNote: 'Due by day 14, no rush!' },
    { name: 'Sprint · Days 1–14', short: 'D1–14', call: 'Sprint kickoff call', callDay: 1, startDay: 1, endDay: 14,
      goal: 'Ads Live',
      resources: [
        { key: 'drive-folder', title: 'Google Drive folder', kind: 'folder', type: 'link',
          hint: 'Add the folder with your edited ads', placeholder: 'https://drive.google.com/drive/folders/…' },
      ],
      weDo: [
        { key: 'pixel-setup', title: 'Pixel setup' },
        { key: 'conversion-event', title: 'Conversion event setup' },
        { key: 'ads-uploaded', title: 'Ads uploaded' },
        { key: 'ads-live', title: 'Ads live' },
      ],
      actions: BUILD_ACTIONS },
    { name: `Sprint · Days 15–${daysInMonth}`, short: `D15–${daysInMonth}`, call: 'Day 14 call', callDay: 14,
      startDay: 15, endDay: daysInMonth, wide: true,
      goal: 'Closes Begin, Double Down On Winning Ads',
      weDo: OPTIMISE_STEPS.map((step) => ({ ...step })),
      form: { key: 'midweek', title: 'Fill this form mid week', minutes: 2 } },
    { name: 'Performance & Scale Call', short: 'Scale', call: 'Performance & scale call',
      startDay: daysInMonth, endDay: daysInMonth, milestone: true,
      goal: 'More Closes, Profitable Campaign Ready To Scale',
      blurb: 'Review results and plan next steps.',
      resources: SCALE_RESOURCES,
      weDo: [{ key: 'scaling-roadmap', title: 'Make your scaling roadmap' }],
      form: [
        { key: 'final-checkin', title: 'Fill the final check-in form', minutes: 3 },
        { key: 'service-feedback', title: 'Service feedback form', minutes: 2 },
      ] },
  ];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS_AHEAD = 12;

const fmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const fmtMonth = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
const fmtCall = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

// Each stage ends with a call on its last day.
const CALL_LINK = 'https://meet.google.com/wkv-ifex-upa';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function parseMonth(value) {
  const [y, m] = value.split('-').map(Number);
  return new Date(y, m - 1, 1);
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// A stage is done after its last day and in progress from its first. The first
// stage that hasn't started is "next".
function phaseStatuses(phases, today) {
  const statuses = new Map();
  for (const phase of phases) {
    let status = 'upcoming';
    if (today > phase.endDay) status = 'done';
    else if (today >= phase.startDay) status = 'current';
    statuses.set(phase, status);
  }
  const next = phases.find((p) => statuses.get(p) === 'upcoming');
  if (next) statuses.set(next, 'next');
  return statuses;
}

const SLACK_INVITE = 'https://join.slack.com/t/paidcoachingcom/shared_invite/zt-4a86ugpdd-3~iayV_1nPsh4SwnDfNuRg';

// Keys of the self-ticked action items this user has completed.
const completedActions = new Set();

async function loadActions() {
  const res = await apiFetch('/api/actions');
  const data = await res.json();
  completedActions.clear();
  data.completed.forEach((key) => completedActions.add(key));
}

// What the team does in a stage — ticked off as each step is done.
function weDoFor(phase) {
  return (phase.weDo || []).map((step) => {
    const done = completedActions.has(step.key);
    return { ...step, tick: true, done, detail: done ? 'Done' : 'Tick once this is done' };
  });
}

// A stage's action items, in order. `tick: true` items are ticked off by the
// user; the form completes itself when submitted.
function actionsFor(phase) {
  const items = [];
  // A stage can have one form or a list of them.
  for (const { key, title, minutes } of [].concat(phase.form || [])) {
    const formDone = Boolean(Forms.submission(key));
    items.push({
      title,
      detail: formDone ? 'Completed' : `${Forms.questionCount(key)} quick questions · about ${minutes} minutes`,
      done: formDone,
      button: formDone ? 'View answers' : 'Click here →',
      onClick: () => Forms.open(key),
    });
  }
  for (const action of phase.actions || []) {
    if (action.embedForm) {
      // Done once they've submitted their embed codes; they can still edit them.
      const done = Boolean(embedSubmission);
      items.push({
        title: action.title,
        detail: done ? 'Submitted — click Edit to change' : action.subtitle,
        done,
        button: done ? 'Edit' : 'Paste here',
        onClick: openEmbeds,
      });
      continue;
    }
    const done = completedActions.has(action.key);
    items.push({
      ...action,
      tick: true,
      done,
      detail: done ? 'Completed' : action.subtitle || 'Tick the box once it\u2019s done',
      // Embedded SOP videos get their own label.
      button: action.video && isSopVideo(action.video) && !action.fixedButton ? 'View SOP' : action.button,
      onClick: action.video ? () => openVideo(action.title, action.video) : undefined,
    });
  }
  return items;
}

// ---- Embed resources pop-up ---------------------------------------------------
// Clients paste the embed code for each of their videos and their form. Saved to
// their account (form key 'embeds'); staff see it on the client's page.
// FAQs are a list: each FAQ video has its own title and embed code, saved as a
// JSON array in the 'faqs' answer.
const EMBED_FIELDS = [
  { id: 'vsl', label: 'VSL' },
  { id: 'faqs', label: 'FAQs', list: true, hint: 'Add each FAQ video separately, with a title for each' },
  { id: 'confirmation_video', label: 'Confirmation page video' },
  { id: 'form', label: 'Form' },
];
const embedsModal = document.getElementById('embeds-modal');
let embedSubmission = null; // { answers, submittedAt } once submitted

async function loadEmbeds() {
  const data = await (await apiFetch('/api/forms/embeds')).json();
  embedSubmission = data.answers ? data : null;
}

function savedFaqs() {
  const raw = embedSubmission?.answers.faqs;
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    if (Array.isArray(list)) return list;
  } catch { /* saved before FAQs were a list: one untitled entry */ }
  return [{ title: '', code: raw }];
}

function embedBox(name, label, value) {
  const box = el('textarea', 'embed-input');
  box.name = name;
  box.rows = 3;
  box.spellcheck = false;
  box.placeholder = `Paste your ${label} embed code`;
  box.value = value || '';
  return box;
}

function faqRow(faq, list) {
  const row = el('div', 'faq-row');
  const head = el('div', 'faq-row-head');
  const title = el('input', 'faq-title');
  title.type = 'text';
  title.placeholder = 'FAQ title, e.g. "What does it cost?"';
  title.value = faq.title || '';
  title.setAttribute('aria-label', 'FAQ title');
  const remove = el('button', 'faq-remove', 'Remove');
  remove.type = 'button';
  remove.addEventListener('click', () => {
    row.remove();
    updateFaqNumbers(list);
  });
  head.append(el('span', 'faq-number'), title, remove);
  row.append(head, embedBox('faq-code', 'FAQ', faq.code));
  return row;
}

// Number the FAQs, and only allow removing when there's more than one.
function updateFaqNumbers(list) {
  const rows = [...list.children];
  rows.forEach((row, i) => {
    row.querySelector('.faq-number').textContent = `FAQ ${i + 1}`;
    row.querySelector('.faq-remove').hidden = rows.length === 1;
  });
}

function openEmbeds() {
  const fields = document.getElementById('embeds-fields');
  fields.replaceChildren(...EMBED_FIELDS.map((field) => {
    const wrap = el(field.list ? 'div' : 'label', 'embed-field');
    wrap.append(el('span', 'embed-label', field.label));
    if (field.hint) wrap.append(el('span', 'embed-hint', field.hint));
    if (field.list) {
      const list = el('div', 'faq-list');
      const faqs = savedFaqs();
      for (const faq of faqs.length ? faqs : [{}]) list.append(faqRow(faq, list));
      updateFaqNumbers(list);
      const add = el('button', 'faq-add', '+ Add another FAQ');
      add.type = 'button';
      add.addEventListener('click', () => {
        const row = faqRow({}, list);
        list.append(row);
        updateFaqNumbers(list);
        row.querySelector('.faq-title').focus();
      });
      wrap.append(list, add);
    } else {
      wrap.append(embedBox(field.id, field.label, embedSubmission?.answers[field.id]));
    }
    return wrap;
  }));
  document.getElementById('embeds-error').textContent = '';
  document.getElementById('embeds-submit').textContent = embedSubmission ? 'Save changes' : 'Submit';
  embedsModal.showModal();
}

document.getElementById('embeds-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const error = document.getElementById('embeds-error');
  const submit = document.getElementById('embeds-submit');
  const form = e.target;
  const faqs = [...form.querySelectorAll('.faq-row')].map((row) => ({
    title: row.querySelector('.faq-title').value.trim(),
    code: row.querySelector('.embed-input').value.trim(),
  })).filter((faq) => faq.title || faq.code);
  const answers = {};
  const missing = [];
  for (const field of EMBED_FIELDS) {
    if (field.list) continue;
    answers[field.id] = form.elements[field.id].value.trim();
    if (!answers[field.id]) missing.push(field.label);
  }
  if (!faqs.length) missing.push('FAQs');
  if (missing.length) {
    error.textContent = `Please paste your ${missing.join(', ')} embed code${missing.length > 1 ? 's' : ''}.`;
    return;
  }
  const incomplete = faqs.findIndex((faq) => !faq.title || !faq.code);
  if (incomplete !== -1) {
    error.textContent = `FAQ ${incomplete + 1} needs both a title and its embed code.`;
    return;
  }
  answers.faqs = JSON.stringify(faqs);
  submit.disabled = true;
  try {
    const res = await apiFetch('/api/forms/embeds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Couldn't save. Please try again.");
    embedSubmission = data;
    embedsModal.close();
    refreshAfterActionChange();
  } catch (err) {
    error.textContent = err.message;
  } finally {
    submit.disabled = false;
  }
});
document.getElementById('embeds-close').addEventListener('click', () => embedsModal.close());
embedsModal.addEventListener('click', (e) => {
  if (e.target === embedsModal) embedsModal.close();
});

async function setActionDone(key, done) {
  if (done) completedActions.add(key); else completedActions.delete(key);
  refreshAfterActionChange();
  try {
    const res = await apiFetch(`/api/actions/${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done }),
    });
    if (!res.ok) throw new Error();
  } catch {
    if (done) completedActions.delete(key); else completedActions.add(key);
    refreshAfterActionChange();
    alert("Couldn't save that. Please try again.");
  }
}

// Progress is the share of action items completed. Stages without action items
// yet fall back to how far through the stage's dates we are.
function stageProgress(phase, status, today) {
  const actions = [...weDoFor(phase), ...actionsFor(phase)];
  if (actions.length) return actions.filter((a) => a.done).length / actions.length;
  const span = phase.endDay - phase.startDay + 1;
  const daysIn = Math.min(Math.max(today - phase.startDay + 1, 0), span);
  // Count today as half done so a stage never reads 100% while it's still in progress.
  return status === 'done' ? 1 : status === 'current' ? Math.max(daysIn - 0.5, 0) / span : 0;
}

const STATUS_LABEL = { done: 'Complete', current: 'In progress', next: 'Up next', upcoming: 'Upcoming' };

let placeMarker = () => {};
window.addEventListener('resize', () => placeMarker());

function renderMonthPicker(user) {
  const select = document.getElementById('program-month');
  const created = new Date(user.createdAt);
  const first = new Date(created.getFullYear(), created.getMonth(), 1);
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() + MONTHS_AHEAD, 1);

  const keys = [];
  for (let d = new Date(first); d <= last; d.setMonth(d.getMonth() + 1)) keys.push(monthKey(d));
  if (!keys.includes(user.programMonth)) keys.push(user.programMonth);
  keys.sort();

  select.replaceChildren(...keys.map((key) => {
    const opt = el('option', null, fmtMonth.format(parseMonth(key)));
    opt.value = key;
    return opt;
  }));
  select.value = user.programMonth;
}

function render(user) {
  const start = parseMonth(user.programMonth);
  const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  const end = new Date(start.getFullYear(), start.getMonth(), daysInMonth);
  // Day number (1 = the 1st of the cohort month) for a date.
  const dayOf = (date) => Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()) - start) / DAY_MS) + 1;
  const phases = phasesFor(daysInMonth, dayOf(new Date(user.createdAt)));
  const firstDay = phases[0].startDay;
  const dateFor = (day) => new Date(start.getFullYear(), start.getMonth(), day);

  // rawDay < 1: still in onboarding/build; > daysInMonth: the program is over.
  const rawDay = dayOf(new Date());
  const today = Math.min(Math.max(rawDay, firstDay - 1), daysInMonth + 1);
  const statuses = phaseStatuses(phases, today);

  document.getElementById('user-name').textContent = user.name;
  document.getElementById('first-name').textContent = user.name.split(' ')[0];
  document.getElementById('program-range').textContent = `${fmt.format(start)} – ${fmt.format(end)}`;

  const badge = document.getElementById('day-badge');
  badge.classList.toggle('is-upcoming', rawDay < 1);
  if (rawDay < 1) {
    const daysLeft = 1 - rawDay;
    badge.textContent = `Sprint starts in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`;
  } else if (rawDay > daysInMonth) {
    badge.textContent = 'Program complete';
  } else {
    badge.textContent = `Sprint day ${rawDay} of ${daysInMonth}`;
  }

  // How far through the whole program (sign-up to the end of the month).
  const totalDays = daysInMonth - firstDay + 1;
  const pct = Math.min(Math.max(today - firstDay, 0) / totalDays, 1);
  document.getElementById('progress-label').textContent = `${Math.round(pct * 100)}% through`;

  // Timeline segments
  const track = document.getElementById('timeline-track');
  track.replaceChildren();
  for (const phase of phases.filter((p) => !p.milestone)) {
    const span = phase.endDay - phase.startDay + 1;
    const range = span > 1
      ? `${fmt.format(dateFor(phase.startDay))} – ${fmt.format(dateFor(phase.endDay))}`
      : fmt.format(dateFor(phase.startDay));
    const seg = el('div', `segment segment-${statuses.get(phase)}`);
    seg.style.flexGrow = span;
    seg.title = `${phase.name}: ${range}`;
    seg.dataset.start = phase.startDay;
    seg.dataset.span = span;
    seg.append(el('span', 'segment-name', phase.timelineName ?? phase.name), el('span', 'segment-short', phase.short), el('span', 'segment-dates', range));
    track.append(seg);
  }

  // Milestones (e.g. Onboarding) are flags under the track on their day.
  const milestoneRow = document.getElementById('timeline-milestones');
  milestoneRow.replaceChildren();
  const flags = phases.filter((p) => p.milestone).map((phase) => {
    const flag = el('div', `milestone milestone-${statuses.get(phase)}`);
    flag.append(el('span', 'milestone-name', phase.name), el('span', 'milestone-day', fmt.format(dateFor(phase.startDay))));
    flag.dataset.day = phase.startDay;
    milestoneRow.append(flag);
    return flag;
  });

  // Horizontal pixel position of the middle of a given day on the track.
  const xForDay = (day) => {
    const seg = [...track.children].find((s) => day >= +s.dataset.start && day < +s.dataset.start + +s.dataset.span);
    return seg.offsetLeft + seg.offsetWidth * ((day - +seg.dataset.start + 0.5) / +seg.dataset.span);
  };

  // Today marker sits in the middle of the current day within the current segment.
  const marker = document.getElementById('timeline-today');
  const inProgram = rawDay >= firstDay && rawDay <= daysInMonth;
  marker.hidden = !inProgram;
  placeMarker = () => {
    for (const flag of flags) {
      const x = xForDay(+flag.dataset.day);
      flag.style.left = `${x}px`;
      // Near the right edge, hang the flag to the left of its stem.
      flag.classList.toggle('milestone-end', x > track.offsetWidth - 220);
    }
    if (inProgram) {
      const x = xForDay(today);
      marker.style.left = `${x}px`;
      // Near the left edge the centred "Today" tag would be cut off.
      marker.classList.toggle('timeline-today-start', x < 40);
    }
  };
  placeMarker();

  // Cards
  const cards = document.getElementById('cards');
  cards.replaceChildren();
  phases.forEach((phase, i) => {
    const status = statuses.get(phase);
    const span = phase.endDay - phase.startDay + 1;
    const progress = stageProgress(phase, status, today);
    stageProgressByName.set(phase.name, progress);

    const card = el('article', `card card-${status}${phase.wide ? ' card-wide' : ''}`);
    const head = el('div', 'card-head');
    head.append(el('span', 'card-step', String(i + 1).padStart(2, '0')), el('span', `pill pill-${status}`, STATUS_LABEL[status]));

    const dates = span > 1
      ? `${fmt.format(dateFor(phase.startDay))} – ${fmt.format(dateFor(phase.endDay))}`
      : fmt.format(dateFor(phase.startDay));

    const bar = el('div', 'bar');
    const fill = el('div', progress === 1 ? 'bar-fill bar-fill-full' : 'bar-fill');
    fill.style.width = `${progress * 100}%`;
    bar.append(fill);

    const cta = el('div', 'card-cta');
    cta.append(el('span', null, CTA_LABEL[status]), el('span', 'card-cta-arrow', '→'));

    const callDate = phase.call ? fmtCall.format(dateFor(phase.callDay ?? phase.endDay)) : null;
    card.append(head, el('h3', null, phase.name), el('p', 'card-dates', dates));
    if (phase.goal) card.append(el('p', 'card-goal', phase.goal));
    if (phase.blurb) card.append(el('p', 'card-blurb', phase.blurb));
    card.append(bar, cta);
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-haspopup', 'dialog');
    card.setAttribute('aria-label', `Open ${phase.name}`);
    const open = () => openPhase({ phase, index: i, status, dates, progress, callDate });
    card.addEventListener('click', open);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
    cards.append(card);
  });
}

const CTA_LABEL = { done: 'Review this stage', current: "Open — you're here", next: 'See what\u2019s next', upcoming: 'Preview what’s coming' };

// Stage pop-up
const modal = document.getElementById('phase-modal');
let openedPhase = null;
const stageProgressByName = new Map();

function setModalProgress(progress) {
  const fill = document.getElementById('modal-progress');
  fill.style.width = `${progress * 100}%`;
  fill.classList.toggle('bar-fill-full', progress === 1);
  document.getElementById('modal-progress-label').textContent = `${Math.round(progress * 100)}% complete`;
}

function renderActions(phase) {
  openedPhase = phase;
  renderChecklist(document.getElementById('modal-wedo'), weDoFor(phase), 'Content for this stage is coming soon.');
  const actionsBox = document.getElementById('modal-actions');
  renderChecklist(actionsBox, actionsFor(phase), 'Your tasks for this stage will appear here.');
  if (phase.actionsNote) actionsBox.prepend(el('p', 'actions-note', phase.actionsNote));
  renderResources(phase.resources || []);
}

function renderResources(resources) {
  const box = document.getElementById('modal-resources');
  if (!resources.length) {
    box.replaceChildren(el('p', 'placeholder', 'Videos, docs and links will appear here.'));
    return;
  }
  const list = el('ul', 'resource-list');
  for (const resource of resources) {
    if (resource.type === 'link') {
      const item = el('li');
      item.append(renderLinkResource(resource));
      list.append(item);
      continue;
    }
    if (resource.type === 'file') {
      const item = el('li');
      item.append(renderFileResource(resource));
      list.append(item);
      continue;
    }
    const item = el('li');
    item.append(ResourceViewer.tile(resource));
    list.append(item);
  }
  box.replaceChildren(list);
}

// PDFs staff uploaded on Templates (shared by every client).
const sharedFiles = {};

async function loadFiles() {
  const res = await fetch('/api/files');
  Object.assign(sharedFiles, (await res.json()).files);
}

// A resource that's a shared PDF: the whole tile downloads it.
function renderFileResource(resource) {
  const file = sharedFiles[resource.key];
  const tile = el(file ? 'a' : 'div', 'resource');
  tile.append(ResourceViewer.icon(resource.kind), el('strong', 'resource-title', resource.title));
  if (file) {
    tile.href = `/files/${resource.key}`;
    tile.append(el('span', 'resource-open', 'Download PDF →'));
  } else {
    tile.append(el('span', 'pill pill-upcoming', 'Coming soon'));
  }
  return tile;
}

const DRIVE_RE = /^https:\/\/(drive|docs)\.google\.com\//;

// A resource that's a link the client adds themselves, saved to their account.
function renderLinkResource(resource, editing = false) {
  const tile = el('div', 'resource resource-link');
  const link = ResourceViewer.own[resource.key];
  tile.append(ResourceViewer.icon(resource.kind), el('strong', 'resource-title', resource.title));

  if (link && !editing) {
    const actions = el('div', 'resource-link-actions');
    const open = el('a', 'btn btn-primary resource-link-open', 'Open folder →');
    open.href = link;
    open.target = '_blank';
    open.rel = 'noopener';
    const change = el('button', 'section-copy', 'Change link');
    change.type = 'button';
    change.addEventListener('click', () => tile.replaceWith(renderLinkResource(resource, true)));
    actions.append(open, change);
    tile.append(actions);
    return tile;
  }

  const form = el('form', 'resource-link-form');
  const input = el('input');
  input.type = 'url';
  input.placeholder = resource.placeholder;
  input.value = link || '';
  input.setAttribute('aria-label', `${resource.title} link`);
  const save = el('button', 'btn btn-primary', 'Add link');
  save.type = 'submit';
  const error = el('p', 'form-error');
  form.append(el('span', 'resource-link-hint', resource.hint), input, save, error);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const value = input.value.trim();
    if (!DRIVE_RE.test(value)) {
      error.textContent = 'Please paste a Google Drive link.';
      return;
    }
    save.disabled = true;
    try {
      const res = await apiFetch(`/api/resources/${resource.key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: value }),
      });
      if (!res.ok) throw new Error();
      ResourceViewer.own[resource.key] = value;
      tile.replaceWith(renderLinkResource(resource));
    } catch {
      error.textContent = "Couldn't save the link. Please try again.";
      save.disabled = false;
    }
  });
  tile.append(form);
  return tile;
}

// How-to video pop-up: a Loom link or an embedded SOP video (pasted embed code),
// shared by every client and set by staff on the Templates page.
const videoModal = document.getElementById('video-modal');

function loomEmbedUrl(link) {
  const match = /loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/.exec(link || '');
  return match ? `https://www.loom.com/embed/${match[1]}` : null;
}

const videoLinks = {}; // key -> { kind: 'loom', url } | { kind: 'embed', code }

async function loadVideos() {
  const res = await fetch('/api/videos');
  const data = await res.json();
  Object.assign(videoLinks, data.videos);
}

const isSopVideo = (key) => videoLinks[key]?.kind === 'embed';

// Shows pasted embed code (set by staff on the Templates page).
function embedFrame(title, code, key) {
  // A plain <iframe> embed (YouTube, Vimeo, …) is shown directly from its
  // https address.
  const doc = new DOMParser().parseFromString(code, 'text/html');
  const plain = doc.querySelector('iframe[src^="https://"]');
  if (plain && !doc.querySelector('script')) {
    const direct = document.createElement('iframe');
    direct.src = plain.getAttribute('src');
    direct.title = title;
    direct.allow = 'fullscreen; autoplay; encrypted-media; picture-in-picture';
    direct.allowFullscreen = true;
    return direct;
  }
  // Script-based players (VTurb, Wistia, …) need a normal page to run on, so
  // they load from their own page on this site (served by /embed/<video>).
  const iframe = document.createElement('iframe');
  iframe.src = `/embed/${key}`;
  iframe.title = title;
  iframe.allow = 'fullscreen; autoplay; encrypted-media; picture-in-picture';
  iframe.allowFullscreen = true;
  return iframe;
}

function openVideo(title, key) {
  const video = videoLinks[key];
  document.getElementById('video-kind').textContent = isSopVideo(key) ? 'SOP video' : 'Watch how to';
  document.getElementById('video-title').textContent = title;
  const frame = document.getElementById('video-frame');
  frame.classList.toggle('video-frame-embed', video?.kind === 'embed');
  if (video?.kind === 'embed' && video.code) {
    frame.replaceChildren(embedFrame(title, video.code, key));
  } else if (loomEmbedUrl(video?.url)) {
    const iframe = document.createElement('iframe');
    iframe.src = loomEmbedUrl(video.url);
    iframe.title = title;
    iframe.allow = 'fullscreen; autoplay; encrypted-media; picture-in-picture';
    iframe.allowFullscreen = true;
    frame.replaceChildren(iframe);
  } else {
    frame.replaceChildren(el('p', 'video-empty', 'Video coming soon'));
  }
  videoModal.showModal();
}

// Stop playback when the pop-up closes.
// The close event fires a moment later, so skip it if the pop-up was reopened.
videoModal.addEventListener('close', () => {
  if (!videoModal.open) document.getElementById('video-frame').replaceChildren();
});
document.getElementById('video-close').addEventListener('click', () => videoModal.close());
videoModal.addEventListener('click', (e) => {
  if (e.target === videoModal) videoModal.close();
});

function renderChecklist(box, actions, emptyText) {
  if (!actions.length) {
    box.replaceChildren(el('p', 'placeholder', emptyText));
    return;
  }
  const list = el('ol', 'action-list');
  actions.forEach((action, i) => {
    const item = el('li', `action-item${action.done ? ' action-done' : ''}`);

    let check;
    if (action.tick) {
      check = el('button', 'action-check action-tick', action.done ? '✓' : '');
      check.type = 'button';
      check.setAttribute('role', 'checkbox');
      check.setAttribute('aria-checked', String(action.done));
      check.setAttribute('aria-label', `Mark "${action.title}" as done`);
      check.title = action.done ? 'Click to untick' : 'Tick when done';
      check.addEventListener('click', () => setActionDone(action.key, !action.done));
    } else {
      check = el('span', 'action-check', action.done ? '✓' : String(i + 1));
    }

    const text = el('div', 'action-text');
    text.append(el('strong', null, action.title), el('span', null, action.detail));

    let btn = null;
    if (!action.button) {
      // Tick-only step, no button.
    } else if (action.href) {
      btn = el('a', `btn ${action.done ? 'btn-ghost' : 'btn-primary'} action-btn`, action.button);
      btn.href = action.href;
      btn.target = '_blank';
      btn.rel = 'noopener';
    } else {
      btn = el('button', `btn ${action.done ? 'btn-ghost' : 'btn-primary'} action-btn`, action.button);
      btn.type = 'button';
      btn.addEventListener('click', action.onClick);
    }
    item.append(check, text);
    if (btn) item.append(btn);
    list.append(item);
  });
  box.replaceChildren(list);
}

function refreshAfterActionChange() {
  render(currentUser);
  if (modal.open && openedPhase) {
    renderActions(openedPhase);
    setModalProgress(stageProgressByName.get(openedPhase.name));
  }
}

Forms.onChange(refreshAfterActionChange);

function openPhase({ phase, index, status, dates, progress, callDate }) {
  document.getElementById('modal-step').textContent = `Stage ${String(index + 1).padStart(2, '0')}`;
  const pill = document.getElementById('modal-status');
  pill.className = `pill pill-${status}`;
  pill.textContent = STATUS_LABEL[status];
  document.getElementById('modal-title').textContent = phase.name;
  document.getElementById('modal-dates').textContent = dates;
  document.getElementById('modal-call').hidden = !callDate;
  renderActions(phase);
  if (callDate) {
    document.getElementById('modal-call-label').textContent = phase.call;
    document.getElementById('modal-call-date').textContent = callDate;
  }
  const goal = document.getElementById('modal-goal');
  goal.hidden = !phase.goal;
  goal.textContent = phase.goal || '';
  const blurb = document.getElementById('modal-blurb');
  blurb.hidden = !phase.blurb;
  blurb.textContent = phase.blurb || '';
  setModalProgress(progress);
  modal.dataset.status = status;
  modal.showModal();
  document.body.classList.add('modal-open');
}

modal.addEventListener('close', () => document.body.classList.remove('modal-open'));
document.getElementById('modal-close').addEventListener('click', () => modal.close());
// Clicking the dimmed backdrop (the dialog element itself, outside its content) closes it.
modal.addEventListener('click', (e) => {
  if (e.target === modal) modal.close();
});

let currentUser = null;

document.getElementById('program-month').addEventListener('change', async (e) => {
  const select = e.target;
  const previous = currentUser.programMonth;
  currentUser.programMonth = select.value;
  render(currentUser);
  select.disabled = true;
  try {
    const res = await apiFetch('/api/program-month', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: select.value }),
    });
    if (!res.ok) throw new Error();
  } catch {
    currentUser.programMonth = previous;
    select.value = previous;
    render(currentUser);
    alert("Couldn't save the program month. Please try again.");
  } finally {
    select.disabled = false;
  }
});

// Staff viewing a client's page get a banner and a way back to the staff board.
function setupStaffView(user) {
  if (!user.viewingAs) return;
  document.title = `${user.name} · paidcoaching.com DFY`;
  document.getElementById('logout-btn').hidden = true;
  const back = el('a', 'btn btn-ghost', '← Staff board');
  back.href = '/admin';
  document.querySelector('.topbar-user').append(back);
  const banner = el('div', 'staff-banner');
  banner.append(
    el('strong', null, `Staff view — you're looking at ${user.name}'s page`),
    el('span', null, 'Anything you tick or edit here is saved to their account.'),
  );
  document.querySelector('.topbar').after(banner);
}

document.getElementById('logout-btn').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  location.href = '/login';
});

apiFetch('/api/me')
  .then((res) => {
    if (res.status === 401) { location.href = '/login'; return null; }
    return res.json();
  })
  .then((user) => {
    if (!user) return;
    currentUser = user;
    setupStaffView(user);
    renderMonthPicker(user);
    render(user);
    // Progress depends on action items, so re-render once they're loaded.
    Promise.all([Forms.loadAll(), loadActions(), ResourceViewer.load('client'), loadVideos(), loadFiles(), loadEmbeds()])
      // Re-render, including any stage pop-up opened before loading finished.
      .then(() => refreshAfterActionChange()).catch(() => {});
  });
