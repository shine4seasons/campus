let currentStatusFilter = 'all';
let currentOrderSearch = '';

function applyBuyerOrderFilters() {
  const ordersList = document.getElementById('ordersList');
  if (!ordersList) return;
  const cards = ordersList.querySelectorAll('.order-card');
  cards.forEach((card) => {
    const statusMatch = currentStatusFilter === 'all' || card.dataset.status === currentStatusFilter;
    const searchMatch = !currentOrderSearch || String(card.dataset.searchText || '').includes(currentOrderSearch);
    card.style.display = statusMatch && searchMatch ? 'flex' : 'none';
  });
}

document.querySelectorAll('.f-pill').forEach((pill) => {
  pill.addEventListener('click', function () {
    currentStatusFilter = this.dataset.status || 'all';
    document.querySelectorAll('.f-pill').forEach((p) => p.classList.remove('on'));
    this.classList.add('on');
    applyBuyerOrderFilters();
  });
});

document.getElementById('buyer-orders-search')?.addEventListener('input', (event) => {
  currentOrderSearch = event.target.value.trim().toLowerCase();
  applyBuyerOrderFilters();
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

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action="cancel-order"][data-order-id]');
  if (button) window.cancelOrder(button.dataset.orderId);
});
