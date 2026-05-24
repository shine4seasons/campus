document.getElementById('google-btn').addEventListener('click', function () {
  this.classList.add('loading');
  window.location.href = '/api/auth/google';
});
const { createElement, createSvgElement } = window.AppUtils || {};

function setSubmitButton(button, loading) {
  if (loading) {
    button.replaceChildren(
      createSvgElement('svg', { width: '18', height: '18', viewBox: '0 0 24 24', style: 'animation:spin 0.7s linear infinite' }, [
        createSvgElement('circle', { cx: '12', cy: '12', r: '10', fill: 'none', stroke: 'rgba(255,255,255,0.3)', 'stroke-width': '2' }),
        createSvgElement('path', { d: 'M12 2a10 10 0 0 1 10 10', fill: 'none', stroke: '#fff', 'stroke-width': '2' })
      ]),
      document.createTextNode(' Saving...')
    );
    return;
  }
  button.replaceChildren(
    createSvgElement('svg', { width: '18', height: '18', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.5' }, [
      createSvgElement('polyline', { points: '20 6 9 17 4 12' })
    ]),
    document.createTextNode(' Finish & Go to homepage')
  );
}

window.submitProfile = async function () {
  const nickname = document.getElementById('f-nickname').value.trim();
  const university = document.getElementById('f-university').value.trim();
  const phone = document.getElementById('f-phone').value.trim();
  const studentId = document.getElementById('f-student-id').value.trim();
  const bio = document.getElementById('f-bio').value.trim();

  let ok = true;
  ['f-nickname', 'f-university'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el.value.trim()) {
      el.classList.add('has-error');
      ok = false;
    } else {
      el.classList.remove('has-error');
    }
  });
  if (!ok) return;

  const btn = document.getElementById('btn-submit');
  btn.disabled = true;
  setSubmitButton(btn, true);

  try {
    const res = await fetch('/api/auth/profile', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, phone, university, studentId, bio, profileComplete: true }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed');
    showSuccess('Profile saved. Redirecting to homepage...');
  } catch (err) {
    btn.disabled = false;
    setSubmitButton(btn, false);
    const errEl = document.getElementById('step2-error');
    document.getElementById('step2-error-text').textContent = err.message || 'Unable to save profile. Please try again.';
    errEl.style.display = 'flex';
  }
};

window.skipProfile = async function () {
  try {
    await fetch('/api/auth/profile', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileComplete: true }),
    });
  } catch {}
  document.getElementById('success-msg').textContent = 'You can complete your profile later in Settings.';
  showSuccess();
};

function showSuccess(msg) {
  if (msg) document.getElementById('success-msg').textContent = msg;
  document.getElementById('success-flash').classList.add('show');
  setTimeout(() => {
    window.location.href = '/';
  }, 1600);
}

if (typeof lucide !== 'undefined') {
  lucide.createIcons();
}

document.addEventListener('click', function (event) {
  const target = event.target.closest('[data-action]');
  if (!target) return;

  if (target.dataset.action === 'submit-profile') {
    window.submitProfile();
  }
  if (target.dataset.action === 'skip-profile') {
    window.skipProfile();
  }
});

const urlParams = new URLSearchParams(window.location.search);
const errorParam = urlParams.get('error');
if (errorParam === 'banned') {
  if (!document.getElementById('toast-wrap')) {
    const wrap = document.createElement('div');
    wrap.id = 'toast-wrap';
    document.body.appendChild(wrap);
  }
  if (typeof showToast === 'function') {
    showToast('This account has been banned.', 'err');
  }
}
