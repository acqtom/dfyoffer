// Typeform-style forms: one question at a time, then a list of answers.
// All forms share the one full-screen dialog; only one is open at a time.
// Exposes window.Forms = { load, open, onChange, submission, questionCount }.
(() => {
  const ANSWER_PLACEHOLDER = 'Type your answer here…';
  const ONBOARDING_QUESTIONS = [
    { id: 'niche',      type: 'text',   label: 'What niche are you in?', placeholder: ANSWER_PLACEHOLDER },
    { id: 'offer',      type: 'long',   label: 'What is your offer?', placeholder: ANSWER_PLACEHOLDER },
    { id: 'pages',      type: 'links',  label: 'Send your landing page and confirmation page', fields: [
      { id: 'landing_page',      label: 'Landing page',      placeholder: 'https://yoursite.com/landing' },
      { id: 'confirmation_page', label: 'Confirmation page', placeholder: 'https://yoursite.com/thank-you' },
    ] },
    { id: 'revenue',    type: 'choice', label: 'What is your monthly revenue?', options: ['Under $10k', '$10k – $25k', '$25k – $50k', '$50k – $100k', '$100k+'] },
    { id: 'traffic',    type: 'choice', label: 'Where does your traffic come from?', options: ['YouTube', 'Instagram', 'TikTok', 'Facebook', 'Ads'] },
    { id: 'objections', type: 'long',   label: "What are your main objections / why don't people move forward?", placeholder: ANSWER_PLACEHOLDER },
    { id: 'aha',        type: 'long',   label: 'What do people love about your offer / program? (aha moments)', placeholder: ANSWER_PLACEHOLDER },
    { id: 'why_you',    type: 'long',   label: 'Why should people choose you over everyone else in the market?', placeholder: ANSWER_PLACEHOLDER },
    { id: 'ads',        type: 'choice', label: 'Have you run paid ads before?', options: ['Never', "Yes, but they weren't profitable", 'Yes, and they were profitable'] },
    { id: 'closer',     type: 'choice', label: "Who's taking the sales calls?", options: ['Me', 'Closer'] },
    { id: 'goal',       type: 'long',   label: "What's the #1 result you want from the next 30 days?", placeholder: ANSWER_PLACEHOLDER },
  ];

  const MIDWEEK_QUESTIONS = [
    { id: 'calls',      type: 'text', label: 'How many calls have you taken?', placeholder: 'e.g. 12' },
    { id: 'show_up',    type: 'long', label: 'How are people showing up?', placeholder: ANSWER_PLACEHOLDER },
    { id: 'objections', type: 'long', label: 'What are the main objections?', placeholder: ANSWER_PLACEHOLDER },
    { id: 'likes',      type: 'long', label: 'What do people really like?', placeholder: ANSWER_PLACEHOLDER },
  ];

  // Week 4: the mid-week questions plus show rate, close rate, AOV and cash collected.
  const FINAL_QUESTIONS = [
    ...MIDWEEK_QUESTIONS,
    { id: 'show_rate', type: 'text', label: "What's your show rate?", placeholder: 'e.g. 70%' },
    { id: 'close_rate', type: 'text', label: "What's your close rate?", placeholder: 'e.g. 25%' },
    { id: 'aov', type: 'text', label: "What's your AOV?", placeholder: 'e.g. $5,000' },
    { id: 'cash_since_14th', type: 'text', label: 'How much cash have you collected since the 14th?', placeholder: 'e.g. $15,000' },
  ];

  const FEEDBACK_QUESTIONS = [
    { id: 'rating',      type: 'scale', label: 'How did you like our service on a scale of 1–10?', min: 1, max: 10, lowLabel: 'Not great', highLabel: 'Amazing' },
    { id: 'why',         type: 'long',  label: 'Why?', placeholder: ANSWER_PLACEHOLDER },
    { id: 'roas',        type: 'text',  label: 'What ROAS did we end off at?', placeholder: 'e.g. 3.5x' },
    { id: 'improve',     type: 'long',  label: 'How could we have improved our service?', placeholder: ANSWER_PLACEHOLDER },
  ];

  // Keys match the server's FORM_KEYS.
  const FORMS = {
    onboarding: { title: 'Your onboarding form', questions: ONBOARDING_QUESTIONS },
    midweek:    { title: 'Your mid-week check-in', questions: MIDWEEK_QUESTIONS },
    'final-checkin': { title: 'Your Week 4 check-in', questions: FINAL_QUESTIONS },
    'service-feedback': { title: 'Your service feedback', questions: FEEDBACK_QUESTIONS },
  };
  // Answer keys a question stores (a links question stores one per field).
  const keysOf = (q) => (q.type === 'links' ? q.fields.map((f) => f.id) : [q.id]);
  const isAnswered = (q) => keysOf(q).every((key) => draft[key]);
  const LINK_RE = /^\S+\.\S+$/;
  const toHref = (value) => (/^https?:\/\//i.test(value) ? value : `https://${value}`);
  const LETTERS = 'ABCDEFGHIJ';

  const dialog = document.getElementById('form-modal');
  const stage = document.getElementById('form-stage');
  const nav = document.getElementById('form-nav');
  const progressWrap = document.getElementById('form-progress-wrap');
  const progress = document.getElementById('form-progress');
  const count = document.getElementById('form-count');
  const prevBtn = document.getElementById('form-prev');
  const nextBtn = document.getElementById('form-next');

  // State of the form currently in the dialog. Each form's state is kept in
  // `states` and swapped in when that form is opened.
  let activeKey = 'onboarding';
  let QUESTIONS = FORMS[activeKey].questions;
  let FORM_URL = `/api/forms/${activeKey}`;
  let submission = null;       // { answers, submittedAt } once submitted
  let draft = {};              // answers in progress
  let index = 0;
  let view = 'questions';      // 'questions' | 'answers'
  const states = Object.fromEntries(Object.keys(FORMS).map((key) => [key, { submission: null, draft: {}, index: 0, view: 'questions' }]));
  const listeners = [];

  function activate(key) {
    states[activeKey] = { submission, draft, index, view };
    activeKey = key;
    QUESTIONS = FORMS[key].questions;
    FORM_URL = `/api/forms/${key}`;
    ({ submission, draft, index, view } = states[key]);
  }

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

  async function load(key) {
    const res = await apiFetch(`/api/forms/${key}`);
    const data = await res.json();
    const loaded = data.answers ? data : null;
    states[key].submission = loaded;
    if (key === activeKey) submission = loaded;
    return loaded;
  }

  function open(key) {
    activate(key);
    view = submission ? 'answers' : 'questions';
    if (!submission) index = Math.min(index, QUESTIONS.length - 1);
    render();
    dialog.showModal();
  }

  // ---- Question view ------------------------------------------------------
  function renderQuestion(direction = 0) {
    const q = QUESTIONS[index];
    progressWrap.hidden = false;
    nav.hidden = false;
    progress.style.width = `${(index / QUESTIONS.length) * 100}%`;
    count.textContent = `${index + 1} of ${QUESTIONS.length}`;
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === QUESTIONS.length - 1 || !isAnswered(q);

    const wrap = el('div', 'fq' + (direction > 0 ? ' fq-up' : direction < 0 ? ' fq-down' : ''));
    const label = el('h2', 'fq-label');
    label.append(el('span', 'fq-num', `${index + 1} →`), document.createTextNode(q.label));
    label.id = 'fq-label';
    wrap.append(label);

    const error = el('p', 'fq-error');
    error.setAttribute('role', 'alert');
    let focusTarget;

    if (q.type === 'scale') {
      const row = el('div', 'fq-scale');
      row.setAttribute('role', 'radiogroup');
      row.setAttribute('aria-labelledby', 'fq-label');
      for (let n = q.min; n <= q.max; n++) {
        const btn = el('button', 'fq-scale-btn', String(n));
        btn.type = 'button';
        btn.setAttribute('role', 'radio');
        btn.setAttribute('aria-checked', String(draft[q.id] === String(n)));
        btn.addEventListener('click', () => choose(String(n)));
        row.append(btn);
        if (n === q.min || draft[q.id] === String(n)) focusTarget = btn;
      }
      const ends = el('div', 'fq-scale-ends');
      ends.append(el('span', null, `${q.min} · ${q.lowLabel}`), el('span', null, `${q.max} · ${q.highLabel}`));
      wrap.append(row, ends, el('p', 'fq-hint', 'Click a number, or type it (0 for 10)'), error);
    } else if (q.type === 'choice') {
      const list = el('div', 'fq-options');
      list.setAttribute('role', 'radiogroup');
      list.setAttribute('aria-labelledby', 'fq-label');
      q.options.forEach((option, i) => {
        const btn = el('button', 'fq-option');
        btn.type = 'button';
        btn.setAttribute('role', 'radio');
        btn.setAttribute('aria-checked', String(draft[q.id] === option));
        btn.append(el('span', 'fq-key', LETTERS[i]), el('span', null, option));
        btn.addEventListener('click', () => choose(option));
        list.append(btn);
        if (i === 0 || draft[q.id] === option) focusTarget = btn;
      });
      wrap.append(list, el('p', 'fq-hint', 'Choose an option, or press its letter key'), error);
    } else if (q.type === 'links') {
      const group = el('div', 'fq-links');
      const inputs = q.fields.map((field, i) => {
        const row = el('label', 'fq-link');
        const input = el('input', 'fq-input');
        input.type = 'url';
        input.inputMode = 'url';
        input.autocomplete = 'url';
        input.placeholder = field.placeholder;
        input.value = draft[field.id] || '';
        input.addEventListener('input', () => {
          draft[field.id] = input.value.trim();
          error.textContent = '';
          nextBtn.disabled = index === QUESTIONS.length - 1 || !isAnswered(q);
        });
        input.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          if (i < q.fields.length - 1) inputs[i + 1].focus();
          else advance();
        });
        row.append(el('span', 'fq-link-label', field.label), input);
        group.append(row);
        return input;
      });
      focusTarget = inputs.find((input) => !input.value) || inputs[0];
      wrap.append(group, okRow(q), error);
    } else {
      const input = q.type === 'long' ? el('textarea', 'fq-input') : el('input', 'fq-input');
      if (q.type === 'long') input.rows = 3;
      else input.type = 'text';
      input.placeholder = q.placeholder;
      input.value = draft[q.id] || '';
      input.setAttribute('aria-labelledby', 'fq-label');
      input.addEventListener('input', () => {
        draft[q.id] = input.value.trim();
        error.textContent = '';
        nextBtn.disabled = index === QUESTIONS.length - 1 || !draft[q.id];
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); advance(); }
      });
      focusTarget = input;
      wrap.append(input, okRow(q), error);
    }

    stage.replaceChildren(wrap);
    requestAnimationFrame(() => focusTarget && focusTarget.focus());
  }

  // OK / Submit button with its keyboard hint.
  function okRow(q) {
    const isLast = index === QUESTIONS.length - 1;
    const row = el('div', 'fq-actions');
    const ok = el('button', 'btn btn-primary fq-ok', isLast ? 'Submit' : 'OK ✓');
    ok.type = 'button';
    ok.addEventListener('click', advance);
    row.append(ok, el('span', 'fq-hint', q.type === 'long' ? 'press Enter ↵ (Shift + Enter for a new line)' : 'press Enter ↵'));
    return row;
  }

  function choose(option) {
    const q = QUESTIONS[index];
    draft[q.id] = option;
    stage.querySelectorAll('.fq-option, .fq-scale-btn').forEach((b) => {
      b.setAttribute('aria-checked', String(b.lastChild.textContent === option));
    });
    // Brief pause so the selection is visible before moving on.
    setTimeout(advance, 280);
  }

  function showError(message) {
    const error = stage.querySelector('.fq-error');
    if (error) error.textContent = message;
  }

  async function advance() {
    const q = QUESTIONS[index];
    if (!isAnswered(q)) return showError(q.type === 'links' ? 'Please add both links.' : 'Please fill this in.');
    if (q.type === 'links' && !q.fields.every((f) => LINK_RE.test(draft[f.id]))) {
      return showError('Please enter valid links, e.g. yoursite.com/page');
    }
    if (index < QUESTIONS.length - 1) {
      index += 1;
      renderQuestion(1);
      return;
    }
    await submit();
  }

  function back() {
    if (index === 0) return;
    index -= 1;
    renderQuestion(-1);
  }

  async function submit() {
    const missing = QUESTIONS.findIndex((q) => !isAnswered(q));
    if (missing !== -1) {
      index = missing;
      renderQuestion();
      return showError('Please fill this in.');
    }
    stage.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    try {
      const res = await apiFetch(FORM_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: draft }),
      });
      if (!res.ok) throw new Error();
      submission = await res.json();
      draft = {};
      index = 0;
      view = 'answers';
      render({ justSubmitted: true });
      states[activeKey].submission = submission;
      listeners.forEach((fn) => fn(activeKey, submission));
    } catch {
      stage.querySelectorAll('button').forEach((b) => { b.disabled = false; });
      showError("Couldn't submit your form. Please try again.");
    }
  }

  // ---- Answers view -------------------------------------------------------
  function renderAnswers({ justSubmitted = false } = {}) {
    progressWrap.hidden = true;
    nav.hidden = true;

    const wrap = el('div', 'fa');
    const head = el('div', 'fa-head');
    head.append(
      el('span', 'tag', justSubmitted ? 'Submitted — thank you!' : FORMS[activeKey].title),
      el('h2', 'fa-title', 'Your answers'),
      el('p', 'fa-sub', `Submitted ${new Date(submission.submittedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`),
    );

    const list = el('ol', 'fa-list');
    QUESTIONS.forEach((q, i) => {
      const item = el('li', 'fa-item');
      item.append(el('span', 'fa-num', String(i + 1).padStart(2, '0')));
      const body = el('div', 'fa-body');
      body.append(el('p', 'fa-q', q.label));
      if (q.type === 'links') {
        for (const field of q.fields) {
          const value = submission.answers[field.id];
          const line = el('p', 'fa-a fa-link');
          line.append(el('span', 'fa-link-label', `${field.label}: `));
          if (value) {
            const a = el('a', null, value);
            a.href = toHref(value);
            a.target = '_blank';
            a.rel = 'noopener';
            line.append(a);
          } else {
            line.append('—');
          }
          body.append(line);
        }
      } else {
        const answer = submission.answers[q.id];
        body.append(el('p', 'fa-a', answer ? (q.type === 'scale' ? `${answer} / ${q.max}` : answer) : '—'));
      }
      item.append(body);
      list.append(item);
    });

    const actions = el('div', 'fa-actions');
    const edit = el('button', 'btn btn-ghost', 'Edit answers');
    edit.type = 'button';
    edit.addEventListener('click', () => {
      // Only carry over answers to the current questions.
      draft = Object.fromEntries(QUESTIONS.flatMap(keysOf)
        .filter((key) => submission.answers[key])
        .map((key) => [key, submission.answers[key]]));
      index = 0;
      view = 'questions';
      render();
    });
    const done = el('button', 'btn btn-primary fa-done', 'Done');
    done.type = 'button';
    done.addEventListener('click', () => dialog.close());
    actions.append(edit, done);

    wrap.append(head, list, actions);
    stage.replaceChildren(wrap);
    stage.scrollTop = 0;
  }

  function render(opts) {
    if (view === 'answers') renderAnswers(opts);
    else renderQuestion();
  }

  // ---- Wiring -------------------------------------------------------------
  prevBtn.addEventListener('click', back);
  nextBtn.addEventListener('click', advance);
  document.getElementById('form-close').addEventListener('click', () => dialog.close());

  dialog.addEventListener('keydown', (e) => {
    if (view !== 'questions') return;
    const q = QUESTIONS[index];
    if (q.type === 'scale' && /^[0-9]$/.test(e.key)) {
      e.preventDefault();
      choose(e.key === '0' ? '10' : e.key);
      return;
    }
    if (q.type !== 'choice') return;
    const i = LETTERS.indexOf(e.key.toUpperCase());
    if (e.key.length === 1 && i > -1 && i < q.options.length) {
      e.preventDefault();
      choose(q.options[i]);
    }
  });

  window.Forms = {
    load,
    loadAll: () => Promise.all(Object.keys(FORMS).map(load)),
    open,
    onChange: (fn) => listeners.push(fn),
    submission: (key) => (key === activeKey ? submission : states[key].submission),
    questionCount: (key) => FORMS[key].questions.length,
  };
})();
