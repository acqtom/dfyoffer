// The program runs for one calendar month (the user's cohort month).
// startDay/endDay are 1-based and inclusive. Weeks are 7-day blocks from day 1;
// Onboarding happens on day 1 (inside Week 1) and is shown as a milestone flag
// rather than its own timeline block. The last stage runs from day 22 to the end
// of the month: Week 4, finishing with the Performance Call on the last day.

// The client's build tasks, shown in both Week 1 and Week 2 (due by day 14).
// Same keys in both weeks, so ticking one ticks it in both.
const BUILD_ACTIONS = [
  { key: 'film-videos', title: 'Film your VSL, confirmation page video, and FAQ videos' },
  {
    key: 'complete-funnel',
    title: 'Complete your funnel',
    subtitle: 'Upload your videos, add your form, connect your domain, and get live',
    button: 'Watch how to',
    video: 'complete-funnel',
  },
  { key: 'film-ads', title: 'Film your ads', button: 'Watch how to', video: 'film-ads' },
];

// What we do in Weeks 3 and 4.
const OPTIMISE_STEPS = [
  { key: 'review-sales', title: 'Review your sales process' },
  { key: 'improve-metrics', title: 'Show you how to improve sales metrics' },
  { key: 'funnel-adjustments', title: 'Make funnel adjustments (if needed)' },
  { key: 'review-ads', title: 'Review ad performance' },
  { key: 'double-down', title: 'Double down on winning ads' },
];

function phasesFor(daysInMonth) {
  return [
    { name: 'Onboarding',       call: 'Onboarding call', short: 'Start', startDay: 1,  endDay: 1,  milestone: true,
      goal: 'Funnel Audit & Onboarding',
      form: { key: 'onboarding', title: 'Fill your form', minutes: 5 },
      actions: [
        { key: 'join-slack', title: 'Join the Slack', subtitle: 'Join, then tick the box once you\u2019re in',
          button: 'Join Slack →', href: SLACK_INVITE },
      ],
      weDo: [
        { key: 'review-form', title: 'Review your form info' },
        { key: 'review-funnel', title: 'Audit your funnel and offer' },
        { key: 'private-slack', title: 'Make your private Slack chat' },
      ] },
    { name: 'Week 1',           call: 'End-of-week call', short: 'W1',    startDay: 1,  endDay: 7,
      goal: 'Cold Funnel Set Up Complete, New Ad Scripts Ready',
      resources: WEEK1_RESOURCES,
      weDo: WEEK1_RESOURCES.map((r) => ({ key: `build-${r.key}`, title: r.title })),
      actions: BUILD_ACTIONS,
      actionsNote: 'Due by day 14, no rush!' },
    { name: 'Week 2',           call: 'End-of-week call', short: 'W2',    startDay: 8,  endDay: 14,
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
    { name: 'Week 3',           call: 'End-of-week call', short: 'W3',    startDay: 15, endDay: 21,
      goal: 'Closes Begin, Double Down On Winning Ads',
      weDo: OPTIMISE_STEPS.map((step) => ({ ...step })),
      form: { key: 'midweek', title: 'Fill this form mid week', minutes: 2 } },
    { name: 'Week 4 + Performance Call', call: 'Performance call', short: 'W4', startDay: 22, endDay: daysInMonth, wide: true,
      goal: 'More Closes, Profitable Campaign Ready To Scale', blurb: 'Review results and plan next steps.',
      // Same steps as Week 3, tracked separately (w4- keys) so they start fresh.
      weDo: OPTIMISE_STEPS.map((step) => ({ ...step, key: `w4-${step.key}` })),
      form: [
        { key: 'final-checkin', title: 'Fill this form mid week', minutes: 3 },
        { key: 'service-feedback', title: 'Service feedback form', minutes: 2 },
      ] },
  ];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS_AHEAD = 12;

const fmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const fmtMonth = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
const fmtCall = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

// Onboarding has a call on day 1 and each week ends with a call on its last day.
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

// Onboarding counts as in progress from signup until the end of day 1, even
// before the cohort starts. The first stage that hasn't started is "next".
function phaseStatuses(phases, today) {
  const statuses = new Map();
  for (const phase of phases) {
    let status = 'upcoming';
    if (today > phase.endDay) status = 'done';
    else if (today >= phase.startDay || phase.milestone) status = 'current';
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
    const done = completedActions.has(action.key);
    items.push({
      ...action,
      tick: true,
      done,
      detail: done ? 'Completed' : action.subtitle || 'Tick the box once it\u2019s done',
      // Embedded SOP videos get their own label.
      button: action.video && isSopVideo(action.video) ? 'View SOP' : action.button,
      onClick: action.video ? () => openVideo(action.title, action.video) : undefined,
    });
  }
  return items;
}

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
  const phases = phasesFor(daysInMonth);
  const dateFor = (day) => new Date(start.getFullYear(), start.getMonth(), day);

  // rawDay < 1 means the program hasn't started; > daysInMonth means it's over.
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const rawDay = Math.round((todayMidnight - start) / DAY_MS) + 1;
  const today = Math.min(Math.max(rawDay, 0), daysInMonth + 1);
  const statuses = phaseStatuses(phases, today);

  document.getElementById('user-name').textContent = user.name;
  document.getElementById('first-name').textContent = user.name.split(' ')[0];
  document.getElementById('program-range').textContent = `${fmt.format(start)} – ${fmt.format(end)}`;

  const badge = document.getElementById('day-badge');
  badge.classList.toggle('is-upcoming', rawDay < 1);
  if (rawDay < 1) {
    const daysLeft = 1 - rawDay;
    badge.textContent = `Starts in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`;
  } else if (rawDay > daysInMonth) {
    badge.textContent = 'Program complete';
  } else {
    badge.textContent = `Day ${rawDay} of ${daysInMonth}`;
  }

  const pct = Math.min(Math.max(rawDay, 0) / daysInMonth, 1);
  document.getElementById('progress-label').textContent =
    rawDay < 1 ? `Starts ${fmt.format(start)}` : `${Math.round(pct * 100)}% through`;

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
    seg.append(el('span', 'segment-name', phase.name), el('span', 'segment-short', phase.short), el('span', 'segment-dates', range));
    track.append(seg);
  }

  // Milestones (e.g. Onboarding) are flags under the track on their day.
  const milestoneRow = document.getElementById('timeline-milestones');
  milestoneRow.replaceChildren();
  const flags = phases.filter((p) => p.milestone).map((phase) => {
    const flag = el('div', `milestone milestone-${statuses.get(phase)}`);
    flag.append(el('span', 'milestone-name', phase.name), el('span', 'milestone-day', `Day ${phase.startDay}`));
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
  const inProgram = rawDay >= 1 && rawDay <= daysInMonth;
  marker.hidden = !inProgram;
  placeMarker = () => {
    for (const flag of flags) flag.style.left = `${xForDay(+flag.dataset.day)}px`;
    if (inProgram) marker.style.left = `${xForDay(today)}px`;
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

    const callDate = phase.call ? fmtCall.format(dateFor(phase.endDay)) : null;
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
    const item = el('li');
    item.append(ResourceViewer.tile(resource));
    list.append(item);
  }
  box.replaceChildren(list);
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
    Promise.all([Forms.loadAll(), loadActions(), ResourceViewer.load('client'), loadVideos()]).then(() => render(user)).catch(() => {});
  });
