const { createElement: appCreateElement, createSvgElement: appCreateSvgElement } = window.AppUtils || {};
const profileConfig = window.AppUtils?.readJsonScript
  ? window.AppUtils.readJsonScript('profile-page-config')
  : {};

lucide.createIcons();

function createToastIcon(type) {
  if (type === 'err') {
    return appCreateSvgElement('svg', { xmlns: 'http://www.w3.org/2000/svg', width: '14', height: '14', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.5', 'stroke-linecap': 'round', style: 'flex-shrink:0' }, [
      appCreateSvgElement('line', { x1: '18', y1: '6', x2: '6', y2: '18' }),
      appCreateSvgElement('line', { x1: '6', y1: '6', x2: '18', y2: '18' })
    ]);
  }
  return appCreateSvgElement('svg', { xmlns: 'http://www.w3.org/2000/svg', width: '14', height: '14', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.5', 'stroke-linecap': 'round', style: 'flex-shrink:0' }, [
    appCreateSvgElement('polyline', { points: '20 6 9 17 4 12' })
  ]);
}

function setButtonLoading(button, text) {
  button.replaceChildren(
    appCreateSvgElement('svg', { width: '16', height: '16', viewBox: '0 0 24 24', style: 'animation:spin 0.7s linear infinite;display:inline-block;vertical-align:middle;margin-right:6px;' }, [
      appCreateSvgElement('circle', { cx: '12', cy: '12', r: '10', fill: 'none', stroke: 'rgba(255,255,255,0.4)', 'stroke-width': '2' }),
      appCreateSvgElement('path', { d: 'M12 2a10 10 0 0 1 10 10', fill: 'none', stroke: '#fff', 'stroke-width': '2' })
    ]),
    document.createTextNode(' ' + text)
  );
}

function toast(msg, type) {
  const c = document.getElementById('toast-wrap');
  if (!c) return;
  const t = document.createElement('div');
  t.className = 'toast ' + (type || 'ok');
  const text = document.createElement('span');
  text.textContent = msg;
  t.append(createToastIcon(type), text);
  c.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transition = 'opacity 0.3s';
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

if (profileConfig.isOwnProfile) {
  const bioInput = document.getElementById('f-bio');
  if (bioInput) {
    bioInput.addEventListener('input', function () {
      document.getElementById('bio-count').textContent = this.value.length + ' / 200';
    });
  }

  window.saveProfile = async function () {
    const nickname = document.getElementById('f-nickname').value.trim();
    const university = document.getElementById('f-university').value.trim();

    if (!nickname) {
      document.getElementById('f-nickname').style.borderColor = '#E84040';
      toast('Display name is required', 'err');
      return;
    }
    if (!university) {
      document.getElementById('f-university').style.borderColor = '#E84040';
      toast('University is required', 'err');
      return;
    }

    const btn = document.getElementById('btn-save');
    btn.disabled = true;
    setButtonLoading(btn, 'Saving...');

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname,
          university,
          phone: document.getElementById('f-phone').value.trim(),
          studentId: document.getElementById('f-student-id').value.trim(),
          bio: document.getElementById('f-bio').value.trim(),
          profileComplete: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Save failed');

      toast('Profile saved!', 'ok');
      document.getElementById('save-status').textContent = 'Last saved: ' + new Date().toLocaleTimeString();
      document.querySelector('.avatar-name').textContent = data.data.nickname || data.data.name;
    } catch (err) {
      toast(err.message || 'Failed to save', 'err');
    } finally {
      btn.disabled = false;
      btn.replaceChildren(
        appCreateElement('i', { attrs: { 'data-lucide': 'check' }, style: { width: '16px', height: '16px', display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' } }),
        document.createTextNode(' Save changes')
      );
      lucide.createIcons({ nodes: [document.getElementById('btn-save')] });
    }
  };

  const avatarUploadInput = document.getElementById('avatar-upload-input');
  if (avatarUploadInput) {
    avatarUploadInput.addEventListener('change', async function () {
      const file = this.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        toast('Image must be under 5MB', 'err');
        return;
      }

      const wrap = document.getElementById('avatar-wrap');
      wrap.classList.add('avatar-uploading');

      try {
        const formData = new FormData();
        formData.append('image', file);

        const res = await fetch('/api/upload/avatar', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Upload failed');

        document.getElementById('avatar-img').src = data.url;

        await fetch('/api/auth/profile', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatar: data.url }),
        });

        toast('Avatar updated!', 'ok');
      } catch (err) {
        toast(err.message || 'Upload failed', 'err');
      } finally {
        wrap.classList.remove('avatar-uploading');
        this.value = '';
      }
    });
  }

  ['f-nickname', 'f-university'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('focus', function () {
        this.style.borderColor = '';
      });
    }
  });
}

let reportTargetType = '';
let reportTargetId = '';

window.showReportModal = function (targetType, targetId) {
  reportTargetType = targetType;
  reportTargetId = targetId;
  document.getElementById('report-modal').style.display = 'flex';
  document.getElementById('report-reason').value = '';
  document.getElementById('report-content').value = '';
  document.getElementById('report-char-count').textContent = '0';
};

window.closeReportModal = function () {
  document.getElementById('report-modal').style.display = 'none';
};

window.submitReport = async function () {
  const reason = document.getElementById('report-reason').value;
  const content = document.getElementById('report-content').value;

  if (!reason) {
    toast('Please select a reason', 'err');
    return;
  }

  try {
    const res = await fetch('/api/report', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetType: reportTargetType,
        targetId: reportTargetId,
        reason,
        content,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to submit report');

    toast('Report submitted. Thank you!', 'ok');
    closeReportModal();
  } catch (err) {
    toast(err.message, 'err');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const textarea = document.getElementById('report-content');
  if (textarea) {
    textarea.addEventListener('input', () => {
      document.getElementById('report-char-count').textContent = textarea.value.length;
    });
  }

  if (!profileConfig.isViewingOwn && profileConfig.viewingUserId && document.getElementById('user-reviews-list')) {
    loadRatings('user', profileConfig.viewingUserId, 'user-reviews-list');
    loadRatingStats('user', profileConfig.viewingUserId, 'user-rating-stats-content');
  }
});

document.addEventListener('click', function (event) {
  const target = event.target.closest('[data-action]');
  if (!target) return;

  if (target.dataset.action === 'save-profile') {
    window.saveProfile();
  }
  if (target.dataset.action === 'show-report-modal') {
    window.showReportModal(target.dataset.targetType, target.dataset.targetId);
  }
  if (target.dataset.action === 'close-report-modal') {
    window.closeReportModal();
  }
  if (target.dataset.action === 'submit-report') {
    window.submitReport();
  }
});

document.getElementById('profile-products-search')?.addEventListener('input', (event) => {
  const term = event.target.value.trim().toLowerCase();
  document.querySelectorAll('[data-profile-product]').forEach((card) => {
    card.style.display = !term || String(card.dataset.searchText || '').includes(term) ? '' : 'none';
  });
});
