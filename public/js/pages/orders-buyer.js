document.querySelectorAll('.f-pill').forEach((pill) => {
  pill.addEventListener('click', function () {
    const status = this.dataset.status;
    document.querySelectorAll('.f-pill').forEach((p) => p.classList.remove('on'));
    this.classList.add('on');
    const ordersList = document.getElementById('ordersList');
    if (!ordersList) return;
    const cards = ordersList.querySelectorAll('.order-card');
    cards.forEach((card) => {
      if (status === 'all' || card.dataset.status === status) {
        card.style.display = 'flex';
      } else {
        card.style.display = 'none';
      }
    });
  });
});

window.cancelOrder = async function (orderId) {
  if (typeof showConfirm !== 'function') return;
  const confirmed = await showConfirm({
    title: 'Cancel Order',
    message: 'Are you sure you want to cancel this order?',
    confirmText: 'Yes, Cancel',
    type: 'danger',
  });
  if (!confirmed) return;
  try {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    });
    const data = await res.json();
    if (data.success) {
      if (typeof showToast === 'function') showToast('Order cancelled', 'ok');
      setTimeout(() => location.reload(), 800);
    } else if (typeof showToast === 'function') {
      showToast(data.message || 'Failed', 'err');
    }
  } catch {
    if (typeof showToast === 'function') showToast('Error', 'err');
  }
};
