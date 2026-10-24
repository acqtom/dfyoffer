// Resource tiles and the full-screen viewer (read, copy, Edit → Done).
// Used on a client's page and on the staff Templates page.
//
// Text is resolved in layers: the copy being edited (`own`), then `base`, then
// the built-in default in resources.js.
//   mode 'client':   own = this client's edits, base = shared templates
//   mode 'template': own = staff's templates,  base = nothing
// Shared resources (SHARED_RESOURCES) are read-only on client pages and always
// show the shared template.
// Boxed resources (RESOURCE_SECTIONS) are stored as JSON: { sectionId: text }.
window.ResourceViewer = (() => {
  const RESOURCE_ICONS = {
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    code: '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>',
    doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    pdf: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 11v6M9.5 14.5 12 17l2.5-2.5"/>',
    video: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-3v10l-6-3z"/>',
    prompt: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  };
  const KIND_LABELS = { code: 'Code', doc: 'Script', prompt: 'Prompt' };
  const openLabel = (resource) => resource.openLabel || (resource.kind === 'code' ? 'View code →' : 'Read script →');

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

  const resourceModal = document.getElementById('resource-modal');
  const resourceCopy = document.getElementById('resource-copy');
  const resourceEditBtn = document.getElementById('resource-edit');
  const resourceBody = document.getElementById('resource-body');
  const resourceEditor = document.getElementById('resource-editor');
  const resourceSections = document.getElementById('resource-sections');

  let mode = 'client';
  const own = {};
  const base = {};
  let openResourceKey = null;

  async function load(viewMode) {
    mode = viewMode;
    if (mode === 'template') {
      const templates = await (await fetch('/api/templates')).json();
      Object.assign(own, templates.templates);
    } else {
      const shared = await (await fetch('/api/templates?shared')).json();
      Object.assign(base, shared.templates);
      const edits = await (await apiFetch('/api/resources')).json();
      Object.assign(own, edits.edits);
    }
  }

  async function save(key, content) {
    const url = mode === 'template' ? `/api/templates/${key}` : `/api/resources/${key}`;
    const send = mode === 'template' ? fetch : apiFetch;
    const res = await send(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) throw new Error();
  }

  function icon(kind) {
    const node = el('span', 'resource-icon');
    // Static SVG markup from RESOURCE_ICONS above, not user input.
    node.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${RESOURCE_ICONS[kind]}</svg>`;
    return node;
  }

  const sectionsDef = (key) => RESOURCE_SECTIONS[key];
  const isEditing = () => resourceModal.classList.contains('is-editing');

  const isShared = (key) => SHARED_RESOURCES.has(key);
  // On client pages a shared resource ignores any per-client copy.
  const stored = (key) => (mode === 'client' && isShared(key) ? base[key] : own[key] ?? base[key]);

  function resourceText(key) {
    return stored(key) ?? RESOURCE_CONTENT[key];
  }

  function sectionValues(key) {
    try {
      const parsed = JSON.parse(stored(key) ?? '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  // Everything in the open resource as plain text, for the top Copy button.
  function fullText(key) {
    const def = sectionsDef(key);
    if (!def) return resourceText(key);
    const values = sectionValues(key);
    return def.sections.map((sec) => `${sec.label}:\n${values[sec.id] || ''}`).join('\n\n');
  }

  async function copyText(text, button, label) {
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = 'Copied ✓';
    } catch {
      button.textContent = 'Copy failed';
    }
    setTimeout(() => { button.textContent = label; }, 1800);
  }

  function renderSections(editing) {
    const def = sectionsDef(openResourceKey);
    const values = sectionValues(openResourceKey);
    const nodes = [el('p', 'section-note', def.note)];
    let grid = null;
    let group = null;
    for (const sec of def.sections) {
      if (sec.group !== group) {
        group = sec.group;
        grid = el('div', 'section-grid');
        nodes.push(el('h3', 'section-group', group), grid);
      }
      const box = el('div', 'section-box');
      const head = el('div', 'section-head');
      head.append(el('span', 'section-label', sec.label));
      if (!editing) {
        const copy = el('button', 'section-copy', 'Copy');
        copy.type = 'button';
        copy.disabled = !values[sec.id];
        copy.addEventListener('click', () => copyText(values[sec.id] || '', copy, 'Copy'));
        head.append(copy);
      }
      box.append(head);
      if (editing) {
        const input = el('textarea', 'section-input');
        input.rows = 4;
        input.dataset.section = sec.id;
        input.value = values[sec.id] || '';
        input.placeholder = `Write ${sec.label.toLowerCase()}…`;
        input.setAttribute('aria-label', sec.label);
        box.append(input);
      } else {
        box.append(values[sec.id]
          ? el('p', 'section-text', values[sec.id])
          : el('p', 'section-text section-empty', 'Nothing written yet — click Edit'));
      }
      grid.append(box);
    }
    resourceSections.replaceChildren(...nodes);
  }

  function setEditing(editing) {
    resourceModal.classList.toggle('is-editing', editing);
    resourceEditBtn.textContent = editing ? 'Done' : 'Edit';
    if (sectionsDef(openResourceKey)) {
      renderSections(editing);
      if (editing) resourceSections.querySelector('textarea').focus();
      return;
    }
    resourceBody.hidden = editing;
    resourceEditor.hidden = !editing;
    if (editing) {
      resourceEditor.value = resourceText(openResourceKey);
      resourceEditor.focus();
      resourceEditor.setSelectionRange(0, 0);
      resourceEditor.scrollTop = 0;
    }
  }

  async function saveResourceEdit() {
    const key = openResourceKey;
    const structured = Boolean(sectionsDef(key));
    const content = structured
      ? JSON.stringify(Object.fromEntries([...resourceSections.querySelectorAll('textarea')]
        .map((t) => [t.dataset.section, t.value]).filter(([, v]) => v.trim())))
      : resourceEditor.value;
    const previous = own[key];
    const unchanged = structured ? content === JSON.stringify(sectionValues(key)) : content === resourceText(key);
    if (!unchanged) own[key] = content;
    setEditing(false);
    if (!structured) resourceBody.textContent = resourceText(key);
    if (unchanged) return;
    try {
      await save(key, content);
    } catch {
      if (previous === undefined) delete own[key]; else own[key] = previous;
      if (openResourceKey === key && resourceModal.open) setEditing(false);
      if (!structured) resourceBody.textContent = resourceText(key);
      alert("Couldn't save your changes. Please try again.");
    }
  }

  function open(resource) {
    openResourceKey = resource.key;
    const structured = Boolean(sectionsDef(resource.key));
    document.getElementById('resource-icon').replaceChildren(icon(resource.kind));
    document.getElementById('resource-kind').textContent = resource.label || KIND_LABELS[resource.kind];
    document.getElementById('resource-title').textContent = resource.title;
    resourceSections.hidden = !structured;
    resourceBody.hidden = structured;
    resourceEditor.hidden = true;
    resourceCopy.textContent = structured ? 'Copy all' : 'Copy';
    const readOnly = mode === 'client' && isShared(resource.key);
    resourceEditBtn.hidden = readOnly;
    const note = document.getElementById('resource-note');
    note.className = `resource-note${isShared(resource.key) ? ' resource-note-shared' : ''}`;
    note.textContent = mode === 'template'
      ? (isShared(resource.key)
        ? 'Shared with all clients — saving updates it for everyone.'
        : "Staff only — saving here doesn't change any client's account.")
      : (readOnly ? 'The same for every client.' : '');
    note.hidden = !note.textContent;
    if (!structured) {
      resourceBody.className = `resource-body resource-body-${resource.kind}`;
      resourceEditor.className = `resource-body resource-body-${resource.kind} resource-editor`;
      resourceBody.textContent = resourceText(resource.key);
    }
    setEditing(false);
    resourceModal.showModal();
    resourceBody.scrollTop = 0;
    resourceSections.scrollTop = 0;
  }

  // A clickable tile for a script or code resource. With `prompt`, the tile
  // gets two buttons instead: open the resource, or open its prompt.
  function tile(resource, { prompt } = {}) {
    if (prompt) {
      const node = el('div', 'resource');
      const actions = el('div', 'resource-actions');
      const openBtn = el('button', 'resource-open resource-open-btn', openLabel(resource));
      openBtn.type = 'button';
      openBtn.addEventListener('click', () => open(resource));
      const promptBtn = el('button', 'resource-prompt-btn', 'View prompt');
      promptBtn.type = 'button';
      promptBtn.addEventListener('click', () => open(prompt));
      actions.append(openBtn, promptBtn);
      node.append(icon(resource.kind), el('strong', 'resource-title', resource.title), actions);
      return node;
    }
    const content = sectionsDef(resource.key) || resourceText(resource.key);
    const shared = mode === 'template' && isShared(resource.key);
    const node = el(content ? 'button' : 'div', shared ? 'resource resource-shared' : 'resource');
    if (content) {
      node.type = 'button';
      node.addEventListener('click', () => open(resource));
    }
    node.append(icon(resource.kind), el('strong', 'resource-title', resource.title));
    if (shared) node.append(el('span', 'resource-shared-label', 'Shared · every client sees your saved version'));
    node.append(content
      ? el('span', 'resource-open', openLabel(resource))
      : el('span', 'pill pill-upcoming', 'Coming soon'));
    return node;
  }

  resourceEditBtn.addEventListener('click', () => {
    if (isEditing()) saveResourceEdit();
    else setEditing(true);
  });

  resourceCopy.addEventListener('click', () => {
    const label = sectionsDef(openResourceKey) ? 'Copy all' : 'Copy';
    const text = isEditing() && !sectionsDef(openResourceKey) ? resourceEditor.value : fullText(openResourceKey);
    copyText(text, resourceCopy, label);
  });

  // Closing mid-edit keeps the changes rather than throwing them away.
  resourceModal.addEventListener('close', () => {
    if (isEditing()) saveResourceEdit();
  });

  document.getElementById('resource-close').addEventListener('click', () => resourceModal.close());
  resourceModal.addEventListener('click', (e) => {
    if (e.target === resourceModal) resourceModal.close();
  });

  return { load, tile, icon, open, own };
})();
