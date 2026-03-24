// ── GUARD ─────────────────────────────────────────────────────
const user = requireAdmin();
if (!user) throw new Error('Not authenticated');

// Set admin name in sidebar
document.getElementById('sidebarAdminName').textContent =
  user.first_name + ' ' + user.last_name;

// ── NAVIGATION ────────────────────────────────────────────────
const navItems = document.querySelectorAll('.nav-item[data-section]');
const subItems = document.querySelectorAll('.nav-sub-item[data-section]');
const sections = document.querySelectorAll('.content-section');
const topbarTitle = document.getElementById('topbarTitle');
const sectionTitles = {
  dashboard: 'Dashboard',
  students: 'Students Information',
  'sitin-records': 'Sit-in Records',
  reports: 'Sit-in Reports',
  feedback: 'Feedback Reports',
  reservation: 'Reservations',
};

function showSection(sectionId) {
  sections.forEach((s) => s.classList.remove('active'));
  navItems.forEach((n) => n.classList.remove('active'));
  subItems.forEach((n) => n.classList.remove('active'));

  // Always reset records dropdown highlight
  document.getElementById('recordsDropBtn').classList.remove('active');
  document.querySelector('.nav-dropdown').classList.remove('open');

  const target = document.getElementById('section-' + sectionId);
  if (target) target.classList.add('active');

  const matchNav = document.querySelector(
    `.nav-item[data-section="${sectionId}"]`,
  );
  const matchSub = document.querySelector(
    `.nav-sub-item[data-section="${sectionId}"]`,
  );
  if (matchNav) matchNav.classList.add('active');
  if (matchSub) {
    matchSub.classList.add('active');
    document.getElementById('recordsDropBtn').classList.add('active');
    document.querySelector('.nav-dropdown').classList.add('open');
  }

  topbarTitle.textContent = sectionTitles[sectionId] || 'Dashboard';

  // Show search only on dashboard
  const topbarSearch = document.querySelector('.topbar-search');
  if (topbarSearch) {
    topbarSearch.style.display = sectionId === 'dashboard' ? 'flex' : 'none';
  }

  // Load section data
  if (sectionId === 'students') loadStudents();
  if (sectionId === 'sitin-records') loadRecords();
  if (sectionId === 'reports') { loadReports(); loadReportsLog(); }
  if (sectionId === 'feedback') loadFeedback();
  if (sectionId === 'dashboard') loadAnnouncements();
}

navItems.forEach((item) => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    showSection(item.dataset.section);
  });
});

subItems.forEach((item) => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    showSection(item.dataset.section);
  });
});

// Records dropdown toggle
document.getElementById('recordsDropBtn').addEventListener('click', () => {
  document.querySelector('.nav-dropdown').classList.toggle('open');
});

// Sidebar toggle (mobile)
document.getElementById('sidebarToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

// ── PROFILE DROPDOWN ─────────────────────────────────────────
const profileBtn = document.getElementById('adminProfileBtn');
const profileMenu = document.getElementById('profileMenu');

profileBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  profileMenu.classList.toggle('open');
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.admin-profile-dropdown')) {
    profileMenu.classList.remove('open');
  }
});

// ── LOGOUT ────────────────────────────────────────────────────
document.getElementById('adminLogoutBtn').addEventListener('click', async () => {
  const ok = await showConfirm({
    title: 'Log out?',
    message: 'You will be redirected to the login page.',
    confirmText: 'Log out',
    type: 'info',
  });
  if (!ok) return;
  clearSession();
  window.location.href = '/index.html';
});

// ── CHANGE PASSWORD ──────────────────────────────────────────
const pwModal = document.getElementById('changePasswordModal');

document.getElementById('changePasswordBtn').addEventListener('click', () => {
  profileMenu.classList.remove('open');
  document.getElementById('currentPassword').value = '';
  document.getElementById('newPassword').value = '';
  document.getElementById('confirmPassword').value = '';
  pwModal.classList.remove('hidden');
});

document.getElementById('closePasswordModal').addEventListener('click', () => pwModal.classList.add('hidden'));
document.getElementById('cancelPasswordModal').addEventListener('click', () => pwModal.classList.add('hidden'));
pwModal.addEventListener('click', (e) => { if (e.target === pwModal) pwModal.classList.add('hidden'); });

