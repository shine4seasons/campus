const Product = require('../models/Product');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Rating = require('../models/Rating');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const { ORDER_STATUS, PRODUCT_STATUS, PRODUCT_CONDITIONS } = require('../config/appConstants');

function findPageProductById(productId) {
  return Product.findById(productId)
    .populate('seller', 'name nickname avatar university rating ratingCount totalSales createdAt')
    .lean();
}

function findRelatedProducts({ category, excludeProductId, limit }) {
  return Product.find({
    category,
    _id: { $ne: excludeProductId },
    status: PRODUCT_STATUS.ACTIVE
  })
    .sort('-views')
    .limit(limit)
    .lean();
}

function findSearchProducts({ query, page, limit, currentUserId }) {
  const q = String(query.q || '').trim();
  const category = String(query.category || '').trim();
  const condition = String(query.condition || '').trim();
  const minPrice = Number.parseInt(query.minPrice, 10);
  const maxPrice = Number.parseInt(query.maxPrice, 10);
  const allowedSorts = new Set(['relevance', 'newest', 'price-asc', 'price-desc', 'rating']);
  const rawSort = String(query.sort || (q ? 'relevance' : 'newest')).trim();
  const sort = allowedSorts.has(rawSort) ? rawSort : (q ? 'relevance' : 'newest');

  const filter = {
    status: PRODUCT_STATUS.ACTIVE,
    $or: [{ quantity: { $gt: 0 } }, { quantity: { $exists: false } }]
  };

  if (category) filter.category = category;
  if (PRODUCT_CONDITIONS.includes(condition)) filter.condition = condition;
  if (Number.isFinite(minPrice) || Number.isFinite(maxPrice)) {
    filter.price = {};
    if (Number.isFinite(minPrice)) filter.price.$gte = minPrice;
    if (Number.isFinite(maxPrice)) filter.price.$lte = maxPrice;
  }
  if (currentUserId) filter.seller = { $ne: currentUserId };

  const queryFilter = q ? { ...filter, $text: { $search: q } } : filter;
  let productQuery;
  if (q && sort === 'relevance') {
    productQuery = Product.find(queryFilter, { score: { $meta: 'textScore' } })
      .sort({ score: { $meta: 'textScore' } });
  } else {
    const sortMap = {
      newest: { createdAt: -1 },
      'price-asc': { price: 1, createdAt: -1 },
      'price-desc': { price: -1, createdAt: -1 },
      rating: { ratingAverage: -1, ratingCount: -1, createdAt: -1 }
    };
    productQuery = Product.find(queryFilter).sort(sortMap[sort] || sortMap.newest);
  }

  const skip = (page - 1) * limit;
  return Promise.all([
    productQuery
      .skip(skip)
      .limit(limit)
      .populate('seller', 'name nickname avatar university rating ratingCount totalSales')
      .lean(),
    Product.countDocuments(queryFilter)
  ]).then(([products, total]) => ({
    products,
    total,
    sort,
    q,
    category,
    condition,
    minPrice,
    maxPrice
  }));
}

function findProductsBySeller(sellerId) {
  return Product.find({ seller: sellerId }).sort('-createdAt').lean();
}

function findSellEditProduct(editId) {
  return Product.findById(editId).lean();
}

function findPublicProfileUserById(userId, isAdmin) {
  const selectFields = isAdmin
    ? '_id name nickname avatar email university bio rating ratingCount totalSales createdAt banned role'
    : '_id name nickname avatar university bio rating ratingCount totalSales createdAt';
  return User.findById(userId).select(selectFields).lean();
}

function findPublicProfileProducts({ userId, isAdmin }) {
  const productFilter = isAdmin
    ? { seller: userId }
    : { seller: userId, status: PRODUCT_STATUS.ACTIVE };
  return Product.find(productFilter).sort('-createdAt').lean();
}

async function getAdminDashboardSnapshot() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const totalUsers = await User.countDocuments({ banned: { $ne: true } });
  const newUsersThisMonth = await User.countDocuments({ createdAt: { $gte: startOfMonth }, banned: { $ne: true } });
  const newUsersLastMonth = await User.countDocuments({ createdAt: { $gte: startOfLastMonth, $lt: startOfMonth }, banned: { $ne: true } });
  const totalUsersDelta = newUsersLastMonth > 0 ? ((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth * 100).toFixed(0) : 0;

  const activeProducts = await Product.countDocuments({ status: PRODUCT_STATUS.ACTIVE });
  const activeProductsYesterday = await Product.countDocuments({ status: PRODUCT_STATUS.ACTIVE, createdAt: { $lt: yesterday } });
  const activeProductsDelta = activeProducts - activeProductsYesterday;

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
    totalProducts: { value: await Product.countDocuments({}) },
    activeProducts: { value: activeProducts, delta: activeProductsDelta },
    ordersThisMonth: { value: ordersThisMonth, delta: ordersDelta },
    gmvThisMonth: { value: gmvThisMonth, delta: gmvDelta }
  };

  const topSellers = await Order.aggregate([
    { $match: { status: ORDER_STATUS.COMPLETED, createdAt: { $gte: startOfMonth } } },
    { $group: { _id: '$seller', totalRevenue: { $sum: '$priceSnapshot' }, totalOrders: { $sum: 1 } } },
    { $sort: { totalRevenue: -1 } },
    { $limit: 5 },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'sellerInfo' } },
    { $unwind: '$sellerInfo' },
    { $project: { _id: 0, sellerId: '$_id', name: { $ifNull: ['$sellerInfo.nickname', '$sellerInfo.name'] }, university: '$sellerInfo.university', rating: '$sellerInfo.rating', totalRevenue: 1, totalOrders: 1 } }
  ]);

  return { stats, topSellers };
}

