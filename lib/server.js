// Paidcoaching.com client hub — Node request handler (Node 22.13+).
// The root server.js starts it, both locally (`npm start`) and on Vercel.
// Data lives in Postgres (Supabase); see lib/db.js.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const db = require('./db');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const ON_VERCEL = Boolean(process.env.VERCEL);
const SESSION_DAYS = 30;

// Tables are created on first start. Row Level Security is switched on with no
// policies, so Supabase's public API can't read them; the app connects as the
// database owner, which isn't affected.
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    program_month TEXT NOT NULL,
    -- 'pending' -> 'approved' or 'rejected' (staff decide on the staff board)
    status TEXT NOT NULL DEFAULT 'pending',
    -- Lets the browser that signed up check its approval and log in once accepted.
    pending_token_hash TEXT
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at BIGINT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS form_responses (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    form_key TEXT NOT NULL,
    answers TEXT NOT NULL,
    submitted_at TEXT NOT NULL,
    PRIMARY KEY (user_id, form_key)
  );
  CREATE TABLE IF NOT EXISTS password_resets (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at BIGINT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS videos (
    video_key TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS templates (
    resource_key TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS resource_edits (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resource_key TEXT NOT NULL,
    content TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, resource_key)
  );
  CREATE TABLE IF NOT EXISTS action_completions (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_key TEXT NOT NULL,
    completed_at TEXT NOT NULL,
    PRIMARY KEY (user_id, action_key)
  );
  ALTER TABLE users ENABLE ROW LEVEL SECURITY;
  ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE form_responses ENABLE ROW LEVEL SECURITY;
  ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;
  ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
  ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
  ALTER TABLE resource_edits ENABLE ROW LEVEL SECURITY;
  ALTER TABLE action_completions ENABLE ROW LEVEL SECURITY;
  -- How-to videos are a Loom link ('loom') or pasted embed code ('embed').
  -- For embed code, url holds the iframe's src and embed_code the original.
  ALTER TABLE videos ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'loom';
  ALTER TABLE videos ADD COLUMN IF NOT EXISTS embed_code TEXT;
`;

// The one staff account. It sees the staff board, approves sign-ups, can open
// any client's page and sets shared content like the how-to videos.
// Every other account is a client.
const STAFF_EMAIL = 'staff@paidcoaching.com';
const isStaff = (user) => user.email === STAFF_EMAIL;

// "Watch how to" videos, shared by all clients.
const VIDEO_KEYS = new Set(['complete-funnel', 'film-ads']);
const LOOM_RE = /^https:\/\/(www\.)?loom\.com\/(share|embed)\/[a-zA-Z0-9]+/;

// Embed code (YouTube, Vimeo, Wistia, Google Drive, …) is never put on client
// pages as-is: the app takes the https address from its <iframe> and builds
// its own player, so pasted code can't run anything else.
const IFRAME_SRC_RE = /<iframe\b[^>]*\ssrc\s*=\s*["']([^"']+)["']/i;

const FORM_KEYS = new Set(['onboarding', 'midweek', 'final-checkin', 'service-feedback']);
// Resources a user can edit their own copy of.
const RESOURCE_KEYS = new Set([
  'main-page-code', 'confirmation-page-code', 'vsl-script', 'ad-scripts',
  'confirmation-page-script', 'faq-video-script',
  // Link the client adds themselves (their Google Drive folder of edited ads).
  'drive-folder',
]);
// Staff's own template copies, only visible to staff. The one exception is a
// shared template: its saved version is what every client sees (read-only).
const TEMPLATE_KEYS = new Set([...RESOURCE_KEYS].filter((key) => key !== 'drive-folder'));
// Staff prompts behind "View prompt" on the Templates page (not the shared one).
for (const key of ['main-page-code', 'confirmation-page-code', 'vsl-script', 'ad-scripts', 'confirmation-page-script']) {
  TEMPLATE_KEYS.add(`prompt-${key}`);
}
const SHARED_TEMPLATE_KEYS = new Set(['faq-video-script']);
// Action items the user ticks off themselves.
const ACTION_KEYS = new Set([
  // Onboarding
  'join-slack', 'review-form', 'review-funnel', 'private-slack',
  // Week 1
  'build-main-page-code', 'build-confirmation-page-code', 'build-vsl-script', 'build-ad-scripts',
  'build-confirmation-page-script', 'build-faq-video-script', 'film-videos', 'complete-funnel', 'film-ads',
  // Week 2
  'pixel-setup', 'conversion-event', 'ads-uploaded', 'ads-live',
  // Week 3
  'review-sales', 'improve-metrics', 'funnel-adjustments', 'review-ads', 'double-down',
  // Week 4 (same steps as Week 3, tracked separately)
  'w4-review-sales', 'w4-improve-metrics', 'w4-funnel-adjustments', 'w4-review-ads', 'w4-double-down',
]);

// Each user's program runs for one calendar month, stored as "YYYY-MM".
// It defaults to the month after the account was created.
function nextMonthAfter(date) {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const PENDING_DAYS = 14;
const pendingCookie = (token, maxAgeSeconds) => `pending=${token}; HttpOnly; Path=/; SameSite=Lax${ON_VERCEL ? '; Secure' : ''}; Max-Age=${maxAgeSeconds}`;

const STATUS_MESSAGES = {
  pending: 'Your account is waiting to be accepted. You\'ll be able to log in once our team approves it.',
  rejected: "Your account wasn't approved. Please contact the Paidcoaching.com team.",
};

// --- Passwords -------------------------------------------------------------
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  const [saltHex, hashHex] = stored.split(':');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

// --- Password reset ---------------------------------------------------------
const RESET_MINUTES = 60;
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

// Emails the reset link via Resend when RESEND_API_KEY is set; otherwise
// prints it to the server log so it can still be used during development.
async function sendResetEmail(email, link) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`Password reset link for ${email}: ${link}`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'Paidcoaching.com <onboarding@resend.dev>',
      to: email,
      subject: 'Reset your Paidcoaching.com password',
      html: `<p>Someone asked to reset the password for your Paidcoaching.com client hub.</p>
<p><a href="${link}">Reset your password</a></p>
<p>This link works once and expires in ${RESET_MINUTES} minutes. If you didn't ask for this, you can ignore this email.</p>`,
    }),
  });
  if (!res.ok) console.error('Reset email failed:', res.status, await res.text());
}