document.getElementById('savePasswordBtn').addEventListener('click', async () => {
  const current_password = document.getElementById('currentPassword').value;
  const new_password = document.getElementById('newPassword').value;
  const confirm_password = document.getElementById('confirmPassword').value;

  if (!current_password || !new_password || !confirm_password) {
    showToast('All fields are required.', 'error');
    return;
  }
  if (new_password.length < 6) {
    showToast('New password must be at least 6 characters.', 'error');
    return;
  }
  if (new_password !== confirm_password) {
    showToast('New passwords do not match.', 'error');
    return;
  }

  try {
    const { res, data } = await apiFetch('/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify({ current_password, new_password }),
    });

    if (!res.ok) {
      showToast(data.message || 'Failed to change password.', 'error');
      return;
    }

    pwModal.classList.add('hidden');
    showToast('Password changed successfully!', 'success');
  } catch (err) {
    showToast('Cannot connect to server.', 'error');
  }
});

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
  if (!dateStr) return '--';
  const date = new Date(dateStr);
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  const datePart = date.toLocaleDateString('en-US', options);
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${datePart} - ${h}:${m}`;
}

// ── SSE: LIVE DASHBOARD ───────────────────────────────────────
function startSSE() {
  const token = getToken();
  const evtSource = new EventSource(
    `${window.location.origin}/api/admin/sse?token=${token}`,
  );

  evtSource.onmessage = function (e) {
    const { active, stats } = JSON.parse(e.data);
    updateStats(stats);
    updateLiveTable(active);
  };

  evtSource.onerror = function () {
    console.warn('SSE connection lost, retrying...');
  };
}

function updateStats(stats) {
  document.getElementById('statStudents').textContent = stats.total_students;
  document.getElementById('statActive').textContent = stats.currently_sitin;
  document.getElementById('statTotal').textContent = stats.total_sitin;
}

function updateLiveTable(active) {
  const tbody = document.getElementById('liveTableBody');
  if (!active || active.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" class="empty-row">No active sit-in sessions</td></tr>';
    return;
  }
  tbody.innerHTML = active
    .map(
      (s) => `
    <tr>
      <td>${s.id_number}</td>
      <td>${s.student_name}</td>
      <td>${s.purpose}</td>
      <td>${s.lab}</td>
      <td>${formatDate(s.created_at)}</td>
    </tr>
  `,
    )
    .join('');
}

// ── ANNOUNCEMENTS ─────────────────────────────────────────────
async function loadAnnouncements() {
  try {
    const { res, data } = await apiFetch('/announcements');
    if (!res.ok) return;
    renderAnnouncements(data.announcements);
  } catch (err) {
    console.error('Load announcements error:', err);
  }
}

function renderAnnouncements(list) {
  const container = document.getElementById('announceList');
  if (!list || list.length === 0) {
    container.innerHTML = '<div class="empty-row">No announcements yet.</div>';
    return;
  }
  container.innerHTML = list
    .map(
      (a) => `
    <div class="announce-item" data-id="${a.id}">
      <div class="announce-item-header">
        <div class="announce-item-title">${a.title}</div>
        <div class="announce-item-date">${formatDate(a.created_at)}</div>
      </div>
      <div class="announce-item-body">${a.body}</div>
      <button class="btn-delete-announce" onclick="deleteAnnouncement(${a.id})">Delete</button>
    </div>
  `,
    )
    .join('');
}

document
  .getElementById('postAnnounceBtn')
  .addEventListener('click', async () => {
    const title = document.getElementById('announceTitle').value.trim();
    const body = document.getElementById('announceBody').value.trim();
    if (!title || !body) {
      showToast('Title and body are required.', 'error');
      return;
    }

    try {
      const { res, data } = await apiFetch('/announcements', {
        method: 'POST',
        body: JSON.stringify({ title, body }),
      });
      if (!res.ok) {
        showToast(data.message, 'error');
        return;
      }
      document.getElementById('announceTitle').value = '';
      document.getElementById('announceBody').value = '';
      showToast('Announcement posted!', 'success');
      loadAnnouncements();
    } catch (err) {
      showToast('Cannot connect to server.', 'error');
    }
  });

async function deleteAnnouncement(id) {
  const ok = await showConfirm({
    title: 'Delete announcement?',
    message: 'This announcement will be permanently removed.',
    confirmText: 'Delete',
    type: 'danger',
  });
  if (!ok) return;
  try {
    const { res, data } = await apiFetch(`/announcements/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      showToast(data.message, 'error');
      return;
    }
    showToast('Announcement deleted.', 'success');
    loadAnnouncements();
  } catch (err) {
    showToast('Cannot connect to server.', 'error');
  }
}