async function getSellerDashboardSnapshot(sellerId) {
  const activeCount = await Product.countDocuments({ seller: sellerId, status: PRODUCT_STATUS.ACTIVE });
  const pendingCount = await Order.countDocuments({ seller: sellerId, status: ORDER_STATUS.PENDING });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const revenueRes = await Order.aggregate([
    { $match: { seller: sellerId, status: ORDER_STATUS.COMPLETED, completedAt: { $gte: startOfMonth } } },
    { $group: { _id: null, total: { $sum: '$priceSnapshot' } } }
  ]);
  const monthRevenue = revenueRes[0]?.total || 0;

  const totalRevRes = await Order.aggregate([
    { $match: { seller: sellerId, status: ORDER_STATUS.COMPLETED } },
    { $group: { _id: null, total: { $sum: '$priceSnapshot' } } }
  ]);
  const totalRevenue = totalRevRes[0]?.total || 0;

  const soldAgg = await Order.aggregate([
    { $match: { seller: sellerId, status: { $ne: ORDER_STATUS.CANCELLED } } },
    { $group: { _id: null, total: { $sum: '$quantity' } } }
  ]);
  const soldCount = soldAgg[0]?.total || 0;

  const recentRatings = await Rating.find({ ratedEntity: 'user', entityId: sellerId })
    .sort('-createdAt')
    .limit(5)
    .populate('rater', 'name nickname')
    .lean();

  let wallet = await Wallet.findOne({ user: sellerId }).lean();
  if (!wallet) wallet = { availableBalance: 0, pendingBalance: 0, totalSales: 0 };

  return {
    stats: {
      activeProducts: activeCount,
      pendingOrders: pendingCount,
      monthRevenue,
      totalRevenue,
      totalSold: soldCount
    },
    wallet,
    recentRatings
  };
}

function findSellerOrders(sellerId) {
  return Order.find({ seller: sellerId })
    .sort('-createdAt')
    .populate('product', 'title images price category condition location')
    .populate('buyer', 'name nickname avatar phone rating ratingCount')
    .populate('seller', 'name nickname avatar phone')
    .lean();
}

async function getProductOrderCounts(sellerId) {
  const aggregation = await Order.aggregate([
    { $match: { seller: sellerId } },
    { $group: { _id: '$product', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  if (!aggregation.length) return [];
  const productIds = aggregation.map((item) => item._id);
  const products = await Product.find({ _id: { $in: productIds } })
    .select('title images price')
    .lean();
  const productMap = new Map(products.map((item) => [String(item._id), item]));
  return aggregation.map((item) => ({
    product: productMap.get(String(item._id)) || { _id: item._id, title: 'Deleted product' },
    count: item.count
  }));
}

function findBuyerOrders(buyerId) {
  return Order.find({ buyer: buyerId })
    .sort('-createdAt')
    .populate('product', 'title images price category')
    .populate('seller', 'name nickname avatar phone location rating ratingCount')
    .lean();
}

function findOrderTrackingDetail(orderId) {
  return Order.findById(orderId)
    .populate('product', 'title images price category location')
    .populate('buyer', 'name nickname avatar phone location')
    .populate('seller', 'name nickname avatar phone location rating ratingCount')
    .populate('timeline.actor', 'name nickname avatar')
    .populate('dispute.openedBy', 'name nickname avatar')
    .populate('dispute.resolvedBy', 'name nickname')
    .lean();
}

function findLatestPaymentForOrder(orderId) {
  return Payment.findOne({ order: orderId })
    .sort({ createdAt: -1 })
    .select('_id status amount expiredAt paidAt paymentCode sepayQrUrl qrUrl')
    .lean();
}

module.exports = {
  findPageProductById,
  findRelatedProducts,
  findSearchProducts,
  findProductsBySeller,
  findSellEditProduct,
  findPublicProfileUserById,
  findPublicProfileProducts,
  getAdminDashboardSnapshot,
  getSellerDashboardSnapshot,
  findSellerOrders,
  getProductOrderCounts,
  findBuyerOrders,
  findOrderTrackingDetail,
  findLatestPaymentForOrder
};