// --- Database setup -----------------------------------------------------------
// Runs once per server instance, before the first request is handled. A fresh
// database has no accounts: if STAFF_PASSWORD is set, the staff account is
// created with it.
async function init() {
  await db.pool.query(SCHEMA);
  if (process.env.STAFF_PASSWORD && !(await db.get('SELECT 1 FROM users WHERE email = ?', STAFF_EMAIL))) {
    const now = new Date();
    await db.run(`
      INSERT INTO users (name, email, password_hash, created_at, program_month, status) VALUES (?, ?, ?, ?, ?, 'approved')
      ON CONFLICT (email) DO NOTHING
    `, 'Paidcoaching Staff', STAFF_EMAIL, hashPassword(process.env.STAFF_PASSWORD), now.toISOString(), nextMonthAfter(now));
  }
}

let ready = null;
function ensureReady() {
  // Retry on the next request if setup failed (e.g. the database was briefly unreachable).
  ready ??= init().catch((err) => { ready = null; throw err; });
  return ready;
}

// --- Sessions --------------------------------------------------------------
async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  await db.run('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)', token, userId, expiresAt);
  return token;
}

function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

async function currentUser(req) {
  const token = parseCookies(req).sid;
  if (!token) return null;
  const row = await db.get(`
    SELECT u.id, u.name, u.email, u.created_at, u.program_month, u.status, s.expires_at
    FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?
  `, token);
  if (!row || row.expires_at < Date.now() || row.status !== 'approved') return null;
  return row;
}

