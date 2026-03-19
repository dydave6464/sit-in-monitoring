const API = 'http://localhost:3000/api';

// ── GET TOKEN ─────────────────────────────────────────────────
function getToken() {
  return localStorage.getItem('token');
}

// ── GET LOGGED IN USER ────────────────────────────────────────
function getUser() {
  const user = localStorage.getItem('loggedInUser');
  return user ? JSON.parse(user) : null;
}

// ── CLEAR SESSION ─────────────────────────────────────────────
function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('loggedInUser');
}

// ── BASE FETCH HELPER ─────────────────────────────────────────
// Automatically attaches token to every request
async function apiFetch(endpoint, options = {}) {
  const token = getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${API}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json();
  return { res, data };
}

// ── REDIRECT BASED ON ROLE ────────────────────────────────────
function redirectByRole(role) {
  if (role === 'admin') {
    window.location.href = '/admin/dashboard.html';
  } else {
    window.location.href = '/student/dashboard.html';
  }
}

// ── GUARD: STUDENT ONLY ───────────────────────────────────────
// Call at top of student pages
function requireStudent() {
  const user = getUser();
  const token = getToken();
  if (!token || !user) {
    window.location.href = '/index.html';
    return null;
  }
  if (user.role !== 'student') {
    window.location.href = '/admin/dashboard.html';
    return null;
  }
  return user;
}

// ── GUARD: ADMIN ONLY ─────────────────────────────────────────
// Call at top of admin pages
function requireAdmin() {
  const user = getUser();
  const token = getToken();
  if (!token || !user) {
    window.location.href = '/index.html';
    return null;
  }
  if (user.role !== 'admin') {
    window.location.href = '/student/dashboard.html';
    return null;
  }
  return user;
}
