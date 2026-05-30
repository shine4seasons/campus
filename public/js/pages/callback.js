(async () => {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    const data = await res.json();

    if (!res.ok || !data.success) throw new Error('Not authenticated');

    const user = data.data || {};
    const message = document.getElementById('msg');
    if (message) message.textContent = `Welcome back, ${user.name || 'there'}!`;

    const redirectTo = sessionStorage.getItem('redirect_after_login') || '/';
    sessionStorage.removeItem('redirect_after_login');
    setTimeout(() => window.location.replace(redirectTo), 800);
  } catch (err) {
    window.AppUtils?.reportClientError('Callback authentication failed', err);
    const spinner = document.getElementById('spinner');
    const message = document.getElementById('msg');
    const errorCard = document.getElementById('err-card');
    if (spinner) spinner.style.display = 'none';
    if (message) message.style.display = 'none';
    if (errorCard) errorCard.style.display = 'block';
  }
})();
