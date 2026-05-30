(() => {
  let currentFilter = '';
  let currentSearch = '';
  let currentSort = 'newest';
  let loadedProducts = [];

  function createElementSafe(tagName, options = {}) {
    const create = window.AppUtils?.createElement || function fallbackCreateElement(tagName, options = {}) {
      const element = document.createElement(tagName);
      if (options.className) element.className = options.className;
      if (Array.isArray(options.classes) && options.classes.length) element.classList.add(...options.classes.filter(Boolean));
      if (options.text != null) element.textContent = String(options.text);
      if (options.attrs) Object.entries(options.attrs).forEach(([name, value]) => { if (value != null) element.setAttribute(name, String(value)); });
      if (options.dataset) Object.entries(options.dataset).forEach(([name, value]) => { if (value != null) element.dataset[name] = String(value); });
      if (options.style) Object.assign(element.style, options.style);
      if (options.children) {
        const children = Array.isArray(options.children) ? options.children : [options.children];
        children.flat(Infinity).forEach((child) => {
          if (child == null || child === false) return;
          if (child instanceof Node) element.appendChild(child);
          else element.appendChild(document.createTextNode(String(child)));
        });
      }
      return element;
    };
    return create(tagName, options);
  }

  function setGridMessage(grid, message) {
    grid.replaceChildren(createElementSafe('div', {
      className: 'seller-products-message',
      text: message
    }));
  }

  function setInventoryEmpty(grid, title, sub) {
    grid.replaceChildren(createElementSafe('div', {
      className: 'seller-empty-state',
      children: [
        createElementSafe('i', { attrs: { 'data-lucide': 'package-search' }, style: { width: '42px', height: '42px', opacity: '0.6' } }),
        createElementSafe('div', { className: 'seller-empty-title', text: title }),
        createElementSafe('div', { className: 'seller-empty-sub', text: sub })
      ]
    }));
    if (window.lucide?.createIcons) window.lucide.createIcons();
  }

  function createRatingDisplay(product) {
    const cell = createElementSafe('span', { className: 'seller-product-rating' });
    if (product.ratingCount > 0) {
      const icon = createElementSafe('i', {
        attrs: { 'data-lucide': 'star' },
        style: { width: '12px', height: '12px', display: 'inline-block', verticalAlign: 'middle', marginRight: '2px', fill: 'currentColor' }
      });
      cell.append(icon, document.createTextNode(` ${parseFloat(product.ratingAverage || 0).toFixed(1)} (${product.ratingCount})`));
    } else {
      cell.textContent = 'No ratings';
    }
    return cell;
  }

  function createStatusBadge(status) {
    const normalized = status || 'active';
    const badgeClass = normalized === 'active' ? 'badge-active' : normalized === 'sold' ? 'badge-sold' : normalized === 'hidden' ? 'badge-hidden' : 'badge-active';
    return createElementSafe('span', { className: `seller-product-status badge ${badgeClass}`, text: normalized });
  }

  function createProductCard(product) {
    const price = window.AppUtils.formatVND(product.price || 0);
    const status = product.status || 'active';
    const imageUrl = Array.isArray(product.images) && product.images.length ? product.images[0] : '';
    const card = createElementSafe('article', {
      className: 'seller-product-card product-card',
      attrs: { tabindex: '0', role: 'link', 'aria-label': `View ${product.title || 'product'}` },
      dataset: { productId: product._id }
    });
    const imageWrap = createElementSafe('div', { className: 'seller-product-image product-img-placeholder' });
    if (imageUrl) {
      imageWrap.appendChild(createElementSafe('img', { attrs: { src: imageUrl, alt: product.title || 'Product image' } }));
    } else {
      imageWrap.appendChild(createElementSafe('div', {
        className: 'seller-product-image-empty',
        children: [createElementSafe('i', { attrs: { 'data-lucide': 'package' } })]
      }));
    }

    const topRow = createElementSafe('div', {
      className: 'seller-product-topline',
      children: [
        createElementSafe('div', { className: 'product-price seller-product-price', text: price }),
        createStatusBadge(status)
      ]
    });

    const metrics = createElementSafe('div', {
      className: 'seller-product-metrics',
      children: [
        createElementSafe('span', { text: `${typeof product.quantity === 'number' ? product.quantity : 1} in stock` }),
        createElementSafe('span', { text: `${product.views || 0} views` }),
        createElementSafe('span', { text: `${product.interested || 0} interested` })
      ]
    });

    const actionWrap = createElementSafe('div', { className: 'tbl-actions' });
    const editBtn = createElementSafe('button', { className: 'act-btn primary', text: 'Edit', attrs: { type: 'button' } });
    editBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      window.location = `/sell?id=${product._id}`;
    });
    const toggleBtn = createElementSafe('button', {
      className: status === 'hidden' ? 'act-btn success' : 'act-btn danger',
      text: status === 'hidden' ? 'Unhide' : 'Hide',
      attrs: { type: 'button' }
    });
    toggleBtn.addEventListener('click', async (event) => {
      event.stopPropagation();
      const confirmed = typeof showConfirm === 'function'
        ? await showConfirm({
            title: status === 'hidden' ? 'Show product' : 'Hide product',
            message: status === 'hidden' ? 'This product will be visible to buyers again.' : 'Hide this product from your storefront until you decide to relist it?',
            confirmText: status === 'hidden' ? 'Show product' : 'Hide product',
            type: status === 'hidden' ? 'info' : 'danger'
          })
        : window.confirm(status === 'hidden' ? 'Show this product again?' : 'Hide this product?');
      if (!confirmed) return;
      window.toggleHide(product._id, status === 'hidden' ? 'active' : 'hidden');
    });
    actionWrap.append(editBtn, toggleBtn);

    const body = createElementSafe('div', {
      className: 'product-body seller-product-body',
      children: [
        topRow,
        createElementSafe('div', { className: 'product-name seller-product-name', text: product.title || '' }),
        createElementSafe('div', { className: 'seller-product-category', text: product.category || 'Uncategorized' }),
        metrics,
        createElementSafe('div', {
          className: 'seller-product-footer',
          children: [createRatingDisplay(product), actionWrap]
        })
      ]
    });

    card.append(imageWrap, body);
    card.addEventListener('click', () => { window.location.href = `/products/${product._id}`; });
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        window.location.href = `/products/${product._id}`;
      }
    });
    return card;
  }

  function applyLocalView() {
    const grid = document.getElementById('my-products-grid');
    if (!grid) return;

    let products = [...loadedProducts];
    if (currentSearch) {
      const q = currentSearch.toLowerCase();
      products = products.filter((product) => `${product.title || ''} ${product.category || ''}`.toLowerCase().includes(q));
    }

    products.sort((a, b) => {
      if (currentSort === 'price-desc') return (b.price || 0) - (a.price || 0);
      if (currentSort === 'price-asc') return (a.price || 0) - (b.price || 0);
      if (currentSort === 'views-desc') return (b.views || 0) - (a.views || 0);
      if (currentSort === 'interest-desc') return (b.interested || 0) - (a.interested || 0);
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    if (!products.length) {
      setInventoryEmpty(
        grid,
        currentSearch ? 'No matching products' : 'No products in this view',
        currentSearch
          ? 'Try another keyword or switch filters to broaden your inventory search.'
          : 'Add a new product or change the current filter to view more listings.'
      );
      return;
    }

    grid.replaceChildren(...products.map(createProductCard));
    if (window.lucide?.createIcons) window.lucide.createIcons();
  }

  async function loadProducts(page = 1) {
    const grid = document.getElementById('my-products-grid');
    if (!grid) return;
    setGridMessage(grid, 'Loading your products...');

    try {
      const params = new URLSearchParams({ page, limit: 12 });
      if (currentFilter) params.append('status', currentFilter);
      const res = await fetch(`/api/products/my?${params}`, { credentials: 'include' });
      const json = await res.json();

      if (!json.success) {
        setGridMessage(grid, 'Failed to load products.');
        return;
      }

      loadedProducts = json.data || [];
      if (!loadedProducts.length) {
        setInventoryEmpty(grid, 'No inventory yet', 'Start by posting your first product, or switch filters if you expected listings here.');
      } else {
        applyLocalView();
      }

      if (typeof renderPagination === 'function') {
        renderPagination('.tbl-wrap .pagination', json.pagination, 'loadProducts');
      }

      const countEl = document.querySelector('.tbl-count');
      if (countEl) countEl.textContent = `${json.pagination?.total || loadedProducts.length} products total`;
    } catch (err) {
      setGridMessage(grid, 'Failed to load products.');
      window.AppUtils?.reportClientError('Failed to fetch my products:', err);
    }
  }

  window.loadProducts = loadProducts;

  window.toggleHide = async function toggleHide(productId, newStatus) {
    try {
      const res = await fetch('/api/products/' + encodeURIComponent(productId) + '/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus })
      });
      const j = await res.json();
      if (j.success) {
        showToast(newStatus === 'hidden' ? 'Product hidden' : 'Product visible again', 'ok');
        loadProducts();
      } else {
        showToast(j.message || 'Failed', 'err');
      }
    } catch (e) {
      showToast('Failed', 'err');
    }
  };

  document.addEventListener('click', (event) => {
    const hrefTarget = event.target.closest('[data-href]');
    if (hrefTarget) window.location.href = hrefTarget.dataset.href;
  });

  document.querySelectorAll('.filter-pills .f-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.filter-pills .f-pill').forEach((p) => p.classList.remove('on'));
      pill.classList.add('on');
      const txt = pill.textContent.trim().toLowerCase();
      currentFilter = txt === 'all' ? '' : txt;
      loadProducts(1);
    });
  });

  document.getElementById('products-search')?.addEventListener('input', (event) => {
    currentSearch = event.target.value.trim();
    applyLocalView();
  });

  document.getElementById('products-sort')?.addEventListener('change', (event) => {
    currentSort = event.target.value;
    applyLocalView();
  });

  document.addEventListener('DOMContentLoaded', () => loadProducts(1));
})();
