(function() {
    const searchInput = document.getElementById('topbar-search-input');
    const searchResults = document.getElementById('search-results');
    if (!searchInput || !searchResults) return;

    let selectedIndex = -1;
    let filteredItems = [];

    // Define searchable items
    // Icons are SVGs as strings (simplified version of Lucide icons)
    const icons = {
        dash: `<svg viewBox="0 0 24 24"><path d="M3 13h8V3H3v10zM13 21h8V11h-8v10z"/></svg>`,
        chart: `<svg viewBox="0 0 24 24"><path d="M3 3v18h18M18 7v10M13 11v6M8 13v4"/></svg>`,
        users: `<svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>`,
        package: `<svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 00-1-1.73L13 3l-7 3.27A2 2 0 005 8v8a2 2 0 001 1.73L11 21l7-3.27A2 2 0 0021 16z"/></svg>`,
        orders: `<svg viewBox="0 0 24 24"><path d="M3 3h18v4H3zM3 11h18v10H3z"/></svg>`,
        report: `<svg viewBox="0 0 24 24"><path d="M12 2l3 7h7l-6 4 3 7-7-4-7 4 3-7-6-4h7z"/></svg>`,
        settings: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06A2 2 0 013.27 17.1l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82L4.21 3.27A2 2 0 016 3.27l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09c.2.74.72 1.35 1.47 1.51h.41a1.65 1.65 0 001.82-.33l.06-.06A2 2 0 0120.73 6.9l-.06.06a1.65 1.65 0 00-.33 1.82V9c.09.54.39 1.05.86 1.46z"/></svg>`,
        revenue: `<svg viewBox="0 0 24 24"><path d="M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6"/></svg>`,
        categories: `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
        star: `<svg viewBox="0 0 24 24"><path d="M12 2l2.9 5.88L21 9.24l-4.5 4.06L17.8 21 12 17.77 6.2 21l1.3-7.7L3 9.24l6.1-1.36L12 2z"/></svg>`,
        profile: `<svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`
    };

    const ALL_ITEMS = [
        // Admin items
        { title: 'Admin Dashboard', sub: 'System overview', icon: icons.dash, sectionId: 'aDash', path: '/admin', role: 'admin', keywords: 'admin dashboard overview system' },
        { title: 'Analytics', sub: 'Stats & Analytics', icon: icons.chart, sectionId: 'aAnalytics', path: '/admin/analytics', role: 'admin', keywords: 'stats reports analytics admin statistics' },
        { title: 'Users Management', sub: 'Manage platform users', icon: icons.users, sectionId: 'aUsers', path: '/admin/users', role: 'admin', keywords: 'users members admin management' },
        { title: 'Products Management', sub: 'Manage product listings', icon: icons.package, sectionId: 'aProducts', path: '/admin/products', role: 'admin', keywords: 'products items admin management' },
        { title: 'Orders Management', sub: 'Manage transactions', icon: icons.orders, sectionId: 'aOrders', path: '/admin/orders', role: 'admin', keywords: 'orders transactions admin management' },
        { title: 'Reports', sub: 'Violation reports', icon: icons.report, sectionId: 'aReports', path: '/admin/reports', role: 'admin', keywords: 'reports violations admin management' },
        { title: 'System Settings', sub: 'Platform configuration', icon: icons.settings, sectionId: 'aSettings', path: '/admin/settings', role: 'admin', keywords: 'settings config admin' },

        // Seller items
        { title: 'Seller Dashboard', sub: 'Store overview', icon: icons.dash, sectionId: 'sDash', path: '/dashboard', role: 'seller', keywords: 'seller dashboard store overview' },
        { title: 'My Products', sub: 'My listed products', icon: icons.package, sectionId: 'sListings', path: '/my-products', role: 'seller', keywords: 'my products seller inventory' },
        { title: 'Orders (Seller)', sub: 'Customer orders', icon: icons.orders, sectionId: 'sOrders', path: '/orders-seller', role: 'seller', keywords: 'orders customer seller management' },
        { title: 'Revenue', sub: 'Revenue & Finances', icon: icons.revenue, sectionId: 'sRevenue', path: '/revenue', role: 'seller', keywords: 'revenue finances seller' },
        { title: 'Messages (Seller)', sub: 'Customer messages', icon: icons.report, sectionId: 'sMessages', path: '/dashboard', role: 'seller', keywords: 'messages chat seller inbox' },
        { title: 'Post Product', sub: 'List a new item', icon: icons.package, path: '/sell', role: 'seller', keywords: 'sell post product list' },

        // Buyer items
        { title: 'Home', sub: 'Campus marketplace', icon: icons.dash, path: '/', keywords: 'home main campus marketplace' },
        { title: 'Categories', sub: 'Explore product categories', icon: icons.categories, path: '/#categories', role: 'buyer', keywords: 'categories explore browse' },
        { title: 'Featured Products', sub: 'Featured items', icon: icons.star, path: '/#featured', role: 'buyer', keywords: 'featured products hot items' },
        { title: 'My Orders (Buyer)', sub: 'Purchased orders', icon: icons.orders, path: '/orders', role: 'buyer', keywords: 'my orders purchase history' },
        { title: 'Sell on Campus', sub: 'List a new item', icon: icons.package, path: '/sell', role: 'buyer', keywords: 'sell post product list' },
        { title: 'Profile Settings', sub: 'Personal information', icon: icons.profile, path: '/profile', keywords: 'profile account settings info' },
        { title: 'Messages', sub: 'My messages', icon: icons.report, path: '/messages', keywords: 'messages chat inbox' }
    ];

    function getItemsByRole() {
        let currentRole = 'buyer';
        try {
            // Priority 1: Check if we are on an admin path
            if (window.location.pathname.startsWith('/admin')) {
                return ALL_ITEMS.filter(item => item.role === 'admin' || !item.role);
            }
            
            // Priority 2: Check localStorage mode
            const mode = localStorage.getItem('campus_mode') || 'buyer';
            currentRole = mode;
        } catch (e) {}

        return ALL_ITEMS.filter(item => !item.role || item.role === currentRole);
    }

    function renderResults(items) {
        if (items.length === 0) {
            searchResults.innerHTML = '<div class="search-no-results">No results found</div>';
            searchResults.classList.add('show');
            return;
        }

        searchResults.innerHTML = items.map((item, index) => `
            <div class="search-item ${index === selectedIndex ? 'selected' : ''}" data-index="${index}">
                <div class="search-item-icon">${item.icon}</div>
                <div class="search-item-info">
                    <div class="search-item-title">${item.title}</div>
                    <div class="search-item-sub">${item.sub}</div>
                </div>
            </div>
        `).join('');
        searchResults.classList.add('show');
    }

    function navigateToItem(item) {
        if (!item) return;

        // Reset search
        searchInput.value = '';
        searchResults.classList.remove('show');
        selectedIndex = -1;

        const currentPath = window.location.pathname;

        // 1. Admin navigation
        if (currentPath.startsWith('/admin') && item.role === 'admin') {
            if (typeof window.goAdmin === 'function') {
                window.goAdmin(item.path, item.sectionId);
                return;
            }
        }

        // 2. Seller navigation
        const isSellerDashboard = currentPath.startsWith('/dashboard') || 
                                currentPath.startsWith('/my-products') || 
                                currentPath.startsWith('/orders-seller') || 
                                currentPath.startsWith('/revenue');
        
        if (isSellerDashboard && item.role === 'seller') {
            // Check if it's an in-page section for the main dashboard
            if (item.path === '/dashboard' && (item.sectionId === 'sDash' || item.sectionId === 'sMessages' || item.sectionId === 'sProfile')) {
                if (currentPath === '/dashboard' && typeof window.nav === 'function') {
                    window.nav(null, item.sectionId);
                    return;
                }
            }
        }

        // Default: Full redirect
        window.location.href = item.path;
    }

    searchInput.addEventListener('input', function(e) {
        const query = e.target.value.toLowerCase().trim();
        if (!query) {
            searchResults.classList.remove('show');
            return;
        }

        const items = getItemsByRole();
        filteredItems = items.filter(item => {
            return item.title.toLowerCase().includes(query) || 
                   item.sub.toLowerCase().includes(query) || 
                   (item.keywords && item.keywords.toLowerCase().includes(query));
        });

        selectedIndex = -1;
        renderResults(filteredItems);
    });

    searchInput.addEventListener('keydown', function(e) {
        if (!searchResults.classList.contains('show')) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = (selectedIndex + 1) % filteredItems.length;
            renderResults(filteredItems);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = (selectedIndex - 1 + filteredItems.length) % filteredItems.length;
            renderResults(filteredItems);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIndex >= 0 && selectedIndex < filteredItems.length) {
                navigateToItem(filteredItems[selectedIndex]);
            } else if (filteredItems.length > 0) {
                navigateToItem(filteredItems[0]);
            }
        } else if (e.key === 'Escape') {
            searchResults.classList.remove('show');
        }
    });

    searchResults.addEventListener('click', function(e) {
        const itemEl = e.target.closest('.search-item');
        if (itemEl) {
            const index = parseInt(itemEl.dataset.index);
            navigateToItem(filteredItems[index]);
        }
    });

    // Close on click outside
    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.classList.remove('show');
        }
    });

    // Handle focus
    searchInput.addEventListener('focus', function() {
        if (searchInput.value.trim()) {
            searchResults.classList.add('show');
        }
    });

})();
