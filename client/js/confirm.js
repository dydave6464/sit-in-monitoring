// ── CUSTOM CONFIRM MODAL ─────────────────────────────────────
// Usage: const ok = await showConfirm({ title, message, confirmText, type })
// type: 'danger' (red), 'warning' (orange), 'info' (blue, default)

(function () {
  // Inject modal HTML once
  const overlay = document.createElement('div');
  overlay.id = 'confirmModalOverlay';
  overlay.className = 'confirm-overlay confirm-hidden';
  overlay.innerHTML = `
    <div class="confirm-card">
      <div class="confirm-icon-wrap" id="confirmIconWrap"></div>
      <h3 class="confirm-title" id="confirmTitle">Are you sure?</h3>
      <p class="confirm-message" id="confirmMessage"></p>
      <div class="confirm-actions">
        <button class="confirm-btn-cancel" id="confirmCancelBtn">Cancel</button>
        <button class="confirm-btn-ok" id="confirmOkBtn">Confirm</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const icons = {
    danger: `<svg viewBox="0 0 24 24" fill="none" stroke="#e53e3e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`,
    warning: `<svg viewBox="0 0 24 24" fill="none" stroke="#dd6b20" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    info: `<svg viewBox="0 0 24 24" fill="none" stroke="#2d7be5" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  };

  const bgColors = {
    danger: '#fff5f5',
    warning: '#fffaf0',
    info: '#ebf4ff',
  };

  const btnColors = {
    danger: '#e53e3e',
    warning: '#dd6b20',
    info: '#2d7be5',
  };

  const btnHoverColors = {
    danger: '#c53030',
    warning: '#c05621',
    info: '#1a63c7',
  };

  let resolvePromise = null;

  const titleEl = document.getElementById('confirmTitle');
  const messageEl = document.getElementById('confirmMessage');
  const iconWrap = document.getElementById('confirmIconWrap');
  const okBtn = document.getElementById('confirmOkBtn');
  const cancelBtn = document.getElementById('confirmCancelBtn');

  function close(result) {
    overlay.classList.add('confirm-hidden');
    if (resolvePromise) resolvePromise(result);
    resolvePromise = null;
  }

  cancelBtn.addEventListener('click', () => close(false));
  okBtn.addEventListener('click', () => close(true));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close(false);
  });

  // ESC key to cancel
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.classList.contains('confirm-hidden')) {
      close(false);
    }
  });

  /**
   * @param {Object} opts
   * @param {string} opts.title - Modal title
   * @param {string} opts.message - Description text
   * @param {string} [opts.confirmText='Confirm'] - OK button label
   * @param {string} [opts.cancelText='Cancel'] - Cancel button label
   * @param {'danger'|'warning'|'info'} [opts.type='info'] - Color scheme
   */
  window.showConfirm = function (opts = {}) {
    const type = opts.type || 'info';

    titleEl.textContent = opts.title || 'Are you sure?';
    messageEl.textContent = opts.message || '';
    messageEl.style.display = opts.message ? 'block' : 'none';
    iconWrap.innerHTML = icons[type] || icons.info;
    iconWrap.style.background = bgColors[type] || bgColors.info;

    okBtn.textContent = opts.confirmText || 'Confirm';
    cancelBtn.textContent = opts.cancelText || 'Cancel';
    okBtn.style.background = btnColors[type] || btnColors.info;
    okBtn.onmouseenter = () => (okBtn.style.background = btnHoverColors[type] || btnHoverColors.info);
    okBtn.onmouseleave = () => (okBtn.style.background = btnColors[type] || btnColors.info);

    overlay.classList.remove('confirm-hidden');

    return new Promise((resolve) => {
      resolvePromise = resolve;
    });
  };
})();