// ── STUDENTS ──────────────────────────────────────────────────
let allStudents = [];

async function loadStudents() {
  try {
    const { res, data } = await apiFetch('/admin/students');
    if (!res.ok) {
      showToast('Failed to load students.', 'error');
      return;
    }
    allStudents = data.students;
    studentsPage = 1;
    renderStudentsPaginated();
  } catch (err) {
    showToast('Cannot connect to server.', 'error');
  }
}

function renderStudents(list) {
  const tbody = document.getElementById('studentsTableBody');
  if (!list || list.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="6" class="empty-row">No students registered yet.</td></tr>';
    return;
  }
  tbody.innerHTML = list
    .map(
      (s) => `
    <tr>
      <td>${s.id_number}</td>
      <td>${s.last_name}, ${s.first_name}</td>
      <td>${s.course_level || '--'}</td>
      <td>${s.course || '--'}</td>
      <td>${s.remaining_sessions}</td>
      <td>
        <button class="btn-edit" onclick="openEditModal('${s.id_number}', '${s.last_name}, ${s.first_name}', ${s.remaining_sessions})">Edit</button>
        <button class="btn-delete" onclick="deleteStudent('${s.id_number}')">Delete</button>
      </td>
    </tr>
  `,
    )
    .join('');
}

// Search
document.getElementById('studentSearch').addEventListener('input', function () {
  studentsPage = 1;
  renderStudentsPaginated();
});

// Reset all sessions
document.getElementById('resetAllBtn').addEventListener('click', async () => {
  const ok = await showConfirm({
    title: 'Reset all sessions?',
    message: 'This will set every student\'s remaining sessions back to 30.',
    confirmText: 'Reset All',
    type: 'danger',
  });
  if (!ok) return;
  try {
    // Update each student's sessions to 30
    const promises = allStudents.map((s) =>
      apiFetch(`/admin/students/${s.id_number}/sessions`, {
        method: 'PUT',
        body: JSON.stringify({ remaining_sessions: 30 }),
      }),
    );
    await Promise.all(promises);
    showToast('All sessions reset to 30!', 'success');
    loadStudents();
  } catch (err) {
    showToast('Cannot connect to server.', 'error');
  }
});

// Edit sessions modal
function openEditModal(id_number, name, sessions) {
  document.getElementById('editStudentId').value = id_number;
  document.getElementById('editStudentName').textContent = name;
  document.getElementById('editSessionsInput').value = sessions;
  document.getElementById('editSessionModal').classList.remove('hidden');
}

document
  .getElementById('closeEditModal')
  .addEventListener('click', () =>
    document.getElementById('editSessionModal').classList.add('hidden'),
  );
document
  .getElementById('closeEditModal2')
  .addEventListener('click', () =>
    document.getElementById('editSessionModal').classList.add('hidden'),
  );

document
  .getElementById('saveSessionsBtn')
  .addEventListener('click', async () => {
    const id_number = document.getElementById('editStudentId').value;
    const remaining_sessions = parseInt(
      document.getElementById('editSessionsInput').value,
    );
    if (isNaN(remaining_sessions) || remaining_sessions < 0) {
      showToast('Enter a valid session number.', 'error');
      return;
    }
    try {
      const { res, data } = await apiFetch(
        `/admin/students/${id_number}/sessions`,
        {
          method: 'PUT',
          body: JSON.stringify({ remaining_sessions }),
        },
      );
      if (!res.ok) {
        showToast(data.message, 'error');
        return;
      }
      document.getElementById('editSessionModal').classList.add('hidden');
      showToast('Sessions updated!', 'success');
      loadStudents();
    } catch (err) {
      showToast('Cannot connect to server.', 'error');
    }
  });

