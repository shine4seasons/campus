const { ORDER_STATUS, PRODUCT_STATUS } = require('../config/appConstants');
const pageRepository = require('../repositories/pageRepository');

const { incrementViews } = require('../utils/viewCounter');
const { VIEWS, APP_NAME, TITLE_SEPARATOR, LIMITS, ERROR_MESSAGES } = require('../config/pageConstants');
const { CATEGORIES } = require('../public/js/categories');

/**
 * Get product details with related products
 */
exports.getProduct = async (req, res, next) => {
  try {
    const productId = req.params.id;

    // Validate product ID
    if (!productId || !productId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(404).render(VIEWS.NOT_FOUND, {
        title: '404 — Not Found',
        isLoginPage: false
      });
    }

    const product = await pageRepository.findPageProductById(productId);

    if (!product || product.status === PRODUCT_STATUS.HIDDEN) {
      return res.status(404).render(VIEWS.NOT_FOUND, {
        title: '404 — Not Found',
        isLoginPage: false
      });
    }

    // Increment view count asynchronously
    incrementViews(productId).catch(err => console.error('View increment error:', err));

    // Get related products
    const relatedProducts = await pageRepository.findRelatedProducts({
      category: product.category,
      excludeProductId: product._id,
      limit: LIMITS.RELATED_PRODUCTS
    });

    res.render(VIEWS.PRODUCT, {
      title: `${product.title}${TITLE_SEPARATOR}${APP_NAME}`,
      product,
      relatedProducts,
      isLoginPage: false
    });
  } catch (error) {
    console.error('Product page error:', error.message);
    return next(error);
  }
};

exports.getSearchResults = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = 12;
    const searchResult = await pageRepository.findSearchProducts({
      query: req.query,
      page,
      limit,
      currentUserId: res.locals.user && res.locals.user._id
    });
    const { products, total, sort, q, category, condition, minPrice, maxPrice } = searchResult;

    const totalPages = Math.max(Math.ceil(total / limit), 1);
    const categoryMeta = CATEGORIES.find(item => item.slug === category) || null;
    const titleBits = [];

    if (q) titleBits.push(`"${q}"`);
    if (categoryMeta) titleBits.push(categoryMeta.name.replace(/&amp;/g, '&'));

    res.render(VIEWS.SEARCH_RESULTS, {
      title: `${titleBits.length ? `Search ${titleBits.join(' · ')}` : 'Search'}${TITLE_SEPARATOR}${APP_NAME}`,
      isLoginPage: false,
      activePage: 'search',
      CATEGORIES,
      products,
      searchQuery: q,
      searchCategory: category,
      searchCondition: condition,
      minPrice: Number.isFinite(minPrice) ? minPrice : '',
      maxPrice: Number.isFinite(maxPrice) ? maxPrice : '',
      searchSort: sort,
      total,
      activeFilters: {
        hasQuery: Boolean(q),
        hasCategory: Boolean(category),
        hasCondition: Boolean(condition),
        hasMinPrice: Number.isFinite(minPrice),
        hasMaxPrice: Number.isFinite(maxPrice)
      },
      pagination: {
        page,
        limit,
        totalPages,
        hasPrev: page > 1,
        hasNext: page < totalPages
      }
    });
  } catch (error) {
    console.error('Search results page error:', error.message);
    return next(error);
  }
};

/**
 * Get user's products for my-products page
 */
exports.getMyProducts = async (req, res, next) => {
  try {
    const products = await pageRepository.findProductsBySeller(res.locals.user._id);

    res.render(VIEWS.MY_PRODUCTS, {
      title: `My products${TITLE_SEPARATOR}${APP_NAME}`,
      products,
      isLoginPage: false,
      activePage: 'products'
    });
  } catch (error) {
    console.error('My products page error:', error.message);
    return next(error);
  }
};

/**
 * Get sell page with optional edit product
 */
