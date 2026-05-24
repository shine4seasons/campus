(function () {
  const { createElement, escapeHtml, formatVND } = window.AppUtils || {};
  const DEFAULT_SEARCH_CATEGORY_OPTIONS = [
    { slug: '', name: 'All categories', lucideIcon: 'layout-grid' },
    ...CATEGORIES
  ];
  let SEARCH_CATEGORY_OPTIONS = [...DEFAULT_SEARCH_CATEGORY_OPTIONS];

  const CAT_COLORS = {
    books: { bg: '#FEF3C7', icon: '#92400E' },
    electronics: { bg: '#DBEAFE', icon: '#1E40AF' },
    clothing: { bg: '#FCE7F3', icon: '#9D174D' },
    furniture: { bg: '#D1FAE5', icon: '#065F46' },
    'daily-needs': { bg: '#FED7AA', icon: '#9A3412' },
    sports: { bg: '#E0E7FF', icon: '#3730A3' },
    gaming: { bg: '#F3E8FF', icon: '#6B21A8' },
    other: { bg: '#E5E7EB', icon: '#374151' }
  };

  const indexPageConfig = window.INDEX_PAGE_CONFIG || {};
  const IS_AUTH = !!indexPageConfig.isAuth;
  const PER_PAGE = 12;

  const state = {
    page: 1,
    limit: PER_PAGE,
    category: '',
    sort: 'newest',
    loading: false
  };
  const paginationState = {
    total: 0,
    page: 1,
    limit: PER_PAGE,
    totalPages: 0
  };
  const categoryCounts = new Map();

  const searchInput = document.getElementById('search-input');
  const searchDropdown = document.getElementById('search-dropdown');
  const searchWrap = document.getElementById('search-wrap');
  const searchCatSelect = document.getElementById('search-cat');
  const searchCatCombobox = document.getElementById('search-cat-combobox');
  const searchCatBtn = document.getElementById('search-cat-btn');
  const searchCatMenu = document.getElementById('search-cat-menu');
  const searchCatLabel = document.getElementById('search-cat-label');
  const searchCatIcon = document.getElementById('search-cat-icon');
  const catGrid = document.getElementById('cat-grid');
  const featuredSection = document.getElementById('featured');
  const toastContainer = document.getElementById('toast-container');
  const catalogState = document.getElementById('catalog-state');

  let suggestActiveIdx = -1;
  let suggestList = [];
  let suggestTimer;

  window.ALL_PRODUCTS = [];
  window.currentFilteredProducts = [];

  if (!searchInput || !searchDropdown || !searchWrap || !searchCatSelect || !searchCatCombobox || !searchCatBtn || !searchCatMenu || !searchCatLabel || !searchCatIcon || !catGrid || !featuredSection || !toastContainer) {
    return;
  }

  function decodeHtmlEntities(value) {
    return String(value || '');
  }

  function humanizeCategorySlug(slug) {
    return String(slug || '')
      .split('-')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  function iconNode(iconName, size) {
    return createElement('i', {
      attrs: { 'data-lucide': iconName || 'tag' },
      style: size ? { width: `${size}px`, height: `${size}px` } : {}
    });
  }

  function refreshIcons(nodes) {
    if (typeof lucide !== 'undefined') {
      lucide.createIcons(nodes ? { nodes } : undefined);
    }
  }

  function setChildren(parent, children) {
    parent.replaceChildren(...children.filter(Boolean));
  }

  function getSortParam(sortValue) {
    if (sortValue === 'price-asc') return 'price';
    if (sortValue === 'price-desc') return '-price';
    if (sortValue === 'rating') return '-ratingAverage';
    return '-createdAt';
  }

  function getCategoryMeta(slug) {
    return SEARCH_CATEGORY_OPTIONS.find((category) => category.slug === slug)
      || DEFAULT_SEARCH_CATEGORY_OPTIONS.find((category) => category.slug === slug)
      || { slug, name: humanizeCategorySlug(slug), lucideIcon: 'tag' };
  }

  function mapProduct(product) {
    const categoryMeta = getCategoryMeta(product.category);
    return {
      id: product._id,
      title: product.title,
      category: product.category,
      categoryName: categoryMeta.name,
      categoryIcon: categoryMeta.lucideIcon || 'tag',
      price: product.price,
      condition: product.condition,
      image: (product.images && product.images[0]) || null,
      seller: (product.seller && (product.seller.nickname || product.seller.name)) || 'Unknown',
      sellerAvatar: (product.seller && product.seller.avatar) || '',
      desc: product.description || '',
      ratingAverage: product.ratingAverage || 0,
      ratingCount: product.ratingCount || 0,
      quantity: typeof product.quantity === 'number' ? product.quantity : 1
    };
  }

  function createCategoryCard(category) {
    const color = CAT_COLORS[category.slug] || CAT_COLORS.other;
    return createElement('div', {
      className: 'cat-card',
      dataset: { cat: category.slug },
      children: [
        createElement('div', {
          className: 'cat-icon-wrap',
          style: { background: color.bg, color: color.icon },
          children: [iconNode(category.lucideIcon || 'tag', 22)]
        }),
        createElement('div', { className: 'cat-name', text: decodeHtmlEntities(category.name) }),
        createElement('div', { className: 'cat-count', text: 'Loading...' })
      ]
    });
  }

  function renderCategoryGrid() {
    setChildren(catGrid, CATEGORIES.map(createCategoryCard));
    refreshIcons([catGrid]);
  }

  function buildSearchCategoryOptions(products = []) {
    const knownMap = new Map(DEFAULT_SEARCH_CATEGORY_OPTIONS.map((category) => [category.slug, { ...category }]));
    const localCounts = new Map();

    products.forEach((product) => {
      const slug = String(product.category || '').trim();
      if (!slug) return;
      localCounts.set(slug, (localCounts.get(slug) || 0) + 1);
      if (!knownMap.has(slug)) {
        knownMap.set(slug, {
          slug,
          name: humanizeCategorySlug(slug),
          lucideIcon: 'tag'
        });
      }
    });

    const baseOptions = DEFAULT_SEARCH_CATEGORY_OPTIONS.map((category) => ({
      ...category,
      name: decodeHtmlEntities(category.name),
      count: category.slug
        ? (categoryCounts.has(category.slug) ? categoryCounts.get(category.slug) : (localCounts.get(category.slug) || 0))
        : (categoryCounts.has('') ? categoryCounts.get('') : products.length)
    }));

    const extraOptions = Array.from(knownMap.values())
      .filter((category) => category.slug && !DEFAULT_SEARCH_CATEGORY_OPTIONS.some((defaultCategory) => defaultCategory.slug === category.slug))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((category) => ({
        ...category,
        name: decodeHtmlEntities(category.name),
        count: categoryCounts.has(category.slug) ? categoryCounts.get(category.slug) : (localCounts.get(category.slug) || 0)
      }));

    SEARCH_CATEGORY_OPTIONS = [...baseOptions, ...extraOptions];

    if (!SEARCH_CATEGORY_OPTIONS.some((category) => category.slug === searchCatSelect.value)) {
      searchCatSelect.value = '';
    }

    setChildren(searchCatSelect, SEARCH_CATEGORY_OPTIONS.map((category) => createElement('option', {
      attrs: { value: category.slug },
      text: category.name
    })));
  }

  function getCategoryDisplayName(slug) {
    const found = SEARCH_CATEGORY_OPTIONS.find((category) => category.slug === slug);
    return found ? found.name : humanizeCategorySlug(slug);
  }

  function updateCategoryCounts() {
    document.querySelectorAll('.cat-card').forEach((card) => {
      const slug = card.dataset.cat;
      const count = categoryCounts.has(slug)
        ? categoryCounts.get(slug)
        : window.ALL_PRODUCTS.filter((product) => product.category === slug).length;
      const element = card.querySelector('.cat-count');
      if (element) {
        element.textContent = count > 0 ? count + (count === 1 ? ' item' : ' items') : 'None yet';
      }
    });
  }

  async function fetchCategoryCounts() {
    try {
      const requests = [
        fetch('/api/products?limit=1', { credentials: 'include' }).then((response) => response.json()),
        ...CATEGORIES.map((category) =>
          fetch('/api/products?limit=1&category=' + encodeURIComponent(category.slug), { credentials: 'include' })
            .then((response) => response.json())
            .then((json) => ({ slug: category.slug, total: json.pagination ? json.pagination.total : 0 }))
        )
      ];
      const [allProductsJson, ...categoryResults] = await Promise.all(requests);
      categoryCounts.set('', allProductsJson.pagination ? allProductsJson.pagination.total : 0);
      categoryResults.forEach((result) => {
        categoryCounts.set(result.slug, result.total || 0);
      });
      buildSearchCategoryOptions(window.ALL_PRODUCTS);
      renderSearchCategoryMenu();
      updateCategoryCounts();
    } catch (error) {
      console.error('Error loading category counts:', error);
      updateCategoryCounts();
    }
  }

  function createCatalogStateNode(mode) {
    if (mode === 'loading') {
      return [createElement('div', { text: 'Loading products...' })];
    }
    if (mode === 'empty') {
      return [createElement('div', { text: 'No products available right now.' })];
    }
    if (mode === 'error') {
      return [
        createElement('div', { text: 'Could not load products.' }),
        createElement('button', {
          attrs: { id: 'catalog-retry-btn' },
          style: {
            marginTop: '10px',
            padding: '8px 14px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            background: '#fff',
            cursor: 'pointer'
          },
          text: 'Retry'
        })
      ];
    }
    return [];
  }

  function showCatalogState(mode) {
    if (!catalogState) return;
    if (mode === 'ready') {
      catalogState.style.display = 'none';
      catalogState.replaceChildren();
      return;
    }

    catalogState.style.display = 'block';
    setChildren(catalogState, createCatalogStateNode(mode));
    const retryBtn = document.getElementById('catalog-retry-btn');
    if (retryBtn) retryBtn.addEventListener('click', () => fetchProducts());
  }

  function createSearchCategoryOption(category) {
    const selected = category.slug === searchCatSelect.value;
    return createElement('button', {
      attrs: {
        type: 'button',
        role: 'option',
        'aria-selected': selected ? 'true' : 'false'
      },
      className: `search-cat-option${selected ? ' selected' : ''}`,
      dataset: { value: category.slug },
      children: [
        createElement('span', {
          className: 'search-cat-option-icon',
          children: [iconNode(category.lucideIcon || 'tag')]
        }),
        createElement('span', {
          className: 'search-cat-option-text',
          children: [
            createElement('span', { className: 'search-cat-option-name', text: category.name }),
            createElement('span', {
              className: 'search-cat-option-meta',
              text: `${typeof category.count === 'number' ? category.count : 0} ${category.slug ? 'products' : 'total'}`
            })
          ]
        }),
        createElement('i', { attrs: { 'data-lucide': 'check' }, className: 'search-cat-check' })
      ]
    });
  }

  function renderSearchCategoryMenu() {
    setChildren(searchCatMenu, SEARCH_CATEGORY_OPTIONS.map(createSearchCategoryOption));
    refreshIcons([searchCatMenu, searchCatIcon]);
  }

  function setSearchCategory(value) {
    const category = SEARCH_CATEGORY_OPTIONS.find((option) => option.slug === value) || SEARCH_CATEGORY_OPTIONS[0];
    searchCatSelect.value = category.slug;
    searchCatLabel.textContent = category.name;
    setChildren(searchCatIcon, [iconNode(category.lucideIcon || 'tag')]);
    renderSearchCategoryMenu();
    refreshIcons([searchCatIcon]);
    searchCatSelect.dispatchEvent(new Event('change'));
  }

  function closeSearchCategoryMenu() {
    searchCatCombobox.classList.remove('open');
    searchCatBtn.setAttribute('aria-expanded', 'false');
  }

  function openSearchCategoryMenu() {
    searchCatCombobox.classList.add('open');
    searchCatBtn.setAttribute('aria-expanded', 'true');
  }

  function createSuggestionItem(product, index) {
    return createElement('div', {
      className: 'search-suggest',
      dataset: { idx: index, id: product.id },
      children: [
        createElement('div', {
          className: 'sg-thumb',
          children: [
            product.image
              ? createElement('img', { attrs: { src: product.image, alt: '' } })
              : createElement('div', { className: 'sg-thumb-placeholder', children: [iconNode(product.categoryIcon || 'package', 18)] })
          ]
        }),
        createElement('div', {
          className: 'sg-info',
          children: [
            createElement('div', { className: 'sg-title', text: product.title }),
            createElement('div', { className: 'sg-meta', text: `${getCategoryDisplayName(product.category)} - ${formatVND(product.price)}` })
          ]
        }),
        iconNode('chevron-right', 14)
      ]
    });
  }

  function renderSuggestions(items) {
    suggestList = items;
    suggestActiveIdx = -1;
    if (!items.length) {
      setChildren(searchDropdown, [createElement('div', { className: 'search-empty', text: 'No matching items - press Enter to search anyway' })]);
      searchDropdown.classList.add('show');
      return;
    }

    setChildren(searchDropdown, [
      ...items.map(createSuggestionItem),
      createElement('div', {
        className: 'search-footer',
        dataset: { action: 'search-all' },
        children: [
          iconNode('search', 14),
          document.createTextNode(' See all results for "'),
          createElement('strong', { text: searchInput.value }),
          document.createTextNode('"')
        ]
      })
    ]);
    refreshIcons([searchDropdown]);
    searchDropdown.classList.add('show');
  }

  function updateSuggestions() {
    const query = searchInput.value.trim().toLowerCase();
    const category = searchCatSelect.value;
    if (!query) {
      hideSuggestions();
      return;
    }

    let pool = window.ALL_PRODUCTS || [];
    if (category) {
      pool = pool.filter((product) => product.category === category);
    }

    const scored = [];
    pool.forEach((product) => {
      const title = (product.title || '').toLowerCase();
      const desc = (product.desc || '').toLowerCase();
      if (title.startsWith(query)) scored.push([product, 3]);
      else if (title.includes(query)) scored.push([product, 2]);
      else if (desc.includes(query)) scored.push([product, 1]);
    });

    scored.sort((a, b) => b[1] - a[1]);
    renderSuggestions(scored.slice(0, 6).map((entry) => entry[0]));
  }

  function hideSuggestions() {
    searchDropdown.classList.remove('show');
    suggestList = [];
    suggestActiveIdx = -1;
  }

  function highlightSuggestion(index) {
    const items = searchDropdown.querySelectorAll('.search-suggest');
    items.forEach((element, itemIndex) => element.classList.toggle('active', itemIndex === index));
    if (items[index]) {
      items[index].scrollIntoView({ block: 'nearest' });
    }
  }

  function createConditionPill(condition) {
    const labels = { new: 'New', 'like-new': 'Like new', good: 'Good', fair: 'Fair' };
    return createElement('span', {
      className: `product-condition condition-${condition}`,
      text: labels[condition] || condition
    });
  }

  function createProductCard(product) {
    const sellerAvatar = product.sellerAvatar
      ? createElement('img', { className: 'seller-avatar', attrs: { src: product.sellerAvatar, alt: product.seller } })
      : createElement('div', {
          className: 'seller-avatar',
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--primary-light)',
            color: 'var(--primary)',
            fontSize: '10px',
            fontWeight: '800'
          },
          text: escapeHtml(product.seller[0].toUpperCase())
        });

    const ratingNode = product.ratingCount > 0
      ? createElement('span', { className: 'product-rating-row', text: `★ ${product.ratingAverage.toFixed(1)} (${product.ratingCount})` })
      : createElement('span', { className: 'product-rating-row', style: { color: 'var(--primary)', fontWeight: '600' }, text: 'New product' });

    return createElement('div', {
      className: 'product-card',
      dataset: { productId: product.id },
      children: [
        createElement('div', {
          className: 'product-img-placeholder',
          children: [
            product.image
              ? createElement('img', { attrs: { src: product.image, alt: product.title } })
              : createElement('div', {
                  style: { opacity: '0.3' },
                  children: [iconNode(product.categoryIcon || 'package', 48)]
                }),
            createElement('div', { className: 'product-cta', text: 'View details →' })
          ]
        }),
        createElement('div', {
          className: 'product-body',
          children: [
            createElement('div', { className: 'product-price', text: formatVND(product.price) }),
            createElement('div', { className: 'product-name', text: product.title }),
            createElement('div', {
              className: 'product-meta-stack',
              children: [
                createElement('div', {
                  className: 'product-meta-row',
                  children: [
                    createElement('span', { className: 'product-category', text: product.categoryName }),
                    createElement('span', { className: 'product-meta-dot', text: '•' }),
                    ratingNode
                  ]
                }),
                createConditionPill(product.condition),
                createElement('div', {
                  className: 'product-stock',
                  text: `${typeof product.quantity === 'number' ? product.quantity : 1} available`
                })
              ]
            }),
            createElement('div', {
              className: 'product-footer',
              children: [
                createElement('div', {
                  className: 'product-seller',
                  children: [
                    sellerAvatar,
                    createElement('span', { className: 'seller-name', text: product.seller })
                  ]
                })
              ]
            })
          ]
        })
      ]
    });
  }

  function renderProducts(products) {
    const grid = document.getElementById('products-grid');
    if (!grid) return;

    if (!products.length) {
      setChildren(grid, [
        createElement('div', {
          style: { gridColumn: '1/-1', textAlign: 'center', padding: '60px', color: 'var(--text-3)' },
          children: [
            createElement('div', {
              style: { display: 'flex', justifyContent: 'center', marginBottom: '16px', opacity: '0.4' },
              children: [iconNode('search', 48)]
            }),
            createElement('p', { style: { fontSize: '16px', fontWeight: '600' }, text: 'No products found' }),
            createElement('p', { text: 'Try a different keyword or browse another category.' })
          ]
        })
      ]);
      refreshIcons([grid]);
      return;
    }

    setChildren(grid, products.map(createProductCard));
    refreshIcons([grid]);

    const loadMoreWrap = document.querySelector('.load-more-wrap');
    if (loadMoreWrap) {
      loadMoreWrap.style.display = paginationState.page < paginationState.totalPages ? 'flex' : 'none';
    }
  }

  async function fetchProducts(options = {}) {
    const append = !!options.append;
    if (state.loading) return;
    state.loading = true;
    try {
      const params = new URLSearchParams({
        page: String(state.page),
        limit: String(state.limit),
        sort: getSortParam(state.sort)
      });
      if (state.category) {
        params.set('category', state.category);
      }

      const response = await fetch('/api/products?' + params.toString(), { credentials: 'include' });
      const json = await response.json();
      const products = (json.data || []).map(mapProduct);

      paginationState.total = json.pagination ? json.pagination.total : products.length;
      paginationState.page = json.pagination ? json.pagination.page : state.page;
      paginationState.limit = json.pagination ? json.pagination.limit : state.limit;
      paginationState.totalPages = json.pagination ? json.pagination.totalPages : 1;

      window.ALL_PRODUCTS = append ? window.ALL_PRODUCTS.concat(products) : products;
      window.currentFilteredProducts = window.ALL_PRODUCTS;
      buildSearchCategoryOptions(window.ALL_PRODUCTS);
      showCatalogState(products.length ? 'ready' : 'empty');
      renderProducts(window.ALL_PRODUCTS);
      updateCategoryCounts();
      renderSearchCategoryMenu();
      setSearchCategory(searchCatSelect.value || '');
    } catch (error) {
      console.error('Error loading products:', error);
      buildSearchCategoryOptions([]);
      renderSearchCategoryMenu();
      setSearchCategory(searchCatSelect.value || '');
      showCatalogState('error');
      renderProducts([]);
    } finally {
      state.loading = false;
    }
  }

  window.handleSearch = function handleSearch() {
    const query = searchInput.value.trim();
    const category = searchCatSelect.value;
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (category) params.set('category', category);
    window.location.href = '/search' + (params.toString() ? `?${params.toString()}` : '');
  };

  window.setFilter = function setFilter(button, filter) {
    document.querySelectorAll('.filter-btn').forEach((element) => element.classList.remove('active'));
    button.classList.add('active');
    state.category = filter === 'all' ? '' : filter;
    state.page = 1;
    fetchProducts();
  };

  window.filterByCategory = function filterByCategory(slug) {
    featuredSection.scrollIntoView({ behavior: 'smooth' });
    const button = document.querySelector('[data-filter="' + slug + '"]');
    if (button) {
      window.setFilter(button, slug);
      return;
    }
    state.category = slug;
    state.page = 1;
    fetchProducts();
  };

  window.loadMore = function loadMore() {
    if (state.loading || paginationState.page >= paginationState.totalPages) return;
    state.page += 1;
    fetchProducts({ append: true });
  };

  window.applySort = function applySort() {
    state.sort = document.getElementById('sort-select').value;
    state.page = 1;
    fetchProducts();
  };

  window.openProduct = function openProduct(id) {
    if (!IS_AUTH) {
      const element = document.createElement('div');
      element.className = 'toast error';
      element.textContent = 'Please sign in to view product details';
      toastContainer.appendChild(element);
      setTimeout(() => {
        window.location.href = '/login';
      }, 1200);
      return;
    }
    window.location.href = '/products/' + id;
  };

  renderCategoryGrid();
  buildSearchCategoryOptions([]);
  showCatalogState('loading');
  fetchProducts();
  fetchCategoryCounts();

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.fade-up').forEach((element) => observer.observe(element));

  renderSearchCategoryMenu();

  searchCatBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    if (searchCatCombobox.classList.contains('open')) closeSearchCategoryMenu();
    else openSearchCategoryMenu();
  });

  searchCatBtn.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openSearchCategoryMenu();
      const firstOption = searchCatMenu.querySelector('.search-cat-option');
      if (firstOption) firstOption.focus();
    } else if (event.key === 'Escape') {
      closeSearchCategoryMenu();
    }
  });

  searchCatMenu.addEventListener('click', (event) => {
    const option = event.target.closest('.search-cat-option');
    if (!option) return;
    setSearchCategory(option.dataset.value || '');
    closeSearchCategoryMenu();
    searchInput.focus();
  });

  searchCatMenu.addEventListener('keydown', (event) => {
    const options = Array.from(searchCatMenu.querySelectorAll('.search-cat-option'));
    if (!options.length) return;
    const currentIndex = options.indexOf(document.activeElement);

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const nextIndex = currentIndex < 0 ? 0 : Math.min(currentIndex + 1, options.length - 1);
      options[nextIndex].focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const prevIndex = currentIndex <= 0 ? 0 : currentIndex - 1;
      options[prevIndex].focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeSearchCategoryMenu();
      searchCatBtn.focus();
    }
  });

  searchInput.addEventListener('input', () => {
    clearTimeout(suggestTimer);
    suggestTimer = setTimeout(updateSuggestions, 120);
  });

  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim()) updateSuggestions();
  });

  searchInput.addEventListener('keydown', (event) => {
    const isOpen = searchDropdown.classList.contains('show');
    if (event.key === 'Enter') {
      if (isOpen && suggestActiveIdx >= 0 && suggestList[suggestActiveIdx]) {
        event.preventDefault();
        window.openProduct(suggestList[suggestActiveIdx].id);
        return;
      }
      window.handleSearch();
      hideSuggestions();
    } else if (event.key === 'ArrowDown' && isOpen) {
      event.preventDefault();
      suggestActiveIdx = Math.min(suggestActiveIdx + 1, suggestList.length - 1);
      highlightSuggestion(suggestActiveIdx);
    } else if (event.key === 'ArrowUp' && isOpen) {
      event.preventDefault();
      suggestActiveIdx = Math.max(suggestActiveIdx - 1, -1);
      highlightSuggestion(suggestActiveIdx);
    } else if (event.key === 'Escape') {
      hideSuggestions();
    }
  });

  searchDropdown.addEventListener('click', (event) => {
    const suggestion = event.target.closest('.search-suggest');
    if (suggestion) {
      window.openProduct(suggestion.dataset.id);
      hideSuggestions();
      return;
    }
    if (event.target.closest('[data-action="search-all"]')) {
      window.handleSearch();
      hideSuggestions();
    }
  });

  document.addEventListener('click', (event) => {
    const categoryCard = event.target.closest('.cat-card[data-cat]');
    if (categoryCard) {
      window.filterByCategory(categoryCard.dataset.cat || '');
      return;
    }

    const productCard = event.target.closest('.product-card[data-product-id]');
    if (productCard) {
      window.openProduct(productCard.dataset.productId);
      return;
    }

    const searchSubmitBtn = event.target.closest('[data-action="search-submit"]');
    if (searchSubmitBtn) {
      window.handleSearch();
      return;
    }

    const filterBtn = event.target.closest('.filter-btn[data-filter]');
    if (filterBtn) {
      window.setFilter(filterBtn, filterBtn.dataset.filter || 'all');
      return;
    }

    const loadMoreBtn = event.target.closest('[data-action="load-more"]');
    if (loadMoreBtn) {
      window.loadMore();
      return;
    }

    if (event.target.closest('[data-action="footer-sign-out"]')) {
      window.footerSignOut();
      return;
    }

    if (!searchCatCombobox.contains(event.target)) closeSearchCategoryMenu();
    if (!searchWrap.contains(event.target)) hideSuggestions();
  });

  searchCatSelect.addEventListener('change', () => {
    if (searchInput.value.trim()) updateSuggestions();
  });

  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => window.applySort());
  }

  refreshIcons();
})();
