const Product = require('../models/Product');
const Order = require('../models/Order');
const Rating = require('../models/Rating');
const User = require('../models/User');
const { ORDER_STATUS, PRODUCT_STATUS } = require('../config/appConstants');

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
 
    if (!product || product.status === PRODUCT_STATUS.HIDDEN) {
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
      : { seller: userId, status: PRODUCT_STATUS.ACTIVE };

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
exports.getDashboard = async (req, res) => {
  const user = res.locals.user;
  if (!user) return res.redirect('/login');

  // If accessed via /dashboard (not /dashboard-seller), show admin dashboard
  // The /dashboard route has requireAdminPage middleware, so only admins reach here
  if (req.path === '/dashboard' || req.baseUrl === '/dashboard') {
    try {
      // Fetch data for admin dashboard (consistent with adminRoutes.js)
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);

      // 1. Stats
      const totalUsers = await User.countDocuments({ banned: { $ne: true } });
      const newUsersThisMonth = await User.countDocuments({ createdAt: { $gte: startOfMonth }, banned: { $ne: true } });
      const newUsersLastMonth = await User.countDocuments({ createdAt: { $gte: startOfLastMonth, $lt: startOfMonth }, banned: { $ne: true } });
      const totalUsersDelta = newUsersLastMonth > 0 ? ((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth * 100).toFixed(0) : 0;
 
      const activeListings = await Product.countDocuments({ status: PRODUCT_STATUS.ACTIVE });
      const activeListingsYesterday = await Product.countDocuments({ status: PRODUCT_STATUS.ACTIVE, createdAt: { $lt: yesterday } });
      const activeListingsDelta = activeListings - activeListingsYesterday;

      const ordersThisMonth = await Order.countDocuments({ createdAt: { $gte: startOfMonth } });
      const ordersLastMonth = await Order.countDocuments({ createdAt: { $gte: startOfLastMonth, $lt: startOfMonth } });
      const ordersDelta = ordersLastMonth > 0 ? ((ordersThisMonth - ordersLastMonth) / ordersLastMonth * 100).toFixed(0) : 0;

      const gmvThisMonthResult = await Order.aggregate([
        { $match: { status: ORDER_STATUS.COMPLETED, createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$priceSnapshot' } } }
      ]);
      const gmvThisMonth = gmvThisMonthResult[0]?.total || 0;

      const gmvLastMonthResult = await Order.aggregate([
        { $match: { status: ORDER_STATUS.COMPLETED, createdAt: { $gte: startOfLastMonth, $lt: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$priceSnapshot' } } }
      ]);
      const gmvLastMonth = gmvLastMonthResult[0]?.total || 0;
      const gmvDelta = gmvLastMonth > 0 ? ((gmvThisMonth - gmvLastMonth) / gmvLastMonth * 100).toFixed(0) : 0;

      const stats = {
        totalUsers: { value: totalUsers, delta: totalUsersDelta },
        totalListings: { value: await Product.countDocuments({}) },
        activeListings: { value: activeListings, delta: activeListingsDelta },
        ordersThisMonth: { value: ordersThisMonth, delta: ordersDelta },
        gmvThisMonth: { value: gmvThisMonth, delta: gmvDelta }
      };

      // 2. Top sellers
      const topSellers = await Order.aggregate([
        { $match: { status: ORDER_STATUS.COMPLETED, createdAt: { $gte: startOfMonth } } },
        { $group: { _id: '$seller', totalRevenue: { $sum: '$priceSnapshot' }, totalOrders: { $sum: 1 } } },
        { $sort: { totalRevenue: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'sellerInfo' } },
        { $unwind: '$sellerInfo' },
        { $project: { _id: 0, sellerId: '$_id', name: { $ifNull: ['$sellerInfo.nickname', '$sellerInfo.name'] }, university: '$sellerInfo.university', rating: '$sellerInfo.rating', totalRevenue: 1, totalOrders: 1 } }
      ]);

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
      return res.render(VIEWS.DASHBOARD_ADMIN, {
        title: `Admin Dashboard${TITLE_SEPARATOR}${APP_NAME}`,
        isLoginPage: false,
        CATEGORIES,
        isSuperAdmin: user.role === 'admin',
        stats: { totalUsers: { value: 0, delta: 0 }, activeListings: { value: 0, delta: 0 }, ordersThisMonth: { value: 0, delta: 0 }, gmvThisMonth: { value: 0, delta: 0 } },
        topSellers: [],
        initialSection: 'aDash'
      });
    }
  }

  // Seller dashboard logic: Fetch stats for initial render
  try {
    const sellerId = user._id;

    // 1. Active listings
    const activeCount = await Product.countDocuments({ seller: sellerId, status: PRODUCT_STATUS.ACTIVE });

    // 2. Orders awaiting confirmation
    const pendingCount = await Order.countDocuments({ seller: sellerId, status: ORDER_STATUS.PENDING });

    // 3. Revenue
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Monthly revenue
    const revenueRes = await Order.aggregate([
      { $match: { seller: sellerId, status: ORDER_STATUS.COMPLETED, completedAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$priceSnapshot' } } }
    ]);
    const monthRevenue = revenueRes[0]?.total || 0;

    // Total revenue
    const totalRevRes = await Order.aggregate([
      { $match: { seller: sellerId, status: ORDER_STATUS.COMPLETED } },
      { $group: { _id: null, total: { $sum: '$priceSnapshot' } } }
    ]);
    const totalRevenue = totalRevRes[0]?.total || 0;

    // 5. Sold counts
    const soldCount = await Product.countDocuments({ seller: sellerId, status: PRODUCT_STATUS.SOLD });

    // 6. Recent ratings
    const recentRatings = await Rating.find({ ratedEntity: 'user', entityId: sellerId })
      .sort('-createdAt')
      .limit(5)
      .populate('rater', 'name nickname')
      .lean();

    return res.render(VIEWS.DASHBOARD_SELLER, {
      title: `Seller Dashboard${TITLE_SEPARATOR}${APP_NAME}`,
      isLoginPage: false,
      isSeller: user.role === 'seller',
      stats: {
        activeListings: activeCount,
        pendingOrders: pendingCount,
        monthRevenue: monthRevenue,
        totalRevenue: totalRevenue,
        totalSold: soldCount
      },
      recentRatings
    });

  } catch (error) {
    console.error('Seller dashboard error:', error.message);
    return res.render(VIEWS.DASHBOARD_SELLER, {
      title: `Seller Dashboard${TITLE_SEPARATOR}${APP_NAME}`,
      isLoginPage: false,
      isSeller: user.role === 'seller',
      stats: { activeListings: 0, pendingOrders: 0, monthRevenue: 0, totalSold: 0 },
      recentRatings: []
    });
  }
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
      status: PRODUCT_STATUS.ACTIVE
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