// Delete student
async function deleteStudent(id_number) {
  const ok = await showConfirm({
    title: 'Delete student?',
    message: `Student ${id_number} and all their records will be permanently deleted.`,
    confirmText: 'Delete',
    type: 'danger',
  });
  if (!ok) return;
  try {
    const { res, data } = await apiFetch(`/admin/students/${id_number}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      showToast(data.message, 'error');
      return;
    }
    showToast('Student deleted.', 'success');
    loadStudents();
  } catch (err) {
    showToast('Cannot connect to server.', 'error');
  }
}

// ── RECORDS ───────────────────────────────────────────────────
let allRecords = [];

async function loadRecords() {
  try {
    const { res, data } = await apiFetch('/admin/records');
    if (!res.ok) {
      showToast('Failed to load records.', 'error');
      return;
    }
    allRecords = data.records;
    recordsPage = 1;
    renderRecordsPaginated();
  } catch (err) {
    showToast('Cannot connect to server.', 'error');
  }
}

function renderRecords(list) {
  const tbody = document.getElementById('recordsTableBody');
  if (!list || list.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="8" class="empty-row">No records yet.</td></tr>';
    return;
  }
  tbody.innerHTML = list
    .map(
      (r) => `
    <tr>
      <td>${r.id}</td>
      <td>${r.id_number}</td>
      <td>${r.student_name}</td>
      <td>${r.purpose}</td>
      <td>${r.lab}</td>
      <td>${r.remaining_sessions !== undefined ? r.remaining_sessions : '--'}</td>
      <td><span class="status-badge status-${r.status}">${r.status}</span></td>
      <td>${r.status === 'active' ? `<button class="btn-danger-sm" onclick="adminLogoutSession(${r.id})">Logout</button>` : '--'}</td>
    </tr>
  `,
    )
    .join('');
}

async function adminLogoutSession(sessionId) {
  const ok = await showConfirm({
    title: 'End sit-in session?',
    message: 'This will log out the student from their current session.',
    confirmText: 'End Session',
    type: 'warning',
  });
  if (!ok) return;
  try {
    const { res, data } = await apiFetch(`/admin/sitin/${sessionId}/end`, {
      method: 'POST',
    });
    if (!res.ok) {
      showToast(data.message || 'Failed to end session.', 'error');
      return;
    }
    showToast(data.message, 'success');
    loadRecords();
  } catch (err) {
    showToast('Cannot connect to server.', 'error');
  }
}

document.getElementById('recordsSearch').addEventListener('input', function () {
  recordsPage = 1;
  renderRecordsPaginated();
});

// ── REPORTS ───────────────────────────────────────────────────
let courseChartInstance = null;
let dayChartInstance = null;

const CHART_COLORS = [
  '#2d7be5',
  '#38a169',
  '#e53e3e',
  '#dd6b20',
  '#805ad5',
  '#319795',
  '#d69e2e',
  '#e91e8c',
  '#3182ce',
  '#276749',
];

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

async function loadReports() {
  try {
    const { res, data } = await apiFetch('/admin/records');
    if (!res.ok) return;
    const records = data.records;

    buildCourseChart(records);
    buildDayChart(records);
  } catch (err) {
    console.error('Load reports error:', err);
  }
}

// ── DOUGHNUT: by Course ───────────────────────────────────────
function buildCourseChart(records) {
  const counts = {};
  records.forEach((r) => {
    const key = r.course || 'Unknown';
    // Shorten long course names for display
    const short = key.length > 22 ? key.slice(0, 22) + '…' : key;
    counts[short] = (counts[short] || 0) + 1;
  });

  const labels = Object.keys(counts);
  const values = Object.values(counts);
  const total = values.reduce((a, b) => a + b, 0);

  if (courseChartInstance) courseChartInstance.destroy();

  const ctx = document.getElementById('courseChart').getContext('2d');
  courseChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: CHART_COLORS.slice(0, labels.length),
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 10,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (c) =>
              ` ${c.label}: ${c.raw} (${Math.round((c.raw / total) * 100)}%)`,
          },
        },
      },
    },
  });

  // Center label — total sessions
  document.getElementById('courseCenterLabel').innerHTML =
    `<div class="center-total">${total}</div><div class="center-sub">Total</div>`;

  // Legend
  document.getElementById('courseLegend').innerHTML = labels
    .map(
      (l, i) => `
    <div class="legend-item">
      <div class="legend-dot" style="background:${CHART_COLORS[i]}"></div>
      <span>${l} <strong>(${values[i]})</strong></span>
    </div>
  `,
    )
    .join('');
}

// ── BAR: by Day of Week ───────────────────────────────────────
function buildDayChart(records) {
  const counts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  records.forEach((r) => {
    const day = new Date(r.created_at).getDay();
    counts[day]++;
  });

  const labels = DAY_NAMES;
  const values = Object.values(counts);
  const maxVal = Math.max(...values);

  // Highlight the busiest day
  const bgColors = values.map((v, i) =>
    v === maxVal && maxVal > 0 ? '#2d7be5' : '#bfdbfe',
  );

  if (dayChartInstance) dayChartInstance.destroy();

  const ctx = document.getElementById('dayChart').getContext('2d');
  dayChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Sit-in Sessions',
          data: values,
          backgroundColor: bgColors,
          borderRadius: 8,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (c) => ` ${c.raw} session${c.raw !== 1 ? 's' : ''}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { family: 'Poppins', size: 12 }, color: '#4a5568' },
        },
        y: {
          beginAtZero: true,
          grid: { color: '#f0f4fb' },
          ticks: {
            stepSize: 1,
            font: { family: 'Poppins', size: 12 },
            color: '#4a5568',
          },
        },
      },
    },
  });
}

