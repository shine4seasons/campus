(() => {
  const { createElement } = window.AppUtils || {};

  let currentFilter = '';
  let currentSearch = '';
  let loadedOrders = [];
  let expandedOrderId = '';

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
      const option = createElement('option', { attrs: { value: status }, text: status });
      if ((order.status || 'pending') === status) option.selected = true;
      select.appendChild(option);
    });
    return select;
  }

  function createStatusBadge(status) {
    return createElement('span', {
      className: 'badge ' + (statusToClass[status] || 'badge-pending'),
      text: status || 'pending'
    });
  }

  function createOrderPreviewRow(order) {
    const row = createElement('tr', {
      className: 'order-preview-row',
      style: { display: expandedOrderId === order._id ? '' : 'none' }
    });
    const preview = createElement('div', {
      className: 'order-preview',
      children: [
        createElement('div', {
          className: 'order-preview-grid',
          children: [
            createElement('div', {
              className: 'order-preview-card',
              children: [
                createElement('div', { className: 'order-preview-label', text: 'Buyer quick info' }),
                createElement('div', { className: 'order-preview-value', text: order.buyer?.nickname || order.buyer?.name || '-' }),
                createElement('div', { className: 'seller-insight-note', text: order.buyer?.email || 'No buyer email available' })
              ]
            }),
            createElement('div', {
              className: 'order-preview-card',
              children: [
                createElement('div', { className: 'order-preview-label', text: 'Delivery + payment' }),
                createElement('div', { className: 'order-preview-value', text: `${order.deliveryMode === 'ship' ? 'Ship' : 'Pickup'} / ${order.paymentMode === 'qr' ? 'QR' : order.paymentMode === 'card' ? 'Card' : 'Cash'}` }),
                createElement('div', { className: 'seller-insight-note', text: order.note || 'No additional buyer note' })
              ]
            }),
            createElement('div', {
              className: 'order-preview-card',
              children: [
                createElement('div', { className: 'order-preview-label', text: 'Order summary' }),
                createElement('div', { className: 'order-preview-value', text: window.AppUtils.formatVND(order.priceSnapshot || 0) }),
                createElement('div', { className: 'seller-insight-note', text: `Qty ${order.quantity || 1} · Created ${new Date(order.createdAt || Date.now()).toLocaleDateString()}` })
              ]
            })
          ]
        })
      ]
    });
    row.appendChild(createElement('td', { attrs: { colspan: '10' }, children: [preview] }));
    return row;
  }

  function createOrderMainRow(order) {
    const price = window.AppUtils.formatVND(order.priceSnapshot || 0);
    const row = createElement('tr', {
      dataset: { orderId: order._id }
    });
    const buyerLink = createElement('a', {
      attrs: { href: '/user/' + (order.buyer?._id || '') },
      style: { color: '#1B5EFF', textDecoration: 'none', fontWeight: '700' },
      text: order.buyer?.nickname || order.buyer?.name || '-'
    });
    const productCell = createElement('div', {
      children: [
        createElement('div', { style: { fontWeight: '800' }, text: order.product?.title || '-' }),
        createElement('div', { className: 'seller-insight-note', text: String(order._id || '').slice(-8).toUpperCase() })
      ]
    });
    const actionsWrap = createElement('div', {
      className: 'tbl-actions',
      children: [
        createElement('button', {
          className: 'act-btn',
          attrs: { type: 'button' },
          dataset: { togglePreview: order._id },
          text: expandedOrderId === order._id ? 'Hide details' : 'Preview'
        }),
        createStatusSelect(order)
      ]
    });

    [
      createElement('td', { style: { fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--t2)' }, text: String(order._id || '').slice(-8).toUpperCase() }),
      createElement('td', { children: [productCell] }),
      createElement('td', { children: [buyerLink] }),
      createElement('td', { text: order.quantity || 1 }),
      createElement('td', { children: [createElement('strong', { text: price })] }),
      createElement('td', { style: { color: 'var(--t2)' }, text: order.deliveryMode === 'ship' ? 'Ship' : 'Pickup' }),
      createElement('td', { style: { color: 'var(--t2)' }, text: order.paymentMode === 'qr' ? 'QR' : order.paymentMode === 'card' ? 'Card' : 'Cash' }),
      createElement('td', { style: { color: 'var(--t3)', fontSize: '12px' }, text: order.note || '-' }),
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

    const rows = [];
    filtered.forEach((order) => {
      rows.push(createOrderMainRow(order), createOrderPreviewRow(order));
    });
    tbody.replaceChildren(...rows);
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
      expandedOrderId = '';
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

  async function updateStatus(orderId, status, selectEl) {
    const original = selectEl.dataset.prev || selectEl.value;
    if (status === original) return;

    const needsConfirm = status === 'cancelled' || status === 'completed';
    if (needsConfirm) {
      const confirmed = typeof showConfirm === 'function'
        ? await showConfirm({
            title: `Mark order as ${status}?`,
            message: status === 'cancelled'
              ? 'This action should be used intentionally because it changes the seller workflow and buyer expectation.'
              : 'Confirm that this order has been fully completed before updating the status.',
            confirmText: `Mark ${status}`,
            type: status === 'cancelled' ? 'danger' : 'info'
          })
        : window.confirm(`Mark order as ${status}?`);
      if (!confirmed) {
        selectEl.value = original;
        return;
      }
    }

    selectEl.disabled = true;
    try {
      const res = await fetch('/api/orders/' + encodeURIComponent(orderId) + '/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error('Request failed');

      const order = loadedOrders.find((item) => item._id === orderId);
      if (order) order.status = status;
      selectEl.dataset.prev = status;
      renderOrders();
      if (typeof showToast === 'function') showToast('Order updated to ' + status, 'ok');
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

  document.addEventListener('click', (e) => {
    const toggle = e.target.closest('[data-toggle-preview]');
    if (!toggle) return;
    const orderId = toggle.dataset.togglePreview;
    expandedOrderId = expandedOrderId === orderId ? '' : orderId;
    renderOrders();
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

  document.getElementById('seller-orders-search')?.addEventListener('input', (event) => {
    currentSearch = event.target.value.trim();
    renderOrders();
  });

  window.loadSellerOrders = loadSellerOrders;

  document.addEventListener('DOMContentLoaded', () => loadSellerOrders(1));
})();
