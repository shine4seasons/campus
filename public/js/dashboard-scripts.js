  /* NOTE: PAGE_META removed â€” titles/subs/cta are read from
     section `data-*` attributes when available, with a small
     fallback map for known section ids. */

  /* â”€â”€ Navigation â”€â”€ */
  function nav(el, id) {
    if (!el) return;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    el.classList.add('active');
    showSection(id);
  }

  function sanitizeObjectId(value) {
    const id = String(value == null ? '' : value).trim();
    return /^[a-fA-F0-9]{24}$/.test(id) ? id : '';
  }

  function toSafeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function clearChildren(node) {
    if (!node) return;
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function appendLegendItems(container, items) {
    if (!container) return;
    clearChildren(container);
    items.forEach((item) => {
      const wrap = document.createElement('span');
      wrap.className = 'leg-item';
      const dot = document.createElement('span');
      dot.className = 'leg-dot';
      dot.style.background = item.color;
      wrap.appendChild(dot);
      wrap.appendChild(document.createTextNode(`${item.label} - ${toSafeNumber(item.percent)}%`));
      container.appendChild(wrap);
    });
  }

  function showSection(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const sec = document.getElementById(id);
    if (sec) sec.classList.add('active');

    // Automatically highlight sidebar active element
    try {
      const el = document.querySelector(`.sb-nav .nav-item[data-admin-section="${id}"]`);
      if (el) {
        document.querySelectorAll('.sb-nav .nav-item').forEach(n => n.classList.remove('active'));
        el.classList.add('active');
      }
    } catch (e) {}

    const pgTitleEl = document.getElementById('pageTitle');
    const pgSubEl = document.getElementById('pageSub');
    const primaryLabelEl = document.getElementById('tbPrimaryLabel');

    // Prefer explicit data attributes on the section element
    let title = '';
    let sub = '';
    let cta = '';
    if (sec) {
      title = sec.dataset && sec.dataset.title ? sec.dataset.title : (sec.getAttribute && sec.getAttribute('data-title')) || '';
      sub = sec.dataset && sec.dataset.sub ? sec.dataset.sub : (sec.getAttribute && sec.getAttribute('data-sub')) || '';
      cta = sec.dataset && sec.dataset.cta ? sec.dataset.cta : (sec.getAttribute && sec.getAttribute('data-cta')) || '';
    }

    // Small fallback map for known sections when no data-* provided
    const fallbacks = {
      'aDash': { title: 'Admin Dashboard', sub: 'Overview & analytics', cta: 'Action' },
      'aAnalytics': { title: 'Detailed Analytics', sub: 'Platform performance & metrics', cta: 'Export PDF' },
      'aUsers': { title: 'User Management', sub: 'Active, banned & new users', cta: 'Action' },
      'aProducts': { title: 'Product Moderation', sub: 'Manage products and reports', cta: 'Action' },
      'aOrders': { title: 'Order Ledger', sub: 'Platform-wide order details', cta: 'Action' },
      'aPayouts': { title: 'Seller Payout Requests', sub: 'Review and process withdrawal requests', cta: 'Action' },
      'aReports': { title: 'Reported Content', sub: 'Review inappropriate items and accounts', cta: 'Action' },
      'aSettings': { title: 'Platform Settings', sub: 'Configure global options', cta: 'Action' },
      
      // Seller sections
      'sDash': { title: 'Seller Dashboard', sub: 'Overview of your sales & performance', cta: 'Action' },
      'sProducts': { title: 'My Products', sub: 'Manage your active and sold products', cta: 'Create Product' },
      'sOrders': { title: 'Seller Orders', sub: 'Manage buyer orders & fulfillment', cta: 'Action' },
      'sRevenue': { title: 'Revenue & Wallet', sub: 'Review wallet balance and payouts', cta: 'Withdraw' },
      'sWallet': { title: 'Revenue & Wallet', sub: 'Review wallet balance and payouts', cta: 'Withdraw' },
      'sMessages': { title: 'Inbox Messages', sub: 'Chat with buyers and sellers', cta: 'Action' },
      'sProfile': { title: 'User Profile', sub: 'Manage account details & settings', cta: 'Action' }
    };

    if (!title && fallbacks[id]) {
      title = fallbacks[id].title;
      sub = fallbacks[id].sub;
      cta = fallbacks[id].cta;
    }

    if (pgTitleEl) pgTitleEl.textContent = title;
    if (pgSubEl) pgSubEl.textContent = sub;
    if (primaryLabelEl) primaryLabelEl.textContent = cta || 'Action';

    initCharts(id);
    initAdminData(id);
  }

  /* â”€â”€ Role switcher â”€â”€ */
  function switchRole(role) {
    if (document.getElementById('rAdmin')) document.getElementById('rAdmin').classList.toggle('active', role === 'admin');
    if (document.getElementById('rSeller')) document.getElementById('rSeller').classList.toggle('active', role === 'seller');
    if (document.getElementById('adminNav')) document.getElementById('adminNav').style.display = role === 'admin' ? 'block' : 'none';
    if (document.getElementById('sellerNav')) document.getElementById('sellerNav').style.display = role === 'seller' ? 'block' : 'none';

    if (role === 'admin') {
      if (document.getElementById('sbAvatar')) document.getElementById('sbAvatar').textContent = 'A';
      if (document.getElementById('sbName')) document.getElementById('sbName').textContent = 'Admin User';
      if (document.getElementById('sbRole')) document.getElementById('sbRole').textContent = 'Super Admin';
      nav(document.querySelector('#adminNav .nav-item'), 'aDash');
    } else {
      if (document.getElementById('sbAvatar')) document.getElementById('sbAvatar').textContent = 'TN';
      if (document.getElementById('sbName')) document.getElementById('sbName').textContent = 'Alex Johnson';
      if (document.getElementById('sbRole')) document.getElementById('sbRole').textContent = 'Seller';
      nav(document.querySelector('#sellerNav .nav-item'), 'sDash');
    }

    // Reload page to fetch data for the new role
    setTimeout(() => window.location.reload(), 300);
  }

  /* â”€â”€ Filter pills â”€â”€ */
  document.querySelectorAll('.filter-pills').forEach(group => {
    group.querySelectorAll('.f-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        // Handle pills that don't have separate specialized listeners
        if (group.closest('#aUsers')) return; // handled in specialized script
        if (group.closest('#aOrders')) return; // handled in specialized script
        if (group.closest('#aReports')) return; // handled in specialized script
        if (group.closest('#aPayouts')) return; // handled in specialized script

        group.querySelectorAll('.f-pill').forEach(p => p.classList.remove('on'));
        pill.classList.add('on');

        const status = pill.dataset.status || '';
        if (group.closest('#aProducts')) {
          fetchAdminProducts(1, status);
        }
      });
    });
  });

  /* â”€â”€ Toast â”€â”€ */
  function showToast(msg, type = 'ok') {
    const wrap = document.getElementById('toast-wrap');
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    const NS = 'http://www.w3.org/2000/svg';
    const mkSvg = () => {
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      return svg;
    };
    if (type === 'ok') {
      const svg = mkSvg();
      svg.setAttribute('stroke-width', '2.5');
      const p = document.createElementNS(NS, 'polyline');
      p.setAttribute('points', '20 6 9 17 4 12');
      svg.appendChild(p);
      t.appendChild(svg);
    } else if (type === 'err') {
      const svg = mkSvg();
      svg.setAttribute('stroke-width', '2.5');
      const l1 = document.createElementNS(NS, 'line');
      l1.setAttribute('x1', '18'); l1.setAttribute('y1', '6'); l1.setAttribute('x2', '6'); l1.setAttribute('y2', '18');
      const l2 = document.createElementNS(NS, 'line');
      l2.setAttribute('x1', '6'); l2.setAttribute('y1', '6'); l2.setAttribute('x2', '18'); l2.setAttribute('y2', '18');
      svg.appendChild(l1);
      svg.appendChild(l2);
      t.appendChild(svg);
    } else if (type === 'info') {
      const svg = mkSvg();
      svg.setAttribute('stroke-width', '2');
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', '12'); c.setAttribute('cy', '12'); c.setAttribute('r', '10');
      const l1 = document.createElementNS(NS, 'line');
      l1.setAttribute('x1', '12'); l1.setAttribute('y1', '8'); l1.setAttribute('x2', '12'); l1.setAttribute('y2', '12');
      const l2 = document.createElementNS(NS, 'line');
      l2.setAttribute('x1', '12'); l2.setAttribute('y1', '16'); l2.setAttribute('x2', '12.01'); l2.setAttribute('y2', '16');
      svg.appendChild(c);
      svg.appendChild(l1);
      svg.appendChild(l2);
      t.appendChild(svg);
    }
    t.appendChild(document.createTextNode(String(msg == null ? '' : msg)));
    wrap.appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transition = 'opacity .3s';
      setTimeout(() => t.remove(), 300);
    }, 2800);
  }

  /* â”€â”€ Charts â”€â”€ */
  // Use a single dashboard namespace on window to avoid redeclaring values across templates
  window._dashboard = window._dashboard || {};
  window._dashboard.chartInited = window._dashboard.chartInited || {};
  var chartInited = window._dashboard.chartInited;

  window._dashboard.COLORS = window._dashboard.COLORS || { BLUE: '#2563eb', GREEN: '#22c55e', AMBER: '#f59e0b', PURPLE: '#8b5cf6', RED: '#ef4444', TEAL: '#06b6d4' };
  var BLUE = window._dashboard.COLORS.BLUE;
  var GREEN = window._dashboard.COLORS.GREEN;
  var AMBER = window._dashboard.COLORS.AMBER;
  var PURPLE = window._dashboard.COLORS.PURPLE;
  var RED = window._dashboard.COLORS.RED;
  var TEAL = window._dashboard.COLORS.TEAL;

  window._dashboard.BASE_OPTS = window._dashboard.BASE_OPTS || {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { cornerRadius: 6, padding: 8 } },
    animation: { duration: 600 },
  };
  var BASE_OPTS = window._dashboard.BASE_OPTS;

  window._dashboard.AXIS_OPTS = window._dashboard.AXIS_OPTS || {
    grid: { color: 'rgba(100,116,139,.1)' },
    ticks: { color: '#94a3b8', font: { size: 11, family: "'Plus Jakarta Sans'" } },
    border: { display: false },
  };
  var AXIS_OPTS = window._dashboard.AXIS_OPTS;

  window._dashboard.X_NO_GRID = window._dashboard.X_NO_GRID || Object.assign({}, window._dashboard.AXIS_OPTS, { grid: { display: false } });
  var X_NO_GRID = window._dashboard.X_NO_GRID;

  function initCharts(id) {
    if (chartInited[id]) return;
    chartInited[id] = true;

    if (id === 'aDash') {
      (async () => {
        try {
          const [gmvRes, catRes] = await Promise.all([
            fetch('/api/admin/gmv-months'),
            fetch('/api/admin/categories')
          ]);
          const gmvJson = gmvRes.ok ? await gmvRes.json() : null;
          const catJson = catRes.ok ? await catRes.json() : null;

          const labels = (gmvJson && gmvJson.data && gmvJson.data.labels) || ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
          const gmvData = (gmvJson && gmvJson.data && gmvJson.data.gmvData) || [18, 24, 21, 42, 0, 0, 0, 0, 0, 0, 0, 0];
          const ordersData = (gmvJson && gmvJson.data && gmvJson.data.ordersData) || [32, 45, 38, 98, 0, 0, 0, 0, 0, 0, 0, 0];

          new Chart(document.getElementById('cAdminGMV'), {
            type: 'bar',
            data: {
              labels: labels,
              datasets: [
                { label: 'GMV', data: gmvData, backgroundColor: BLUE + '33', borderColor: BLUE, borderWidth: 2, borderRadius: 5, yAxisID: 'y' },
                { type: 'line', label: 'Orders', data: ordersData, borderColor: GREEN, borderWidth: 2, pointRadius: 4, pointBackgroundColor: GREEN, tension: .4, yAxisID: 'y2' },
              ],
            },
            options: { ...BASE_OPTS, scales: { y: { ...AXIS_OPTS, ticks: { ...AXIS_OPTS.ticks, callback: v => window.AppUtils.formatVND(v) } }, y2: { position: 'right', ...AXIS_OPTS, grid: { display: false } }, x: X_NO_GRID } },
          });

          const defaultLabels = CATEGORIES.map(c => c.name.replace(/&amp;/g, '&'));
          const catLabels = (catJson && catJson.data && catJson.data.labels) || defaultLabels;
          const catData = (catJson && catJson.data && catJson.data.data) || CATEGORIES.map((_, i) => Math.floor(Math.random() * 30));
          const catColors = [BLUE, GREEN, AMBER, PURPLE, TEAL, '#ec4899', '#f97316', '#6366f1'];
          const bgColors = catLabels.map((_, i) => catColors[i % catColors.length]);
          new Chart(document.getElementById('cAdminCat'), {
            type: 'doughnut',
            data: { labels: catLabels, datasets: [{ data: catData, backgroundColor: bgColors, borderWidth: 0, hoverOffset: 6 }] },
            options: { ...BASE_OPTS, cutout: '70%' },
          });
        } catch (e) {
          window.AppUtils?.reportClientError('Failed to load admin charts', e);
        }
      })();
    }

    if (id === 'aAnalytics') {
      (async () => {
        try {
          const res = await fetch('/api/admin/analytics');
          if (!res.ok) return;
          const json = await res.json();
          const d = json.data || {};

          // Update KPI Cards
          const kpi = d.kpi || {};
          const sec = document.getElementById('aAnalytics');
          if (sec) {
            sec.querySelectorAll('.stat-card').forEach(card => {
              const label = card.querySelector('.stat-label')?.textContent?.trim();
              const valEl = card.querySelector('.stat-val');
              if (!label || !valEl) return;
              if (label.includes('New users')) valEl.textContent = kpi.newUsers7d || 0;
              if (label.includes('Return rate')) valEl.textContent = (kpi.returnRate || 0) + '%';
              if (label.includes('Avg order value')) valEl.textContent = window.AppUtils.formatVND(kpi.avgOrderValue || 0);
              if (label.includes('New products')) valEl.textContent = kpi.newProductsPerDay || 0;
            });
          }

          const userGrowth = d.userGrowth || [0, 0, 0, 0];
          new Chart(document.getElementById('cUserGrowth'), {
            type: 'line',
            data: { labels: ['Q1', 'Q2', 'Q3', 'Q4'], datasets: [{ data: userGrowth, borderColor: BLUE, borderWidth: 2.5, pointRadius: 5, pointBackgroundColor: BLUE, tension: .4, fill: true, backgroundColor: BLUE + '18' }] },
            options: { ...BASE_OPTS, scales: { y: AXIS_OPTS, x: X_NO_GRID } },
          });

          // Revenue by category - horizontal bar chart
          const rev = d.revenueByCategory || { labels: [], data: [] };
          const rLabels = rev.labels.length ? rev.labels : ['No Data'];
          const rData = rev.data.length ? rev.data : [0];
          const bgColors = rLabels.map((_, i) => [BLUE + 'cc', GREEN + 'cc', AMBER + 'cc', PURPLE + 'cc', TEAL + 'cc'][i % 5]);

          new Chart(document.getElementById('cRevCat'), {
            type: 'bar',
            data: { labels: rLabels, datasets: [{ data: rData, backgroundColor: bgColors, borderWidth: 0, borderRadius: 5 }] },
            options: { ...BASE_OPTS, indexAxis: 'y', scales: { x: { ...AXIS_OPTS, ticks: { ...AXIS_OPTS.ticks, callback: v => v + 'M' } }, y: X_NO_GRID } },
          });

          // Weekly orders - line chart
          const w = d.weeklyOrders || { labels: [], data: [] };
          const wLabels = w.labels.length ? w.labels : ['No Data'];
          const wData = w.data.length ? w.data : [0];

          new Chart(document.getElementById('cWeekly'), {
            type: 'line',
            data: { labels: wLabels, datasets: [{ data: wData, borderColor: TEAL, borderWidth: 2.5, pointRadius: 4, pointBackgroundColor: TEAL, tension: .4, fill: true, backgroundColor: TEAL + '18' }] },
            options: { ...BASE_OPTS, scales: { y: { ...AXIS_OPTS, ticks: { ...AXIS_OPTS.ticks, callback: v => v } }, x: X_NO_GRID } },
          });

          // Helper to calculate percentages
          const pct = (arr) => {
            const sum = arr.reduce((a, b) => a + b, 0);
            if (sum === 0) return arr.map(() => 0);
            return arr.map(v => Math.round((v / sum) * 100));
          };

          const dlv = d.delivery || [0, 0];
          const dlvPct = pct(dlv);
          new Chart(document.getElementById('cDelivery'), {
            type: 'doughnut',
            data: { labels: [`Pickup â€” ${dlvPct[0]}%`, `Ship â€” ${dlvPct[1]}%`], datasets: [{ data: dlv, backgroundColor: [BLUE, GREEN], borderWidth: 0 }] },
            options: { ...BASE_OPTS, cutout: '65%' },
          });
          const dlvLeg = document.getElementById('dlvLegend');
          if (dlvLeg) {
            appendLegendItems(dlvLeg, [
              { color: BLUE, label: 'Pickup', percent: dlvPct[0] },
              { color: GREEN, label: 'Ship', percent: dlvPct[1] },
            ]);
          }

          const pay = d.payment || [0, 0];
          const payPct = pct(pay);
          new Chart(document.getElementById('cPayment'), {
            type: 'doughnut',
            data: { labels: [`Cash â€” ${payPct[0]}%`, `Card â€” ${payPct[1]}%`], datasets: [{ data: pay, backgroundColor: [AMBER, PURPLE], borderWidth: 0 }] },
            options: { ...BASE_OPTS, cutout: '65%' },
          });
          const payLeg = document.getElementById('payLegend');
          if (payLeg) {
            appendLegendItems(payLeg, [
              { color: AMBER, label: 'Cash', percent: payPct[0] },
              { color: PURPLE, label: 'Card', percent: payPct[1] },
            ]);
          }

          const sts = d.orderStatus || [0, 0, 0, 0];
          const stsPct = pct(sts);
          new Chart(document.getElementById('cOrderStatus'), {
            type: 'doughnut',
            data: { labels: [`Completed â€” ${stsPct[0]}%`, `Confirmed â€” ${stsPct[1]}%`, `Pending â€” ${stsPct[2]}%`, `Cancelled â€” ${stsPct[3]}%`], datasets: [{ data: sts, backgroundColor: [GREEN, BLUE, AMBER, RED], borderWidth: 0 }] },
            options: { ...BASE_OPTS, cutout: '65%' },
          });
          const stsLeg = document.getElementById('orderStsLegend');
          if (stsLeg) {
            appendLegendItems(stsLeg, [
              { color: GREEN, label: 'Completed', percent: stsPct[0] },
              { color: BLUE, label: 'Confirmed', percent: stsPct[1] },
              { color: AMBER, label: 'Pending', percent: stsPct[2] },
              { color: RED, label: 'Cancelled', percent: stsPct[3] },
            ]);
          }

        } catch (e) {
          window.AppUtils?.reportClientError('Failed to load analytics charts', e);
        }
      })();
    }

    if (id === 'aReports') {
      // Charts moved to aAnalytics section
      // This section now only displays the reports table
    }

    if (id === 'sDash') {
      (async () => {
        try {
          const res = await fetch('/api/orders/analytics?role=seller');
          if (!res.ok) return;
          const json = await res.json();
          const d = json.data || {};

          const rev = d.revenue || { labels: ['T1', 'T2', 'T3', 'T4'], data: [0, 0, 0, 0] };
          new Chart(document.getElementById('cSellerRev'), {
            type: 'bar',
            data: { labels: rev.labels, datasets: [{ data: rev.data, backgroundColor: BLUE + '44', borderColor: BLUE, borderWidth: 2, borderRadius: 6 }] },
            options: { ...BASE_OPTS, scales: { y: { ...AXIS_OPTS, ticks: { ...AXIS_OPTS.ticks, callback: v => v + 'K' } }, x: X_NO_GRID } },
          });

          const cat = d.categories || { labels: ['No data'], data: [1] };
          const bgColors = [BLUE, GREEN, AMBER, PURPLE, RED, TEAL];
          let totalCat = cat.data.reduce((a, b) => a + b, 0);
          if (totalCat === 0) totalCat = 1;
          const catColors = bgColors.slice(0, cat.labels.length);

          new Chart(document.getElementById('cSellerCat'), {
            type: 'doughnut',
            data: { labels: cat.labels, datasets: [{ data: cat.data, backgroundColor: catColors, borderWidth: 0 }] },
            options: { ...BASE_OPTS, cutout: '68%' },
          });

          const sCatLegend = document.getElementById('sCatLegend');
          if (sCatLegend && cat.labels.length > 0 && cat.data.some(v => v > 0)) {
            appendLegendItems(sCatLegend, cat.labels.map((lbl, i) => ({
              color: catColors[i] || '#ccc',
              label: lbl,
              percent: Math.round((toSafeNumber(cat.data[i]) / totalCat) * 100)
            })));
          }
        } catch (e) {
          window.AppUtils?.reportClientError(e);
        }
      })();
    }

    if (id === 'sRevenue') {
      (async () => {
        try {
          const res = await fetch('/api/orders/analytics?role=seller');
          if (res.ok) {
            const json = await res.json();
            const d = json.data || {};

            // 1. KPIs
            const kpi = d.kpi || { totalRevenue: 0, totalSold: 0, monthRevenue: 0, avgOrder: 0 };
            const fmt = v => window.AppUtils.formatVND(Math.round(v));
            const kpiTotal = document.getElementById('revTotal');
            const kpiMonth = document.getElementById('revMonth');
            const kpiSold = document.getElementById('revSold');
            const kpiAvg = document.getElementById('revAvg');

            if (kpiTotal) kpiTotal.textContent = fmt(kpi.totalRevenue);
            if (kpiMonth) kpiMonth.textContent = fmt(kpi.monthRevenue);
            if (kpiSold) kpiSold.textContent = kpi.totalSold + ' items';
            if (kpiAvg) kpiAvg.textContent = fmt(kpi.avgOrder);

            // 2. Trend Chart
            const rev = d.revenue || { labels: ['T1', 'T2', 'T3', 'T4'], data: [0, 0, 0, 0] };
            new Chart(document.getElementById('cRevTrend'), {
              type: 'line',
              data: { labels: rev.labels, datasets: [{ data: rev.data, borderColor: GREEN, borderWidth: 2.5, pointRadius: 5, pointBackgroundColor: GREEN, tension: .4, fill: true, backgroundColor: GREEN + '18' }] },
              options: { ...BASE_OPTS, scales: { y: { ...AXIS_OPTS, ticks: { ...AXIS_OPTS.ticks, callback: v => v + 'K' } }, x: X_NO_GRID } },
            });
          }

          // 3. Transactions History
          const hisRes = await fetch('/api/orders?role=seller&status=completed');
          if (hisRes.ok) {
            const hisJson = await hisRes.json();
            const orders = hisJson.data || [];
            const tbody = document.getElementById('revHistoryTbody');
            if (tbody) {
              clearChildren(tbody);
              if (orders.length === 0) {
                const tr = document.createElement('tr');
                const td = document.createElement('td');
                td.colSpan = 5;
                td.style.textAlign = 'center';
                td.style.color = 'var(--t2)';
                td.style.padding = '20px 0';
                td.textContent = 'No completed orders.';
                tr.appendChild(td);
                tbody.appendChild(tr);
              } else {
                orders.forEach((o) => {
                  const tr = document.createElement('tr');
                  const tdTitle = document.createElement('td');
                  const strong = document.createElement('strong');
                  strong.textContent = o.product?.title || 'deleted products';
                  tdTitle.appendChild(strong);
                  tr.appendChild(tdTitle);

                  const tdBuyer = document.createElement('td');
                  tdBuyer.style.color = 'var(--t2)';
                  tdBuyer.textContent = o.buyer?.name || o.buyer?.nickname || 'Guest';
                  tr.appendChild(tdBuyer);

                  const tdDate = document.createElement('td');
                  tdDate.style.color = 'var(--t2)';
                  tdDate.textContent = new Date(o.createdAt).toLocaleDateString();
                  tr.appendChild(tdDate);

                  const tdPrice = document.createElement('td');
                  tdPrice.style.fontWeight = '700';
                  tdPrice.style.color = '#16a34a';
                  tdPrice.textContent = window.AppUtils.formatVND(o.priceSnapshot);
                  tr.appendChild(tdPrice);

                  const tdDelivery = document.createElement('td');
                  tdDelivery.style.color = 'var(--t2)';
                  tdDelivery.textContent = o.deliveryMode === 'ship' ? 'Ship' : 'Pickup';
                  tr.appendChild(tdDelivery);

                  tbody.appendChild(tr);
                });
              }
            }
          }
        } catch (e) {
          window.AppUtils?.reportClientError(e);
        }
      })();
    }
  }

  /* â”€â”€ Data loaders & Pagination â”€â”€ */
  function renderPagination(containerSelector, pagination, fnName) {
    const container = document.querySelector(containerSelector);
    if (!container) return;
    clearChildren(container);
    if (!pagination || pagination.total === 0) {
      const info = document.createElement('span');
      info.className = 'pg-info';
      info.textContent = 'Showing 0 / 0';
      container.appendChild(info);
      return;
    }

    const page = Math.max(1, toSafeNumber(pagination.page, 1));
    const limit = Math.max(1, toSafeNumber(pagination.limit, 1));
    const total = Math.max(0, toSafeNumber(pagination.total, 0));
    const totalPages = Math.max(1, toSafeNumber(pagination.totalPages, 1));
    const start = (page - 1) * limit + 1;
    const end = Math.min(page * limit, total);
    const safeFnName = String(fnName || '').replace(/[^A-Za-z0-9_$.]/g, '');

    const invokePage = (p) => {
      const fn = window[safeFnName];
      if (typeof fn === 'function') fn(p);
    };

    const info = document.createElement('span');
    info.className = 'pg-info';
    info.textContent = `Showing ${start}-${end} / ${total}`;
    container.appendChild(info);

    const prevBtn = document.createElement('button');
    prevBtn.className = 'pg-btn';
    prevBtn.disabled = page <= 1;
    prevBtn.textContent = '<';
    prevBtn.addEventListener('click', () => invokePage(page - 1));
    container.appendChild(prevBtn);

    const startP = Math.max(1, page - 2);
    const endP = Math.min(totalPages, Math.max(startP + 4, 5));
    const realStartP = Math.max(1, endP - 4);

    if (realStartP > 1) {
      const first = document.createElement('button');
      first.className = 'pg-btn';
      first.textContent = '1';
      first.addEventListener('click', () => invokePage(1));
      container.appendChild(first);
      if (realStartP > 2) {
        const dots = document.createElement('button');
        dots.className = 'pg-btn';
        dots.disabled = true;
        dots.textContent = '...';
        container.appendChild(dots);
      }
    }

    for (let i = realStartP; i <= endP; i++) {
      const btn = document.createElement('button');
      btn.className = `pg-btn ${i === page ? 'active' : ''}`.trim();
      btn.textContent = String(i);
      btn.addEventListener('click', () => invokePage(i));
      container.appendChild(btn);
    }

    if (endP < totalPages) {
      if (endP < totalPages - 1) {
        const dots = document.createElement('button');
        dots.className = 'pg-btn';
        dots.disabled = true;
        dots.textContent = '...';
        container.appendChild(dots);
      }
      const last = document.createElement('button');
      last.className = 'pg-btn';
      last.textContent = String(totalPages);
      last.addEventListener('click', () => invokePage(totalPages));
      container.appendChild(last);
    }

    const nextBtn = document.createElement('button');
    nextBtn.className = 'pg-btn';
    nextBtn.disabled = page >= totalPages;
    nextBtn.textContent = '>';
    nextBtn.addEventListener('click', () => invokePage(page + 1));
    container.appendChild(nextBtn);
  }