// ── SSE AUTH FIX ──────────────────────────────────────────────
// Since EventSource doesn't support custom headers,
// pass token as query param and verify it in the backend
function startSSEWithToken() {
  const token = getToken();
  const evtSource = new EventSource(
    `${window.location.origin}/api/admin/sse-open?token=${token}`,
  );
  evtSource.onmessage = function (e) {
    const { active, stats } = JSON.parse(e.data);
    updateStats(stats);
    updateLiveTable(active);
  };
  evtSource.onerror = () => console.warn('SSE reconnecting...');
}

// ── PAGINATION UTILITY ────────────────────────────────────────
const PAGE_SIZE = 10;

function paginate(list, page) {
  const start = (page - 1) * PAGE_SIZE;
  return list.slice(start, start + PAGE_SIZE);
}

function renderPagination(containerId, totalItems, currentPage, onPageChange) {
  const container = document.getElementById(containerId);
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);
  if (totalPages <= 1) { container.innerHTML = ''; return; }

  let html = `<button ${currentPage === 1 ? 'disabled' : ''} onclick="${onPageChange}(${currentPage - 1})">‹</button>`;
  for (let i = 1; i <= totalPages; i++) {
    if (totalPages > 7 && i > 3 && i < totalPages - 1 && Math.abs(i - currentPage) > 1) {
      if (i === 4 || i === totalPages - 2) html += '<span style="padding:0 4px;color:var(--text-light)">…</span>';
      continue;
    }
    html += `<button class="${i === currentPage ? 'active' : ''}" onclick="${onPageChange}(${i})">${i}</button>`;
  }
  html += `<button ${currentPage === totalPages ? 'disabled' : ''} onclick="${onPageChange}(${currentPage + 1})">›</button>`;
  container.innerHTML = html;
}

// ── PAGINATED STUDENTS ───────────────────────────────────────
let studentsPage = 1;

function renderStudentsPaginated() {
  const q = document.getElementById('studentSearch').value.toLowerCase();
  const filtered = allStudents.filter(
    (s) =>
      s.id_number.includes(q) ||
      s.first_name.toLowerCase().includes(q) ||
      s.last_name.toLowerCase().includes(q) ||
      (s.course || '').toLowerCase().includes(q),
  );
  renderStudents(paginate(filtered, studentsPage));
  renderPagination('studentsPagination', filtered.length, studentsPage, 'goStudentsPage');
}

function goStudentsPage(p) { studentsPage = p; renderStudentsPaginated(); }

// ── PAGINATED RECORDS ────────────────────────────────────────
let recordsPage = 1;

function renderRecordsPaginated() {
  const q = document.getElementById('recordsSearch').value.toLowerCase();
  const filtered = allRecords.filter(
    (r) =>
      String(r.id).includes(q) ||
      r.id_number.includes(q) ||
      r.student_name.toLowerCase().includes(q) ||
      r.purpose.toLowerCase().includes(q) ||
      r.lab.toLowerCase().includes(q),
  );
  renderRecords(paginate(filtered, recordsPage));
  renderPagination('recordsPagination', filtered.length, recordsPage, 'goRecordsPage');
}

function goRecordsPage(p) { recordsPage = p; renderRecordsPaginated(); }

// ── REPORTS LOG ──────────────────────────────────────────────
let allReportsLog = [];
let reportsLogPage = 1;

async function loadReportsLog() {
  try {
    const { res, data } = await apiFetch('/admin/reports');
    if (!res.ok) return;
    allReportsLog = data.reports;
    reportsLogPage = 1;
    renderReportsLogPaginated();
  } catch (err) {
    console.error('Load reports log error:', err);
  }
}

