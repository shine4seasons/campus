const paymentConfig = window.PAYMENT_PAGE_CONFIG || {};
const PAYMENT_ID = paymentConfig.paymentId || '';
const EXPIRED_AT = new Date(paymentConfig.expiredAt || '').getTime();
const TRACKING_URL = paymentConfig.trackingUrl || '/';
const IS_ALREADY_PAID = Boolean(paymentConfig.isAlreadyPaid);
const { createElement } = window.AppUtils || {};

let paidCountdownTimer = null;
let paidRedirectTimer = null;
let paidOverlayShown = false;

function updateTimer() {
  const now = new Date().getTime();
  const diff = EXPIRED_AT - now;

  if (diff <= 0) {
    document.getElementById('timer').textContent = '00:00';
    const countdownText = document.getElementById('countdown-text');
    countdownText.replaceChildren(
      document.createTextNode('Payment session '),
      createElement('strong', { text: 'Expired' }),
      document.createTextNode('. Please try again.')
    );
    return;
  }

  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  document.getElementById('timer').textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

async function checkStatus() {
  try {
    const res = await fetch(`/api/payments/${PAYMENT_ID}/check`, {
      method: 'GET',
      credentials: 'include',
    });
    const json = await res.json();

    if (json.success) {
      if (json.status === 'PAID') {
        const badge = document.getElementById('payment-status-badge');
        badge.className = 'payment-status-badge status-paid';
        badge.replaceChildren(
          createElement('i', { attrs: { 'data-lucide': 'check-circle' }, style: { width: '16px', height: '16px' } }),
          document.createTextNode(' Payment Successful')
        );
        showPaidOverlay();
        return;
      }
      if (json.status === 'EXPIRED') {
        window.location.reload();
        return;
      }
    }
  } catch (err) {
    window.AppUtils?.reportClientError('[Payment Polling] Error checking status:', err);
  }

  setTimeout(checkStatus, 3000);
}

window.copyToClipboard = function (text) {
  navigator.clipboard.writeText(text);
};

function showPaidOverlay() {
  if (paidOverlayShown) return;
  paidOverlayShown = true;
  const overlay = document.getElementById('paid-overlay');
  const countdownEl = document.getElementById('paid-countdown');
  let remaining = 5;
  countdownEl.textContent = `Auto return home in ${remaining}s`;
  overlay.classList.add('show');
  lucide.createIcons();

  clearInterval(paidCountdownTimer);
  clearTimeout(paidRedirectTimer);

  paidCountdownTimer = setInterval(() => {
    remaining -= 1;
    countdownEl.textContent = `Auto return home in ${Math.max(remaining, 0)}s`;
    if (remaining <= 0) clearInterval(paidCountdownTimer);
  }, 1000);

  paidRedirectTimer = setTimeout(() => {
    window.location.href = '/';
  }, 5000);
}

window.goHomeAfterPaid = function () {
  clearInterval(paidCountdownTimer);
  clearTimeout(paidRedirectTimer);
  window.location.href = '/';
};

window.goTrackAfterPaid = function () {
  clearInterval(paidCountdownTimer);
  clearTimeout(paidRedirectTimer);
  window.location.href = TRACKING_URL;
};

document.addEventListener('click', function (event) {
  const target = event.target.closest('[data-action]');
  if (!target) return;

  if (target.dataset.action === 'copy') {
    window.copyToClipboard(target.dataset.copyValue || '');
  }
  if (target.dataset.action === 'go-home-after-paid') {
    window.goHomeAfterPaid();
  }
  if (target.dataset.action === 'go-track-after-paid') {
    window.goTrackAfterPaid();
  }
});

setInterval(updateTimer, 1000);
updateTimer();

if (IS_ALREADY_PAID) {
  const badge = document.getElementById('payment-status-badge');
  badge.className = 'payment-status-badge status-paid';
  badge.replaceChildren(
    createElement('i', { attrs: { 'data-lucide': 'check-circle' }, style: { width: '16px', height: '16px' } }),
    document.createTextNode(' Payment Successful')
  );
  showPaidOverlay();
} else {
  checkStatus();
}

lucide.createIcons();
