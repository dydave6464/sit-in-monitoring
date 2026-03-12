const API = 'http://localhost:3000/api';

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

// ── FIELD ERROR HELPERS ───────────────────────────────────────
function setError(inputEl, message) {
  clearError(inputEl);
  inputEl.classList.add('input-error');
  const errorLabel = document.createElement('span');
  errorLabel.className = 'error-label';
  errorLabel.textContent = message;
  inputEl.insertAdjacentElement('afterend', errorLabel);
}

function clearError(inputEl) {
  inputEl.classList.remove('input-error');
  const next = inputEl.nextElementSibling;
  if (next && next.classList.contains('error-label')) next.remove();
}

function clearAllErrors(form) {
  form
    .querySelectorAll('.input-error')
    .forEach((el) => el.classList.remove('input-error'));
  form.querySelectorAll('.error-label').forEach((el) => el.remove());
}

// ── LOGIN ─────────────────────────────────────────────────────
const loginForm = document.getElementById('loginForm');

if (loginForm) {
  const idInput = document.getElementById('loginId');
  const pwInput = document.getElementById('loginPassword');

  idInput.addEventListener('input', () => clearError(idInput));
  pwInput.addEventListener('input', () => clearError(pwInput));

  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearAllErrors(loginForm);

    const id_number = idInput.value.trim();
    const password = pwInput.value;
    let hasError = false;

    if (!/^\d{8}$/.test(id_number)) {
      setError(idInput, 'ID Number must be exactly 8 digits.');
      hasError = true;
    }
    if (!password) {
      setError(pwInput, 'Password is required.');
      hasError = true;
    }
    if (hasError) return;

    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_number, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.field === 'id_number') setError(idInput, data.message);
        else if (data.field === 'password') setError(pwInput, data.message);
        else showToast(data.message, 'error');
        return;
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('loggedInUser', JSON.stringify(data.user));
      showToast('Login successful! Redirecting...', 'success');
      setTimeout(() => (window.location.href = 'dashboard.html'), 1200);
    } catch (err) {
      showToast('Cannot connect to server. Please try again.', 'error');
    }
  });
}

// ── REGISTER ─────────────────────────────────────────────────
const registerForm = document.getElementById('registerForm');

if (registerForm) {
  registerForm.querySelectorAll('input').forEach((input) => {
    input.addEventListener('input', () => clearError(input));
  });

  registerForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearAllErrors(registerForm);

    const id_number = document.getElementById('idNumber').value.trim();
    const last_name = document.getElementById('lastName').value.trim();
    const first_name = document.getElementById('firstName').value.trim();
    const middle_name = document.getElementById('middleName').value.trim();
    const course_level = document.getElementById('courseLevel').value;
    const password = document.getElementById('password').value;
    const repeatPassword = document.getElementById('repeatPassword').value;
    const email = document.getElementById('email').value.trim();
    const course = document.getElementById('course').value;
    const address = document.getElementById('address').value.trim();

    let hasError = false;

    if (!/^\d{8}$/.test(id_number)) {
      setError(
        document.getElementById('idNumber'),
        'ID Number must be exactly 8 digits.',
      );
      hasError = true;
    }
    if (!last_name) {
      setError(document.getElementById('lastName'), 'Last name is required.');
      hasError = true;
    }
    if (!first_name) {
      setError(document.getElementById('firstName'), 'First name is required.');
      hasError = true;
    }
    if (!course_level) {
      setError(
        document.getElementById('courseLevel'),
        'Please select a course level.',
      );
      hasError = true;
    }
    if (password.length < 6) {
      setError(
        document.getElementById('password'),
        'Password must be at least 6 characters.',
      );
      hasError = true;
    }
    if (password !== repeatPassword) {
      setError(
        document.getElementById('repeatPassword'),
        'Passwords do not match.',
      );
      hasError = true;
    }
    if (!course) {
      setError(document.getElementById('course'), 'Please select a course.');
      hasError = true;
    }
    if (hasError) return;

    try {
      const res = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_number,
          last_name,
          first_name,
          middle_name,
          course_level,
          password,
          email,
          course,
          address,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.field) {
          const fieldMap = { id_number: 'idNumber', password: 'password' };
          const el = document.getElementById(fieldMap[data.field]);
          if (el) setError(el, data.message);
          else showToast(data.message, 'error');
        } else {
          showToast(data.message, 'error');
        }
        return;
      }

      showToast('Registration successful! Redirecting to login...', 'success');
      setTimeout(() => (window.location.href = 'index.html'), 1500);
    } catch (err) {
      showToast('Cannot connect to server. Please try again.', 'error');
    }
  });
}

// ── SELECT COLOR FIX ──────────────────────────────────────────
document.querySelectorAll('select').forEach((sel) => {
  sel.addEventListener('change', function () {
    this.classList.toggle('selected', this.value !== '');
  });
});
