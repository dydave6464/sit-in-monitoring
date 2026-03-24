// ── GUARD ─────────────────────────────────────────────────────
const user = requireStudent();
if (!user) throw new Error('Not authenticated');

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

// ── CAPITALIZE HELPER ─────────────────────────────────────────
function titleCase(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ── POPULATE STUDENT INFO SIDEBAR ────────────────────────────
function populateInfo(u) {
  const fullName = [u.first_name, u.middle_name, u.last_name]
    .filter(Boolean)
    .map(titleCase)
    .join(' ');
  document.getElementById('infoName').textContent = fullName;
  document.getElementById('infoCourse').textContent = u.course || '--';
  document.getElementById('infoYear').textContent = u.course_level || '--';
  document.getElementById('infoEmail').textContent = u.email || '--';
  document.getElementById('infoAddress').textContent = titleCase(u.address) || '--';
  document.getElementById('infoSessions').textContent = u.remaining_sessions;

  // Welcome banner
  const heading = document.getElementById('welcomeHeading');
  if (heading) heading.textContent = `Welcome back, ${titleCase(u.first_name)}!`;

  // Avatar
  setAvatar(u.profile_image);
}

function setAvatar(imagePath) {
  const img = document.getElementById('avatarImage');
  const svg = document.getElementById('avatarSvg');
  if (imagePath) {
    img.src = imagePath;
    img.classList.remove('hidden');
    svg.style.display = 'none';
  } else {
    img.classList.add('hidden');
    svg.style.display = '';
  }
}

// ── LOAD PROFILE FROM SERVER ─────────────────────────────────
async function loadProfile() {
  try {
    const { res, data } = await apiFetch('/auth/profile');
    if (res.ok && data.user) {
      populateInfo(data.user);
      // Update localStorage so it stays in sync
      localStorage.setItem('loggedInUser', JSON.stringify(data.user));
      return data.user;
    }
  } catch (err) {
    console.warn('Failed to load profile:', err);
  }
  // Fallback to localStorage data
  populateInfo(user);
  return user;
}

// ── LOAD ANNOUNCEMENTS ───────────────────────────────────────
async function loadAnnouncements() {
  const feed = document.getElementById('announcementFeed');
  try {
    const { res, data } = await apiFetch('/announcements');
    if (!res.ok || !data.announcements || data.announcements.length === 0) {
      feed.innerHTML = '<div class="empty-state">No announcements yet.</div>';
      return;
    }

    feed.innerHTML = data.announcements
      .map((a) => {
        const date = new Date(a.created_at);
        const formatted = date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: '2-digit',
        });
        return `
          <div class="announcement-entry">
            <span class="announcement-author">CCS Admin<span class="announcement-date">| ${formatted}</span></span>
            ${a.title ? `<div class="announcement-title">${escapeHtml(a.title)}</div>` : ''}
            <div class="announcement-text">${escapeHtml(a.body)}</div>
          </div>`;
      })
      .join('');
  } catch (err) {
    feed.innerHTML = '<div class="empty-state">Unable to load announcements.</div>';
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── EDIT PROFILE MODAL ───────────────────────────────────────
const editModal = document.getElementById('editProfileModal');
const editForm = document.getElementById('editProfileForm');
const navEditBtn = document.getElementById('navEditProfile');
const closeEditBtn = document.getElementById('closeEditModal');
const cancelEditBtn = document.getElementById('cancelEditModal');

function openEditModal() {
  // Pre-fill with current data from localStorage
  const u = JSON.parse(localStorage.getItem('loggedInUser'));
  document.getElementById('editIdNumber').value = u.id_number || '';
  document.getElementById('editFirstName').value = u.first_name || '';
  document.getElementById('editLastName').value = u.last_name || '';
  document.getElementById('editMiddleName').value = u.middle_name || '';
  document.getElementById('editEmail').value = u.email || '';
  document.getElementById('editAddress').value = u.address || '';

  // Set select values
  const courseSelect = document.getElementById('editCourse');
  courseSelect.value = u.course || '';
  courseSelect.classList.toggle('selected', !!u.course);

  const levelSelect = document.getElementById('editCourseLevel');
  levelSelect.value = u.course_level ? String(u.course_level) : '';
  levelSelect.classList.toggle('selected', !!u.course_level);

  editModal.classList.remove('hidden');
}

function closeEditModal() {
  editModal.classList.add('hidden');
}

navEditBtn.addEventListener('click', openEditModal);
closeEditBtn.addEventListener('click', closeEditModal);
cancelEditBtn.addEventListener('click', closeEditModal);

// Close modal on overlay click
editModal.addEventListener('click', (e) => {
  if (e.target === editModal) closeEditModal();
});

// Submit profile edit
editForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const payload = {
    first_name: document.getElementById('editFirstName').value.trim(),
    last_name: document.getElementById('editLastName').value.trim(),
    middle_name: document.getElementById('editMiddleName').value.trim(),
    course: document.getElementById('editCourse').value,
    course_level: document.getElementById('editCourseLevel').value,
    email: document.getElementById('editEmail').value.trim(),
    address: document.getElementById('editAddress').value.trim(),
  };

  if (!payload.first_name || !payload.last_name) {
    showToast('First and last name are required.');
    return;
  }

  try {
    const { res, data } = await apiFetch('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      showToast(data.message || 'Failed to update profile.');
      return;
    }

    // Update sidebar and localStorage
    populateInfo(data.user);
    localStorage.setItem('loggedInUser', JSON.stringify(data.user));
    closeEditModal();
    showToast('Profile updated successfully!', 'success');
  } catch (err) {
    showToast('Cannot connect to server.');
  }
});

