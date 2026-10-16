const form = document.getElementById('auth-form');
const errorEl = document.getElementById('form-error');
const submitBtn = document.getElementById('submit-btn');

const successEl = document.getElementById('form-success');
const resetToken = new URLSearchParams(location.search).get('token');

const MODES = {
  login: {
    title: 'Welcome back',
    subtitle: 'Log in to your client hub.',
    button: 'Log in',
    switchText: "Don't have an account yet?",
    switchLabel: 'Create one',
    switchHref: '/signup',
    endpoint: '/api/login',
    fields: ['email', 'password'],
  },
  signup: {
    title: 'Create your account',
    subtitle: 'Set up your login to access your client hub.',
    button: 'Create account',
    switchText: 'Already have an account?',
    switchLabel: 'Log in',
    switchHref: '/login',
    endpoint: '/api/signup',
    fields: ['name', 'email', 'password'],
  },
  forgot: {
    title: 'Forgot your password?',
    subtitle: "Enter your email and we'll send you a link to reset it.",
    button: 'Send reset link',
    switchText: 'Remembered it?',
    switchLabel: 'Back to log in',
    switchHref: '/login',
    endpoint: '/api/forgot',
    fields: ['email'],
  },
  reset: {
    title: 'Set a new password',
    subtitle: 'Choose a new password for your client hub.',
    button: 'Save new password',
    switchText: 'Remembered it?',
    switchLabel: 'Back to log in',
    switchHref: '/login',
    endpoint: '/api/reset',
    fields: ['password'],
  },
};

let mode = location.pathname.slice(1);
if (!MODES[mode] || (mode === 'reset' && !resetToken)) mode = 'login';

function render() {
  const m = MODES[mode];
  document.getElementById('auth-title').textContent = m.title;
  document.getElementById('auth-subtitle').textContent = m.subtitle;
  document.getElementById('switch-text').textContent = m.switchText;
  const link = document.getElementById('switch-link');
  link.textContent = m.switchLabel;
  link.href = m.switchHref;
  submitBtn.textContent = m.button;
  submitBtn.disabled = false;
  form.hidden = false;
  document.getElementById('name-field').hidden = !m.fields.includes('name');
  document.getElementById('email-field').hidden = !m.fields.includes('email');
  document.getElementById('password-field').hidden = !m.fields.includes('password');
  document.getElementById('forgot-link').hidden = mode !== 'login';
  document.getElementById('password-label').textContent = mode === 'reset' ? 'New password' : 'Password';
  form.password.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  errorEl.textContent = '';
  successEl.textContent = '';
}

function switchMode(next) {
  mode = next;
  history.replaceState(null, '', `/${mode}`);
  render();
}

document.getElementById('switch-link').addEventListener('click', (e) => {
  e.preventDefault();
  switchMode(MODES[mode].switchHref.slice(1));
});

document.getElementById('forgot-link').addEventListener('click', (e) => {
  e.preventDefault();
  switchMode('forgot');
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.textContent = '';
  successEl.textContent = '';
  submitBtn.disabled = true;

  const payload = {};
  if (mode !== 'reset') payload.email = form.email.value;
  if (mode !== 'forgot') payload.password = form.password.value;
  if (mode === 'signup') payload.name = form.name.value;
  if (mode === 'reset') payload.token = resetToken;

  try {
    const res = await fetch(MODES[mode].endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Something went wrong.');
    if (mode === 'signup' && data.pending) {
      showWaiting(payload.name);
      return;
    }
    if (data.message) {
      // Password changed, but the account still needs approval.
      form.hidden = true;
      document.getElementById('auth-subtitle').textContent = `Your password has been updated. ${data.message}`;
      return;
    }
    if (mode === 'forgot') {
      form.hidden = true;
      successEl.textContent = '';
      document.getElementById('auth-subtitle').textContent =
        `If there's an account for ${payload.email.trim()}, we've sent a reset link. It expires in 1 hour — check your spam folder if you don't see it.`;
      return;
    }
    location.href = data.staff ? '/admin' : '/dashboard';
  } catch (err) {
    errorEl.textContent = err.message;
    submitBtn.disabled = false;
  }
});

// ---- Waiting for approval ---------------------------------------------------
// After signing up, this browser checks every few seconds whether staff have
// accepted the account, and logs straight in when they have.
let statusTimer = null;

function showWaiting(name) {
  form.hidden = true;
  document.querySelector('.auth-switch').hidden = true;
  document.getElementById('auth-title').textContent = 'Waiting to be accepted';
  document.getElementById('auth-subtitle').textContent =
    `Thanks, ${name.trim().split(' ')[0]}! Your account has been sent to our team for approval. ` +
    "Keep this page open — it'll take you straight in as soon as you're accepted.";
  document.querySelector('.auth-card').classList.add('auth-waiting');
  clearInterval(statusTimer);
  statusTimer = setInterval(checkStatus, 4000);
}

async function checkStatus() {
  let data;
  try {
    data = await (await fetch('/api/signup-status')).json();
  } catch {
    return; // Offline for a moment; try again next tick.
  }
  if (data.status === 'pending') {
    if (!statusTimer) showWaiting(data.name);
    return;
  }
  clearInterval(statusTimer);
  statusTimer = null;
  const card = document.querySelector('.auth-card');
  if (data.status === 'approved') {
    card.classList.remove('auth-waiting');
    card.classList.add('auth-accepted');
    document.getElementById('auth-title').textContent = "You're in!";
    document.getElementById('auth-subtitle').textContent = 'Your account has been accepted. Taking you to your hub…';
    setTimeout(() => { location.href = '/dashboard'; }, 1500);
  } else if (data.status === 'rejected') {
    card.classList.remove('auth-waiting');
    document.getElementById('auth-title').textContent = 'Not approved';
    document.getElementById('auth-subtitle').textContent = data.message;
  }
}

const togglePassword = document.getElementById('toggle-password');
togglePassword.addEventListener('click', () => {
  const show = form.password.type === 'password';
  form.password.type = show ? 'text' : 'password';
  togglePassword.setAttribute('aria-pressed', String(show));
  togglePassword.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  form.password.focus();
});

render();
// Came back after signing up? Pick up where they left off.
checkStatus();
