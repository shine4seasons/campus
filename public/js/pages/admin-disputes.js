(() => {
  const { createElement, createSvgElement, formatVND } = window.AppUtils || {};
  let currentTab = 'open';

  function formatDate(d) {
    return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function createLoadingState() {
    return createElement('div', {
      className: 'dsp-loading',
      children: [
        createSvgElement('svg', { class: 'spinner', width: '28', height: '28', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.5' }, [
          createSvgElement('circle', { cx: '12', cy: '12', r: '10', 'stroke-opacity': '0.25' }),
          createSvgElement('path', { d: 'M12 2a10 10 0 0 1 10 10' })
        ])
      ]
    });
  }

  function createEmptyState(title, message) {
    return createElement('div', {
      className: 'dsp-empty',
      children: [
        createElement('h3', { text: title }),
        createElement('p', { text: message })
      ]
    });
  }

  function createActionButton(label, className, onClick) {
    const button = createElement('button', { className, attrs: { type: 'button' }, text: label });
    button.addEventListener('click', onClick);
    return button;
  }

  function renderCard(order) {
    const dispute = order.dispute;
    const isOpen = dispute.status === 'open' || dispute.status === 'in_review';
    const productImg = (order.product && order.product.images && order.product.images[0]) || '';
    const productTitle = order.product ? order.product.title : '(Deleted product)';
    const buyerName = (order.buyer && (order.buyer.nickname || order.buyer.name)) || 'Unknown';
    const sellerName = (order.seller && (order.seller.nickname || order.seller.name)) || 'Unknown';
    const opener = (dispute.openedBy && (dispute.openedBy.nickname || dispute.openedBy.name)) || 'Unknown';

    const evidence = (dispute.evidenceImages || []).length
      ? createElement('div', {
          className: 'dsp-evidence',
          children: dispute.evidenceImages.map((url) => createElement('a', {
            attrs: { href: url, target: '_blank' },
            children: [createElement('img', { attrs: { src: url, alt: 'evidence' } })]
          }))
        })
      : null;

    const resolution = dispute.resolvedAt
      ? createElement('div', {
          className: 'dsp-resolution-meta',
          children: [
            createElement('strong', { text: 'Resolved:' }),
            document.createTextNode(` ${String(dispute.resolution || '').replace('-', ' ')}`),
            dispute.resolutionNote ? document.createTextNode(` - ${dispute.resolutionNote}`) : null,
            dispute.resolvedBy ? document.createTextNode(` · by ${dispute.resolvedBy.nickname || dispute.resolvedBy.name}`) : null,
            document.createTextNode(` · ${formatDate(dispute.resolvedAt)}`)
          ].filter(Boolean)
        })
      : null;

    const actions = createElement('div', { className: 'dsp-actions' });
    actions.appendChild(createActionButton('View order', 'dsp-btn view', () => {
      window.open(`/orders/tracking/${order._id}`, '_blank');
    }));
    if (isOpen) {
      actions.appendChild(createActionButton('Buyer wins', 'dsp-btn buyer', () => openResolveModal(order._id, 'buyer-favor')));
      actions.appendChild(createActionButton('Seller wins', 'dsp-btn seller', () => openResolveModal(order._id, 'seller-favor')));
      actions.appendChild(createActionButton('Mutual', 'dsp-btn mutual', () => openResolveModal(order._id, 'mutual')));
      actions.appendChild(createActionButton('Reject', 'dsp-btn reject', () => openResolveModal(order._id, 'rejected')));
    }

    return createElement('div', {
      className: 'dsp-card',
      children: [
        createElement('div', {
          className: 'dsp-card-head',
          children: [
            createElement('div', {
              children: [
                createElement('div', {
                  className: 'dsp-card-id',
                  text: `#${String(order._id).substring(0, 8).toUpperCase()} · opened ${formatDate(dispute.openedAt)}`
                })
              ]
            }),
            createElement('span', {
              className: `dsp-status ${dispute.status}`,
              text: String(dispute.status).replace('_', ' ')
            })
          ]
        }),
        createElement('div', {
          className: 'dsp-product',
          children: [
            productImg
              ? createElement('img', { attrs: { src: productImg, alt: productTitle } })
              : createElement('div', {
                  style: { width: '44px', height: '44px', background: 'var(--surface-2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
                  text: 'Package'
                }),
            createElement('div', {
              children: [
                createElement('div', { className: 'dsp-product-name', text: productTitle }),
                createElement('div', { className: 'dsp-product-price', text: formatVND(order.priceSnapshot) })
              ]
            })
          ]
        }),
        createElement('div', {
          className: 'dsp-row',
          children: [
            createElement('div', { children: [createElement('div', { className: 'lbl', text: 'Buyer' }), document.createTextNode(buyerName)] }),
            createElement('div', { children: [createElement('div', { className: 'lbl', text: 'Seller' }), document.createTextNode(sellerName)] }),
            createElement('div', { children: [createElement('div', { className: 'lbl', text: 'Opened by' }), document.createTextNode(`${opener} (${dispute.openedRole})`)] }),
            createElement('div', { children: [createElement('div', { className: 'lbl', text: 'Category' }), document.createTextNode(dispute.category || '')] })
          ]
        }),
        createElement('div', {
          className: 'dsp-reason',
          children: [
            createElement('strong', { text: dispute.reason || '' }),
            dispute.description ? document.createTextNode(` ${dispute.description}`) : null,
            evidence
          ].filter(Boolean)
        }),
        resolution,
        actions
      ].filter(Boolean)
    });
  }

  async function fetchDisputes() {
    const list = document.getElementById('dsp-list');
    list.replaceChildren(createLoadingState());

    try {
      const res = await fetch('/api/orders/disputes/all?status=' + currentTab + '&limit=50', { credentials: 'include' });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      if (!json.data.length) {
        list.replaceChildren(createEmptyState(`No ${currentTab === 'all' ? '' : currentTab} disputes`.trim(), 'Nothing to review here.'));
        return;
      }
      list.replaceChildren(...json.data.map(renderCard));
    } catch (err) {
      list.replaceChildren(createEmptyState('Failed to load', err.message || 'Unknown error'));
    }
  }

  document.getElementById('dsp-tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.dsp-tab');
    if (!tab) return;
    document.querySelectorAll('.dsp-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    currentTab = tab.dataset.status;
    fetchDisputes();
  });

  window.openResolveModal = function(orderId, decision) {
    document.getElementById('resolve-order-id').value = orderId;
    document.getElementById('resolve-decision').value = decision;
    document.getElementById('resolve-refund').checked = decision === 'buyer-favor';
    document.getElementById('resolve-note').value = '';
    document.getElementById('resolve-backdrop').classList.add('show');
  };

  window.closeResolveModal = function() {
    document.getElementById('resolve-backdrop').classList.remove('show');
  };

  document.getElementById('resolve-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'resolve-backdrop') closeResolveModal();
  });

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-action="close-resolve-modal"]')) window.closeResolveModal();
    if (event.target.closest('[data-action="submit-resolve"]')) window.submitResolve();
  });

  window.submitResolve = async function() {
    const orderId = document.getElementById('resolve-order-id').value;
    const resolution = document.getElementById('resolve-decision').value;
    const refund = document.getElementById('resolve-refund').checked;
    const note = document.getElementById('resolve-note').value.trim();
    const btn = document.getElementById('resolve-submit-btn');

    btn.disabled = true;
    btn.textContent = 'Submitting...';

    try {
      const res = await fetch('/api/orders/' + orderId + '/dispute/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ resolution, refund, resolutionNote: note })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      closeResolveModal();
      if (typeof showToast === 'function') showToast('Dispute resolved successfully', 'ok');
      fetchDisputes();
    } catch (err) {
      if (typeof showToast === 'function') showToast('Failed: ' + err.message, 'err');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Submit decision';
    }
  };

  fetchDisputes();
})();