// The user whose data a request reads or writes. Normally the logged-in user;
// staff can act on a client's account by adding ?as=<client id>.
async function subjectUser(req, url) {
  const user = await currentUser(req);
  if (!user) return null;
  const as = url.searchParams.get('as');
  if (!as || !isStaff(user)) return user;
  if (!/^\d+$/.test(as)) return null;
  const client = await db.get(`
    SELECT id, name, email, created_at, program_month, status FROM users WHERE id = ? AND status = 'approved'
  `, Number(as));
  return client && !isStaff(client) ? client : null;
}

async function staffUser(req) {
  const user = await currentUser(req);
  return user && isStaff(user) ? user : null;
}

// Secure (HTTPS-only) when deployed; plain HTTP is fine on localhost.
const COOKIE_FLAGS = `HttpOnly; Path=/; SameSite=Lax${ON_VERCEL ? '; Secure' : ''}`;

function sessionCookie(token, maxAgeSeconds) {
  return `sid=${token}; ${COOKIE_FLAGS}; Max-Age=${maxAgeSeconds}`;
}

// --- HTTP helpers ----------------------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(JSON.stringify(body));
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

// The app's pages, read once at startup. The literal paths let Vercel see these
// files are needed and bundle them with the server.
const PAGES = {
  auth: fs.readFileSync(path.join(__dirname, '..', 'public', 'auth.html')),
  dashboard: fs.readFileSync(path.join(__dirname, '..', 'public', 'dashboard.html')),
  admin: fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html')),
  templates: fs.readFileSync(path.join(__dirname, '..', 'public', 'templates.html')),
};

function sendPage(res, name) {
  res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' });
  res.end(PAGES[name]);
}

