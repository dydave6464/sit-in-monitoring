// Public top-3 leaderboard on the login page.
(function () {
  const podium = document.getElementById('hofPodium');
  const emptyEl = document.getElementById('hofEmpty');
  if (!podium) return;

  function initialsOf(name) {
    return (name || '?')
      .split(/\s+/)
      .map((s) => s[0] || '')
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  function fillSlot(slot, entry) {
    if (!slot) return;
    if (!entry) {
      slot.classList.add('podium-empty');
      return;
    }
    slot.classList.remove('podium-empty');
    const nameEl = slot.querySelector('.podium-name');
    const scoreEl = slot.querySelector('.podium-score');
    const initialsEl = slot.querySelector('.podium-initials');
    const avatarWrap = slot.querySelector('.podium-avatar');

    if (nameEl) nameEl.textContent = entry.name;
    if (scoreEl) scoreEl.textContent = entry.score.toFixed(2);

    if (entry.profile_image && avatarWrap) {
      const existing = avatarWrap.querySelector('.podium-img');
      if (!existing) {
        const img = document.createElement('img');
        img.className = 'podium-img';
        img.alt = entry.name;
        img.src = entry.profile_image;
        avatarWrap.appendChild(img);
        if (initialsEl) initialsEl.style.display = 'none';
      }
    } else if (initialsEl) {
      initialsEl.textContent = initialsOf(entry.name);
    }
  }

  async function load() {
    try {
      const res = await fetch('/api/leaderboard/public-top');
      const data = await res.json();
      if (!res.ok || !data.top || data.top.length === 0) {
        podium.style.display = 'none';
        emptyEl?.classList.remove('hidden');
        return;
      }
      const slot1 = podium.querySelector('.podium-1');
      const slot2 = podium.querySelector('.podium-2');
      const slot3 = podium.querySelector('.podium-3');
      fillSlot(slot1, data.top[0]);
      fillSlot(slot2, data.top[1]);
      fillSlot(slot3, data.top[2]);
    } catch (_) {
      podium.style.display = 'none';
      emptyEl?.classList.remove('hidden');
    }
  }

  load();
})();
