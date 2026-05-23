(() => {
  const { createElement } = window.AppUtils || {};

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

  function createBadge(text, className) {
    return createElement('span', { className, text });
  }

  function createActionButton(label, className, onClick) {
    const button = createElement('button', { className, attrs: { type: 'button' }, text: label });
    button.addEventListener('click', onClick);
    return button;
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

    function getAvatarColor(str) {
      let h = 0;
      for (let i = 0; i < str.length; i += 1) h = str.charCodeAt(i) + ((h << 5) - h);
      return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
    }

    function getInitials(name) {
      return (name || '?').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
    }

    function createRoleBadge(user) {
      if (user.role === 'admin') return createBadge('Admin', 'badge badge-admin');
      if (user.banned) return createBadge('Banned', 'badge badge-cancelled');
      return createBadge('User', 'badge badge-active');
    }

    function createUserActions(user) {
      const wrap = createElement('div', { className: 'tbl-actions' });
      wrap.appendChild(createActionButton('View', user.role === 'admin' ? 'act-btn primary' : 'act-btn primary', () => {
        window.location.href = `/user/${user._id}`;
      }));
      if (user.banned) {
        wrap.appendChild(createActionButton('Unban', 'act-btn success', () => adminToggleBan(user._id, false)));
      } else if (user.role === 'admin') {
        wrap.appendChild(createActionButton('Revoke', 'act-btn', () => showToast('Admin privileges revoked', 'ok')));
      } else {
        wrap.appendChild(createActionButton('Ban', 'act-btn danger', () => adminToggleBan(user._id, true)));
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
          style: { minWidth: '0' },
          children: [
            createElement('div', {
              className: 'uc-name',
              style: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' },
              text: user.nickname || user.name || '-'
            }),
            createElement('div', {
              className: 'uc-sub',
              style: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' },
              text: user.email || ''
            })
          ]
        })
      );
      sellerLink.appendChild(userCell);

      const ratingCell = createElement('td');
      if (user.rating) {
        ratingCell.appendChild(createElement('div', {
          style: { display: 'flex', alignItems: 'center', gap: '4px' },
          children: [
            createElement('span', { text: Number(user.rating).toFixed(1) }),
            createElement('span', { style: { fontSize: '11px', fontWeight: '700' }, text: 'rating' })
          ]
        }));
      } else {
        ratingCell.appendChild(createElement('span', { style: { color: 'var(--t3)' }, text: '-' }));
      }

      [
        createElement('td', { children: [sellerLink] }),
        createElement('td', { style: { color: 'var(--t2)' }, text: user.university || '-' }),
        createElement('td', { style: { color: 'var(--t2)' }, text: joined }),
        createElement('td', { children: [createElement('strong', { text: user.totalSales || 0 })] }),
        createElement('td', { text: user.totalPurchases || 0 }),
        ratingCell,
        createElement('td', { children: [createRoleBadge(user)] }),
        createElement('td', { children: [createUserActions(user)] })
      ].forEach((cell) => row.appendChild(cell));

      return row;
    }

    async function adminToggleBan(userId, banned) {
      try {
        const res = await fetch(`/api/admin/users/${userId}/ban`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ banned })
        });
        if (!res.ok) throw new Error();
        showToast(banned ? 'Account banned' : 'Account unbanned', 'ok');
        loadUsers();
      } catch {
        showToast('Action failed', 'error');
      }
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

    const searchInput = document.querySelector('#aUsers .tbl-search input');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(loadUsers, 300);
      });
    }

    async function loadUsers(page = 1) {
      const tbody = document.getElementById('usersTableBody');
      if (!tbody) return;
      setLoadingMessage(tbody, 8, 'Loading...');

      const q = searchInput ? searchInput.value.trim() : '';
      const params = new URLSearchParams({ limit: 20, page });
      if (q) params.set('q', q);
      if (currentFilter && currentFilter !== 'new') params.set('status', currentFilter);

      try {
        const res = await fetch(`/api/admin/users?${params}`);
        const json = await res.json();
        if (json.success) {
          const users = json.data || [];
          if (users.length === 0) {
            setTableMessage(tbody, 9, 'No users found');
          } else {
            tbody.replaceChildren(...users.map(createUserRow));
          }
          if (typeof renderPagination === 'function') {
            renderPagination('#aUsers .pagination', json.pagination, 'loadUsers');
          }
        } else {
          setTableMessage(tbody, 9, 'Failed to load users', 'var(--danger)');
        }
      } catch {
        setTableMessage(tbody, 9, 'Network error', 'var(--danger)');
      }
    }
  })();

  (function ordersTable() {
    const statusBadges = {
      pending: 'badge-pending',
      confirmed: 'badge-confirmed',
      completed: 'badge-completed',
      cancelled: 'badge-cancelled'
    };

    function createOrderRow(order) {
      const row = createElement('tr');
      const orderId = String(order._id || '').slice(-6).toUpperCase();
      const productCell = createElement('div', {
        style: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' },
        attrs: { title: order.product?.title || '-' },
        text: order.product?.title || '-'
      });
      [
        createElement('td', { style: { fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--t2)' }, text: `#ORD-${orderId}` }),
        createElement('td', { style: { color: 'var(--t2)' }, children: [productCell] }),
        createElement('td', { style: { color: 'var(--t2)' }, text: order.buyer?.nickname || order.buyer?.name || '-' }),
        createElement('td', { style: { color: 'var(--t2)' }, text: order.seller?.nickname || order.seller?.name || '-' }),
        createElement('td', { text: order.priceSnapshot ? `${order.priceSnapshot.toLocaleString()} VND` : '-' }),
        createElement('td', { style: { color: 'var(--t2)' }, text: order.deliveryMethod === 'pickup' ? 'Pickup' : order.deliveryMethod === 'ship' ? 'Ship' : '-' }),
        createElement('td', { style: { color: 'var(--t2)' }, text: order.paymentMethod === 'cash' ? 'Cash' : order.paymentMethod === 'card' ? 'Card' : '-' }),
        createElement('td', { children: [createBadge((order.status || 'pending').replace(/^./, (s) => s.toUpperCase()), `badge ${statusBadges[order.status] || 'badge-pending'}`)] })
      ].forEach((cell) => row.appendChild(cell));
      return row;
    }

    window.loadOrders = loadOrders;
    let currentOrderFilter = '';

    document.querySelectorAll('#aOrders .f-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('#aOrders .f-pill').forEach((p) => p.classList.remove('on'));
        pill.classList.add('on');
        const txt = pill.textContent.trim().toLowerCase();
        currentOrderFilter = txt === 'all' ? '' : txt;
        loadOrders();
      });
    });

    async function loadOrders(page = 1) {
      const tbody = document.getElementById('ordersTableBody');
      if (!tbody) return;
      setLoadingMessage(tbody, 8, 'Loading...');

      const params = new URLSearchParams({ limit: 20, page });
      if (currentOrderFilter) params.set('status', currentOrderFilter);

      try {
        const res = await fetch(`/api/admin/orders?${params}`);
        const json = await res.json();
        if (json.success) {
          const orders = json.data || [];
          if (orders.length === 0) {
            setTableMessage(tbody, 8, 'No orders found');
          } else {
            tbody.replaceChildren(...orders.map(createOrderRow));
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

    function createReportRow(report) {
      const row = createElement('tr', { style: { background: '#fff7ed' } });
      const actionWrap = createElement('div', { className: 'tbl-actions' });
      actionWrap.appendChild(createActionButton('View', 'act-btn primary', () => {
        window.location.href = report.targetType === 'product' ? `/products/${report.targetId}` : `/user/${report.targetId}`;
      }));
      actionWrap.appendChild(createActionButton('Resolve', 'act-btn', function onResolveClick(event) {
        resolveReport(report._id, event.currentTarget);
      }));

      [
        createElement('td', { children: [createBadge(report.targetType === 'product' ? 'Product' : 'User', `badge ${report.targetType === 'product' ? 'badge-reported' : 'badge-pending'}`)] }),
        createElement('td', { children: [createElement('strong', { text: report.targetDetails ? (report.targetType === 'product' ? report.targetDetails.title : report.targetDetails.nickname || report.targetDetails.name) : '-' })] }),
        createElement('td', { style: { color: 'var(--t2)' }, text: report.reporter ? report.reporter.nickname || report.reporter.name : '-' }),
        createElement('td', { style: { color: 'var(--t2)', fontSize: '13px' }, text: reasonLabels[report.reason] || report.reason }),
        createElement('td', { style: { color: 'var(--t2)', fontSize: '12px' }, text: new Date(report.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }),
        createElement('td', { children: [createBadge((report.status || 'pending').replace('-', ' '), `badge ${statusMap[report.status] || 'badge-pending'}`)] }),
        createElement('td', { children: [actionWrap] })
      ].forEach((cell) => row.appendChild(cell));

      return row;
    }

    async function resolveReport(reportId, btn) {
      try {
        btn.disabled = true;
        btn.textContent = 'Resolving...';
        const res = await fetch(`/api/admin/reports/${reportId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'resolved' })
        });
        if (!res.ok) throw new Error();
        showToast('Report resolved', 'ok');
        btn.textContent = 'Resolved';
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
        loadReports();
      } catch {
        showToast('Failed to resolve report', 'error');
        btn.disabled = false;
        btn.textContent = 'Resolve';
      }
    }

    window.resolveReport = resolveReport;

    let currentReportFilter = 'all';
    document.querySelectorAll('#aReports .f-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('#aReports .f-pill').forEach((p) => p.classList.remove('on'));
        pill.classList.add('on');
        currentReportFilter = pill.dataset.filter || 'all';
        loadReports();
      });
    });

    async function loadReports(page = 1) {
      const tbody = document.getElementById('reportsTableBody');
      if (!tbody) return;
      setLoadingMessage(tbody, 7, 'Loading...');

      const params = new URLSearchParams({ limit: 25, page });
      if (currentReportFilter && currentReportFilter !== 'all') params.set('status', currentReportFilter);

      try {
        const res = await fetch(`/api/admin/reports?${params}`);
        const json = await res.json();
        if (json.success) {
          const reports = json.data || [];
          if (reports.length === 0) {
            setTableMessage(tbody, 7, 'No reports found');
          } else {
            tbody.replaceChildren(...reports.map(createReportRow));
          }
          if (typeof renderPagination === 'function') {
            renderPagination('#aReports .pagination', json.pagination, 'loadReports');
          }
        } else {
          setTableMessage(tbody, 7, 'Failed to load reports', 'var(--danger)');
        }
      } catch {
        setTableMessage(tbody, 7, 'Network error', 'var(--danger)');
      }
    }

    window.loadReports = loadReports;

    async function syncSellerRatings() {
      const confirmed = await showConfirm({
        title: 'Sync Seller Ratings',
        message: 'This will recalculate ratings for all users based on product reviews. Continue?',
        confirmText: 'Start Sync'
      });
      if (!confirmed) return;
      try {
        if (typeof showToast === 'function') showToast('Synchronizing ratings...', 'info');
        const res = await fetch('/api/admin/sync-ratings', { method: 'POST' });
        const json = await res.json();
        if (json.success) {
          if (typeof showToast === 'function') showToast(json.message || 'Sync complete', 'ok');
          setTimeout(() => location.reload(), 2000);
        } else {
          showToast(json.message || 'Sync failed', 'error');
        }
      } catch {
        showToast('Network error', 'error');
      }
    }
    window.syncSellerRatings = syncSellerRatings;
  })();

  (function payoutsTable() {
    let currentPayoutFilter = '';
    let activePayoutId = null;
    let activePayoutAction = null;

    function createPayoutActions(payout) {
      if (payout.status !== 'PENDING' && payout.status !== 'PROCESSING') {
        return createElement('span', { style: { color: 'var(--t3)' }, text: '-' });
      }
      const wrap = createElement('div', { className: 'tbl-actions' });
      const primaryAction = payout.status === 'PENDING' ? 'approve' : 'mark-paid';
      const primaryLabel = payout.status === 'PENDING' ? 'Approve' : 'Mark paid';
      wrap.appendChild(createActionButton(primaryLabel, 'act-btn success', () => window.openPayoutModal(payout._id, primaryAction)));
      wrap.appendChild(createActionButton('Reject', 'act-btn danger', () => window.openPayoutModal(payout._id, 'reject')));
      return wrap;
    }

    function createPayoutRow(payout) {
      const row = createElement('tr');
      const bankCell = createElement('td');
      if (payout.bankInfo) {
        bankCell.append(
          createElement('div', {
            style: { fontSize: '12px', lineHeight: '1.4' },
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
        bankCell.appendChild(createElement('span', { style: { color: 'var(--t3)' }, text: '-' }));
      }

      const transferCell = createElement('td');
      if (payout.transferReference) {
        transferCell.appendChild(createElement('div', {
          style: { fontSize: '12px', lineHeight: '1.45' },
          children: [
            createElement('strong', { text: payout.transferReference }),
            createElement('br'),
            createElement('span', { style: { color: 'var(--text-3)' }, text: payout.transferNote || '' })
          ]
        }));
      } else {
        transferCell.appendChild(createElement('span', { style: { color: 'var(--t3)' }, text: '-' }));
      }

      [
        createElement('td', { children: [createElement('strong', { text: payout.user?.nickname || payout.user?.name || '-' })] }),
        createElement('td', { style: { color: 'var(--text-2)' }, text: payout.user?.email || '-' }),
        createElement('td', { children: [createElement('strong', { style: { color: 'var(--primary)' }, text: `${String(payout.amount).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} VND` })] }),
        bankCell,
        createElement('td', { style: { color: 'var(--text-3)', fontSize: '12px' }, text: new Date(payout.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }),
        createElement('td', { children: [createBadge(payout.status, `badge ${payout.status === 'PAID' ? 'badge-completed' : payout.status === 'REJECTED' ? 'badge-cancelled' : 'badge-pending'}`)] }),
        transferCell,
        createElement('td', { children: [createPayoutActions(payout)] })
      ].forEach((cell) => row.appendChild(cell));

      return row;
    }

    async function loadPayouts(page = 1) {
      const tbody = document.getElementById('payoutsTableBody');
      if (!tbody) return;
      setLoadingMessage(tbody, 8, 'Loading payout requests...');

      const params = new URLSearchParams({ limit: 20, page });
      if (currentPayoutFilter) params.set('status', currentPayoutFilter);

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
      const refField = document.getElementById('payoutTransferReference');
      if (!modal || !text) return;

      if (noteField) noteField.value = '';
      if (refField) refField.value = '';
      text.textContent = action === 'mark-paid'
        ? 'Confirm that the bank transfer to the seller has been completed.'
        : `Are you sure you want to ${action} this payout?`;
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
          const payload = { adminNote, transferReference };
          if (activePayoutAction === 'reject' && !adminNote.trim()) {
            showToast('Rejection reason is required', 'error');
            return;
          }
          const res = await fetch(`/api/admin/payouts/${activePayoutId}/${activePayoutAction}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const json = await res.json();

          if (json.success) {
            const successText = activePayoutAction === 'mark-paid'
              ? 'Payout marked as paid'
              : `Payout request ${activePayoutAction}d successfully`;
            showToast(successText, 'ok');
          } else {
            showToast(json.message || 'Action failed', 'error');
          }
        } catch {
          showToast('Network error', 'error');
        } finally {
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'Confirm';
          closePayoutModal();
          loadPayouts();
        }
      });
    }
  })();
})();
