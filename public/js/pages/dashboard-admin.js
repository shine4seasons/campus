(() => {
  const { createElement } = window.AppUtils || {};

  function safeToast(message, type) {
    const normalizedType = type === 'error' ? 'err' : (type || 'ok');
    if (typeof window.showToast === 'function') {
      window.showToast(message || 'Action failed', normalizedType);
      return;
    }
    window.AppUtils?.reportClientWarn(message || 'Action failed');
  }

  async function safeConfirm({ title, message, confirmText }) {
    if (typeof window.showConfirm === 'function') {
      return window.showConfirm({ title, message, confirmText });
    }
    safeToast('Confirmation dialog is still loading. Please try again.', 'info');
    return false;
  }

  function setTableMessage(tbody, colspan, message, color) {
    const row = createElement('tr');
    row.appendChild(createElement('td', {
      attrs: { colspan: String(colspan) },
      style: { textAlign: 'center', color: color || 'var(--t2)', padding: '24px' },
      text: message
    }));
    tbody.replaceChildren(row);
  }

  function setLoadingMessage(tbody, colspan, message) {
    const row = createElement('tr');
    const cell = createElement('td', {
      attrs: { colspan: String(colspan) },
      style: { textAlign: 'center', color: 'var(--t2)', padding: '32px' }
    });
    cell.appendChild(createElement('span', { className: 'adm-loader' }));
    cell.appendChild(document.createTextNode(' ' + message));
    row.appendChild(cell);
    tbody.replaceChildren(row);
  }

  function badgeIconFor(text, className) {
    const key = `${className} ${text}`.toLowerCase();
    if (key.includes('completed') || key.includes('active') || key.includes('paid')) return '+';
    if (key.includes('pending') || key.includes('processing') || key.includes('review')) return '~';
    if (key.includes('cancelled') || key.includes('banned') || key.includes('rejected') || key.includes('hidden')) return 'x';
    if (key.includes('reported') || key.includes('warning')) return '!';
    return 'i';
  }

  function createBadge(text, className) {
    return createElement('span', {
      className,
      children: [
        createElement('span', { className: 'badge-icon', text: badgeIconFor(text, className) }),
        createElement('span', { text })
      ]
    });
  }

  function createActionButton(label, className, onClick) {
    const button = createElement('button', { className, attrs: { type: 'button' }, text: label });
    if (typeof onClick === 'function') button.addEventListener('click', onClick);
    return button;
  }

  function createIcon(name, size = 16) {
    const icon = createElement('i', {
      attrs: {
        'data-lucide': name,
        'aria-hidden': 'true'
      }
    });
    icon.style.width = `${size}px`;
    icon.style.height = `${size}px`;
    return icon;
  }

  function entityLink({ href, text, className = 'admin-entity-link', title }) {
    const label = text || '-';
    if (!href || label === '-') {
      return createElement('span', { className, text: label });
    }
    return createElement('a', {
      className,
      attrs: { href, title: title || label },
      text: label
    });
  }

  function userProfileLink(user, options = {}) {
    const label = user?.nickname || user?.name || '-';
    const userId = user?._id ? String(user._id) : '';
    return entityLink({
      href: userId ? `/user/${encodeURIComponent(userId)}` : '',
      text: label,
      className: options.className || 'admin-entity-link admin-user-link',
      title: label
    });
  }

  function productLink(product, options = {}) {
    const label = product?.title || '-';
    const productId = product?._id ? String(product._id) : '';
    return entityLink({
      href: productId ? `/products/${encodeURIComponent(productId)}` : '',
      text: label,
      className: options.className || 'admin-entity-link admin-product-link',
      title: label
    });
  }

  function createActionMenu(label, items) {
    const details = createElement('details', { className: 'action-menu' });
    const summary = createElement('summary', { className: 'act-btn primary', text: label });
    const panel = createElement('div', { className: 'action-menu-panel' });
    items.forEach((item) => {
      panel.appendChild(createActionButton(item.label, item.className || 'act-btn', item.onClick));
    });
    details.append(summary, panel);
    return details;
  }

  function formatDeliveryMode(mode) {
    if (mode === 'pickup') return 'Pickup';
    if (mode === 'ship') return 'Ship';
    return '-';
  }

  function formatPaymentMode(mode) {
    if (mode === 'cash') return 'Cash';
    if (mode === 'qr') return 'QR Transfer';
    if (mode === 'card') return 'Card';
    return '-';
  }

  function formatDate(date, options) {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', options || { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function focusVisibleAdminSearch() {
    const activeSection = document.querySelector('.dashboard-admin .section.active');
    if (!activeSection) return false;
    const input = activeSection.querySelector('.tbl-search input:not([disabled])');
    if (!input) return false;
    input.focus();
    if (typeof input.select === 'function') input.select();
    return true;
  }

  document.addEventListener('keydown', (event) => {
    if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
    if (focusVisibleAdminSearch()) event.preventDefault();
  });

  document.addEventListener('click', (event) => {
    const insideMenu = event.target.closest('.action-menu');
    document.querySelectorAll('.action-menu[open]').forEach((menu) => {
      if (menu !== insideMenu) menu.removeAttribute('open');
    });
  });

  function updateReportCounters({ pendingReports, reportedProducts }) {
    const reportCount = Number(pendingReports || 0);
    const reportedProductCount = Number(reportedProducts || 0);
    const reportedProductsEl = document.getElementById('reported-products-count');
    if (reportedProductsEl) reportedProductsEl.textContent = String(reportedProductCount);

    const reportAlertEl = document.getElementById('reports-alert-text');
    if (reportAlertEl) {
      reportAlertEl.textContent = `There are ${reportCount} reported item${reportCount === 1 ? '' : 's'} awaiting review. Please review and take action promptly.`;
    }
  }

  async function refreshAdminModerationStats() {
    try {
      const res = await fetch('/api/admin/stats');
      if (!res.ok) return;
      const json = await res.json();
      updateReportCounters(json.data || {});
    } catch {
      // ignore opportunistic refresh errors
    }
  }

  (function usersTable() {
    const AVATAR_COLORS = [
      { bg: '#dbeafe', fg: '#1d4ed8' },
      { bg: '#dcfce7', fg: '#15803d' },
      { bg: '#fef3c7', fg: '#b45309' },
      { bg: '#ede9fe', fg: '#6d28d9' },
      { bg: '#fee2e2', fg: '#b91c1c' },
      { bg: '#ccfbf1', fg: '#0f766e' }
    ];
    const selectedUsers = new Set();
    const selectAll = document.getElementById('usersSelectAll');
    const bulkBar = document.getElementById('usersBulkBar');
    const bulkCount = document.getElementById('usersSelectedCount');

    function getAvatarColor(str) {
      let h = 0;
      for (let i = 0; i < str.length; i += 1) h = str.charCodeAt(i) + ((h << 5) - h);
      return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
    }

    function getInitials(name) {
      return (name || '?').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
    }

    function createTrustChip(user) {
      if (user.banned) return createElement('span', { className: 'meta-chip warn', text: 'Restricted' });
      if (user.role === 'admin') return createElement('span', { className: 'meta-chip', text: 'Verified staff' });
      if (Number(user.rating || 0) >= 4.7 && Number(user.totalSales || 0) >= 5) {
        return createElement('span', { className: 'meta-chip good', text: 'Trusted seller' });
      }
      if (Number(user.totalSales || 0) === 0 && Number(user.totalPurchases || 0) <= 1) {
        return createElement('span', { className: 'meta-chip', text: 'New account' });
      }
      return createElement('span', { className: 'meta-chip', text: 'Standard account' });
    }

    function createRoleBadge(user) {
      if (user.role === 'admin') return createBadge('Admin', 'badge badge-admin');
      if (user.banned) return createBadge('Banned', 'badge badge-cancelled');
      return createBadge('User', 'badge badge-active');
    }

    function updateBulkBar() {
      if (bulkCount) bulkCount.textContent = String(selectedUsers.size);
      if (bulkBar) bulkBar.classList.toggle('show', selectedUsers.size > 0);
      if (selectAll) {
        const rowChecks = [...document.querySelectorAll('#usersTableBody .user-select')];
        const checkedCount = rowChecks.filter((box) => box.checked).length;
        selectAll.checked = rowChecks.length > 0 && checkedCount === rowChecks.length;
        selectAll.indeterminate = checkedCount > 0 && checkedCount < rowChecks.length;
      }
    }

    function createUserActions(user) {
      const wrap = createElement('div', { className: 'tbl-actions' });
      wrap.appendChild(createActionButton('View', 'act-btn primary', () => {
        window.location.href = `/user/${user._id}`;
      }));

      if (user.banned) {
        wrap.appendChild(createActionButton('Unban', 'act-btn success', () => adminToggleBan(user._id, false)));
      } else if (user.role === 'admin') {
        wrap.appendChild(createActionButton('Revoke admin', 'act-btn', () => safeToast('Admin privileges revoked', 'ok')));
      } else {
        wrap.appendChild(createActionButton('Ban user', 'act-btn danger', () => adminToggleBan(user._id, true)));
      }
      return wrap;
    }

    function createUserRow(user) {
      const row = createElement('tr');
      const colors = getAvatarColor(user._id || '');
      const joined = user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '-';
      const sellerLink = createElement('a', {
        attrs: { href: `/user/${user._id}` },
        style: { textDecoration: 'none', color: 'inherit' }
      });
      const userCell = createElement('div', { className: 'user-cell' });
      userCell.append(
        createElement('div', {
          className: 'uc-avatar',
          style: { background: colors.bg, color: colors.fg },
          text: getInitials(user.nickname || user.name)
        }),
        createElement('div', {
          className: 'uc-body',
          children: [
            createElement('div', {
              className: 'uc-name',
              style: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '220px' },
              text: user.nickname || user.name || '-'
            }),
            createElement('div', {
              className: 'uc-sub',
              style: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '220px' },
              text: user.email || ''
            }),
            createElement('div', {
              className: 'uc-meta',
              children: [
                createTrustChip(user),
                createElement('span', { className: 'meta-chip', text: `Joined ${joined}` })
              ]
            })
          ]
        })
      );
      sellerLink.appendChild(userCell);

      const checkbox = createElement('input', {
        className: 'admin-checkbox user-select',
        attrs: { type: 'checkbox', 'aria-label': `Select ${user.nickname || user.name || 'user'}` }
      });
      checkbox.dataset.userId = user._id;
      checkbox.checked = selectedUsers.has(user._id);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) selectedUsers.add(user._id);
        else selectedUsers.delete(user._id);
        updateBulkBar();
      });

      const ratingCell = createElement('td');
      if (user.rating) {
        ratingCell.appendChild(createElement('div', {
          className: 'metric-text',
          children: [
            createElement('strong', { text: Number(user.rating).toFixed(1) }),
            document.createTextNode(' / 5')
          ]
        }));
      } else {
        ratingCell.appendChild(createElement('span', { className: 'muted-cell', text: '-' }));
      }

      [
        createElement('td', { className: 'check-cell', children: [checkbox] }),
        createElement('td', { children: [sellerLink] }),
        createElement('td', { className: 'muted-cell', text: user.university || '-' }),
        createElement('td', { className: 'muted-cell', text: joined }),
        createElement('td', { children: [createElement('strong', { text: user.totalSales || 0 })] }),
        createElement('td', { text: user.totalPurchases || 0 }),
        ratingCell,
        createElement('td', { children: [createRoleBadge(user)] }),
        createElement('td', { children: [createUserActions(user)] })
      ].forEach((cell) => row.appendChild(cell));

      return row;
    }

    async function adminToggleBan(userId, banned, options = {}) {
      if (!options.skipConfirm) {
        const confirmed = await safeConfirm({
          title: banned ? 'Ban user' : 'Unban user',
          message: banned ? 'This account will lose access until you reverse the action.' : 'This account will regain marketplace access.',
          confirmText: banned ? 'Ban account' : 'Restore access'
        });
        if (!confirmed) return;
      }

      try {
        const res = await fetch(`/api/admin/users/${userId}/ban`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ banned })
        });
        if (!res.ok) throw new Error();
        safeToast(banned ? 'Account banned' : 'Account unbanned', 'ok');
        selectedUsers.delete(userId);
        if (options.refresh !== false) loadUsers();
      } catch {
        safeToast('Action failed', 'error');
      }
    }

    async function bulkToggleUsers(banned) {
      if (!selectedUsers.size) return;
      const confirmed = await safeConfirm({
        title: banned ? 'Ban selected users' : 'Unban selected users',
        message: `Apply this action to ${selectedUsers.size} selected account${selectedUsers.size === 1 ? '' : 's'}?`,
        confirmText: banned ? 'Ban selected' : 'Unban selected'
      });
      if (!confirmed) return;
      const ids = [...selectedUsers];
      for (const userId of ids) {
        // eslint-disable-next-line no-await-in-loop
        await adminToggleBan(userId, banned, { skipConfirm: true, refresh: false });
      }
      selectedUsers.clear();
      updateBulkBar();
      loadUsers();
    }

    window.adminToggleBan = adminToggleBan;
    window.loadUsers = loadUsers;

    let currentFilter = '';
    let searchTimeout;

    document.querySelectorAll('#aUsers .f-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('#aUsers .f-pill').forEach((p) => p.classList.remove('on'));
        pill.classList.add('on');
        const txt = pill.textContent.trim().toLowerCase();
        currentFilter = txt === 'all' ? '' : txt === 'new (7d)' ? 'new' : txt;
        loadUsers();
      });
    });

    if (selectAll) {
      selectAll.addEventListener('change', () => {
        document.querySelectorAll('#usersTableBody .user-select').forEach((box) => {
          box.checked = selectAll.checked;
          if (box.checked) selectedUsers.add(box.dataset.userId);
          else selectedUsers.delete(box.dataset.userId);
        });
        updateBulkBar();
      });
    }

    const searchInput = document.querySelector('#aUsers .tbl-search input');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(loadUsers, 300);
      });
    }

    async function loadUsers(page = 1) {
      const tbody = document.getElementById('usersTableBody');
      const countEl = document.getElementById('adminUsersCount');
      if (!tbody) return;
      setLoadingMessage(tbody, 9, 'Loading...');

      const q = searchInput ? searchInput.value.trim() : '';
      const params = new URLSearchParams({ limit: 20, page });
      if (q) params.set('q', q);
      if (currentFilter && currentFilter !== 'new') params.set('status', currentFilter);

      try {
        const res = await fetch(`/api/admin/users?${params}`);
        const json = await res.json();
        if (json.success) {
          const users = json.data || [];
          const total = Number(json.pagination?.total || 0);
          if (countEl) countEl.textContent = `${total.toLocaleString()} accounts`;
          if (users.length === 0) {
            selectedUsers.clear();
            updateBulkBar();
            setTableMessage(tbody, 9, 'No users found');
          } else {
            tbody.replaceChildren(...users.map(createUserRow));
            updateBulkBar();
          }
          if (typeof renderPagination === 'function') {
            renderPagination('#aUsers .pagination', json.pagination, 'loadUsers');
          }
        } else {
          if (countEl) countEl.textContent = '0 accounts';
          setTableMessage(tbody, 9, 'Failed to load users', 'var(--danger)');
        }
      } catch {
        if (countEl) countEl.textContent = '0 accounts';
        setTableMessage(tbody, 9, 'Network error', 'var(--danger)');
      }
    }

    document.addEventListener('click', (event) => {
      const target = event.target.closest('[data-action]');
      if (!target) return;
      if (target.dataset.action === 'bulk-ban-users') bulkToggleUsers(true);
      if (target.dataset.action === 'bulk-unban-users') bulkToggleUsers(false);
    });
  })();

  (function ordersTable() {
    const statusBadges = {
      pending: 'badge-pending',
      confirmed: 'badge-confirmed',
      completed: 'badge-completed',
      cancelled: 'badge-cancelled'
    };

    function copyOrderId(text) {
      if (!navigator.clipboard?.writeText) {
        safeToast(text, 'info');
        return;
      }
      navigator.clipboard.writeText(text)
        .then(() => safeToast('Order ID copied', 'ok'))
        .catch(() => safeToast('Copy failed', 'error'));
    }

    function createOrderRow(order) {
      const row = createElement('tr');
      const orderId = String(order._id || '').slice(-6).toUpperCase();
      const fullOrderId = `#ORD-${orderId}`;
      const productCell = productLink(order.product, { className: 'admin-order-product admin-entity-link admin-product-link' });
      const copyBtn = createElement('button', {
        className: 'copy-btn',
        attrs: { type: 'button', 'aria-label': `Copy ${fullOrderId}`, title: `Copy ${fullOrderId}` },
        children: [createIcon('copy', 14)]
      });
      copyBtn.addEventListener('click', () => copyOrderId(fullOrderId));

      [
        createElement('td', {
          children: [createElement('div', { className: 'mono-id', children: [createElement('span', { text: fullOrderId }), copyBtn] })]
        }),
        createElement('td', { className: 'muted-cell', children: [productCell] }),
        createElement('td', { className: 'muted-cell', children: [userProfileLink(order.buyer)] }),
        createElement('td', { className: 'muted-cell', children: [userProfileLink(order.seller)] }),
        createElement('td', { children: [createElement('strong', { text: order.priceSnapshot ? `${order.priceSnapshot.toLocaleString()} VND` : '-' })] }),
        createElement('td', { children: [createElement('span', { className: 'meta-chip', text: formatDeliveryMode(order.deliveryMode) })] }),
        createElement('td', { children: [createElement('span', { className: 'meta-chip', text: formatPaymentMode(order.paymentMode) })] }),
        createElement('td', { children: [createBadge((order.status || 'pending').replace(/^./, (s) => s.toUpperCase()), `badge ${statusBadges[order.status] || 'badge-pending'}`)] })
      ].forEach((cell) => row.appendChild(cell));
      return row;
    }

    window.loadOrders = loadOrders;
    let currentOrderFilter = '';
    let currentOrderSearch = '';
    let orderSearchTimeout;

    document.querySelectorAll('#aOrders .f-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('#aOrders .f-pill').forEach((p) => p.classList.remove('on'));
        pill.classList.add('on');
        const txt = pill.textContent.trim().toLowerCase();
        currentOrderFilter = txt === 'all' ? '' : txt;
        loadOrders(1);
      });
    });

    document.getElementById('adminOrdersSearch')?.addEventListener('input', (event) => {
      currentOrderSearch = event.target.value.trim();
      clearTimeout(orderSearchTimeout);
      orderSearchTimeout = setTimeout(() => loadOrders(1), 300);
    });

    async function loadOrders(page = 1) {
      const tbody = document.getElementById('ordersTableBody');
      if (!tbody) return;
      setLoadingMessage(tbody, 8, 'Loading...');

      const params = new URLSearchParams({ limit: 20, page });
      if (currentOrderFilter) params.set('status', currentOrderFilter);
      if (currentOrderSearch) params.set('q', currentOrderSearch);

      try {
        const res = await fetch(`/api/admin/orders?${params}`);
        const json = await res.json();
        if (json.success) {
          const orders = json.data || [];
          if (orders.length === 0) {
            setTableMessage(tbody, 8, 'No orders found');
          } else {
            tbody.replaceChildren(...orders.map(createOrderRow));
            if (typeof window.lucide?.createIcons === 'function') window.lucide.createIcons();
          }
          if (typeof renderPagination === 'function') {
            renderPagination('#aOrders .pagination', json.pagination, 'loadOrders');
          }
        } else {
          setTableMessage(tbody, 8, 'Failed to load orders', 'var(--danger)');
        }
      } catch {
        setTableMessage(tbody, 8, 'Network error', 'var(--danger)');
      }
    }
  })();

  (function reportsTable() {
    const reasonLabels = {
      'inappropriate-content': 'Inappropriate content',
      'offensive-language': 'Offensive language',
      'fraud-scam': 'Fraud/Scam',
      'counterfeit-item': 'Counterfeit item',
      'damaged-item': 'Damaged/Missing item',
      'misleading-description': 'Misleading description',
      'fake-account': 'Fake account',
      'suspicious-behavior': 'Suspicious behavior',
      other: 'Other'
    };

    const statusMap = {
      pending: 'badge-pending',
      'under-review': 'badge-pending',
      resolved: 'badge-completed',
      dismissed: 'badge-cancelled'
    };

    const selectedReports = new Set();
    const selectAll = document.getElementById('reportsSelectAll');
    const bulkBar = document.getElementById('reportsBulkBar');
    const bulkCount = document.getElementById('reportsSelectedCount');

    function updateBulkBar() {
      if (bulkCount) bulkCount.textContent = String(selectedReports.size);
      if (bulkBar) bulkBar.classList.toggle('show', selectedReports.size > 0);
      if (selectAll) {
        const rowChecks = [...document.querySelectorAll('#reportsTableBody .report-select')];
        const checkedCount = rowChecks.filter((box) => box.checked).length;
        selectAll.checked = rowChecks.length > 0 && checkedCount === rowChecks.length;
        selectAll.indeterminate = checkedCount > 0 && checkedCount < rowChecks.length;
      }
    }

    function createReportRow(report) {
      const isResolved = report.status === 'resolved';
      const row = createElement('tr', { className: isResolved ? 'row-resolved' : 'row-critical' });
      const actionWrap = createElement('div', { className: 'tbl-actions' });
      actionWrap.appendChild(createActionButton('View', 'act-btn primary', () => {
        window.location.href = report.targetType === 'product' ? `/products/${report.targetId}` : `/user/${report.targetId}`;
      }));
      const resolveBtn = createActionButton(isResolved ? 'Resolved' : 'Resolve', isResolved ? 'act-btn resolution-disabled' : 'act-btn', function onResolveClick(event) {
        if (!isResolved) resolveReport(report._id, event.currentTarget);
      });
      if (isResolved) resolveBtn.disabled = true;
      actionWrap.appendChild(resolveBtn);

      const checkbox = createElement('input', {
        className: 'admin-checkbox report-select',
        attrs: { type: 'checkbox', 'aria-label': 'Select report' }
      });
      checkbox.dataset.reportId = report._id;
      checkbox.checked = selectedReports.has(report._id);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) selectedReports.add(report._id);
        else selectedReports.delete(report._id);
        updateBulkBar();
      });

      const targetNode = report.targetType === 'product'
        ? productLink({ ...(report.targetDetails || {}), _id: report.targetId }, { className: 'report-target-title admin-entity-link admin-product-link' })
        : userProfileLink({ ...(report.targetDetails || {}), _id: report.targetId }, { className: 'report-target-title admin-entity-link admin-user-link' });
      const reportDate = formatDate(report.createdAt);

      [
        createElement('td', { className: 'check-cell', children: [checkbox] }),
        createElement('td', {
          children: [
            createElement('div', {
              className: 'report-target-cell',
              children: [
                createBadge(report.targetType === 'product' ? 'Product' : 'User', `badge ${report.targetType === 'product' ? 'badge-reported' : 'badge-pending'}`),
                targetNode,
                createElement('span', {
                  className: 'report-target-sub',
                  text: report.targetType === 'product'
                    ? (report.targetDetails?.category || 'Product report')
                    : 'User profile report'
                })
              ]
            })
          ]
        }),
        createElement('td', {
          children: [
            createElement('div', {
              className: 'report-meta-cell',
              children: [
                userProfileLink(report.reporter, { className: 'admin-entity-link admin-user-link report-reporter-link' }),
                createElement('span', { text: reportDate })
              ]
            })
          ]
        }),
        createElement('td', {
          children: [
            createElement('div', {
              className: 'report-reason-cell',
              children: [
                createElement('strong', { text: reasonLabels[report.reason] || report.reason }),
                createElement('span', {
                  text: report.description || 'No description provided'
                })
              ]
            })
          ]
        }),
        createElement('td', { children: [createBadge((report.status || 'pending').replace('-', ' '), `badge ${statusMap[report.status] || 'badge-pending'}`)] }),
        createElement('td', { children: [actionWrap] })
      ].forEach((cell) => row.appendChild(cell));

      return row;
    }

    async function resolveReport(reportId, btn, options = {}) {
      if (!options.skipConfirm) {
        const confirmed = await safeConfirm({
          title: 'Resolve report',
          message: 'This will mark the report as resolved and remove it from the pending moderation queue.',
          confirmText: 'Resolve report'
        });
        if (!confirmed) return;
      }

      try {
        if (btn) {
          btn.disabled = true;
          btn.textContent = 'Resolving...';
        }
        const res = await fetch(`/api/admin/reports/${reportId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'resolved' })
        });
        if (!res.ok) throw new Error();
        safeToast('Report resolved', 'ok');
        selectedReports.delete(reportId);
        refreshAdminModerationStats();
        if (options.refresh !== false) loadReports();
      } catch {
        safeToast('Failed to resolve report', 'error');
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Resolve';
        }
      }
    }

    async function bulkResolveReports() {
      if (!selectedReports.size) return;
      const confirmed = await safeConfirm({
        title: 'Resolve selected reports',
        message: `Mark ${selectedReports.size} selected report${selectedReports.size === 1 ? '' : 's'} as resolved?`,
        confirmText: 'Resolve selected'
      });
      if (!confirmed) return;
      const ids = [...selectedReports];
      for (const reportId of ids) {
        // eslint-disable-next-line no-await-in-loop
        await resolveReport(reportId, null, { skipConfirm: true, refresh: false });
      }
      selectedReports.clear();
      updateBulkBar();
      loadReports();
    }

    window.resolveReport = resolveReport;

    let currentReportFilter = 'all';
    let currentReportSearch = '';
    document.querySelectorAll('#aReports .f-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('#aReports .f-pill').forEach((p) => p.classList.remove('on'));
        pill.classList.add('on');
        currentReportFilter = pill.dataset.filter || 'all';
        loadReports();
      });
    });

    if (selectAll) {
      selectAll.addEventListener('change', () => {
        document.querySelectorAll('#reportsTableBody .report-select').forEach((box) => {
          box.checked = selectAll.checked;
          if (box.checked) selectedReports.add(box.dataset.reportId);
          else selectedReports.delete(box.dataset.reportId);
        });
        updateBulkBar();
      });
    }

    async function loadReports(page = 1) {
      const tbody = document.getElementById('reportsTableBody');
      if (!tbody) return;
      setLoadingMessage(tbody, 6, 'Loading...');

      const params = new URLSearchParams({ limit: 25, page });
      if (currentReportFilter && currentReportFilter !== 'all') params.set('status', currentReportFilter);
      if (currentReportSearch) params.set('q', currentReportSearch);

      try {
        const res = await fetch(`/api/admin/reports?${params}`);
        const json = await res.json();
        if (json.success) {
          const reports = json.data || [];
          if (json.pagination && currentReportFilter === 'all') {
            const totalEl = document.getElementById('reports-total');
            if (totalEl) totalEl.textContent = `${json.pagination.total || 0} item${json.pagination.total === 1 ? '' : 's'}`;
          }
          if (reports.length === 0) {
            selectedReports.clear();
            updateBulkBar();
            setTableMessage(tbody, 6, 'No reports found');
          } else {
            tbody.replaceChildren(...reports.map(createReportRow));
            updateBulkBar();
          }
          if (typeof renderPagination === 'function') {
            renderPagination('#aReports .pagination', json.pagination, 'loadReports');
          }
        } else {
          setTableMessage(tbody, 6, 'Failed to load reports', 'var(--danger)');
        }
      } catch {
        setTableMessage(tbody, 6, 'Network error', 'var(--danger)');
      }
    }

    window.loadReports = loadReports;

    document.getElementById('admin-reports-search')?.addEventListener('input', (event) => {
      currentReportSearch = event.target.value.trim();
      selectedReports.clear();
      loadReports(1);
    });
    refreshAdminModerationStats();

    async function syncSellerRatings() {
      const confirmed = await safeConfirm({
        title: 'Sync Seller Ratings',
        message: 'This will recalculate ratings for all users based on product reviews. Continue?',
        confirmText: 'Start Sync'
      });
      if (!confirmed) return;
      try {
        safeToast('Synchronizing ratings...', 'info');
        const res = await fetch('/api/admin/sync-ratings', { method: 'POST' });
        const json = await res.json();
        if (json.success) {
          safeToast(json.message || 'Sync complete', 'ok');
          setTimeout(() => location.reload(), 2000);
        } else {
          safeToast(json.message || 'Sync failed', 'error');
        }
      } catch {
        safeToast('Network error', 'error');
      }
    }
    window.syncSellerRatings = syncSellerRatings;

    document.addEventListener('click', (event) => {
      const target = event.target.closest('[data-action]');
      if (!target) return;
      if (target.dataset.action === 'bulk-resolve-reports') bulkResolveReports();
    });
  })();

  (function payoutsTable() {
    let currentPayoutFilter = '';
    let currentPayoutSearch = '';
    let activePayoutId = null;
    let activePayoutAction = null;

    function createPayoutActions(payout) {
      if (payout.status !== 'PENDING' && payout.status !== 'PROCESSING') {
        return createElement('span', { className: 'muted-cell', text: '-' });
      }

      const wrap = createElement('div', { className: 'tbl-actions' });
      const primaryAction = payout.status === 'PENDING' ? 'approve' : 'mark-paid';
      const primaryLabel = payout.status === 'PENDING' ? 'Approve' : 'Mark paid';
      wrap.appendChild(createActionButton(primaryLabel, 'act-btn success', () => window.openPayoutModal(payout._id, primaryAction)));
      wrap.appendChild(createActionMenu('More', [
        { label: 'Reject request', className: 'act-btn danger', onClick: () => window.openPayoutModal(payout._id, 'reject') }
      ]));
      return wrap;
    }

    function createPayoutRow(payout) {
      const row = createElement('tr');
      const bankCell = createElement('td', { className: 'payout-bank-cell' });
      if (payout.bankInfo) {
        bankCell.append(
          createElement('div', {
            className: 'metric-text payout-bank-details',
            children: [
              createElement('strong', { text: payout.bankInfo.bankName }),
              createElement('br'),
              document.createTextNode(`No: ${payout.bankInfo.accountNumber}`),
              createElement('br'),
              document.createTextNode(`Name: ${payout.bankInfo.accountName}`)
            ]
          })
        );
      } else {
        bankCell.appendChild(createElement('span', { className: 'muted-cell', text: '-' }));
      }

      const transferCell = createElement('td', { className: 'payout-transfer-cell' });
      if (payout.transferReference) {
        transferCell.appendChild(createElement('div', {
          className: 'metric-text payout-transfer-details',
          children: [
            createElement('strong', { text: payout.transferReference }),
            createElement('br'),
            createElement('span', { className: 'muted-cell', text: payout.transferNote || '' })
          ]
        }));
      } else {
        transferCell.appendChild(createElement('span', { className: 'muted-cell', text: '-' }));
      }

      const badgeClass = payout.status === 'PAID'
        ? 'badge badge-completed'
        : payout.status === 'REJECTED'
          ? 'badge badge-cancelled'
          : payout.status === 'PROCESSING'
            ? 'badge badge-info'
            : 'badge badge-pending';

      const requestedDate = new Date(payout.createdAt);

      [
        createElement('td', {
          className: 'payout-seller-cell',
          children: [
            userProfileLink(payout.user, { className: 'payout-seller-name admin-entity-link admin-user-link' })
          ]
        }),
        createElement('td', {
          className: 'payout-email-cell',
          children: [createElement('span', { className: 'muted-cell payout-email-text', text: payout.user?.email || '-' })]
        }),
        createElement('td', {
          className: 'payout-amount-cell',
          children: [createElement('strong', {
            className: 'payout-amount-text',
            text: `${String(payout.amount).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} VND`
          })]
        }),
        bankCell,
        createElement('td', {
          className: 'muted-cell payout-date-cell',
          children: [
            createElement('div', {
              className: 'payout-date-stack',
              children: [
                createElement('strong', {
                  className: 'payout-date-primary',
                  text: requestedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                }),
                createElement('span', {
                  className: 'payout-date-secondary',
                  text: requestedDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                })
              ]
            })
          ]
        }),
        createElement('td', { className: 'payout-status-cell', children: [createBadge(payout.status, badgeClass)] }),
        transferCell,
        createElement('td', { className: 'payout-actions-cell', children: [createPayoutActions(payout)] })
      ].forEach((cell) => row.appendChild(cell));

      return row;
    }

    async function loadPayouts(page = 1) {
      const tbody = document.getElementById('payoutsTableBody');
      if (!tbody) return;
      setLoadingMessage(tbody, 8, 'Loading payout requests...');

      const params = new URLSearchParams({ limit: 20, page });
      if (currentPayoutFilter) params.set('status', currentPayoutFilter);
      if (currentPayoutSearch) params.set('q', currentPayoutSearch);

      try {
        const res = await fetch(`/api/admin/payouts?${params}`);
        const json = await res.json();
        if (json.success) {
          if (json.stats) {
            document.getElementById('payout-pending-count').textContent = json.stats.PENDING || 0;
            document.getElementById('payout-processing-count').textContent = json.stats.PROCESSING || 0;
            document.getElementById('payout-paid-count').textContent = json.stats.PAID || 0;
            document.getElementById('payout-rejected-count').textContent = json.stats.REJECTED || 0;
            const total = (json.stats.PENDING || 0) + (json.stats.PROCESSING || 0) + (json.stats.PAID || 0) + (json.stats.REJECTED || 0);
            document.getElementById('payout-total-count').textContent = `${total} requests`;
          }

          const payouts = json.data || [];
          if (payouts.length === 0) {
            setTableMessage(tbody, 8, 'No payout requests found');
          } else {
            tbody.replaceChildren(...payouts.map(createPayoutRow));
          }

          if (typeof renderPagination === 'function') {
            renderPagination('#aPayouts .pagination', json.pagination, 'loadPayouts');
          }
        } else {
          setTableMessage(tbody, 8, 'Failed to load payouts', 'var(--danger)');
        }
      } catch {
        setTableMessage(tbody, 8, 'Network error', 'var(--danger)');
      }
    }

    window.loadPayouts = loadPayouts;
    document.getElementById('admin-payouts-search')?.addEventListener('input', (event) => {
      currentPayoutSearch = event.target.value.trim();
      loadPayouts(1);
    });
    if (document.getElementById('aPayouts')?.classList.contains('active')) {
      loadPayouts(1);
    }

    document.querySelectorAll('#aPayouts .f-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('#aPayouts .f-pill').forEach((p) => p.classList.remove('on'));
        pill.classList.add('on');
        currentPayoutFilter = pill.dataset.filter === 'all' ? '' : pill.dataset.filter;
        loadPayouts();
      });
    });

    window.openPayoutModal = function openPayoutModal(id, action) {
      activePayoutId = id;
      activePayoutAction = action;

      const modal = document.getElementById('payoutActionModal');
      const text = document.getElementById('payoutActionText');
      const noteField = document.getElementById('payoutAdminNote');
      const noteLabel = document.getElementById('payoutAdminNoteLabel');
      const refField = document.getElementById('payoutTransferReference');
      const refGroup = document.getElementById('payoutTransferReferenceGroup');
      const transferNoteField = document.getElementById('payoutTransferNote');
      const transferNoteGroup = document.getElementById('payoutTransferNoteGroup');
      if (!modal || !text) return;

      if (noteField) noteField.value = '';
      if (refField) refField.value = '';
      if (transferNoteField) transferNoteField.value = '';
      const needsTransferDetails = action === 'mark-paid';
      if (refGroup) refGroup.style.display = needsTransferDetails ? 'grid' : 'none';
      if (transferNoteGroup) transferNoteGroup.style.display = needsTransferDetails ? 'grid' : 'none';
      text.textContent = action === 'mark-paid'
        ? 'Confirm that the bank transfer to the seller has been completed and record the transfer details.'
        : `Are you sure you want to ${action} this payout?`;
      if (noteField) {
        noteField.placeholder = action === 'reject'
          ? 'Rejection reason'
          : 'Admin note';
      }
      if (noteLabel) {
        noteLabel.textContent = action === 'reject'
          ? 'Rejection reason'
          : 'Admin note';
      }
      modal.classList.add('show');
      modal.style.display = 'flex';
    };

    window.closePayoutModal = function closePayoutModal() {
      const modal = document.getElementById('payoutActionModal');
      if (modal) {
        modal.classList.remove('show');
        modal.style.display = 'none';
      }
      activePayoutId = null;
      activePayoutAction = null;
    };

    const confirmBtn = document.getElementById('payoutConfirmBtn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        if (!activePayoutId || !activePayoutAction) return;

        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Processing...';

        try {
          const adminNote = document.getElementById('payoutAdminNote')?.value || '';
          const transferReference = document.getElementById('payoutTransferReference')?.value || '';
          const transferNote = document.getElementById('payoutTransferNote')?.value || '';
          if (activePayoutAction === 'reject' && !adminNote.trim()) {
            safeToast('Rejection reason is required', 'err');
            return;
          }
          if (activePayoutAction === 'mark-paid' && !transferReference.trim()) {
            safeToast('Transfer reference is required', 'err');
            return;
          }
          const payload = { adminNote };
          if (activePayoutAction === 'mark-paid') {
            payload.transferReference = transferReference;
            payload.transferNote = transferNote;
          }
          const res = await fetch(`/api/admin/payouts/${activePayoutId}/${activePayoutAction}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const json = await res.json().catch(() => ({}));

          if (res.ok && json.success) {
            const successText = activePayoutAction === 'mark-paid'
              ? 'Payout marked as paid'
              : `Payout request ${activePayoutAction}d successfully`;
            safeToast(successText, 'ok');
          } else {
            const fieldErrors = json.details?.fieldErrors || {};
            const firstFieldError = Object.values(fieldErrors).flat()[0];
            safeToast(firstFieldError || json.message || 'Action failed', 'err');
            return;
          }
        } catch {
          safeToast('Network error', 'err');
        } finally {
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'Confirm';
        }
        window.closePayoutModal();
        loadPayouts();
      });
    }
  })();

  document.addEventListener('click', async (event) => {
    const dangerTarget = event.target.closest('[data-danger-confirm]');
    if (dangerTarget) {
      event.preventDefault();
      const confirmed = await safeConfirm({
        title: 'Confirm action',
        message: dangerTarget.dataset.dangerConfirm,
        confirmText: 'Continue'
      });
      if (confirmed && dangerTarget.dataset.toastMessage) {
        safeToast(dangerTarget.dataset.toastMessage, dangerTarget.dataset.toastType || 'info');
      }
      return;
    }

    const toastTarget = event.target.closest('[data-toast-message]');
    if (toastTarget) {
      safeToast(toastTarget.dataset.toastMessage, toastTarget.dataset.toastType || 'info');
      return;
    }

    const actionTarget = event.target.closest('[data-action]');
    if (!actionTarget) return;
    if (actionTarget.dataset.action === 'save-admin-settings') window.saveAdminSettings?.();
    if (actionTarget.dataset.action === 'sync-seller-ratings') window.syncSellerRatings?.();
    if (actionTarget.dataset.action === 'close-payout-modal') window.closePayoutModal?.();
  });

  function bootActiveAdminTable() {
    const config = window.AppUtils?.readJsonScript?.('dashboard-page-config') || {};
    const configuredSection = String(config.initialSection || '').trim();
    const activeSection = document.querySelector('.dashboard-admin .section.active')?.id || '';
    const sectionId = configuredSection || activeSection;

    if (sectionId === 'aUsers') window.loadUsers?.(1);
    if (sectionId === 'aOrders') {
      window.loadOrders?.(1);
      if (typeof fetchAdminOrderCounts === 'function') fetchAdminOrderCounts();
    }
    if (sectionId === 'aReports') window.loadReports?.(1);
    if (sectionId === 'aPayouts') window.loadPayouts?.(1);
    if (sectionId === 'aProducts' && typeof fetchAdminProducts === 'function') fetchAdminProducts(1);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootActiveAdminTable, { once: true });
  } else {
    bootActiveAdminTable();
  }
})();