// Select color fix for edit modal
document.querySelectorAll('.edit-modal select').forEach((sel) => {
  sel.addEventListener('change', function () {
    this.classList.toggle('selected', this.value !== '');
  });
});

// ── LOGOUT ───────────────────────────────────────────────────
document.getElementById('navLogoutBtn').addEventListener('click', () => {
  if (!confirm('Are you sure you want to log out?')) return;
  clearSession();
  window.location.href = '/index.html';
});

// ── TAB NAVIGATION ───────────────────────────────────────────
const dashContainer = document.querySelector('.dash-container');
const welcomeBanner = document.querySelector('.welcome-banner');
const historySection = document.getElementById('historySection');
const navTabs = document.querySelectorAll('.dash-nav-item[data-tab]');

navTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    navTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    if (tab.dataset.tab === 'history') {
      dashContainer.classList.add('hidden');
      welcomeBanner.classList.add('hidden');
      historySection.classList.remove('hidden');
      loadHistory();
    } else {
      dashContainer.classList.remove('hidden');
      welcomeBanner.classList.remove('hidden');
      historySection.classList.add('hidden');
    }
  });
});

// ── HISTORY ──────────────────────────────────────────────────
async function loadHistory() {
  const tbody = document.getElementById('historyTableBody');
  try {
    const { res, data } = await apiFetch('/sitin/history');
    if (!res.ok || !data.history || data.history.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No session history yet.</td></tr>';
      return;
    }
    tbody.innerHTML = data.history.map(h => {
      const date = new Date(h.created_at).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: '2-digit'
      });
      const hasFeedback = h.has_feedback > 0;
      const isCompleted = h.status === 'completed';
      return `
        <tr>
          <td>${escapeHtml(h.purpose)}</td>
          <td>${escapeHtml(h.lab)}</td>
          <td>${date}</td>
          <td><span class="status-badge status-${h.status}">${h.status}</span></td>
          <td>${isCompleted
            ? hasFeedback
              ? '<button class="btn-feedback" disabled>Submitted</button>'
              : `<button class="btn-feedback" onclick="openFeedbackModal(${h.id})">Feedback</button>`
            : '--'
          }</td>
        </tr>`;
    }).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Unable to load history.</td></tr>';
  }
}

// ── FEEDBACK MODAL ───────────────────────────────────────────
const feedbackModal = document.getElementById('feedbackModal');
let selectedRating = 0;

function openFeedbackModal(sessionId) {
  document.getElementById('feedbackSessionId').value = sessionId;
  document.getElementById('feedbackMessage').value = '';
  selectedRating = 0;
  updateStars(0);
  feedbackModal.classList.remove('hidden');
}

function closeFeedbackModal() {
  feedbackModal.classList.add('hidden');
}

document.getElementById('closeFeedbackModal').addEventListener('click', closeFeedbackModal);
document.getElementById('cancelFeedbackModal').addEventListener('click', closeFeedbackModal);
feedbackModal.addEventListener('click', (e) => {
  if (e.target === feedbackModal) closeFeedbackModal();
});

// Star selection
const starSelect = document.getElementById('starSelect');
starSelect.querySelectorAll('span').forEach(star => {
  star.addEventListener('click', () => {
    selectedRating = parseInt(star.dataset.star);
    updateStars(selectedRating);
  });
  star.addEventListener('mouseenter', () => updateStars(parseInt(star.dataset.star)));
  star.addEventListener('mouseleave', () => updateStars(selectedRating));
});

function updateStars(rating) {
  starSelect.querySelectorAll('span').forEach(s => {
    s.textContent = parseInt(s.dataset.star) <= rating ? '★' : '☆';
    s.classList.toggle('active', parseInt(s.dataset.star) <= rating);
  });
}

document.getElementById('submitFeedbackBtn').addEventListener('click', async () => {
  if (selectedRating === 0) {
    showToast('Please select a rating.');
    return;
  }

  const session_id = document.getElementById('feedbackSessionId').value;
  const message = document.getElementById('feedbackMessage').value.trim();

  try {
    const { res, data } = await apiFetch('/sitin/feedback', {
      method: 'POST',
      body: JSON.stringify({ session_id: parseInt(session_id), rating: selectedRating, message }),
    });

    if (!res.ok) {
      showToast(data.message || 'Failed to submit feedback.');
      return;
    }

    closeFeedbackModal();
    showToast('Feedback submitted!', 'success');
    loadHistory();
  } catch (err) {
    showToast('Cannot connect to server.');
  }
});

// ── AVATAR UPLOAD ────────────────────────────────────────────
const avatarClickable = document.getElementById('avatarClickable');
const avatarInput = document.getElementById('avatarInput');

avatarClickable.addEventListener('click', () => avatarInput.click());

avatarInput.addEventListener('change', async () => {
  const file = avatarInput.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('avatar', file);

  try {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/auth/profile/avatar', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.message || 'Upload failed.');
      return;
    }

    setAvatar(data.profile_image);
    // Update localStorage
    const u = JSON.parse(localStorage.getItem('loggedInUser'));
    u.profile_image = data.profile_image;
    localStorage.setItem('loggedInUser', JSON.stringify(u));
    showToast('Profile photo updated!', 'success');
  } catch (err) {
    showToast('Cannot connect to server.');
  }
  // Reset input so same file can be re-selected
  avatarInput.value = '';
});

// ── INIT ─────────────────────────────────────────────────────
loadProfile();
loadAnnouncements();
