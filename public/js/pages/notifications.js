(() => {
  const { createElement, createSvgElement } = window.AppUtils || {};

  let currentFilter = 'all';
  let currentPage = 1;
  let totalPages = 1;

  const TYPE_COLORS = {
    order: { color: '#1B5EFF', bg: '#EBF0FF', icon: 'box' },
    message: { color: '#10B981', bg: '#D1FAE5', icon: 'message' },
    rating: { color: '#F59E0B', bg: '#FEF3C7', icon: 'star' },
    system: { color: '#7C3AED', bg: '#F3E8FF', icon: 'bell' },
    info: { color: '#6B7280', bg: '#F3F4F6', icon: 'info' }
  };

  function createIcon(type) {
    const icon = type || 'info';
    if (icon === 'box') {
      return createSvgElement('svg', { width: '18', height: '18', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [
        createSvgElement('path', { d: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z' })
      ]);
    }
    if (icon === 'message') {
      return createSvgElement('svg', { width: '18', height: '18', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [
        createSvgElement('path', { d: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' })
      ]);
    }
    if (icon === 'star') {
      return createSvgElement('svg', { width: '18', height: '18', viewBox: '0 0 24 24', fill: 'currentColor' }, [
        createSvgElement('polygon', { points: '12 2 15.09 10.26 24 10.27 17.18 16.31 20.09 24.5 12 18.45 3.91 24.5 6.82 16.31 0 10.27 8.91 10.26 12 2' })
      ]);
    }
    if (icon === 'bell') {
      return createSvgElement('svg', { width: '18', height: '18', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [
        createSvgElement('path', { d: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9' }),
        createSvgElement('path', { d: 'M13.73 21a2 2 0 0 1-3.46 0' })
      ]);
    }
    return createSvgElement('svg', { width: '18', height: '18', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, [
      createSvgElement('circle', { cx: '12', cy: '12', r: '10' }),
      createSvgElement('line', { x1: '12', y1: '16', x2: '12', y2: '12' }),
      createSvgElement('line', { x1: '12', y1: '8', x2: '12.01', y2: '8' })
    ]);
  }

  function timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return m + 'm ago';
    const h = Math.floor(m / 60);
    if (h < 24) return h + 'h ago';
    const d = Math.floor(h / 24);
    if (d < 7) return d + 'd ago';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function createEmptyState(title, subtitle) {
    return createElement('div', {
      className: 'notif-empty',
      children: [
        createElement('div', { className: 'notif-empty-title', text: title }),
        createElement('div', { className: 'notif-empty-sub', text: subtitle })
      ]
    });
  }

  function renderEmpty(filter) {
    const titles = {
      all: 'No notifications yet',
      unread: 'Nothing unread',
      order: 'No order notifications',
      message: 'No message notifications',
      rating: 'No review notifications',
      system: 'No system notifications'
    };
    return createEmptyState(titles[filter] || titles.all, 'Updates will appear here.');
  }

  function createNotificationItem(notification) {
    const meta = TYPE_COLORS[notification.type] || TYPE_COLORS.info;
    const isRead = !!notification.isRead;
    const item = createElement('div', {
      className: `notif-item ${isRead ? '' : 'unread'}`.trim(),
      dataset: { id: notification._id }
    });

    if (!isRead) {
      item.appendChild(createElement('span', { className: 'notif-unread-dot' }));
    }

    item.appendChild(createElement('div', {
      className: 'notif-icon',
      style: {
        background: meta.bg,
        color: meta.color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      },
      children: [createIcon(meta.icon)]
    }));

    const body = createElement('div', { className: 'notif-body' });
    body.appendChild(createElement('div', {
      className: 'notif-row',
      children: [
        createElement('div', { className: 'notif-title-text', text: notification.title || '' }),
        createElement('div', { className: 'notif-time', text: timeAgo(notification.createdAt) })
      ]
    }));
    body.appendChild(createElement('div', { className: 'notif-message', text: notification.message || '' }));

    if (notification.link && notification.link !== '#') {
      body.appendChild(createElement('a', {
        className: 'notif-link',
        attrs: { href: notification.link },
        text: 'View details'
      }));
    }

    item.appendChild(body);
    item.appendChild(createElement('button', {
      className: 'notif-delete-btn',
      dataset: { id: notification._id },
      attrs: { type: 'button', title: 'Delete' },
      text: 'x'
    }));
    return item;
  }

  function replaceNotificationList(list, nodes) {
    list.replaceChildren(...nodes);
  }

  async function fetchNotifications(append) {
    const list = document.getElementById('notif-page-list');
    try {
      const url = '/api/notifications?page=' + currentPage + '&limit=15&filter=' + currentFilter;
      const res = await fetch(url, { credentials: 'include' });
      const json = await res.json();

      if (!json.success) throw new Error(json.message || 'Server error');
      const items = json.notifications || [];
      const unread = json.unreadCount || 0;
      const pagination = json.pagination || {};

      document.getElementById('tab-unread-count').textContent = unread;
      const badge = document.getElementById('notif-count-badge');
      if (unread > 0) {
        badge.textContent = unread + ' unread';
        badge.style.display = 'inline-flex';
      } else {
        badge.style.display = 'none';
      }
      document.getElementById('mark-all-btn').disabled = unread === 0;

      if (!append) {
        replaceNotificationList(list, items.length === 0 ? [renderEmpty(currentFilter)] : items.map(createNotificationItem));
      } else {
        items.forEach((item) => list.appendChild(createNotificationItem(item)));
      }

      document.getElementById('load-more-wrap').style.display = pagination.hasMore ? 'flex' : 'none';
      totalPages = pagination.totalPages || 1;
    } catch (err) {
      window.AppUtils?.reportClientError('[notifications] error:', err);
      if (!append) {
        replaceNotificationList(list, [createEmptyState('Failed to load', err.message || 'Unknown error')]);
      }
    }
  }

  function showToast(msg, type) {
    const t = document.getElementById('notif-toast');
    t.textContent = msg;
    t.dataset.type = type || 'info';
    t.classList.add('show');
    clearTimeout(t._t);
    t._t = setTimeout(function removeToast() {
      t.classList.remove('show');
    }, 2500);
  }

  window.loadMore = function loadMore() {
    currentPage += 1;
    fetchNotifications(true);
  };

  window.markAllRead = async function markAllRead() {
    try {
      const res = await fetch('/api/notifications/read-all', { method: 'POST', credentials: 'include' });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      currentPage = 1;
      await fetchNotifications();
      showToast('All marked as read', 'success');
    } catch (err) {
      showToast(err.message || 'Failed', 'error');
    }
  };

  document.getElementById('notif-tabs').addEventListener('click', function onTabClick(e) {
    const tab = e.target.closest('.notif-tab');
    if (!tab) return;
    document.querySelectorAll('.notif-tab').forEach(function clearActive(t) {
      t.classList.remove('active');
    });
    tab.classList.add('active');
    currentFilter = tab.dataset.filter;
    currentPage = 1;
    document.getElementById('notif-page-list').replaceChildren(createElement('div', {
      style: { padding: '40px', textAlign: 'center', color: '#8890B0' },
      text: 'Loading...'
    }));
    fetchNotifications();
  });

  document.getElementById('notif-page-list').addEventListener('click', async function onListClick(e) {
    const delBtn = e.target.closest('.notif-delete-btn');
    if (delBtn) {
      e.stopPropagation();
      const id = delBtn.dataset.id;
      const item = delBtn.closest('.notif-item');
      const confirmed = await showConfirm({
        title: 'Delete Notification',
        message: 'Delete this notification?',
        confirmText: 'Delete',
        type: 'danger'
      });
      if (!confirmed) return;
      try {
        const res = await fetch('/api/notifications/' + id, { method: 'DELETE', credentials: 'include' });
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
        item.remove();
        showToast('Deleted', 'success');
        if (!document.querySelector('#notif-page-list .notif-item')) fetchNotifications();
      } catch (err) {
        showToast(err.message || 'Failed', 'error');
      }
      return;
    }
    const item = e.target.closest('.notif-item');
    if (item && item.classList.contains('unread')) {
      item.classList.remove('unread');
      const dot = item.querySelector('.notif-unread-dot');
      if (dot) dot.remove();
      try {
        await fetch('/api/notifications/' + item.dataset.id + '/read', { method: 'PATCH', credentials: 'include' });
      } catch {}
      const badge = document.getElementById('tab-unread-count');
      const n = Math.max(0, parseInt(badge.textContent, 10) - 1);
      badge.textContent = n;
      const head = document.getElementById('notif-count-badge');
      if (n === 0) {
        head.style.display = 'none';
        document.getElementById('mark-all-btn').disabled = true;
      } else {
        head.textContent = n + ' unread';
      }
    }
  });

  fetchNotifications();

  document.getElementById('mark-all-btn').addEventListener('click', function onMarkAll() {
    window.markAllRead();
  });

  document.getElementById('load-more-btn').addEventListener('click', function onLoadMore() {
    window.loadMore();
  });
})();
