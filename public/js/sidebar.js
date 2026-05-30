(function () {
  if (typeof window.nav !== 'function') {
    window.nav = function (el, id) {
      try {
        if (typeof window.showSection === 'function') {
          if (el && el.classList) {
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            el.classList.add('active');
          }
          return window.showSection(id);
        }
      } catch (e) {}
      const PATHS = {
        aDash:'/admin', aAnalytics:'/admin/analytics', aUsers:'/admin/users',
        aProducts:'/admin/products', aOrders:'/admin/orders', aPayouts:'/admin/payouts',
        aReports:'/admin/reports',
        aSettings:'/admin/settings', sDash:'/dashboard', sProducts:'/my-products',
        sOrders:'/orders-seller', sRevenue:'/revenue', sWallet:'/wallet-payouts',
        sMessages:'/messages', sProfile:'/profile'
      };
      if (el && el.classList) {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        el.classList.add('active');
      }
      window.location.href = PATHS[id] || '/';
    };
  }

  const MODE_COOKIE = 'campus_mode';

  function getCookie(name) {
    return document.cookie
      .split(';')
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith(name + '='))
      ?.slice(name.length + 1);
  }

  function getMode() {
    return getCookie(MODE_COOKIE) === 'seller' ? 'seller' : 'buyer';
  }

  window.goAdmin = function (path, sectionId, el) {
    try {
      if (window.location.pathname.startsWith('/admin') && typeof nav === 'function') {
        if (el) {
          document.querySelectorAll('#adminNav .nav-item').forEach(n => n.classList.remove('active'));
          el.classList.add('active');
        }
        nav(el, sectionId);
        history.replaceState(null, '', path);
        return;
      }
    } catch (e) {}
    window.location.href = path;
  };

  function applyMode(mode) {
    document.body.classList.remove('mode-buyer', 'mode-seller');
    document.body.classList.add('mode-' + mode);
    const browseBtn = document.getElementById('workspace-browse-btn');
    const manageBtn = document.getElementById('workspace-manage-btn');
    if (browseBtn) browseBtn.classList.toggle('active', mode === 'buyer');
    if (manageBtn) manageBtn.classList.toggle('active', mode === 'seller');
  }

  window.setMode = function (mode) {
    document.cookie = 'campus_mode=' + mode + '; path=/; max-age=' + (30*24*60*60);
    applyMode(mode);
    window.location.href = mode === 'seller' ? '/dashboard-seller' : '/';
  };

  applyMode(getMode());

  try { document.body.classList.add('has-sidebar'); } catch(e) {}

  document.addEventListener('DOMContentLoaded', () => {
    const userTrigger = document.getElementById('sb-user-trigger');
    const userDropdown = document.getElementById('sb-user-dropdown');
    const browseWorkspaceBtn = document.getElementById('workspace-browse-btn');
    const manageWorkspaceBtn = document.getElementById('workspace-manage-btn');

    function closeUserDropdown() {
      if (!userTrigger || !userDropdown) return;
      userTrigger.setAttribute('aria-expanded', 'false');
      userDropdown.classList.remove('open');
    }

    if (userTrigger && userDropdown) {
      userTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isOpen = userDropdown.classList.toggle('open');
        userTrigger.setAttribute('aria-expanded', String(isOpen));
      });

      document.addEventListener('click', (e) => {
        if (!userTrigger.contains(e.target) && !userDropdown.contains(e.target)) {
          closeUserDropdown();
        }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeUserDropdown();
      });
    }

    if (browseWorkspaceBtn) {
      browseWorkspaceBtn.addEventListener('click', () => {
        closeUserDropdown();
        window.setMode('buyer');
      });
    }

    if (manageWorkspaceBtn) {
      manageWorkspaceBtn.addEventListener('click', () => {
        closeUserDropdown();
        window.setMode('seller');
      });
    }

    // Show correct nav group
    (function updateNavByMode() {
      const mode = getMode();
      const buyerGroup = document.querySelector('.nav-links-buyer');
      const sellerGroup = document.querySelector('.nav-links-seller');
      if (!buyerGroup) return;
      if (mode === 'seller') {
        buyerGroup.style.display = 'none';
        if (sellerGroup) sellerGroup.style.display = 'block';
      } else {
        buyerGroup.style.display = 'block';
        if (sellerGroup) sellerGroup.style.display = 'none';
      }
    })();

    // Buyer-only page modal
    const switchModalBackdrop = document.getElementById('switch-modal-backdrop');

    function showSwitchModal(targetHref) {
      if (!switchModalBackdrop) return;
      switchModalBackdrop.classList.add('show');
      const cancel = document.getElementById('switch-cancel');
      const confirm = document.getElementById('switch-confirm');
      
      function hide() { 
        switchModalBackdrop.classList.remove('show'); 
        cancel.removeEventListener('click', onCancel); 
        confirm.removeEventListener('click', onConfirm); 
      }
      function onCancel() { hide(); }
      function onConfirm() { hide(); window.setMode('buyer'); if (targetHref) window.location.href = targetHref; }
      
      cancel.addEventListener('click', onCancel);
      confirm.addEventListener('click', onConfirm);
    }

    document.querySelectorAll('.nav-link.buyer-only').forEach(a => {
      a.addEventListener('click', (e) => {
        const mode = getMode();
        const href = a.getAttribute('href');
        if (mode === 'seller') {
          e.preventDefault();
          if (href === '/') { window.location.href = '/my-products'; return; }
          showSwitchModal(href);
        }
      });
    });

    document.addEventListener('click', (e) => {
      const a = e.target.closest && e.target.closest('a');
      if (!a) return;
      const hrefAttr = a.getAttribute('href');
      if (!hrefAttr || hrefAttr.startsWith('#') || hrefAttr.startsWith('mailto:') || hrefAttr.startsWith('tel:')) return;
      let url;
      try { url = new URL(hrefAttr, window.location.origin); } catch { return; }
      const path = url.pathname;
      const mode = getMode();
      if (mode === 'seller' && (/^\/orders(\/|$)/.test(path) && path !== '/orders-seller')) {
        e.preventDefault();
        showSwitchModal(hrefAttr);
      }
    }, true);

    // Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch {}
        localStorage.removeItem('campus_token');
        localStorage.removeItem('campus_user');
        document.cookie = 'campus_mode=; path=/; max-age=0';
        window.location.href = '/login';
      });
    }

    // Chat badge
    async function updateChatBadge() {
      try {
        const res = await fetch('/api/chat', { credentials: 'include' });
        const json = await res.json();
        if (!json.success) return;
        const uiMode = getMode();
        const filtered = json.data.filter(c => uiMode === 'seller' ? c.isSellerConversation : !c.isSellerConversation);
        const total = filtered.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
        const badgeId = uiMode === 'seller' ? 'nav-chat-badge-seller' : 'nav-chat-badge';
        const badge = document.getElementById(badgeId);
        if (badge) {
          badge.textContent = total > 99 ? '99+' : total;
          badge.style.display = total > 0 ? 'flex' : 'none';
        }
        const chatDot = document.getElementById('chat-dot');
        if (chatDot) {
          chatDot.textContent = total > 9 ? '9+' : total;
          chatDot.style.display = total > 0 ? 'block' : 'none';
        }
      } catch {}
    }
    updateChatBadge();
    if (!window.location.pathname.startsWith('/messages')) setInterval(updateChatBadge, 15000);

    // Admin: restrict navigation
    const sidebarConfig = window.AppUtils?.readJsonScript
      ? window.AppUtils.readJsonScript('sidebar-user-config')
      : {};
    const _USER_ROLE = sidebarConfig.role || '';
    window.APP_USER_CONTEXT = Object.assign({}, window.APP_USER_CONTEXT || {}, { role: _USER_ROLE || 'buyer' });
    if (_USER_ROLE === 'admin') {
      document.addEventListener('click', function (e) {
        const a = e.target.closest && e.target.closest('a');
        if (!a) return;
        const hrefAttr = a.getAttribute('href');
        if (!hrefAttr || hrefAttr.startsWith('#') || hrefAttr.startsWith('mailto:') || hrefAttr.startsWith('tel:')) return;
        let url;
        try { url = new URL(hrefAttr, window.location.origin); } catch { return; }
        const path = url.pathname || '';
        if (path.startsWith('/dashboard') || path.startsWith('/admin') || path.startsWith('/profile') ||
            hrefAttr.startsWith('/api') || hrefAttr.startsWith('/auth') || hrefAttr.startsWith('/login') ||
            hrefAttr.startsWith('/logout') || hrefAttr.startsWith('/user')) return;
        e.preventDefault();
        try { showToast('Administrators can only access admin pages', 'info'); } catch(e) {}
        window.location.href = '/admin';
      }, true);
    }

    const toggle = document.getElementById('sb-mobile-toggle');
    const backdrop = document.getElementById('sb-backdrop');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const STORAGE_KEY_SIDEBAR = 'campus_sidebar_collapsed';
    const MOBILE_SIDEBAR_BREAKPOINT = 900;

    function isMobileSidebarViewport() {
      return window.innerWidth <= MOBILE_SIDEBAR_BREAKPOINT;
    }

    function syncSidebarToggleState() {
      const isDrawerOpen = document.body.classList.contains('sb-open');
      const isDesktopCollapsed = document.body.classList.contains('sidebar-collapsed');

      if (toggle) {
        toggle.hidden = !isMobileSidebarViewport();
        toggle.setAttribute('aria-expanded', String(isDrawerOpen));
        toggle.setAttribute('aria-label', isDrawerOpen ? 'Close sidebar' : 'Open sidebar');
      }

      if (sidebarToggle) {
        const isExpanded = isMobileSidebarViewport() ? isDrawerOpen : !isDesktopCollapsed;
        const sidebarActionLabel = isMobileSidebarViewport()
          ? (isDrawerOpen ? 'Close sidebar' : 'Open sidebar')
          : (isDesktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar');
        sidebarToggle.setAttribute('aria-expanded', String(isExpanded));
        sidebarToggle.setAttribute('aria-label', sidebarActionLabel);
        sidebarToggle.setAttribute('title', sidebarActionLabel);
      }
    }

    function openMobileSidebar() {
      if (!isMobileSidebarViewport()) return;
      document.body.classList.add('sb-open');
      syncSidebarToggleState();
    }

    function closeMobileSidebar() {
      document.body.classList.remove('sb-open');
      syncSidebarToggleState();
    }

    function setSidebarCollapsed(collapsed) {
      if (isMobileSidebarViewport()) {
        if (collapsed) closeMobileSidebar();
        else openMobileSidebar();
        return;
      }

      document.body.classList.toggle('sidebar-collapsed', collapsed);
      localStorage.setItem(STORAGE_KEY_SIDEBAR, collapsed ? 'true' : 'false');
      syncSidebarToggleState();
    }

    function applySidebarStateForViewport() {
      if (isMobileSidebarViewport()) {
        document.body.classList.remove('sidebar-collapsed');
      } else {
        closeMobileSidebar();
        document.body.classList.toggle('sidebar-collapsed', localStorage.getItem(STORAGE_KEY_SIDEBAR) === 'true');
      }
      syncSidebarToggleState();
    }

    if (toggle) {
      toggle.addEventListener('click', () => {
        if (document.body.classList.contains('sb-open')) closeMobileSidebar();
        else openMobileSidebar();
      });
    }

    if (backdrop) {
      backdrop.addEventListener('click', closeMobileSidebar);
    }

    if (sidebarToggle) {
      sidebarToggle.addEventListener('click', () => {
        if (isMobileSidebarViewport()) {
          if (document.body.classList.contains('sb-open')) closeMobileSidebar();
          else openMobileSidebar();
          return;
        }

        const isCollapsed = document.body.classList.contains('sidebar-collapsed');
        setSidebarCollapsed(!isCollapsed);
      });
    }

    function updateHashActive() {
      const hash = window.location.hash;
      document.querySelectorAll('.nav-link.buyer-only').forEach(a => {
        const aHash = a.getAttribute('href').split('#')[1];
        if (aHash && hash === '#' + aHash) a.classList.add('active');
        else if (!aHash && !hash && a.getAttribute('href') === '/') a.classList.add('active');
        else if (a.classList.contains('buyer-only')) a.classList.remove('active');
      });
    }

    window.addEventListener('hashchange', updateHashActive);
    updateHashActive();

    document.addEventListener('click', (e) => {
      const adminItem = e.target.closest && e.target.closest('[data-admin-path][data-admin-section]');
      if (adminItem) {
        window.goAdmin(adminItem.dataset.adminPath, adminItem.dataset.adminSection, adminItem);
        return;
      }

      const sidebarAction = e.target.closest && e.target.closest('.sidebar a, .sidebar .nav-item');
      if (!sidebarAction || !isMobileSidebarViewport()) return;
      closeMobileSidebar();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMobileSidebar();
    });

    window.addEventListener('resize', applySidebarStateForViewport);
    applySidebarStateForViewport();
  });
})();
