const { ORDER_STATUS, PRODUCT_STATUS } = require('../config/appConstants');
const pageRepository = require('../repositories/pageRepository');
const pageService = require('../services/pageService');
const logger = require('../utils/logger');

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
    const currentUser = req.user || res.locals.user || null;
    const isAdmin = currentUser && currentUser.role === 'admin';

    if (!product || (product.status === PRODUCT_STATUS.HIDDEN && !isAdmin)) {
      return res.status(404).render(VIEWS.NOT_FOUND, {
        title: '404 — Not Found',
        isLoginPage: false
      });
    }

    // Increment view count asynchronously
    incrementViews(productId).catch(err => logger.error('page.view_increment_failed', { err: err.message, productId }));

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
      isAdminProductPreview: !!isAdmin,
      isLoginPage: false
    });
  } catch (error) {
    logger.error('page.product_failed', { err: error.message, stack: error.stack, productId: req.params.id });
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
    logger.error('page.search_results_failed', { err: error.message, stack: error.stack });
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
    logger.error('page.my_products_failed', { err: error.message, stack: error.stack, userId: req.user?._id ? String(req.user._id) : null });
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
      logger.error('page.edit_product_fetch_failed', { err: error.message, stack: error.stack, productId });
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
    logger.error('page.profile_failed', { err: error.message, stack: error.stack, userId: req.user?._id ? String(req.user._id) : null });
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
    logger.error('page.user_profile_failed', { err: error.message, stack: error.stack, userId: req.params.id });
    return next(error);
  }
};

/**
 * Get dashboard based on route
 * /dashboard: Admin-only (protected by requireAdminPage middleware)
 * /dashboard-seller: For all authenticated users
 */
exports.getDashboard = async (req, res, next) => {
  try {
    const sellerSectionMap = {
      sDash: {
        sellerSection: 'sDash',
        sellerActivePage: 'dashboard',
        sellerTitle: `Seller Dashboard${TITLE_SEPARATOR}${APP_NAME}`
      },
      sWallet: {
        sellerSection: 'sWallet',
        sellerActivePage: 'wallet',
        sellerTitle: `Wallet & Payouts${TITLE_SEPARATOR}${APP_NAME}`
      }
    };

    const requestedSellerSection = String(req.query.section || '').trim();
    const sellerSectionConfig = sellerSectionMap[requestedSellerSection] || sellerSectionMap.sDash;

    const viewModel = await pageService.getDashboardViewModel({
      user: res.locals.user,
      path: req.path,
      baseUrl: req.baseUrl,
      ...sellerSectionConfig
    });
    if (viewModel.redirectTo) {
      return res.redirect(viewModel.redirectTo);
    }
    return res.render(viewModel.view, viewModel.locals);
  } catch (error) {
    logger.error('page.dashboard_failed', { err: error.message, stack: error.stack, userId: req.user?._id ? String(req.user._id) : null });
    return next(error);
  }
};

/**
 * Get seller orders with product statistics
 */
exports.getSellerOrders = async (req, res, next) => {
  try {
    const viewModel = await pageService.getSellerOrdersViewModel(res.locals.user._id);
    res.render(VIEWS.ORDERS_SELLER, viewModel);
  } catch (error) {
    logger.error('page.seller_orders_failed', { err: error.message, stack: error.stack, userId: req.user?._id ? String(req.user._id) : null });
    return next(error);
  }
};

/**
 * Get revenue page (placeholder for future implementation)
 */
exports.getRevenue = async (req, res, next) => {
  try {
    const { stats, wallet } = await pageService.getSellerWalletViewModel(res.locals.user._id);
    return res.render(VIEWS.REVENUE, {
      title: `Revenue${TITLE_SEPARATOR}${APP_NAME}`,
      isLoginPage: false,
      activePage: 'revenue',
      stats,
      wallet
    });
  } catch (error) {
    logger.error('page.revenue_failed', { err: error.message, stack: error.stack, userId: req.user?._id ? String(req.user._id) : null });
    return next(error);
  }
};

exports.getWalletPayouts = async (req, res, next) => {
  try {
    const viewModel = await pageService.getSellerWalletViewModel(res.locals.user._id);
    return res.render(VIEWS.WALLET_PAYOUTS, viewModel);
  } catch (error) {
    logger.error('page.wallet_payouts_failed', { err: error.message, stack: error.stack, userId: req.user?._id ? String(req.user._id) : null });
    return next(error);
  }
};

/**
 * Get buyer's orders (for /orders page)
 */
exports.getBuyerOrders = async (req, res, next) => {
  try {
    const viewModel = await pageService.getBuyerOrdersViewModel(res.locals.user._id);
    res.render(VIEWS.ORDERS_BUYER, viewModel);
  } catch (error) {
    logger.error('page.buyer_orders_failed', { err: error.message, stack: error.stack, userId: req.user?._id ? String(req.user._id) : null });
    return next(error);
  }
};

/**
 * Get order tracking page with map
 */
exports.getOrderTracking = async (req, res, next) => {
  try {
    const viewModel = await pageService.getOrderTrackingViewModel({
      orderId: req.params.orderId,
      actor: res.locals.user
    });
    res.render(VIEWS.ORDER_TRACKING, viewModel);
  } catch (error) {
    logger.error('page.order_tracking_failed', { err: error.message, stack: error.stack, orderId: req.params.id });
    if (error.status === 404) {
      return res.status(404).render(VIEWS.NOT_FOUND, {
        title: '404 — Not Found',
        isLoginPage: false
      });
    }
    if (error.status === 403) {
      return res.status(403).render(VIEWS.NOT_FOUND, {
        title: 'Forbidden',
        isLoginPage: false
      });
    }
    return next(error);
  }
};

