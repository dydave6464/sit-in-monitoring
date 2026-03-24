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

  // Load section data
  if (sectionId === 'students') loadStudents();
  if (sectionId === 'sitin-records') loadRecords();
  if (sectionId === 'reports') loadReports();
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

// ── LOGOUT ────────────────────────────────────────────────────
document.getElementById('adminLogoutBtn').addEventListener('click', () => {
  if (!confirm('Are you sure you want to log out?')) return;
  clearSession();
  window.location.href = '/index.html';
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
    `http://localhost:3000/api/admin/sse?token=${token}`,
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
  if (!confirm('Delete this announcement?')) return;
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
    renderStudents(allStudents);
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
      <td>${s.course || '--'}</td>
      <td>${s.course_level || '--'}</td>
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
  const q = this.value.toLowerCase();
  const filtered = allStudents.filter(
    (s) =>
      s.id_number.includes(q) ||
      s.first_name.toLowerCase().includes(q) ||
      s.last_name.toLowerCase().includes(q) ||
      (s.course || '').toLowerCase().includes(q),
  );
  renderStudents(filtered);
});

// Reset all sessions
document.getElementById('resetAllBtn').addEventListener('click', async () => {
  if (!confirm('Reset ALL student sessions back to 30?')) return;
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
  if (!confirm(`Delete student ${id_number}? This cannot be undone.`)) return;
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
    renderRecords(allRecords);
  } catch (err) {
    showToast('Cannot connect to server.', 'error');
  }
}

function renderRecords(list) {
  const tbody = document.getElementById('recordsTableBody');
  if (!list || list.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="7" class="empty-row">No records yet.</td></tr>';
    return;
  }
  tbody.innerHTML = list
    .map(
      (r) => `
    <tr>
      <td>${r.id_number}</td>
      <td>${r.student_name}</td>
      <td>${r.purpose}</td>
      <td>${r.lab}</td>
      <td><span class="status-badge status-${r.status}">${r.status}</span></td>
      <td>${formatDate(r.created_at)}</td>
      <td>${r.ended_at ? formatDate(r.ended_at) : '--'}</td>
    </tr>
  `,
    )
    .join('');
}

document.getElementById('recordsSearch').addEventListener('input', function () {
  const q = this.value.toLowerCase();
  const filtered = allRecords.filter(
    (r) =>
      r.id_number.includes(q) ||
      r.student_name.toLowerCase().includes(q) ||
      r.purpose.toLowerCase().includes(q) ||
      r.lab.toLowerCase().includes(q),
  );
  renderRecords(filtered);
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
    `http://localhost:3000/api/admin/sse-open?token=${token}`,
  );
  evtSource.onmessage = function (e) {
    const { active, stats } = JSON.parse(e.data);
    updateStats(stats);
    updateLiveTable(active);
  };
  evtSource.onerror = () => console.warn('SSE reconnecting...');
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