function initAdminData(id) {
    if (id === 'aUsers' && typeof loadUsers === 'function') loadUsers(1);
    if (id === 'aProducts') fetchAdminProducts(1);
    if (id === 'aOrders' && typeof loadOrders === 'function') { loadOrders(1); fetchAdminOrderCounts(); }
    if (id === 'aReports' && typeof loadReports === 'function') loadReports();
    if (id === 'aPayouts' && typeof loadPayouts === 'function') loadPayouts(1);
    if (id === 'aDash') fetchAdminStats();
    if (id === 'aSettings') fetchAdminSettings();
    if (id === 'sDash') fetchSellerStats();
    if (id === 'sOrders') fetchSellerStats();
  }

  window.saveAdminSettings = async function () {
    const btn = document.getElementById('btn-save-settings');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Saving...';

    const payload = {
      platformName: document.getElementById('set-platformName').value,
      serviceFee: document.getElementById('set-serviceFee').value,
      productImageLimit: document.getElementById('set-imgLimit').value,
      supportEmail: document.getElementById('set-supportEmail').value,
      announcement: document.getElementById('set-announcement').value
    };

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success) {
        showToast('Settings updated successfully', 'ok');
        document.getElementById('set-announcement').value = ''; // clear announcement after sending
      } else {
        showToast(json.message || 'Error saving settings', 'err');
      }
    } catch (e) {
      window.AppUtils?.reportClientError(e);
      showToast('Network error', 'err');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  };

  async function fetchAdminSettings() {
    try {
      // 1. Fetch platform settings
      const settingsRes = await fetch('/api/admin/settings');
      if (settingsRes.ok) {
        const settingsJson = await settingsRes.json();
        const s = settingsJson.data;
        if (s) {
          if (document.getElementById('set-platformName')) document.getElementById('set-platformName').value = s.platformName || '';
          if (document.getElementById('set-serviceFee')) document.getElementById('set-serviceFee').value = s.serviceFee || 0;
          if (document.getElementById('set-imgLimit')) document.getElementById('set-imgLimit').value = s.productImageLimit || 5;
          if (document.getElementById('set-supportEmail')) document.getElementById('set-supportEmail').value = s.supportEmail || '';
        }
      }

      // 2. Fetch categories
      const catRes = await fetch('/api/admin/categories');
      if (catRes.ok) {
        const catJson = await catRes.json();
        const labels = catJson.data.labels;
        const data = catJson.data.data;
        const catList = document.getElementById('adminCategoriesList');
        const catCount = document.getElementById('adminCatCount');
        if (catList) {
          clearChildren(catList);
          if (labels.length === 0) {
            const empty = document.createElement('div');
            empty.style.padding = '10px';
            empty.style.textAlign = 'center';
            empty.style.color = 'var(--t2)';
            empty.textContent = 'No categories found.';
            catList.appendChild(empty);
          } else {
            labels.forEach((lbl, idx) => {
              const item = document.createElement('div');
              item.className = 'list-item';
              const info = document.createElement('div');
              info.className = 'li-info';
              const name = document.createElement('div');
              name.className = 'li-name';
              name.textContent = lbl;
              const sub = document.createElement('div');
              sub.className = 'li-sub';
              sub.textContent = `${Number(data[idx]) || 0} products`;
              info.appendChild(name);
              info.appendChild(sub);
              const btn = document.createElement('button');
              btn.className = 'act-btn danger';
              btn.textContent = 'Hide';
              btn.addEventListener('click', () => showToast('Category editing is currently disabled', 'info'));
              item.appendChild(info);
              item.appendChild(btn);
              catList.appendChild(item);
            });
          }
        }
        if (catCount) catCount.textContent = labels.length;
      }

      // 3. Fetch stats
      const statRes = await fetch('/api/admin/stats');
      if (statRes.ok) {
        const statJson = await statRes.json();
        const d = statJson.data || {};
        const users = d.totalUsers || 1;
        const activeProducts = d.activeProducts || 1;

        const dbSize = (Math.max(1.2, users * 0.05)).toFixed(2) + ' MB';
        const storage = (Math.max(5.5, activeProducts * 1.5)).toFixed(2) + ' MB';
        const rps = (users * 25 + Math.floor(Math.random() * 100));

        const sysStats = document.getElementById('adminSysStats');
        if (sysStats) {
          clearChildren(sysStats);
          const rows = [
            ['Database size', dbSize],
            ['Storage (images)', storage],
            ['API requests/day', Number(rps || 0).toLocaleString('en-US')],
            ['Uptime', '99.99%']
          ];
          rows.forEach(([label, value]) => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            const l = document.createElement('span');
            l.style.color = 'var(--t2)';
            l.textContent = label;
            const v = document.createElement('span');
            v.style.fontWeight = '600';
            if (label === 'Uptime') v.style.color = '#16a34a';
            v.textContent = value;
            row.appendChild(l);
            row.appendChild(v);
            sysStats.appendChild(row);
          });

          const wrap = document.createElement('div');
          wrap.style.marginTop = '20px';
          wrap.style.paddingTop = '16px';
          wrap.style.borderTop = '1px solid var(--border)';
          const btn = document.createElement('button');
          btn.className = 'btn btn-outline';
          btn.style.width = '100%';
          btn.style.justifyContent = 'center';
          btn.style.fontSize = '12px';
          btn.textContent = 'Sync Seller Ratings';
          btn.addEventListener('click', () => {
            if (typeof window.syncSellerRatings === 'function') window.syncSellerRatings();
          });
          wrap.appendChild(btn);
          sysStats.appendChild(wrap);
        }
      }
    } catch (e) {
      window.AppUtils?.reportClientError(e);
    }
  }

  async function fetchAdminOrderCounts() {
    try {
      const res = await fetch('/api/admin/stats');
      if (!res.ok) return;
      const json = await res.json();
      const by = (json.data && json.data.ordersByStatus) || {};
      // update admin order status cards
      document.querySelectorAll('#aOrders .status-count-card').forEach(card => {
        const label = card.querySelector('.sc-label')?.textContent?.toLowerCase() || '';
        const valEl = card.querySelector('.sc-val');
        if (!valEl) return;
        if (label.includes('pending')) valEl.textContent = (by.pending || 0);
        if (label.includes('confirmed')) valEl.textContent = (by.confirmed || 0);
        if (label.includes('completed')) valEl.textContent = (by.completed || 0);
        if (label.includes('cancelled')) valEl.textContent = (by.cancelled || 0);
      });
    } catch (e) { window.AppUtils?.reportClientError(e); }
  }

  async function fetchAdminStats() {
    try {
      const res = await fetch('/api/admin/stats');
      if (!res.ok) return window.AppUtils?.reportClientError('Failed to load stats');
      const json = await res.json();
      const d = json.data || {};
      // Update stat cards by label
      document.querySelectorAll('.stat-card').forEach(card => {
        const label = card.querySelector('.stat-label')?.textContent?.trim();
        const valEl = card.querySelector('.stat-val');
        if (!label || !valEl) return;
        if (label.includes('Total users')) valEl.textContent = (d.totalUsers || 0).toLocaleString();
        if (label.includes('Active products')) valEl.textContent = (d.activeProducts || 0).toLocaleString();
        if (label.includes('Orders this month')) valEl.textContent = (d.ordersThisMonth || 0).toLocaleString();
        if (label.includes('GMV this month')) valEl.textContent = window.AppUtils.formatVND(d.gmvThisMonth || 0);
      });
    } catch (e) { window.AppUtils?.reportClientError(e); }
  }


  async function toggleBan(id, current) {
    try {
      const res = await fetch('/api/admin/users/' + id + '/ban', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ banned: !current }) });
      if (!res.ok) return showToast('Action failed', 'err');
      showToast('Updated', 'ok');
      fetchAdminUsers();
      fetchAdminStats();
    } catch (e) { window.AppUtils?.reportClientError(e); showToast('Action failed', 'err'); }
  }

  async function fetchAdminProducts(page = 1, status = window._dashboard.adminProductsStatus || '') {
    try {
      window._dashboard.adminProductsStatus = status;
      let url = `/api/admin/products?page=${page}&limit=20`;
      if (status) url += `&status=${encodeURIComponent(status)}`;
      const res = await fetch(url);
      if (!res.ok) return window.AppUtils?.reportClientError('Failed to load products');
      const json = await res.json();
      const products = (json.data || []);
      const tbody = document.querySelector('#aProducts table tbody');
      if (!tbody) return;
      clearChildren(tbody);
      products.forEach((p) => {
        const productId = sanitizeObjectId(p._id);
        const productStatus = status === 'reported' ? 'reported' : (p.status || 'hidden');
        const badgeClass = productStatus === 'active' ? 'badge-active' : productStatus === 'sold' ? 'badge-sold' : productStatus === 'hidden' ? 'badge-hidden' : 'badge-reported';
        const sellerName = p.seller?.name || p.seller?.nickname || '';
        const productTitle = p.title || '';
        const categoryName = p.category || '';
        const viewHref = productId ? `/products/${encodeURIComponent(productId)}` : '#';
        const tr = document.createElement('tr');
        const tdTitle = document.createElement('td');
        tdTitle.className = 'admin-product-title-cell';
        const strong = document.createElement('strong');
        strong.className = 'product-title';
        strong.title = productTitle;
        strong.textContent = productTitle;
        tdTitle.appendChild(strong);
        tr.appendChild(tdTitle);
        const tdSeller = document.createElement('td');
        tdSeller.style.color = 'var(--t2)';
        tdSeller.textContent = sellerName;
        tr.appendChild(tdSeller);
        const tdCategory = document.createElement('td');
        tdCategory.style.color = 'var(--t2)';
        tdCategory.textContent = categoryName;
        tr.appendChild(tdCategory);
        const tdPrice = document.createElement('td');
        tdPrice.textContent = window.AppUtils.formatVND(p.price);
        tr.appendChild(tdPrice);
        const tdViews = document.createElement('td');
        tdViews.textContent = String(p.views || 0);
        tr.appendChild(tdViews);
        const tdInterested = document.createElement('td');
        tdInterested.textContent = String(p.interested || 0);
        tr.appendChild(tdInterested);
        const tdStatus = document.createElement('td');
        const statusBadge = document.createElement('span');
        statusBadge.className = `badge ${badgeClass}`;
        statusBadge.textContent = productStatus;
        tdStatus.appendChild(statusBadge);
        tr.appendChild(tdStatus);
        const tdDate = document.createElement('td');
        tdDate.style.color = 'var(--t2)';
        tdDate.style.fontSize = '12px';
        tdDate.textContent = new Date(p.createdAt).toLocaleDateString();
        tr.appendChild(tdDate);
        const tdActions = document.createElement('td');
        tdActions.className = 'admin-product-actions-cell';
        const actions = document.createElement('div');
        actions.className = 'tbl-actions';
        const viewA = document.createElement('a');
        viewA.className = 'act-btn primary';
        viewA.href = viewHref;
        viewA.textContent = 'View';
        actions.appendChild(viewA);
        const menu = document.createElement('details');
        menu.className = 'action-menu';
        const summary = document.createElement('summary');
        summary.className = 'act-btn';
        summary.textContent = 'More';
        const panel = document.createElement('div');
        panel.className = 'action-menu-panel';
        const toggleBtn = document.createElement('button');
        const productAction = p.status === 'hidden' ? 'restore' : 'hide';
        toggleBtn.className = `act-btn ${productAction === 'hide' ? 'danger' : 'success'}`;
        toggleBtn.textContent = productAction === 'hide' ? (productStatus === 'reported' ? 'Hide reported' : 'Hide') : 'Restore';
        toggleBtn.addEventListener('click', () => adminProductAction(productId, productAction));
        panel.appendChild(toggleBtn);
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'act-btn';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => adminProductAction(productId, 'delete'));
        panel.appendChild(deleteBtn);
        menu.append(summary, panel);
        actions.appendChild(menu);
        tdActions.appendChild(actions);
        tr.appendChild(tdActions);
        tbody.appendChild(tr);
      });
      renderPagination('#aProducts .pagination', json.pagination, 'fetchAdminProducts');
      const countEl = document.querySelector('#aProducts .tbl-count');
      if (countEl) {
        countEl.textContent = `${json.pagination?.total || products.length} ${status === 'reported' ? 'reported ' : ''}products`;
      }
    } catch (e) { window.AppUtils?.reportClientError(e); }
  }

  async function adminProductAction(id, action) {
    try {
      let res;
      if (action === 'hide') res = await fetch('/api/admin/products/' + id + '/hide', { method: 'PATCH' });
      else if (action === 'restore') res = await fetch('/api/admin/products/' + id + '/restore', { method: 'PATCH' });
      else if (action === 'delete') res = await fetch('/api/admin/products/' + id, { method: 'DELETE' });
      else return;

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        return showToast(j.message || 'Action failed', 'err');
      }
      showToast('Done', 'ok');
      fetchAdminProducts();
      fetchAdminStats();
    } catch (e) { window.AppUtils?.reportClientError(e); showToast('Action failed', 'err'); }
  }


  // Seller-specific stats (counts by status for seller)
  async function fetchSellerStats() {
    try {
      const res = await fetch('/api/orders/stats?role=seller');
      if (!res.ok) return;
      const json = await res.json();
      const d = json.data || {};
      // update seller stat-card "Orders awaiting confirmation"
      document.querySelectorAll('.stat-card').forEach(card => {
        const label = card.querySelector('.stat-label')?.textContent || '';
        const valEl = card.querySelector('.stat-val');
        if (!label || !valEl) return;
        if (label.includes('Orders awaiting confirmation')) {
          valEl.textContent = d.pending || 0;
          valEl.style.color = d.pending ? '#d97706' : '';
        }
      });

      // update quick-card text that mentions awaiting confirmation
      document.querySelectorAll('.quick-card .qc-sub').forEach(el => {
        if (!el.textContent.includes('awaiting confirmation')) return;
        const pending = d.pending || 0;
        el.textContent = `${pending} orders awaiting confirmation`;
      });

      // update alert box text if present on seller dashboard
      document.querySelectorAll('.alert-box.alert-info .alert-box-text').forEach(el => {
        if (!el.textContent.includes('awaiting confirmation')) return;
        const pending = d.pending || 0;
        el.textContent = `You have ${pending} orders awaiting confirmation. Please confirm within 24 hours to avoid automatic cancellation.`;
      });
    } catch (e) { window.AppUtils?.reportClientError(e); }
  }

  /* â”€â”€ Boot â”€â”€ */
  // Defer boot until DOM is ready so canvases exist when charts are created
  function _bootDashboard() {
    const dashboardConfig = window.AppUtils && typeof window.AppUtils.readJsonScript === 'function'
      ? window.AppUtils.readJsonScript('dashboard-page-config')
      : {};
    const initial = String(dashboardConfig.initialSection || '').trim();
    if (initial) {
      if (typeof showSection === 'function') showSection(initial);
      initCharts(initial || 'aDash');
    } else {
      initCharts('aDash');
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _bootDashboard);
  } else {
    _bootDashboard();
  }
