(function () {
  const PRODUCT_PLACEHOLDER =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
      '<rect width="64" height="64" fill="#EEF1F8"/>' +
      '<g fill="none" stroke="#8890B0" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M55 42V22a4 4 0 0 0-2-3.46l-18-9a4 4 0 0 0-4 0l-18 9A4 4 0 0 0 11 22v20a4 4 0 0 0 2 3.46l18 9a4 4 0 0 0 4 0l18-9A4 4 0 0 0 55 42z"/>' +
      '<polyline points="11 18.5 32 29 53 18.5"/>' +
      '<line x1="32" y1="29" x2="32" y2="53"/>' +
      '</g></svg>'
    );

  const AVATAR_PLACEHOLDER =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">' +
      '<rect width="48" height="48" rx="24" fill="#1B5EFF"/>' +
      '<text x="50%" y="56%" text-anchor="middle" font-family="system-ui,sans-serif" ' +
      'font-size="20" font-weight="700" fill="#fff">?</text></svg>'
    );

  function classify(img) {
    const cls = (img.className || '').toString().toLowerCase();
    const alt = (img.alt || '').toLowerCase();
    if (cls.includes('avatar') || alt.includes('avatar') || img.closest('.user-avatar, .avatar, .conv-avatar, .seller-avatar')) {
      return AVATAR_PLACEHOLDER;
    }
    return PRODUCT_PLACEHOLDER;
  }

  document.addEventListener(
    'error',
    function (e) {
      const t = e.target;
      if (!(t && t.tagName === 'IMG')) return;
      if (t.dataset.fallbackApplied === '1') return;
      t.dataset.fallbackApplied = '1';
      t.src = classify(t);
      t.style.objectFit = t.style.objectFit || 'cover';
    },
    true
  );
})();
