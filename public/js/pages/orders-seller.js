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

  const statusToLabel = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    completed: 'Completed',
    cancelled: 'Cancelled'
  };

  function closeStatusMenus(exceptMenu = null) {
    document.querySelectorAll('.order-status-menu.open').forEach((menu) => {
      if (exceptMenu && menu === exceptMenu) return;
      menu.classList.remove('open');
      const trigger = menu.querySelector('.order-status-trigger');
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
    });
  }

  function decorateStatusMenu(menu, status) {
    if (!menu) return;

    ['status-pending', 'status-confirmed', 'status-completed', 'status-cancelled'].forEach((className) => {
      menu.classList.remove(className);
    });

    const nextStatus = status || 'pending';
    menu.classList.add(`status-${nextStatus}`);
    menu.dataset.status = nextStatus;

    const triggerLabel = menu.querySelector('.order-status-trigger-label');
    if (triggerLabel) triggerLabel.textContent = statusToLabel[nextStatus] || nextStatus;

    menu.querySelectorAll('.order-status-option').forEach((option) => {
      const selected = option.dataset.statusValue === nextStatus;
      option.classList.toggle('active', selected);
      option.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
  }

  function setTableMessage(tbody, message) {
    const row = createElement('tr');
    row.appendChild(createElement('td', {
      className: 'empty',
      attrs: { colspan: '6' },
      text: message
    }));
    tbody.replaceChildren(row);
  }

  function createStatusMenu(order) {
    const currentStatus = order.status || 'pending';
    const menu = createElement('div', {
      className: 'order-status-menu',
      dataset: { orderId: order._id, prev: currentStatus, status: currentStatus }
    });

    const trigger = createElement('button', {
      className: 'order-status-trigger',
      attrs: {
        type: 'button',
        'aria-haspopup': 'true',
        'aria-expanded': 'false'
      },
      dataset: { action: 'toggle-status-menu' },
      children: [
        createElement('span', { className: 'order-status-trigger-label', text: statusToLabel[currentStatus] || currentStatus }),
        createElement('span', { className: 'order-status-trigger-icon', text: '▾' })
      ]
    });

    const panel = createElement('div', {
      className: 'order-status-panel',
      attrs: { role: 'menu' }
    });

    ['pending', 'confirmed', 'completed', 'cancelled'].forEach((status) => {
      panel.appendChild(createElement('button', {
        className: 'order-status-option',
        attrs: { type: 'button', role: 'menuitem' },
        dataset: { action: 'select-status', statusValue: status },
        children: [
          createElement('span', { className: 'order-status-option-dot' }),
          createElement('span', { className: 'order-status-option-label', text: statusToLabel[status] || status })
        ]
      }));
    });

    menu.append(trigger, panel);
    decorateStatusMenu(menu, currentStatus);
    return menu;
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
                createElement('div', { className: 'order-preview-label', text: 'Fulfillment' }),
                createElement('div', { className: 'order-preview-value', text: order.deliveryMode === 'ship' ? 'Shipping' : 'Pickup' }),
                createElement('div', { className: 'seller-insight-note', text: order.deliveryMode === 'ship' ? 'Deliver to buyer address' : 'Meet buyer at the agreed pickup point' })
              ]
            }),
            createElement('div', {
              className: 'order-preview-card',
              children: [
                createElement('div', { className: 'order-preview-label', text: 'Payment + note' }),
                createElement('div', { className: 'order-preview-value', text: order.paymentMode === 'qr' ? 'QR Transfer' : order.paymentMode === 'card' ? 'Card' : 'Cash' }),
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
    row.appendChild(createElement('td', { attrs: { colspan: '6' }, children: [preview] }));
    return row;
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
        createElement('div', { className: 'seller-insight-note', text: `Qty ${order.quantity || 1} · ${order.deliveryMode === 'ship' ? 'Shipping' : 'Pickup'}` })
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
        createStatusMenu(order)
      ]
    });

    [
      createElement('td', { style: { fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--t2)' }, text: String(order._id || '').slice(-8).toUpperCase() }),
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

  async function updateStatus(orderId, status, menuEl) {
    const original = menuEl.dataset.prev || menuEl.dataset.status || 'pending';
    if (status === original) return;
    decorateStatusMenu(menuEl, status);
    closeStatusMenus();

    const needsConfirm = status === 'cancelled' || status === 'completed';
    if (needsConfirm) {
      const confirmed = typeof showConfirm === 'function' && await showConfirm({
        title: `Mark order as ${status}?`,
        message: status === 'cancelled'
          ? 'This action should be used intentionally because it changes the seller workflow and buyer expectation.'
          : 'Confirm that this order has been fully completed before updating the status.',
        confirmText: `Mark ${status}`,
        type: status === 'cancelled' ? 'danger' : 'info'
      });
      if (!confirmed) {
        decorateStatusMenu(menuEl, original);
        return;
      }
    }

    menuEl.classList.add('is-busy');
    menuEl.querySelectorAll('button').forEach((button) => {
      button.disabled = true;
    });
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
      menuEl.dataset.prev = status;
      renderOrders();
      if (typeof showToast === 'function') showToast('Order updated to ' + status, 'ok');
    } catch {
      decorateStatusMenu(menuEl, original);
      if (typeof showToast === 'function') showToast('Failed to update order', 'err');
    } finally {
      menuEl.classList.remove('is-busy');
      menuEl.querySelectorAll('button').forEach((button) => {
        button.disabled = false;
      });
    }
  }

  document.addEventListener('click', (e) => {
    const statusToggle = e.target.closest('[data-action="toggle-status-menu"]');
    if (statusToggle) {
      const menu = statusToggle.closest('.order-status-menu');
      if (!menu || menu.classList.contains('is-busy')) return;
      const nextOpen = !menu.classList.contains('open');
      closeStatusMenus(nextOpen ? menu : null);
      menu.classList.toggle('open', nextOpen);
      statusToggle.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
      return;
    }

    const statusOption = e.target.closest('[data-action="select-status"][data-status-value]');
    if (statusOption) {
      const menu = statusOption.closest('.order-status-menu');
      if (!menu || menu.classList.contains('is-busy')) return;
      updateStatus(menu.dataset.orderId, statusOption.dataset.statusValue, menu);
      return;
    }

    const toggle = e.target.closest('[data-toggle-preview]');
    if (toggle) {
      const orderId = toggle.dataset.togglePreview;
      expandedOrderId = expandedOrderId === orderId ? '' : orderId;
      closeStatusMenus();
      renderOrders();
      return;
    }

    if (!e.target.closest('.order-status-menu')) {
      closeStatusMenus();
    }
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => loadSellerOrders(1), { once: true });
  } else {
    loadSellerOrders(1);
  }
})();

