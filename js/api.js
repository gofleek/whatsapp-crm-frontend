// ---- API base ----
// Frontend (Vercel) and backend (Railway) are on different domains now,
// so every request needs an absolute URL. API_BASE_URL comes from config.js
// (loaded before this file in every HTML page) - edit it there.
const API_BASE = API_BASE_URL;

function getToken() {
  return localStorage.getItem('crm_token');
}
function getUser() {
  const raw = localStorage.getItem('crm_user');
  return raw ? JSON.parse(raw) : null;
}
function setSession(token, user) {
  localStorage.setItem('crm_token', token);
  localStorage.setItem('crm_user', JSON.stringify(user));
}
function clearSession() {
  localStorage.removeItem('crm_token');
  localStorage.removeItem('crm_user');
}

/**
 * Generic authenticated API call.
 * Throws an Error with `.message` set from the server's JSON body on failure.
 */
async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(API_BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  let data;
  try {
    data = await res.json();
  } catch (e) {
    data = { success: false, message: 'Unexpected server response' };
  }

  if (!res.ok || data.success === false) {
    if (res.status === 401) {
      clearSession();
      window.location.href = '/index.html';
    }
    throw new Error(data.message || 'Request failed');
  }

  return data;
}

/** Redirects to login if no session, or to the right dashboard if role mismatches. */
function guardPage(requiredRole) {
  const user = getUser();
  const token = getToken();
  if (!token || !user) {
    window.location.href = '/index.html';
    return null;
  }
  if (requiredRole && user.role !== requiredRole) {
    window.location.href = roleHome(user.role);
    return null;
  }
  return user;
}

function roleHome(role) {
  if (role === 'admin') return '/admin.html';
  if (role === 'traffic_manager') return '/traffic.html';
  if (role === 'salesman') return '/salesman.html';
  return '/index.html';
}

function logout() {
  clearSession();
  window.location.href = '/index.html';
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function formatClock(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

function showToast(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}
