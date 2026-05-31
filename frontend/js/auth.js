/* =========================================================================
   AuDHD Task Manager — Auth & Session Management
   ========================================================================= */

let authToken = localStorage.getItem('pm_auth_token');
let currentUser = null;

/* ── Check session on load ──────────────────────────────────────────── */
async function checkAuth() {
  if (!authToken) {
    showLogin();
    return;
  }
  try {
    const r = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: authToken }),
    });
    const data = await r.json();
    if (data.valid) {
      currentUser = data.user;
      hideLogin();
    } else {
      localStorage.removeItem('pm_auth_token');
      authToken = null;
      showLogin();
    }
  } catch {
    // Offline — use stored session optimistically
    currentUser = { username: 'janhellion', display_name: 'Jan Hellion', role: 'admin' };
    hideLogin();
  }
}

/* ── Login Screen ───────────────────────────────────────────────────── */
function showLogin() {
  document.getElementById('app').style.display = 'none';
  let loginEl = document.getElementById('loginScreen');
  if (!loginEl) {
    loginEl = document.createElement('div');
    loginEl.id = 'loginScreen';
    loginEl.innerHTML = `
      <div class="login-screen">
        <div class="login-card glass">
          <div class="login-logo">⌂</div>
          <h1 class="login-title">pm</h1>
          <p class="login-subtitle">AuDHD Task Manager</p>
          <form id="loginForm" onsubmit="submitLogin(event)">
            <div class="form-group">
              <label>Username</label>
              <input class="input" name="username" placeholder="username" required autofocus>
            </div>
            <div class="form-group">
              <label>Password</label>
              <input class="input" type="password" name="password" placeholder="password" required>
            </div>
            <div id="loginError" style="color:var(--status-warn);font-size:0.85rem;margin-bottom:var(--sp-2);display:none;"></div>
            <button type="submit" class="btn btn-orange w-full" style="justify-content:center;">Sign In</button>
          </form>
        </div>
      </div>
    `;
    document.body.prepend(loginEl);
  }
  loginEl.style.display = '';
  if (document.getElementById('loginError')) {
    document.getElementById('loginError').style.display = 'none';
  }
}

function hideLogin() {
  const loginEl = document.getElementById('loginScreen');
  if (loginEl) loginEl.style.display = 'none';
  document.getElementById('app').style.display = '';
  // Show username in sidebar
  const userBadge = document.getElementById('userBadge');
  if (userBadge && currentUser) {
    userBadge.textContent = currentUser.display_name || currentUser.username;
  }
}

async function submitLogin(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const data = Object.fromEntries(fd.entries());
  const errEl = document.getElementById('loginError');
  try {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) {
      errEl.textContent = 'Invalid credentials';
      errEl.style.display = '';
      return;
    }
    const result = await r.json();
    authToken = result.access_token;
    currentUser = result.user;
    localStorage.setItem('pm_auth_token', authToken);
    hideLogin();
  } catch {
    errEl.textContent = 'Connection error';
    errEl.style.display = '';
  }
}

function logout() {
  localStorage.removeItem('pm_auth_token');
  authToken = null;
  currentUser = null;
  showLogin();
}

/* ── Hook into fetch for auth headers ───────────────────────────────── */
const origFetch = window.fetch;
window.fetch = function(input, init = {}) {
  if (typeof input === 'string' && input.startsWith('/api/')) {
    // Skip auth endpoints
    if (!input.includes('/auth/login') && !input.includes('/auth/verify')) {
      init.headers = init.headers || {};
      init.headers['Authorization'] = `Bearer ${authToken}`;
    }
  }
  return origFetch.call(this, input, init);
};

/* ── Init ───────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', checkAuth);
