(() => {
  const { createElement } = window.AppUtils || {};

  let currentFilter = '';
  let currentSearch = '';
  let loadedOrders = [];

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
      attrs: { colspan: '6' },
      text: message
    }));
    tbody.replaceChildren(row);
  }

  function createStatusBadge(status) {
    return createElement('span', {
      className: 'badge ' + (statusToClass[status] || 'badge-pending'),
      text: status || 'pending'
    });
  }

  function createOrderMainRow(order) {
    const price = window.AppUtils.formatVND(order.priceSnapshot || 0);
    const row = createElement('tr', {
      dataset: { orderId: order._id }
    });

    const buyerLink = createElement('a', {
      className: 'seller-order-buyer-link',
      attrs: { href: '/user/' + (order.buyer?._id || '') },
      text: order.buyer?.nickname || order.buyer?.name || '-'
    });

    const productCell = createElement('div', {
      className: 'seller-order-product-cell',
      children: [
        createElement('div', { className: 'seller-order-product-title', text: order.product?.title || '-' }),
        createElement('div', { className: 'seller-insight-note', text: `Qty ${order.quantity || 1} | ${order.deliveryMode === 'ship' ? 'Shipping' : 'Pickup'}` })
      ]
    });

    const actionsWrap = createElement('div', {
      className: 'tbl-actions',
      children: [
        createElement('a', {
          className: 'seller-order-view-link',
          attrs: { href: `/orders/tracking/${order._id}` },
          text: 'View'
        })
      ]
    });

    [
      createElement('td', {
        style: { fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--t2)' },
        text: String(order._id || '').slice(-8).toUpperCase()
      }),
      createElement('td', { children: [productCell] }),
      createElement('td', { children: [buyerLink] }),
      createElement('td', { className: 'seller-order-price-cell', children: [createElement('strong', { className: 'seller-order-price', text: price })] }),
      createElement('td', { children: [createStatusBadge(order.status)] }),
      createElement('td', { children: [actionsWrap] })
    ].forEach((cell) => row.appendChild(cell));

    return row;
  }

  function renderOrders() {
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;

    let filtered = [...loadedOrders];
    if (currentSearch) {
      const q = currentSearch.toLowerCase();
      filtered = filtered.filter((order) => {
        const haystack = `${order.product?.title || ''} ${order.buyer?.nickname || order.buyer?.name || ''} ${order._id || ''}`.toLowerCase();
        return haystack.includes(q);
      });
    }

    if (!filtered.length) {
      setTableMessage(tbody, currentSearch ? 'No matching orders found.' : 'No orders found.');
      return;
    }

    tbody.replaceChildren(...filtered.map(createOrderMainRow));
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

      loadedOrders = json.data || [];
      renderOrders();

      if (typeof renderPagination === 'function') {
        renderPagination('.tbl-wrap .pagination', json.pagination, 'loadSellerOrders');
      }

      const countEl = document.querySelector('.tbl-count');
      if (countEl) countEl.textContent = `${json.pagination?.total || loadedOrders.length} orders total`;
    } catch (err) {
      setTableMessage(tbody, 'Failed to load orders.');
      window.AppUtils?.reportClientError('Failed to fetch seller orders:', err);
    }
  }

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

  document.getElementById('seller-orders-search')?.addEventListener('input', (event) => {
    currentSearch = event.target.value.trim();
    renderOrders();
  });

  window.loadSellerOrders = loadSellerOrders;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => loadSellerOrders(1), { once: true });
  } else {
    loadSellerOrders(1);
  }
})();