// Static assets. On Vercel these are served straight from public/ before
// reaching the server; this covers running locally.
function sendFile(res, file) {
  const full = path.join(PUBLIC_DIR, file);
  if (!full.startsWith(PUBLIC_DIR + path.sep)) return notFound(res);
  fs.readFile(full, (err, data) => {
    if (err) return notFound(res);
    // no-cache: browsers revalidate each time, so updates show up on refresh.
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e5) req.destroy();
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Invalid JSON')); }
    });
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// --- Routes ----------------------------------------------------------------
async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const route = `${req.method} ${url.pathname}`;

  switch (route) {
    case 'GET /':
    case 'GET /login':
    case 'GET /signup':
    case 'GET /forgot':
    case 'GET /reset': {
      const user = await currentUser(req);
      if (user) return redirect(res, isStaff(user) ? '/admin' : '/dashboard');
      if (url.pathname === '/') return redirect(res, '/login');
      return sendPage(res, 'auth');
    }

    case 'GET /dashboard': {
      const user = await currentUser(req);
      if (!user) return redirect(res, '/login');
      if (isStaff(user)) return redirect(res, '/admin');
      return sendPage(res, 'dashboard');
    }

    case 'GET /admin':
      if (!(await staffUser(req))) return redirect(res, (await currentUser(req)) ? '/dashboard' : '/login');
      return sendPage(res, 'admin');

    case 'GET /admin/templates':
      if (!(await staffUser(req))) return redirect(res, (await currentUser(req)) ? '/dashboard' : '/login');
      return sendPage(res, 'templates');

    case 'POST /api/signup': {
      const { name = '', email = '', password = '' } = await readJson(req);
      const cleanName = String(name).trim();
      const cleanEmail = String(email).trim().toLowerCase();
      if (!cleanName) return sendJson(res, 400, { error: 'Please enter your name.' });
      if (!EMAIL_RE.test(cleanEmail)) return sendJson(res, 400, { error: 'Please enter a valid email.' });
      if (String(password).length < 8) return sendJson(res, 400, { error: 'Password must be at least 8 characters.' });
      if (await db.get('SELECT 1 FROM users WHERE email = ?', cleanEmail)) {
        return sendJson(res, 409, { error: 'An account with that email already exists. Try logging in.' });
      }
      const now = new Date();
      const pendingToken = crypto.randomBytes(32).toString('hex');
      await db.run(`
        INSERT INTO users (name, email, password_hash, created_at, program_month, status, pending_token_hash)
        VALUES (?, ?, ?, ?, ?, 'pending', ?)
      `, cleanName, cleanEmail, hashPassword(String(password)), now.toISOString(), nextMonthAfter(now), sha256(pendingToken));
      // No session yet: the account can't be used until staff accept it (the staff
      // board polls for new requests). The pending cookie lets this browser pick
      // up the decision (see signup-status).
      return sendJson(res, 201, { pending: true }, { 'Set-Cookie': pendingCookie(pendingToken, PENDING_DAYS * 86400) });
    }

    case 'GET /api/signup-status': {
      const token = parseCookies(req).pending;
      const user = token && await db.get('SELECT id, name, status FROM users WHERE pending_token_hash = ?', sha256(token));
      if (!user) return sendJson(res, 200, { status: 'none' });
      if (user.status === 'pending') return sendJson(res, 200, { status: 'pending', name: user.name });
      // Decided: the token has done its job either way.
      await db.run('UPDATE users SET pending_token_hash = NULL WHERE id = ?', user.id);
      if (user.status === 'rejected') {
        return sendJson(res, 200, { status: 'rejected', message: STATUS_MESSAGES.rejected }, { 'Set-Cookie': pendingCookie('', 0) });
      }
      const session = await createSession(user.id);
      return sendJson(res, 200, { status: 'approved', name: user.name }, {
        'Set-Cookie': [pendingCookie('', 0), sessionCookie(session, SESSION_DAYS * 86400)],
      });
    }

    case 'POST /api/login': {
      const { email = '', password = '' } = await readJson(req);
      const user = await db.get('SELECT id, email, password_hash, status FROM users WHERE email = ?', String(email).trim().toLowerCase());
      if (!user || !verifyPassword(String(password), user.password_hash)) {
        return sendJson(res, 401, { error: 'Incorrect email or password.' });
      }
      if (user.status !== 'approved') return sendJson(res, 403, { error: STATUS_MESSAGES[user.status], status: user.status });
      const token = await createSession(user.id);
      return sendJson(res, 200, { ok: true, staff: isStaff(user) }, { 'Set-Cookie': sessionCookie(token, SESSION_DAYS * 86400) });
    }

    case 'POST /api/forgot': {
      const { email = '' } = await readJson(req);
      const user = await db.get('SELECT id, email FROM users WHERE email = ?', String(email).trim().toLowerCase());
      // Same response whether or not the account exists, so emails can't be probed.
      if (user) {
        const token = crypto.randomBytes(32).toString('hex');
        await db.run('DELETE FROM password_resets WHERE user_id = ? OR expires_at < ?', user.id, Date.now());
        await db.run('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
          sha256(token), user.id, Date.now() + RESET_MINUTES * 60 * 1000);
        const proto = req.headers['x-forwarded-proto'] || 'http';
        const base = process.env.APP_URL || `${proto}://${req.headers.host}`;
        await sendResetEmail(user.email, `${base}/reset?token=${token}`);
      }
      return sendJson(res, 200, { ok: true });
    }

    case 'POST /api/reset': {
      const { token = '', password = '' } = await readJson(req);
      const row = await db.get('SELECT user_id, expires_at FROM password_resets WHERE token_hash = ?', sha256(String(token)));
      if (!row || row.expires_at < Date.now()) {
        return sendJson(res, 400, { error: 'This reset link has expired or already been used. Please request a new one.' });
      }
      if (String(password).length < 8) return sendJson(res, 400, { error: 'Password must be at least 8 characters.' });
      await db.run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(String(password)), row.user_id);
      // Single use, and log out everywhere else.
      await db.run('DELETE FROM password_resets WHERE user_id = ?', row.user_id);
      await db.run('DELETE FROM sessions WHERE user_id = ?', row.user_id);
      const account = await db.get('SELECT email, status FROM users WHERE id = ?', row.user_id);
      // A reset doesn't skip approval: only approved accounts are logged in.
      if (account.status !== 'approved') return sendJson(res, 200, { ok: true, message: STATUS_MESSAGES[account.status] });
      const session = await createSession(row.user_id);
      return sendJson(res, 200, { ok: true, staff: isStaff(account) }, { 'Set-Cookie': sessionCookie(session, SESSION_DAYS * 86400) });
    }

    case 'POST /api/logout': {
      const token = parseCookies(req).sid;
      if (token) await db.run('DELETE FROM sessions WHERE token = ?', token);
      return sendJson(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', 0) });
    }

    case 'GET /api/me': {
      const viewer = await currentUser(req);
      const user = await subjectUser(req, url);
      if (!viewer || !user) return sendJson(res, 401, { error: 'Not logged in' });
      return sendJson(res, 200, {
        name: user.name,
        email: user.email,
        createdAt: user.created_at,
        programMonth: user.program_month,
        isStaff: isStaff(viewer),
        viewingAs: user.id !== viewer.id,
      });
    }

    case 'GET /api/admin/clients': {
      if (!(await staffUser(req))) return sendJson(res, 403, { error: 'Staff only.' });
      const rows = await db.all(`
        SELECT u.id, u.name, u.email, u.program_month, u.created_at, f.answers
        FROM users u LEFT JOIN form_responses f ON f.user_id = u.id AND f.form_key = 'onboarding'
        WHERE u.status = 'approved' AND u.email != ?
        ORDER BY u.program_month, lower(u.name)
      `, STAFF_EMAIL);
      return sendJson(res, 200, {
        clients: rows.map((r) => ({
          id: r.id,
          name: r.name,
          email: r.email,
          programMonth: r.program_month,
          createdAt: r.created_at,
          niche: r.answers ? JSON.parse(r.answers).niche || null : null,
        })),
      });
    }

    case 'GET /api/admin/pending': {
      if (!(await staffUser(req))) return sendJson(res, 403, { error: 'Staff only.' });
      const rows = await db.all("SELECT id, name, email, created_at FROM users WHERE status = 'pending' ORDER BY created_at");
      return sendJson(res, 200, { pending: rows.map((r) => ({ id: r.id, name: r.name, email: r.email, createdAt: r.created_at })) });
    }

    case 'POST /api/program-month': {
      const user = await subjectUser(req, url);
      if (!user) return sendJson(res, 401, { error: 'Not logged in' });
      const { month = '' } = await readJson(req);
      if (!MONTH_RE.test(month)) return sendJson(res, 400, { error: 'Invalid month.' });
      await db.run('UPDATE users SET program_month = ? WHERE id = ?', month, user.id);
      return sendJson(res, 200, { programMonth: month });
    }
  }

  const decisionMatch = url.pathname.match(/^\/api\/admin\/users\/(\d+)\/decision$/);
  if (req.method === 'POST' && decisionMatch) {
    if (!(await staffUser(req))) return sendJson(res, 403, { error: 'Staff only.' });
    const { approve } = await readJson(req);
    const status = approve ? 'approved' : 'rejected';
    const result = await db.run("UPDATE users SET status = ? WHERE id = ? AND status = 'pending'", status, Number(decisionMatch[1]));
    if (!result.rowCount) return sendJson(res, 404, { error: 'That request was already handled.' });
    return sendJson(res, 200, { status });
  }

  if (route === 'GET /api/actions') {
    const user = await subjectUser(req, url);
    if (!user) return sendJson(res, 401, { error: 'Not logged in' });
    const rows = await db.all('SELECT action_key FROM action_completions WHERE user_id = ?', user.id);
    return sendJson(res, 200, { completed: rows.map((r) => r.action_key) });
  }

  if (route === 'GET /api/videos') {
    if (!(await currentUser(req))) return sendJson(res, 401, { error: 'Not logged in' });
    const rows = await db.all('SELECT video_key, url, kind, embed_code FROM videos');
    return sendJson(res, 200, {
      videos: Object.fromEntries(rows.map((r) => [r.video_key, { url: r.url, kind: r.kind, code: r.embed_code }])),
    });
  }

  // Set a how-to video: { kind: 'loom', url } or { kind: 'embed', code }.
  const videoMatch = url.pathname.match(/^\/api\/videos\/([a-z-]+)$/);
  if (req.method === 'POST' && videoMatch && VIDEO_KEYS.has(videoMatch[1])) {
    if (!(await staffUser(req))) return sendJson(res, 403, { error: 'Only staff can change videos.' });
    const { kind = 'loom', url: rawLink = '', code: rawCode = '' } = await readJson(req);
    let link;
    let code = null;
    if (kind === 'embed') {
      code = String(rawCode).trim().slice(0, 5000);
      link = (IFRAME_SRC_RE.exec(code)?.[1] || '').replace(/&amp;/g, '&');
      if (!/^https:\/\/[^\s<>"']+$/.test(link)) {
        return sendJson(res, 400, { error: 'Paste an embed code that contains an <iframe> with an https link.' });
      }
    } else {
      link = String(rawLink).trim();
      if (!LOOM_RE.test(link)) return sendJson(res, 400, { error: 'Please paste a Loom link (loom.com/share/…).' });
    }
    const savedKind = kind === 'embed' ? 'embed' : 'loom';
    await db.run(`
      INSERT INTO videos (video_key, url, kind, embed_code, updated_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (video_key) DO UPDATE SET url = excluded.url, kind = excluded.kind,
        embed_code = excluded.embed_code, updated_at = excluded.updated_at
    `, videoMatch[1], link, savedKind, code, new Date().toISOString());
    return sendJson(res, 200, { url: link, kind: savedKind, code });
  }

  if (route === 'GET /api/templates') {
    // ?shared: just the shared templates, for client pages. Otherwise staff only.
    const shared = url.searchParams.has('shared');
    if (shared ? !(await currentUser(req)) : !(await staffUser(req))) return sendJson(res, 403, { error: 'Staff only.' });
    const rows = (await db.all('SELECT resource_key, content FROM templates'))
      .filter((r) => !shared || SHARED_TEMPLATE_KEYS.has(r.resource_key));
    return sendJson(res, 200, { templates: Object.fromEntries(rows.map((r) => [r.resource_key, r.content])) });
  }

  const templateMatch = url.pathname.match(/^\/api\/templates\/([a-z-]+)$/);
  if (req.method === 'POST' && templateMatch && TEMPLATE_KEYS.has(templateMatch[1])) {
    if (!(await staffUser(req))) return sendJson(res, 403, { error: 'Staff only.' });
    const { content } = await readJson(req);
    if (typeof content !== 'string' || content.length > 90000) return sendJson(res, 400, { error: 'Invalid content.' });
    await db.run(`
      INSERT INTO templates (resource_key, content, updated_at) VALUES (?, ?, ?)
      ON CONFLICT (resource_key) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at
    `, templateMatch[1], content, new Date().toISOString());
    return sendJson(res, 200, { ok: true });
  }

  if (route === 'GET /api/resources') {
    const user = await subjectUser(req, url);
    if (!user) return sendJson(res, 401, { error: 'Not logged in' });
    const rows = await db.all('SELECT resource_key, content FROM resource_edits WHERE user_id = ?', user.id);
    return sendJson(res, 200, { edits: Object.fromEntries(rows.map((r) => [r.resource_key, r.content])) });
  }

  const resourceMatch = url.pathname.match(/^\/api\/resources\/([a-z-]+)$/);
  if (req.method === 'POST' && resourceMatch && RESOURCE_KEYS.has(resourceMatch[1])) {
    const user = await subjectUser(req, url);
    if (!user) return sendJson(res, 401, { error: 'Not logged in' });
    if (SHARED_TEMPLATE_KEYS.has(resourceMatch[1])) return sendJson(res, 400, { error: 'This one is shared — edit it in Templates.' });
    const { content } = await readJson(req);
    if (typeof content !== 'string' || content.length > 90000) return sendJson(res, 400, { error: 'Invalid content.' });
    await db.run(`
      INSERT INTO resource_edits (user_id, resource_key, content, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT (user_id, resource_key) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at
    `, user.id, resourceMatch[1], content, new Date().toISOString());
    return sendJson(res, 200, { ok: true });
  }

  const actionMatch = url.pathname.match(/^\/api\/actions\/([a-z-]+)$/);
  if (req.method === 'POST' && actionMatch && ACTION_KEYS.has(actionMatch[1])) {
    const user = await subjectUser(req, url);
    if (!user) return sendJson(res, 401, { error: 'Not logged in' });
    const { done } = await readJson(req);
    if (done) {
      await db.run(`
        INSERT INTO action_completions (user_id, action_key, completed_at) VALUES (?, ?, ?)
        ON CONFLICT (user_id, action_key) DO NOTHING
      `, user.id, actionMatch[1], new Date().toISOString());
    } else {
      await db.run('DELETE FROM action_completions WHERE user_id = ? AND action_key = ?', user.id, actionMatch[1]);
    }
    return sendJson(res, 200, { key: actionMatch[1], done: Boolean(done) });
  }

  const formMatch = url.pathname.match(/^\/api\/forms\/([a-z-]+)$/);
  if (formMatch && FORM_KEYS.has(formMatch[1])) {
    const user = await subjectUser(req, url);
    if (!user) return sendJson(res, 401, { error: 'Not logged in' });
    const formKey = formMatch[1];

    if (req.method === 'GET') {
      const row = await db.get('SELECT answers, submitted_at FROM form_responses WHERE user_id = ? AND form_key = ?', user.id, formKey);
      return sendJson(res, 200, row ? { answers: JSON.parse(row.answers), submittedAt: row.submitted_at } : { answers: null });
    }

    if (req.method === 'POST') {
      const { answers } = await readJson(req);
      const entries = answers && typeof answers === 'object' && !Array.isArray(answers) ? Object.entries(answers) : null;
      const valid = entries && entries.length > 0 && entries.length <= 50 &&
        entries.every(([k, v]) => /^[\w-]{1,40}$/.test(k) && typeof v === 'string' && v.length <= 5000);
      if (!valid) return sendJson(res, 400, { error: 'Invalid answers.' });
      const submittedAt = new Date().toISOString();
      await db.run(`
        INSERT INTO form_responses (user_id, form_key, answers, submitted_at) VALUES (?, ?, ?, ?)
        ON CONFLICT (user_id, form_key) DO UPDATE SET answers = excluded.answers, submitted_at = excluded.submitted_at
      `, user.id, formKey, JSON.stringify(Object.fromEntries(entries)), submittedAt);
      return sendJson(res, 200, { answers: Object.fromEntries(entries), submittedAt });
    }
  }

  // A client's page, opened from the staff board.
  if (req.method === 'GET' && /^\/admin\/clients\/\d+$/.test(url.pathname)) {
    if (!(await staffUser(req))) return redirect(res, (await currentUser(req)) ? '/dashboard' : '/login');
    return sendPage(res, 'dashboard');
  }

  if (req.method === 'GET' && /^\/[\w.-]+\.(css|js|png|svg)$/.test(url.pathname)) {
    return sendFile(res, url.pathname.slice(1));
  }
  return notFound(res);
}

function handler(req, res) {
  return ensureReady().then(() => handle(req, res)).catch((err) => {
    console.error(err);
    if (!res.headersSent) sendJson(res, 500, { error: 'Something went wrong.' });
  });
}

module.exports = handler;
