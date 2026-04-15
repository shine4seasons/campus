const Product = require('../models/Product');
const Order = require('../models/Order');
const { incrementViews } = require('../utils/viewCounter');
const { VIEWS, APP_NAME, TITLE_SEPARATOR, LIMITS, ERROR_MESSAGES } = require('../config/pageConstants');
const { CATEGORIES } = require('../public/js/categories');

/**
 * Get product details with related products
 */
exports.getProduct = async (req, res) => {
  try {
    const productId = req.params.id;

    // Validate product ID
    if (!productId || !productId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(404).render(VIEWS.NOT_FOUND, {
        title: '404 — Not Found',
        isLoginPage: false
      });
    }

    const product = await Product.findById(productId)
      .populate('seller', 'name nickname avatar university rating ratingCount totalSales createdAt')
      .lean();

    if (!product || product.status === 'hidden') {
      return res.status(404).render(VIEWS.NOT_FOUND, {
        title: '404 — Not Found',
        isLoginPage: false
      });
    }

    // Increment view count asynchronously
    incrementViews(productId).catch(err => console.error('View increment error:', err));

    // Get related products
    const relatedProducts = await getRelatedProducts(product, LIMITS.RELATED_PRODUCTS);

    res.render(VIEWS.PRODUCT, {
      title: `${product.title}${TITLE_SEPARATOR}${APP_NAME}`,
      product,
      relatedProducts,
      isLoginPage: false
    });
  } catch (error) {
    console.error('Product page error:', error.message);
    res.status(500).render(VIEWS.NOT_FOUND, {
      title: 'Error',
      isLoginPage: false
    });
  }
};

/**
 * Get user's products for my-products page
 */
exports.getMyProducts = async (req, res) => {
  try {
    const products = await Product.find({ seller: res.locals.user._id })
      .sort('-createdAt')
      .lean();

    res.render(VIEWS.MY_PRODUCTS, {
      title: `My Listings${TITLE_SEPARATOR}${APP_NAME}`,
      products,
      isLoginPage: false
    });
  } catch (error) {
    console.error('My products page error:', error.message);
    res.status(500).render(VIEWS.NOT_FOUND, {
      title: 'Error',
      isLoginPage: false
    });
  }
};

/**
 * Get sell page with optional edit product
 */
exports.getSellPage = async (req, res) => {
  const editId = req.query.id;
  let editProduct = null;

  if (editId) {
    try {
      const product = await Product.findById(editId).lean();
      if (product && String(product.seller) === String(res.locals.user._id)) {
        editProduct = product;
      }
    } catch (error) {
      console.error('Edit product fetch error:', error.message);
    }
  }

  const title = editProduct
    ? `Edit Listing${TITLE_SEPARATOR}${APP_NAME}`
    : `Post a Listing${TITLE_SEPARATOR}${APP_NAME}`;

  res.render(VIEWS.SELL, {
    title,
    editProduct,
    isLoginPage: false,
    CATEGORIES
  });
};

/**
 * Get profile page with user's products
 */
exports.getProfile = async (req, res) => {
  try {
    const products = await Product.find({ seller: res.locals.user._id })
      .sort('-createdAt')
      .lean();

    res.render(VIEWS.PROFILE, {
      title: `My Profile${TITLE_SEPARATOR}${APP_NAME}`,
      products,
      isLoginPage: false,
      isOwnProfile: true,
      viewingUser: null
    });
  } catch (error) {
    console.error('Profile page error:', error.message);
    res.render(VIEWS.PROFILE, {
      title: `My Profile${TITLE_SEPARATOR}${APP_NAME}`,
      products: [],
      isLoginPage: false,
      isOwnProfile: true,
      viewingUser: null
    });
  }
};

/**
 * Get public user profile by user ID
 */
exports.getUserProfile = async (req, res) => {
  try {
    const User = require('../models/User');
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

    const viewingUser = await User.findById(userId)
      .select(selectFields)
      .lean();

    if (!viewingUser) {
      return res.status(404).render(VIEWS.NOT_FOUND, {
        title: '404 — Not Found',
        isLoginPage: false
      });
    }

    // Admin can see all products (including hidden/sold), regular users only see active
    const productFilter = isAdmin
      ? { seller: userId }
      : { seller: userId, status: 'active' };

    const products = await Product.find(productFilter)
      .sort('-createdAt')
      .lean();

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
    res.status(500).render(VIEWS.NOT_FOUND, {
      title: 'Error',
      isLoginPage: false
    });
  }
};

/**
 * Get dashboard based on route
 * /dashboard: Admin-only (protected by requireAdminPage middleware)
 * /dashboard-seller: For all authenticated users
 */
