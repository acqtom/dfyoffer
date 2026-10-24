// Staff Templates page: the starting version of each resource for every client.
const list = document.getElementById('template-list');

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

let toastTimer;
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 4000);
}

// ---- How-to videos (shared by every client) -----------------------------------
// Each one is a Loom link or pasted embed code (VTurb, YouTube, Vimeo, Wistia, …).
// Embedded videos show on client pages as "View SOP". Keys match VIDEO_KEYS on the server and the
// `video` on each action in dashboard.js.
const VIDEOS = [
  { key: 'complete-funnel', title: 'Complete your funnel', where: 'Weeks 1 & 2' },
  { key: 'film-ads', title: 'Film your ads', where: 'Weeks 1 & 2' },
];
const LOOM_RE = /loom\.com\/(?:share|embed)\/[a-zA-Z0-9]+/;

function statusText(video) {
  if (!video) return ['video-status', 'Not set — clients see "Video coming soon"'];
  if (video.kind === 'embed') return ['video-status video-status-set', '✓ Embedded video live — clients see "View SOP"'];
  return ['video-status video-status-set', '✓ Loom link live for all clients'];
}

async function saveVideo(key, body) {
  const res = await fetch(`/api/videos/${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Couldn't save. Please try again.");
  return data;
}

function videoRow(video, current) {
  const row = el('div', 'video-setting');
  const label = el('div', 'video-setting-label');
  label.append(el('strong', null, video.title), el('span', null, video.where));

  // Loom link / Upload video switch
  const modes = el('div', 'video-modes');
  modes.setAttribute('role', 'group');
  modes.setAttribute('aria-label', `How to add the ${video.title} video`);
  const loomTab = el('button', 'video-mode', 'Loom link');
  const embedTab = el('button', 'video-mode', 'Embed code');
  loomTab.type = 'button';
  embedTab.type = 'button';
  modes.append(loomTab, embedTab);

  const status = el('span');
  const setStatus = (cls, text) => { status.className = cls; status.textContent = text; };
  setStatus(...statusText(current));

  // Loom panel
  const loomForm = el('form', 'video-panel');
  const input = el('input');
  input.type = 'url';
  input.placeholder = 'https://www.loom.com/share/…';
  input.value = current?.kind === 'loom' ? current.url : '';
  input.setAttribute('aria-label', `Loom link for ${video.title}`);
  const save = el('button', 'btn btn-primary', 'Save');
  save.type = 'submit';
  loomForm.append(input, save);
  loomForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const link = input.value.trim();
    if (!LOOM_RE.test(link)) return setStatus('video-status video-status-error', 'Please paste a Loom link (loom.com/share/…)');
    save.disabled = true;
    try {
      const saved = await saveVideo(video.key, { kind: 'loom', url: link });
      setStatus(...statusText(saved));
      showToast(`"${video.title}" Loom saved for every client`);
    } catch (err) {
      setStatus('video-status video-status-error', err.message);
    } finally {
      save.disabled = false;
    }
  });

  // Embed code panel
  const embedForm = el('form', 'video-panel');
  const code = el('textarea', 'video-embed');
  code.rows = 3;
  code.spellcheck = false;
  code.placeholder = 'Paste the embed code from VTurb, YouTube, Vimeo, Wistia…';
  code.value = current?.kind === 'embed' ? current.code || '' : '';
  code.setAttribute('aria-label', `Embed code for ${video.title}`);
  const saveEmbed = el('button', 'btn btn-primary', 'Save');
  saveEmbed.type = 'submit';
  embedForm.append(code, saveEmbed);
  embedForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!/<[a-z]/i.test(code.value)) {
      return setStatus('video-status video-status-error', 'Paste the embed code from your video platform.');
    }
    saveEmbed.disabled = true;
    try {
      const saved = await saveVideo(video.key, { kind: 'embed', code: code.value });
      setStatus(...statusText(saved));
      showToast(`"${video.title}" embedded video saved for every client`);
    } catch (err) {
      setStatus('video-status video-status-error', err.message);
    } finally {
      saveEmbed.disabled = false;
    }
  });

  const showMode = (mode) => {
    loomTab.setAttribute('aria-pressed', String(mode === 'loom'));
    embedTab.setAttribute('aria-pressed', String(mode === 'embed'));
    loomForm.hidden = mode !== 'loom';
    embedForm.hidden = mode !== 'embed';
  };
  loomTab.addEventListener('click', () => showMode('loom'));
  embedTab.addEventListener('click', () => showMode('embed'));
  showMode(current?.kind === 'embed' ? 'embed' : 'loom');

  row.append(label, modes, loomForm, embedForm, status);
  return row;
}

async function loadVideoSettings() {
  const { videos } = await (await fetch('/api/videos')).json();
  document.getElementById('video-settings').replaceChildren(...VIDEOS.map((video) => videoRow(video, videos[video.key])));
}

// Default text for each resource's prompt until staff save their own.
// Placeholders — replace them with the real prompts via Edit.
const PROMPT_DEFAULTS = {
  'main-page-code': `PLACEHOLDER — replace with your real prompt

Build the main landing page for this client as a single HTML file.

Client details (from their onboarding form):
- Niche: [niche]
- Offer: [offer]
- Why people choose them: [why_you]

Include: a headline, the VSL embed, proof, and a "Book your call" button.`,
  'confirmation-page-code': `PLACEHOLDER — replace with your real prompt

Build the confirmation page this client's leads see after booking a call, as a single HTML file.

Client details:
- Niche: [niche]
- Offer: [offer]

Include: "You're booked" headline, confirmation video embed, FAQ videos, and show-up reminders.`,
  'vsl-script': `PLACEHOLDER — replace with your real prompt

Write a VSL script for this client.

Client details:
- Niche: [niche]
- Offer: [offer]
- Main objections: [objections]
- What people love (aha moments): [aha]
- Why choose them: [why_you]

Structure: Hook → Problem → New way → Proof → Offer → Call to action.`,
  'ad-scripts': `PLACEHOLDER — replace with your real prompt

Write ad scripts for this client: 5 hooks, 2 bodies and 1 CTA (5 × 2 = 10 ads).

Client details:
- Niche: [niche]
- Offer: [offer]
- Main objections: [objections]
- What people love: [aha]`,
  'confirmation-page-script': `PLACEHOLDER — replace with your real prompt

Write the script for this client's confirmation page video.

Client details:
- Niche: [niche]
- Offer: [offer]

Cover: congrats on booking, what happens on the call, a quick client story, and showing up on time.`,
};
Object.assign(RESOURCE_CONTENT, Object.fromEntries(
  Object.entries(PROMPT_DEFAULTS).map(([key, text]) => [`prompt-${key}`, text]),
));

// ---- Shared PDFs (e.g. the Editor SOP) ------------------------------------------
// Uploaded once here; every client downloads the same file from Week 1 resources.
// Keys match FILE_KEYS on the server. Stored in the database, so 4 MB max.
const SHARED_PDFS = [{ key: 'editor-sop', title: 'Editor SOP' }];
const MAX_PDF_BYTES = 4 * 1024 * 1024;

const formatSize = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

function pdfTile(pdf, current) {
  const tile = el('div', 'resource resource-shared');
  tile.append(ResourceViewer.icon('pdf'), el('strong', 'resource-title', pdf.title));
  tile.append(el('span', 'resource-shared-label', 'Shared · every client sees your saved version'));
  const status = el('span', 'pdf-status');
  const actions = el('div', 'resource-actions');
  const input = el('input');
  input.type = 'file';
  input.accept = 'application/pdf,.pdf';
  input.hidden = true;
  const upload = el('button', 'resource-prompt-btn', current ? 'Replace PDF' : 'Upload PDF');
  upload.type = 'button';
  upload.addEventListener('click', () => input.click());
  const download = el('a', 'resource-open', 'Download →');
  download.href = `/files/${pdf.key}`;
  const show = (file) => {
    status.textContent = file ? `${file.name} · ${formatSize(file.size)}` : 'No PDF yet — clients see "Coming soon"';
    download.hidden = !file;
    upload.textContent = file ? 'Replace PDF' : 'Upload PDF';
  };
  show(current);

  input.addEventListener('change', async () => {
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    if (file.size > MAX_PDF_BYTES) return showToast('That PDF is over 4 MB. Please use a smaller file.');
    if (file.type && file.type !== 'application/pdf') return showToast('Please choose a PDF file.');
    upload.disabled = true;
    status.textContent = `Uploading ${file.name}…`;
    try {
      const res = await fetch(`/api/files/${pdf.key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/pdf', 'X-File-Name': encodeURIComponent(file.name) },
        body: file,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed. Please try again.');
      show(data);
      showToast(`"${pdf.title}" PDF saved for every client`);
    } catch (err) {
      show(current);
      showToast(err.message);
    } finally {
      upload.disabled = false;
    }
  });

  actions.append(download, upload);
  tile.append(status, actions, input);
  return tile;
}

Promise.all([ResourceViewer.load('template'), fetch('/api/files').then((r) => r.json())]).then(([, { files }]) => {
  const resourceItems = WEEK1_RESOURCES.map((resource) => {
    const item = document.createElement('li');
    // Every resource except the shared one has a prompt.
    const prompt = SHARED_RESOURCES.has(resource.key)
      ? undefined
      : { key: `prompt-${resource.key}`, title: `${resource.title} prompt`, kind: 'prompt' };
    item.append(ResourceViewer.tile(resource, { prompt }));
    return item;
  });
  const pdfItems = SHARED_PDFS.map((pdf) => {
    const item = document.createElement('li');
    item.append(pdfTile(pdf, files[pdf.key]));
    return item;
  });
  list.replaceChildren(...resourceItems, ...pdfItems);
});

loadVideoSettings();

document.getElementById('logout-btn').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  location.href = '/login';
});
