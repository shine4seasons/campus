(() => {
  const { createElement } = window.AppUtils || {};

  let currentFilter = '';

  const statusToClass = {
    pending: 'badge-pending',
    confirmed: 'badge-confirmed',
    completed: 'badge-completed',
    cancelled: 'badge-cancelled'
  };

  function setTableMessage(tbody, message) {
    const row = createElement('tr');
    row.appendChild(createElement('td', {
      className: 'empty',
      attrs: { colspan: '10' },
      text: message
    }));
    tbody.replaceChildren(row);
  }

  function createStatusSelect(order) {
    const select = createElement('select', {
      className: 'order-status-select',
      dataset: { orderId: order._id, prev: order.status || 'pending' }
    });
    ['pending', 'confirmed', 'completed', 'cancelled'].forEach((status) => {
      const option = createElement('option', {
        attrs: { value: status },
        text: status
      });
      if ((order.status || 'pending') === status) {
        option.selected = true;
      }
      select.appendChild(option);
    });
    return select;
  }

  function createOrderRow(order) {
    const price = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'VND' }).format(order.priceSnapshot || 0);
    const row = createElement('tr');
    const buyerLink = createElement('a', {
      attrs: { href: '/user/' + (order.buyer?._id || '') },
      style: { color: '#1B5EFF', textDecoration: 'none' },
      text: order.buyer?.nickname || order.buyer?.name || '-'
    });
    const badge = createElement('span', {
      className: 'badge ' + (statusToClass[order.status] || 'badge-pending'),
      text: order.status || 'pending'
    });
    const actionsWrap = createElement('div', {
      className: 'tbl-actions',
      children: [createStatusSelect(order)]
    });

    [
      createElement('td', {
        style: { fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--t2)' },
        text: String(order._id || '').slice(-8).toUpperCase()
      }),
      createElement('td', { text: order.product?.title || '-' }),
      createElement('td', { children: [buyerLink] }),
      createElement('td', { text: order.quantity || 1 }),
      createElement('td', { text: price }),
      createElement('td', { style: { color: 'var(--t2)' }, text: order.deliveryMode === 'ship' ? 'Ship' : 'Pickup' }),
      createElement('td', {
        style: { color: 'var(--t2)' },
        text: order.paymentMode === 'qr' ? 'QR' : order.paymentMode === 'card' ? 'Card' : 'Cash'
      }),
      createElement('td', { style: { color: 'var(--t3)', fontSize: '12px' }, text: order.note || '-' }),
      createElement('td', { children: [badge] }),
      createElement('td', { children: [actionsWrap] })
    ].forEach((cell) => row.appendChild(cell));

    return row;
  }

  async function loadSellerOrders(page = 1) {
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;
    setTableMessage(tbody, 'Loading orders...');

    try {
      const params = new URLSearchParams({ page, limit: 10, role: 'seller' });
      if (currentFilter) params.append('status', currentFilter);

      const res = await fetch(`/api/orders?${params}`, { credentials: 'same-origin' });
      const json = await res.json();

      if (!json.success) {
        setTableMessage(tbody, 'Failed to load orders.');
        return;
      }
      const orders = json.data || [];
      if (!orders.length) {
        setTableMessage(tbody, 'No orders found.');
        return;
      }

      tbody.replaceChildren(...orders.map(createOrderRow));

      if (typeof renderPagination === 'function') {
        renderPagination('.tbl-wrap .pagination', json.pagination, 'loadSellerOrders');
      }

      const countEl = document.querySelector('.tbl-count');
      if (countEl) countEl.textContent = `${json.pagination?.total || orders.length} orders total`;
    } catch (err) {
      setTableMessage(tbody, 'Failed to load orders.');
      console.error('Failed to fetch seller orders:', err);
    }
  }

  async function updateStatus(orderId, status, selectEl) {
    const original = selectEl.dataset.prev || selectEl.value;
    selectEl.disabled = true;
    try {
      const res = await fetch('/api/orders/' + encodeURIComponent(orderId) + '/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error('Request failed');
      const row = selectEl.closest('tr');
      const badge = row.querySelector('.badge');
      if (badge) {
        badge.className = 'badge ' + (statusToClass[status] || 'badge-pending');
        badge.textContent = status;
      }
      if (typeof showToast === 'function') showToast('Order updated to ' + status, 'ok');
      selectEl.dataset.prev = status;
    } catch {
      selectEl.value = original;
      if (typeof showToast === 'function') showToast('Failed to update order', 'err');
    } finally {
      selectEl.disabled = false;
    }
  }

  document.addEventListener('change', (e) => {
    const sel = e.target.closest('.order-status-select');
    if (!sel) return;
    updateStatus(sel.dataset.orderId, sel.value, sel);
  });

  document.querySelectorAll('.filter-pills .f-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.filter-pills .f-pill').forEach((p) => p.classList.remove('on'));
      pill.classList.add('on');
      const txt = pill.textContent.trim().toLowerCase();
      if (txt === 'all') currentFilter = '';
      else if (txt === 'needs action') currentFilter = 'pending';
      else if (txt === 'in progress') currentFilter = 'confirmed';
      else if (txt === 'completed') currentFilter = 'completed';
      else currentFilter = txt;
      loadSellerOrders(1);
    });
  });

  window.loadSellerOrders = loadSellerOrders;

  document.addEventListener('DOMContentLoaded', () => loadSellerOrders(1));
})();