exports.getDashboard = (req, res) => {
  // If accessed via /dashboard (not /dashboard-seller), show admin dashboard
  // The /dashboard route has requireAdminPage middleware, so only admins reach here
  if (req.path === '/dashboard' || req.baseUrl === '/dashboard') {
    return res.render(VIEWS.DASHBOARD_ADMIN, {
      title: `Admin Dashboard${TITLE_SEPARATOR}${APP_NAME}`,
      isLoginPage: false,
      CATEGORIES
    });
  }

  // For /dashboard-seller and other paths, show seller dashboard
  const role = res.locals.user?.role;
  const isSeller = role === 'seller';
  return res.render(VIEWS.DASHBOARD_SELLER, {
    title: `Seller Dashboard${TITLE_SEPARATOR}${APP_NAME}`,
    isLoginPage: false,
    isSeller
  });
};

/**
 * Get seller orders with product statistics
 */
exports.getSellerOrders = async (req, res) => {
  try {
    const sellerId = res.locals.user._id;

    // Get orders with populated data
    const orders = await Order.find({ seller: sellerId })
      .sort('-createdAt')
      .populate('product', 'title images price category condition location')
      .populate('buyer', 'name nickname avatar phone rating ratingCount')
      .populate('seller', 'name nickname avatar phone')
      .lean();

    // Get product order counts
    const productsWithCounts = await getProductOrderCounts(sellerId);

    res.render(VIEWS.ORDERS_SELLER, {
      title: `Orders${TITLE_SEPARATOR}${APP_NAME}`,
      orders,
      productsWithCounts,
      isLoginPage: false
    });
  } catch (error) {
    console.error('Seller orders page error:', error.message);
    res.status(500).render(VIEWS.NOT_FOUND, {
      title: 'Error',
      isLoginPage: false
    });
  }
};

/**
 * Get revenue page (placeholder for future implementation)
 */
exports.getRevenue = async (req, res) => {
  try {
    res.render(VIEWS.REVENUE, {
      title: `Revenue${TITLE_SEPARATOR}${APP_NAME}`,
      isLoginPage: false
    });
  } catch (error) {
    console.error('Revenue page error:', error.message);
    res.status(500).render(VIEWS.NOT_FOUND, {
      title: 'Error',
      isLoginPage: false
    });
  }
};

/**
 * Get buyer's orders (for /orders page)
 */
exports.getBuyerOrders = async (req, res) => {
  try {
    const buyerId = res.locals.user._id;

    // Get orders with populated data
    const orders = await Order.find({ buyer: buyerId })
      .sort('-createdAt')
      .populate('product', 'title images price category')
      .populate('seller', 'name nickname avatar phone location rating ratingCount')
      .lean();

    // Count orders by status
    const statusCounts = {
      pending: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0
    };

    orders.forEach(order => {
      statusCounts[order.status]++;
    });

    res.render(VIEWS.ORDERS_BUYER, {
      title: `My Orders${TITLE_SEPARATOR}${APP_NAME}`,
      orders,
      statusCounts,
      isLoginPage: false
    });
  } catch (error) {
    console.error('Buyer orders page error:', error.message);
    res.status(500).render(VIEWS.NOT_FOUND, {
      title: 'Error',
      isLoginPage: false
    });
  }
};

/**
 * Get order tracking page with map
 */
exports.getOrderTracking = async (req, res) => {
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

    const order = await Order.findById(orderId)
      .populate('product', 'title images price category location')
      .populate('buyer', 'name nickname avatar phone location')
      .populate('seller', 'name nickname avatar phone location rating ratingCount')
      .lean();

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
      isBuyer,
      isSeller,
      isLoginPage: false
    });
  } catch (error) {
    console.error('Order tracking page error:', error.message);
    res.status(500).render(VIEWS.NOT_FOUND, {
      title: 'Error',
      isLoginPage: false
    });
  }
};

// Helper functions


/**
 * Get related products for a given product
 */
async function getRelatedProducts(product, limit) {
  try {
    return await Product.find({
      category: product.category,
      _id: { $ne: product._id },
      status: 'active'
    })
      .sort('-views')
      .limit(limit)
      .lean();
  } catch (error) {
    console.error('Related products fetch error:', error.message);
    return [];
  }
}

/**
 * Get product order counts for a seller
 */
async function getProductOrderCounts(sellerId) {
  try {
    const aggregation = await Order.aggregate([
      { $match: { seller: sellerId } },
      { $group: { _id: '$product', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    if (!aggregation.length) return [];

    const productIds = aggregation.map(a => a._id);
    const products = await Product.find({ _id: { $in: productIds } })
      .select('title images price')
      .lean();

    const productMap = new Map(products.map(p => [String(p._id), p]));

    return aggregation.map(a => ({
      product: productMap.get(String(a._id)) || { _id: a._id, title: 'Deleted product' },
      count: a.count
    }));
  } catch (error) {
    console.error('Product order counts error:', error.message);
    return [];
  }
}