function formatTime(dateStr) {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(mins) {
  if (!mins && mins !== 0) return '--';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatShortDate(dateStr) {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
}

function renderReportsLog(list) {
  const tbody = document.getElementById('reportsLogBody');
  if (!list || list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-row">No completed sessions yet.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(r => `
    <tr>
      <td>${r.id_number}</td>
      <td>${r.student_name}</td>
      <td>${r.purpose}</td>
      <td>${r.lab}</td>
      <td>${formatTime(r.login_time)}</td>
      <td>${formatTime(r.logout_time)}</td>
      <td>${formatDuration(r.duration_minutes)}</td>
      <td>${formatShortDate(r.session_date)}</td>
    </tr>
  `).join('');
}

function renderReportsLogPaginated() {
  const q = (document.getElementById('reportsSearch')?.value || '').toLowerCase();
  const filtered = allReportsLog.filter(r =>
    r.id_number.includes(q) ||
    r.student_name.toLowerCase().includes(q) ||
    r.purpose.toLowerCase().includes(q) ||
    r.lab.toLowerCase().includes(q),
  );
  renderReportsLog(paginate(filtered, reportsLogPage));
  renderPagination('reportsPagination', filtered.length, reportsLogPage, 'goReportsLogPage');
}

function goReportsLogPage(p) { reportsLogPage = p; renderReportsLogPaginated(); }

document.getElementById('reportsSearch')?.addEventListener('input', function () {
  reportsLogPage = 1;
  renderReportsLogPaginated();
});

// ── FEEDBACK ─────────────────────────────────────────────────
let allFeedback = [];
let feedbackPage = 1;

async function loadFeedback() {
  try {
    const { res, data } = await apiFetch('/admin/feedback');
    if (!res.ok) return;
    allFeedback = data.feedback;
    feedbackPage = 1;
    renderFeedbackPaginated();
  } catch (err) {
    console.error('Load feedback error:', err);
  }
}

function renderStars(rating) {
  return '<span class="star-rating">' + '★'.repeat(rating) + '☆'.repeat(5 - rating) + '</span>';
}

function renderFeedbackTable(list) {
  const tbody = document.getElementById('feedbackTableBody');
  if (!list || list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-row">No feedback yet.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(f => `
    <tr>
      <td>${f.id_number}</td>
      <td>${f.student_name}</td>
      <td>${f.course || '--'}</td>
      <td>${f.lab}</td>
      <td>${renderStars(f.rating)}</td>
      <td>${f.message || '--'}</td>
      <td>${formatShortDate(f.created_at)}</td>
    </tr>
  `).join('');
}

function renderFeedbackPaginated() {
  const q = (document.getElementById('feedbackSearch')?.value || '').toLowerCase();
  const filtered = allFeedback.filter(f =>
    f.id_number.includes(q) ||
    f.student_name.toLowerCase().includes(q) ||
    (f.course || '').toLowerCase().includes(q) ||
    f.lab.toLowerCase().includes(q),
  );
  renderFeedbackTable(paginate(filtered, feedbackPage));
  renderPagination('feedbackPagination', filtered.length, feedbackPage, 'goFeedbackPage');
}

function goFeedbackPage(p) { feedbackPage = p; renderFeedbackPaginated(); }

document.getElementById('feedbackSearch')?.addEventListener('input', function () {
  feedbackPage = 1;
  renderFeedbackPaginated();
});

// ── EXPORT UTILITIES ─────────────────────────────────────────
function exportToCSV(headers, rows, filename) {
  const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

function exportToExcel(headers, rows, filename) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, filename);
}

function exportToPDF(headers, rows, filename, title) {
  const jsPDFLib = window.jspdf || window.jsPDF;
  if (!jsPDFLib) {
    showToast('PDF library failed to load. Try refreshing the page.', 'error');
    return;
  }
  const jsPDFClass = jsPDFLib.jsPDF || jsPDFLib;
  const doc = new jsPDFClass();
  doc.setFontSize(16);
  doc.text(title, 14, 20);
  doc.autoTable({ head: [headers], body: rows, startY: 30, styles: { fontSize: 9 } });
  doc.save(filename);
}

function exportReports(format) {
  const headers = ['ID Number', 'Name', 'Purpose', 'Lab', 'Login', 'Logout', 'Duration', 'Date'];
  const rows = allReportsLog.map(r => [
    r.id_number, r.student_name, r.purpose, r.lab,
    formatTime(r.login_time), formatTime(r.logout_time),
    formatDuration(r.duration_minutes), formatShortDate(r.session_date),
  ]);
  const ts = new Date().toISOString().slice(0, 10);
  if (format === 'csv') exportToCSV(headers, rows, `sit-in-reports-${ts}.csv`);
  if (format === 'excel') exportToExcel(headers, rows, `sit-in-reports-${ts}.xlsx`);
  if (format === 'pdf') exportToPDF(headers, rows, `sit-in-reports-${ts}.pdf`, 'CCS Sit-in Reports');
}

function exportFeedback(format) {
  const headers = ['ID Number', 'Name', 'Course', 'Lab', 'Rating', 'Feedback', 'Date'];
  const rows = allFeedback.map(f => [
    f.id_number, f.student_name, f.course || '--', f.lab,
    f.rating + '/5', f.message || '--', formatShortDate(f.created_at),
  ]);
  const ts = new Date().toISOString().slice(0, 10);
  if (format === 'csv') exportToCSV(headers, rows, `feedback-reports-${ts}.csv`);
  if (format === 'excel') exportToExcel(headers, rows, `feedback-reports-${ts}.xlsx`);
  if (format === 'pdf') exportToPDF(headers, rows, `feedback-reports-${ts}.pdf`, 'CCS Feedback Reports');
}

// ── SIT-IN SEARCH & MODAL ────────────────────────────────────
const sitinModal = document.getElementById('sitinModal');
const sitinSearchInput = document.getElementById('sitinSearchInput');
const sitinSearchBtn = document.getElementById('sitinSearchBtn');

function closeSitinModal() {
  sitinModal.classList.add('hidden');
}

document.getElementById('closeSitinModal').addEventListener('click', closeSitinModal);
document.getElementById('cancelSitinModal').addEventListener('click', closeSitinModal);
sitinModal.addEventListener('click', (e) => {
  if (e.target === sitinModal) closeSitinModal();
});

async function lookupStudent() {
  const id = sitinSearchInput.value.trim();
  if (!/^\d{8}$/.test(id)) {
    showToast('Enter a valid 8-digit ID number.', 'error');
    return;
  }

  try {
    const { res, data } = await apiFetch(`/admin/students/${id}/lookup`);
    if (!res.ok) {
      showToast(data.message || 'Student not found.', 'error');
      return;
    }

    const s = data.student;

    if (s.has_active_session) {
      showToast('Student already has an active sit-in session.', 'error');
      return;
    }

    if (s.remaining_sessions <= 0) {
      showToast('Student has no remaining sessions.', 'error');
      return;
    }

    // Populate modal
    document.getElementById('sitinIdNumber').textContent = s.id_number;
    const fullName = [s.first_name, s.middle_name, s.last_name]
      .filter(Boolean)
      .join(' ');
    document.getElementById('sitinStudentName').textContent = fullName;
    document.getElementById('sitinCourseYear').textContent =
      `${s.course || '--'} - Year ${s.course_level || '--'}`;
    document.getElementById('sitinRemaining').textContent = s.remaining_sessions;

    // Reset selects
    document.getElementById('sitinPurpose').value = '';
    document.getElementById('sitinLab').value = '';

    sitinModal.classList.remove('hidden');
  } catch (err) {
    showToast('Cannot connect to server.', 'error');
  }
}

sitinSearchBtn.addEventListener('click', lookupStudent);
sitinSearchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') lookupStudent();
});

// Submit sit-in
document.getElementById('submitSitinBtn').addEventListener('click', async () => {
  const id_number = document.getElementById('sitinIdNumber').textContent;
  const purpose = document.getElementById('sitinPurpose').value;
  const lab = document.getElementById('sitinLab').value;

  if (!purpose || !lab) {
    showToast('Purpose and lab are required.', 'error');
    return;
  }

  try {
    const { res, data } = await apiFetch('/admin/sitin', {
      method: 'POST',
      body: JSON.stringify({ id_number, purpose, lab }),
    });

    if (!res.ok) {
      showToast(data.message || 'Failed to start sit-in.', 'error');
      return;
    }

    closeSitinModal();
    sitinSearchInput.value = '';
    showToast(data.message, 'success');
  } catch (err) {
    showToast('Cannot connect to server.', 'error');
  }
});

// ── INIT ──────────────────────────────────────────────────────
startSSEWithToken();
loadAnnouncements();
