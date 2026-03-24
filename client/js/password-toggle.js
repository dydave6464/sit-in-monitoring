// ── PASSWORD VISIBILITY TOGGLE ────────────────────────────────
// Auto-wraps every input[type="password"] with an eye icon toggle.
// Include this script on any page with password fields.

(function () {
  const eyeShow = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const eyeHide = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>`;

  function wrapPasswordField(input) {
    // Skip if already wrapped or inside OTP inputs
    if (input.closest('.pw-wrapper') || input.classList.contains('otp-box')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'pw-wrapper';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'pw-toggle';
    toggle.innerHTML = eyeShow;
    toggle.tabIndex = -1;

    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);
    wrapper.appendChild(toggle);

    toggle.addEventListener('click', () => {
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      toggle.innerHTML = isPassword ? eyeHide : eyeShow;
      input.focus();
    });
  }

  // Wrap existing fields
  document.querySelectorAll('input[type="password"]').forEach(wrapPasswordField);

  // Watch for dynamically added password fields
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((m) => {
      m.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        if (node.matches && node.matches('input[type="password"]')) {
          wrapPasswordField(node);
        }
        if (node.querySelectorAll) {
          node.querySelectorAll('input[type="password"]').forEach(wrapPasswordField);
        }
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