exports.getSellPage = async (req, res, next) => {
  const editId = req.query.id;
  let editProduct = null;

  if (editId) {
    try {
      const product = await pageRepository.findSellEditProduct(editId);
      if (product && String(product.seller) === String(res.locals.user._id)) {
        editProduct = product;
      }
    } catch (error) {
      console.error('Edit product fetch error:', error.message);
    }
  }

  const title = editProduct
    ? `Edit product${TITLE_SEPARATOR}${APP_NAME}`
    : `Post a product${TITLE_SEPARATOR}${APP_NAME}`;

  try {
    return res.render(VIEWS.SELL, {
      title,
      editProduct,
      isLoginPage: false,
      CATEGORIES,
      activePage: 'products'
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Get profile page with user's products
 */
exports.getProfile = async (req, res, next) => {
  try {
    const products = await pageRepository.findProductsBySeller(res.locals.user._id);

    res.render(VIEWS.PROFILE, {
      title: `My Profile${TITLE_SEPARATOR}${APP_NAME}`,
      products,
      isLoginPage: false,
      isOwnProfile: true,
      viewingUser: null,
      activePage: 'profile'
    });
  } catch (error) {
    console.error('Profile page error:', error.message);
    return next(error);
  }
};

/**
 * Get public user profile by user ID
 */
exports.getUserProfile = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const currentUser = res.locals.user;
    const isAdmin = currentUser && currentUser.role === 'admin';

    // Validate user ID format
    if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(404).render(VIEWS.NOT_FOUND, {
        title: '404 — Not Found',
        isLoginPage: false
      });
    }

    // If same as logged-in user, redirect to /profile (skip for admin viewing others)
    if (currentUser && String(currentUser._id) === String(userId)) {
      return res.redirect('/profile');
    }

    // Fetch the user profile
    // Admin can see email field as well
    const selectFields = isAdmin
      ? '_id name nickname avatar email university bio rating ratingCount totalSales createdAt banned role'
      : '_id name nickname avatar university bio rating ratingCount totalSales createdAt';

    const viewingUser = await pageRepository.findPublicProfileUserById(userId, isAdmin);

    if (!viewingUser) {
      return res.status(404).render(VIEWS.NOT_FOUND, {
        title: '404 — Not Found',
        isLoginPage: false
      });
    }

    // Admin can see all products (including hidden/sold), regular users only see active
    const products = await pageRepository.findPublicProfileProducts({ userId, isAdmin });

    res.render(VIEWS.PROFILE, {
      title: `${viewingUser.nickname || viewingUser.name}${TITLE_SEPARATOR}${APP_NAME}`,
      products,
      isLoginPage: false,
      isOwnProfile: false,
      isAdminView: isAdmin,
      viewingUser
    });
  } catch (error) {
    console.error('User profile page error:', error.message);
    return next(error);
  }
};

/**
 * Get dashboard based on route
 * /dashboard: Admin-only (protected by requireAdminPage middleware)
 * /dashboard-seller: For all authenticated users
 */
exports.getDashboard = async (req, res, next) => {
  const user = res.locals.user;
  if (!user) return res.redirect('/login');

  // If accessed via /dashboard (not /dashboard-seller), show admin dashboard
  // The /dashboard route has requireAdminPage middleware, so only admins reach here
  if (req.path === '/dashboard' || req.baseUrl === '/dashboard') {
    try {
      // Fetch data for admin dashboard (consistent with adminRoutes.js)
      const { stats, topSellers } = await pageRepository.getAdminDashboardSnapshot();

      return res.render(VIEWS.DASHBOARD_ADMIN, {
        title: `Admin Dashboard${TITLE_SEPARATOR}${APP_NAME}`,
        isLoginPage: false,
        CATEGORIES,
        isSuperAdmin: user.role === 'admin',
        stats,
        topSellers,
        initialSection: 'aDash'
      });
    } catch (err) {
      console.error('Admin dashboard error:', err.message);
      return next(err);
    }
  }

  // Seller dashboard logic: Fetch stats for initial render
  try {
    const sellerId = user._id;

    const { stats, wallet, recentRatings } = await pageRepository.getSellerDashboardSnapshot(sellerId);

    return res.render(VIEWS.DASHBOARD_SELLER, {
      title: `Seller Dashboard${TITLE_SEPARATOR}${APP_NAME}`,
      isLoginPage: false,
      isSeller: user.role === 'seller',
      stats,
      wallet,
      recentRatings,
      activePage: 'dashboard'
    });

  } catch (error) {
    console.error('Seller dashboard error:', error.message);
    return next(error);
  }
};

/**
 * Get seller orders with product statistics
 */
exports.getSellerOrders = async (req, res, next) => {
  try {
    const sellerId = res.locals.user._id;

    // Get orders with populated data
    const orders = await pageRepository.findSellerOrders(sellerId);

    // Get product order counts
    const productsWithCounts = await pageRepository.getProductOrderCounts(sellerId);

    res.render(VIEWS.ORDERS_SELLER, {
      title: `Orders${TITLE_SEPARATOR}${APP_NAME}`,
      orders,
      productsWithCounts,
      isLoginPage: false,
      activePage: 'seller-orders'
    });
  } catch (error) {
    console.error('Seller orders page error:', error.message);
    return next(error);
  }
};

/**
 * Get revenue page (placeholder for future implementation)
 */
exports.getRevenue = async (req, res, next) => {
  try {
    res.render(VIEWS.REVENUE, {
      title: `Revenue${TITLE_SEPARATOR}${APP_NAME}`,
      isLoginPage: false,
      activePage: 'revenue'
    });
  } catch (error) {
    console.error('Revenue page error:', error.message);
    return next(error);
  }
};

/**
 * Get buyer's orders (for /orders page)
 */
exports.getBuyerOrders = async (req, res, next) => {
  try {
    const buyerId = res.locals.user._id;

    // Get orders with populated data
    const orders = await pageRepository.findBuyerOrders(buyerId);

    // Count orders by status
    const statusCounts = {
      [ORDER_STATUS.PENDING]: 0,
      [ORDER_STATUS.CONFIRMED]: 0,
      [ORDER_STATUS.COMPLETED]: 0,
      [ORDER_STATUS.CANCELLED]: 0
    };

    orders.forEach(order => {
      statusCounts[order.status]++;
    });

    res.render(VIEWS.ORDERS_BUYER, {
      title: `My Orders${TITLE_SEPARATOR}${APP_NAME}`,
      orders,
      statusCounts,
      isLoginPage: false,
      activePage: 'orders'
    });
  } catch (error) {
    console.error('Buyer orders page error:', error.message);
    return next(error);
  }
};

/**
 * Get order tracking page with map
 */
exports.getOrderTracking = async (req, res, next) => {
  try {
    const orderId = req.params.orderId;
    const userId = res.locals.user._id;

    // Validate order ID format
    if (!orderId || !orderId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(404).render(VIEWS.NOT_FOUND, {
        title: '404 — Not Found',
        isLoginPage: false
      });
    }

    const order = await pageRepository.findOrderTrackingDetail(orderId);
    const payment = await pageRepository.findLatestPaymentForOrder(orderId);

    if (!order) {
      return res.status(404).render(VIEWS.NOT_FOUND, {
        title: '404 — Not Found',
        isLoginPage: false
      });
    }

    // Check authorization - only buyer, seller, or admin can view order details
    const isBuyer = String(order.buyer._id) === String(userId);
    const isSeller = String(order.seller._id) === String(userId);
    const isAdmin = res.locals.user.role === 'admin';

    if (!isBuyer && !isSeller && !isAdmin) {
      return res.status(403).render(VIEWS.NOT_FOUND, {
        title: 'Forbidden',
        isLoginPage: false
      });
    }

    res.render(VIEWS.ORDER_TRACKING, {
      title: `Order Tracking${TITLE_SEPARATOR}${APP_NAME}`,
      order,
      payment,
      isBuyer,
      isSeller,
      isLoginPage: false,
      activePage: 'orders'
    });
  } catch (error) {
    console.error('Order tracking page error:', error.message);
    return next(error);
  }
};

