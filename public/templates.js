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
// Keys match VIDEO_KEYS on the server and the `video` on each action in dashboard.js.
const VIDEOS = [
  { key: 'complete-funnel', title: 'Complete your funnel', where: 'Weeks 1 & 2' },
  { key: 'film-ads', title: 'Film your ads', where: 'Weeks 1 & 2' },
];
const LOOM_RE = /loom\.com\/(?:share|embed)\/[a-zA-Z0-9]+/;

async function loadVideoSettings() {
  const { videos } = await (await fetch('/api/videos')).json();
  const root = document.getElementById('video-settings');
  root.replaceChildren(...VIDEOS.map((video) => {
    const form = el('form', 'video-setting');
    const label = el('div', 'video-setting-label');
    label.append(el('strong', null, video.title), el('span', null, video.where));
    const input = el('input');
    input.type = 'url';
    input.placeholder = 'https://www.loom.com/share/…';
    input.value = videos[video.key] || '';
    input.setAttribute('aria-label', `Loom link for ${video.title}`);
    const save = el('button', 'btn btn-primary', 'Save');
    save.type = 'submit';
    const status = el('span', videos[video.key] ? 'video-status video-status-set' : 'video-status', videos[video.key] ? '✓ Live for all clients' : 'Not set — clients see "Video coming soon"');
    form.append(label, input, save, status);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const link = input.value.trim();
      if (!LOOM_RE.test(link)) {
        status.className = 'video-status video-status-error';
        status.textContent = 'Please paste a Loom link (loom.com/share/…)';
        return;
      }
      save.disabled = true;
      const res = await fetch(`/api/videos/${video.key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: link }),
      });
      save.disabled = false;
      const data = await res.json();
      if (!res.ok) {
        status.className = 'video-status video-status-error';
        status.textContent = data.error || "Couldn't save. Please try again.";
        return;
      }
      status.className = 'video-status video-status-set';
      status.textContent = '✓ Live for all clients';
      showToast(`"${video.title}" video saved for every client`);
    });
    return form;
  }));
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

ResourceViewer.load('template').then(() => {
  list.replaceChildren(...WEEK1_RESOURCES.map((resource) => {
    const item = document.createElement('li');
    // Every resource except the shared one has a prompt.
    const prompt = SHARED_RESOURCES.has(resource.key)
      ? undefined
      : { key: `prompt-${resource.key}`, title: `${resource.title} prompt`, kind: 'prompt' };
    item.append(ResourceViewer.tile(resource, { prompt }));
    return item;
  }));
});

loadVideoSettings();

document.getElementById('logout-btn').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  location.href = '/login';
});
