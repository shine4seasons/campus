(() => {
  const { createElement, appendChildren, createSvgElement, formatVND } = window.AppUtils || {};

  let currentPage = 1;
  let totalCount = 0;

  function createHeartIcon() {
    return createSvgElement('svg', {
      viewBox: '0 0 24 24',
      fill: 'currentColor',
      stroke: 'currentColor',
      'stroke-width': '2'
    });
  }

  function populateHeartIcon(svg) {
    svg.appendChild(createSvgElement('path', {
      d: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z'
    }));
    return svg;
  }

  function createSearchIcon() {
    return createSvgElement(
      'svg',
      { width: '16', height: '16', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' },
      [
        createSvgElement('circle', { cx: '11', cy: '11', r: '8' }),
        createSvgElement('line', { x1: '21', y1: '21', x2: '16.65', y2: '16.65' })
      ]
    );
  }

  function clearNode(node) {
    if (node) {
      node.replaceChildren();
    }
  }

  function setGridState(grid, content) {
    clearNode(grid);
    if (content) {
      grid.appendChild(content);
    }
  }

  function createStatusPill(status) {
    if (status !== 'sold' && status !== 'hidden') return null;
    return createElement('span', {
      className: `fav-status-pill ${status}`,
      text: status
    });
  }

  function createFavoriteCard(product) {
    const seller = product.seller || {};
    const sellerName = seller.nickname || seller.name || 'Unknown';
    const sellerInitial = sellerName.charAt(0).toUpperCase();
    const card = createElement('div', {
      className: `fav-card ${product.status === 'sold' ? 'sold' : ''}`.trim(),
      dataset: { id: product._id }
    });

    const imageWrap = createElement('div', { className: 'fav-card-img-wrap' });
    imageWrap.addEventListener('click', () => {
      window.location.href = `/products/${product._id}`;
    });

    const statusPill = createStatusPill(product.status);
    if (statusPill) {
      imageWrap.appendChild(statusPill);
    }

    const removeBtn = createElement('button', {
      className: 'fav-remove-btn',
      attrs: { type: 'button', title: 'Remove from favorites' }
    });
    removeBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      window.removeFavorite(product._id);
    });
    removeBtn.appendChild(populateHeartIcon(createHeartIcon()));
    imageWrap.appendChild(removeBtn);

    const img = Array.isArray(product.images) ? product.images[0] : '';
    if (img) {
      imageWrap.appendChild(createElement('img', {
        className: 'fav-card-img',
        attrs: { src: img, alt: product.title || 'Favorite product' }
      }));
    } else {
      imageWrap.appendChild(createElement('div', {
        className: 'fav-card-img-empty',
        text: 'Package'
      }));
    }

    const body = createElement('div', { className: 'fav-card-body' });
    body.addEventListener('click', () => {
      window.location.href = `/products/${product._id}`;
    });

    const sellerAvatar = createElement('div', { className: 'fav-seller-avatar' });
    if (seller.avatar) {
      sellerAvatar.appendChild(createElement('img', {
        attrs: { src: seller.avatar, alt: sellerName }
      }));
    } else {
      sellerAvatar.textContent = sellerInitial;
    }

    appendChildren(body, [
      createElement('div', { className: 'fav-cat', text: product.category || '' }),
      createElement('div', { className: 'fav-name', text: product.title || 'Untitled' }),
      createElement('div', { className: 'fav-price', text: formatVND(product.price) }),
      createElement('div', {
        className: 'fav-seller',
        children: [
          sellerAvatar,
          createElement('span', { text: sellerName })
        ]
      })
    ]);

    card.append(imageWrap, body);
    return card;
  }

  function createEmptyState(title, subtitle, withBrowseButton) {
    const empty = createElement('div', { className: 'fav-empty' });
    const icon = populateHeartIcon(createHeartIcon());
    icon.classList.add('fav-empty-icon');
    empty.appendChild(icon);
    empty.appendChild(createElement('div', { className: 'fav-empty-title', text: title }));
    empty.appendChild(createElement('div', { className: 'fav-empty-sub', text: subtitle }));

    if (withBrowseButton) {
      const link = createElement('a', {
        className: 'btn-browse',
        attrs: { href: '/' }
      });
      link.append(createSearchIcon(), document.createTextNode('Browse products'));
      empty.appendChild(link);
    }

    return empty;
  }

  function renderFavorites(grid, items, append) {
    if (!append) {
      clearNode(grid);
    }
    items.forEach((item) => {
      grid.appendChild(createFavoriteCard(item));
    });
  }

  async function fetchFavorites(append) {
    const grid = document.getElementById('fav-grid');
    try {
      const res = await fetch('/api/products/favorites?page=' + currentPage + '&limit=12', { credentials: 'include' });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Failed');
      const items = json.data || [];
      const pagination = json.pagination || {};

      totalCount = pagination.total || 0;
      const badge = document.getElementById('fav-count');
      if (totalCount > 0) {
        badge.textContent = totalCount;
        badge.style.display = 'inline-flex';
      } else {
        badge.style.display = 'none';
      }

      if (!append) {
        if (items.length === 0) {
          setGridState(grid, createEmptyState('No favorites yet', 'Tap the heart on any product to save it here.', true));
        } else {
          renderFavorites(grid, items, false);
        }
      } else {
        renderFavorites(grid, items, true);
      }

      document.getElementById('fav-load-more').style.display = pagination.hasMore ? 'flex' : 'none';
    } catch (err) {
      window.AppUtils?.reportClientError('[favorites] error:', err);
      if (!append) {
        setGridState(grid, createEmptyState('Failed to load', err.message || 'Unknown error', false));
      }
    }
  }

  window.removeFavorite = async function removeFavorite(productId) {
    const card = document.querySelector(`.fav-card[data-id="${productId}"]`);
    if (card) card.style.opacity = '0.4';

    try {
      const res = await fetch('/api/products/' + productId + '/interested', {
        method: 'POST',
        credentials: 'include'
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      if (!json.isFavorited && card) {
        card.style.transition = 'opacity 0.2s ease';
        card.style.opacity = '0';
        setTimeout(() => {
          card.remove();
          totalCount = Math.max(0, totalCount - 1);
          const badge = document.getElementById('fav-count');
          if (totalCount === 0) {
            setGridState(
              document.getElementById('fav-grid'),
              createEmptyState('No favorites yet', 'Tap the heart on any product to save it here.', true)
            );
            badge.style.display = 'none';
          } else {
            badge.textContent = totalCount;
          }
        }, 200);
      } else if (card) {
        card.style.opacity = '';
      }
    } catch (err) {
      if (card) card.style.opacity = '';
      window.AppUtils?.reportClientError('[favorites] remove error:', err);
    }
  };

  window.loadMore = function loadMore() {
    currentPage += 1;
    fetchFavorites(true);
  };

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-action="load-more-favorites"]')) {
      window.loadMore();
    }
  });

  fetchFavorites();
})();
