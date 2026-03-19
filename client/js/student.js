// ── GUARD ─────────────────────────────────────────────────────
const user = requireStudent();
if (!user) throw new Error('Not authenticated');

// ── ELEMENTS ──────────────────────────────────────────────────
const sitInForm = document.getElementById('sitInForm');
const formSection = document.getElementById('formSection');
const activeSection = document.getElementById('activeSection');
const receiptModal = document.getElementById('receiptModal');
const welcomeName = document.getElementById('welcomeName');
const remainingSessions = document.getElementById('remainingSessions');

// ── TOAST ─────────────────────────────────────────────────────
function showToast(message, type = 'error') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add('toast-show'), 10);
  setTimeout(() => {
    toast.classList.remove('toast-show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ── FORMAT DATE ───────────────────────────────────────────────
function formatDate(dateStr) {
  const date = new Date(dateStr);
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  const datePart = date.toLocaleDateString('en-US', options);
  const hours = String(date.getHours()).padStart(2, '0');
  const mins = String(date.getMinutes()).padStart(2, '0');
  return `${datePart} - ${hours}:${mins}`;
}

// ── POPULATE RECEIPT ──────────────────────────────────────────
function showReceipt(session) {
  document.getElementById('rcptIdNumber').textContent = session.id_number;
  document.getElementById('rcptName').textContent = session.student_name;
  document.getElementById('rcptPurpose').textContent = session.purpose;
  document.getElementById('rcptLab').textContent = session.lab;
  document.getElementById('rcptDate').textContent = formatDate(
    session.created_at,
  );
  document.getElementById('rcptStatus').textContent = 'Active';
  receiptModal.classList.remove('hidden');
}

// ── SHOW ACTIVE SESSION VIEW ──────────────────────────────────
function showActiveView(session) {
  formSection.classList.add('hidden');
  activeSection.classList.remove('hidden');
  showReceipt(session);
}

// ── SHOW FORM VIEW ────────────────────────────────────────────
function showFormView() {
  formSection.classList.remove('hidden');
  activeSection.classList.add('hidden');
  receiptModal.classList.add('hidden');
}

// ── LOAD DASHBOARD ────────────────────────────────────────────
async function loadDashboard() {
  // Set welcome message
  welcomeName.textContent = `${user.first_name} ${user.last_name}`;
  remainingSessions.textContent = user.remaining_sessions;

  try {
    // Check if student has an active session
    const { res, data } = await apiFetch('/sitin/active');

    if (!res.ok) {
      showToast('Failed to load session data.', 'error');
      return;
    }

    if (data.session) {
      // Already has active session — show receipt directly
      showActiveView(data.session);
    } else {
      showFormView();
    }
  } catch (err) {
    showToast('Cannot connect to server.', 'error');
  }
}

// ── SUBMIT SIT-IN FORM ────────────────────────────────────────
if (sitInForm) {
  sitInForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const purpose = document.getElementById('purpose').value.trim();
    const lab = document.getElementById('lab').value.trim();

    if (!purpose) {
      showToast('Please enter your purpose.', 'error');
      return;
    }
    if (!lab) {
      showToast('Please enter the lab number.', 'error');
      return;
    }

    try {
      const { res, data } = await apiFetch('/sitin/start', {
        method: 'POST',
        body: JSON.stringify({ purpose, lab }),
      });

      if (!res.ok) {
        showToast(data.message, 'error');
        return;
      }

      // Update remaining sessions display
      remainingSessions.textContent = data.remaining_sessions;

      // Update stored user
      const updatedUser = {
        ...user,
        remaining_sessions: data.remaining_sessions,
      };
      localStorage.setItem('loggedInUser', JSON.stringify(updatedUser));

      showToast('Sit-in started!', 'success');
      showActiveView(data.session);
      startHeartbeat();
    } catch (err) {
      showToast('Cannot connect to server.', 'error');
    }
  });
}

// ── LOGOUT (end sit-in) ───────────────────────────────────────
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async function () {
    if (
      !confirm('Are you sure you want to log out? This will deduct 1 session.')
    )
      return;

    try {
      const { res, data } = await apiFetch('/sitin/end', { method: 'POST' });

      if (!res.ok) {
        showToast(data.message, 'error');
        return;
      }

      stopHeartbeat();
      clearSession();
      showToast('Logged out successfully. Session deducted.', 'success');
      setTimeout(() => (window.location.href = '/index.html'), 1200);
    } catch (err) {
      showToast('Cannot connect to server.', 'error');
    }
  });
}

// ── HEARTBEAT ─────────────────────────────────────────────────
let heartbeatInterval = null;

function startHeartbeat() {
  // Send immediately then every 30 seconds
  sendHeartbeat();
  heartbeatInterval = setInterval(sendHeartbeat, 30000);
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

async function sendHeartbeat() {
  try {
    await apiFetch('/sitin/heartbeat', { method: 'POST' });
  } catch (err) {
    console.warn('Heartbeat failed:', err);
  }
}

// ── WARN BEFORE CLOSING TAB ───────────────────────────────────
window.addEventListener('beforeunload', function (e) {
  const session = document.getElementById('receiptModal');
  if (session && !session.classList.contains('hidden')) {
    e.preventDefault();
    e.returnValue =
      'You have an active sit-in session. Please log out properly so your session is recorded.';
  }
});

// ── INIT ──────────────────────────────────────────────────────
loadDashboard();
