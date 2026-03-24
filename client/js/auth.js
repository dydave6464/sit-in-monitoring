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
  // If already logged in, redirect
  const existingUser = getUser();
  if (existingUser && getToken()) {
    redirectByRole(existingUser.role);
  }

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
      const { res, data } = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ id_number, password }),
      });

      if (!res.ok) {
        if (data.field === 'id_number') setError(idInput, data.message);
        else if (data.field === 'password') setError(pwInput, data.message);
        else showToast(data.message, 'error');
        return;
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('loggedInUser', JSON.stringify(data.user));

      showToast('Login successful! Redirecting...', 'success');
      setTimeout(() => redirectByRole(data.user.role), 1200);
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
      const { res, data } = await apiFetch('/auth/register', {
        method: 'POST',
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
      setTimeout(() => (window.location.href = '/index.html'), 1500);
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

// ── FORGOT PASSWORD ──────────────────────────────────────────
const forgotLink = document.getElementById('forgotPasswordLink');
const forgotModal = document.getElementById('forgotModal');

if (forgotLink && forgotModal) {
  const step1 = document.getElementById('forgotStep1');
  const step2 = document.getElementById('forgotStep2');
  const step3 = document.getElementById('forgotStep3');
  const forgotEmailInput = document.getElementById('forgotEmail');
  const emailDisplay = document.getElementById('forgotEmailDisplay');
  let forgotEmail = '';
  let resendInterval = null;

  function showStep(step) {
    [step1, step2, step3].forEach((s) => s.classList.add('forgot-hidden'));
    step.classList.remove('forgot-hidden');
  }

  function closeForgotModal() {
    forgotModal.classList.add('confirm-hidden');
    clearResendTimer();
    // Reset all fields
    forgotEmailInput.value = '';
    document.querySelectorAll('.otp-box').forEach((b) => (b.value = ''));
    document.getElementById('forgotNewPassword').value = '';
    document.getElementById('forgotConfirmPassword').value = '';
    showStep(step1);
  }

  // Open modal
  forgotLink.addEventListener('click', (e) => {
    e.preventDefault();
    forgotModal.classList.remove('confirm-hidden');
    showStep(step1);
    setTimeout(() => forgotEmailInput.focus(), 100);
  });

  // Close on overlay click
  forgotModal.addEventListener('click', (e) => {
    if (e.target === forgotModal) closeForgotModal();
  });

  // Back buttons
  document.getElementById('forgotBackBtn1').addEventListener('click', closeForgotModal);
  document.getElementById('forgotBackBtn2').addEventListener('click', closeForgotModal);

  // ── Step 1: Send OTP ──
  document.getElementById('sendOtpBtn').addEventListener('click', async () => {
    const email = forgotEmailInput.value.trim();
    if (!email) {
      showToast('Please enter your email.');
      return;
    }

    const btn = document.getElementById('sendOtpBtn');
    btn.disabled = true;
    btn.textContent = 'Sending...';

    try {
      const { res, data } = await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        showToast(data.message || 'Failed to send code.');
        btn.disabled = false;
        btn.textContent = 'Send Code';
        return;
      }

      forgotEmail = email;
      emailDisplay.textContent = email;
      showStep(step2);
      startResendTimer();
      // Focus first OTP box
      document.querySelector('.otp-box[data-index="0"]').focus();
      showToast('Verification code sent!', 'success');
    } catch (err) {
      showToast('Cannot connect to server.');
    }

    btn.disabled = false;
    btn.textContent = 'Send Code';
  });

  // ── OTP Input behavior ──
  const otpBoxes = document.querySelectorAll('.otp-box');

  otpBoxes.forEach((box) => {
    box.addEventListener('input', (e) => {
      const val = e.target.value;
      // Only allow digits
      e.target.value = val.replace(/\D/g, '').slice(0, 1);

      if (e.target.value && box.dataset.index < 5) {
        const next = document.querySelector(`.otp-box[data-index="${parseInt(box.dataset.index) + 1}"]`);
        if (next) next.focus();
      }
    });

    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && box.dataset.index > 0) {
        const prev = document.querySelector(`.otp-box[data-index="${parseInt(box.dataset.index) - 1}"]`);
        if (prev) { prev.focus(); prev.value = ''; }
      }
    });

    // Handle paste
    box.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
      pasted.split('').forEach((char, i) => {
        const target = document.querySelector(`.otp-box[data-index="${i}"]`);
        if (target) target.value = char;
      });
      const lastBox = document.querySelector(`.otp-box[data-index="${Math.min(pasted.length - 1, 5)}"]`);
      if (lastBox) lastBox.focus();
    });
  });

  // ── Step 2: Verify OTP ──
  document.getElementById('verifyOtpBtn').addEventListener('click', async () => {
    const code = Array.from(otpBoxes).map((b) => b.value).join('');
    if (code.length !== 6) {
      showToast('Please enter the complete 6-digit code.');
      return;
    }

    const btn = document.getElementById('verifyOtpBtn');
    btn.disabled = true;
    btn.textContent = 'Verifying...';

    try {
      const { res, data } = await apiFetch('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email: forgotEmail, code }),
      });

      if (!res.ok) {
        showToast(data.message || 'Invalid code.');
        btn.disabled = false;
        btn.textContent = 'Verify Code';
        return;
      }

      clearResendTimer();
      showStep(step3);
      document.getElementById('forgotNewPassword').focus();
    } catch (err) {
      showToast('Cannot connect to server.');
    }

    btn.disabled = false;
    btn.textContent = 'Verify Code';
  });

  // ── Resend timer (60s cooldown) ──
  function startResendTimer() {
    let seconds = 60;
    const timerEl = document.getElementById('resendTimer');
    const resendBtn = document.getElementById('resendOtpBtn');
    resendBtn.disabled = true;

    timerEl.textContent = `Resend in ${seconds}s`;

    resendInterval = setInterval(() => {
      seconds--;
      if (seconds <= 0) {
        clearInterval(resendInterval);
        resendInterval = null;
        timerEl.textContent = '';
        resendBtn.disabled = false;
      } else {
        timerEl.textContent = `Resend in ${seconds}s`;
      }
    }, 1000);
  }

  function clearResendTimer() {
    if (resendInterval) {
      clearInterval(resendInterval);
      resendInterval = null;
    }
    const timerEl = document.getElementById('resendTimer');
    if (timerEl) timerEl.textContent = '';
  }

  document.getElementById('resendOtpBtn').addEventListener('click', async () => {
    const btn = document.getElementById('resendOtpBtn');
    btn.disabled = true;

    try {
      const { res, data } = await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: forgotEmail }),
      });

      if (res.ok) {
        showToast('New code sent!', 'success');
        otpBoxes.forEach((b) => (b.value = ''));
        document.querySelector('.otp-box[data-index="0"]').focus();
        startResendTimer();
      } else {
        showToast(data.message || 'Failed to resend.');
        btn.disabled = false;
      }
    } catch (err) {
      showToast('Cannot connect to server.');
      btn.disabled = false;
    }
  });

  // ── Step 3: Reset Password ──
  document.getElementById('resetPasswordBtn').addEventListener('click', async () => {
    const newPw = document.getElementById('forgotNewPassword').value;
    const confirmPw = document.getElementById('forgotConfirmPassword').value;

    if (newPw.length < 6) {
      showToast('Password must be at least 6 characters.');
      return;
    }
    if (newPw !== confirmPw) {
      showToast('Passwords do not match.');
      return;
    }

    const btn = document.getElementById('resetPasswordBtn');
    btn.disabled = true;
    btn.textContent = 'Resetting...';

    try {
      const { res, data } = await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email: forgotEmail, new_password: newPw }),
      });

      if (!res.ok) {
        showToast(data.message || 'Failed to reset password.');
        btn.disabled = false;
        btn.textContent = 'Reset Password';
        return;
      }

      closeForgotModal();
      showToast('Password reset successfully! You can now log in.', 'success');
    } catch (err) {
      showToast('Cannot connect to server.');
    }

    btn.disabled = false;
    btn.textContent = 'Reset Password';
  });
}
