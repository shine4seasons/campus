const Product = require('../models/Product');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Rating = require('../models/Rating');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const { ORDER_STATUS, PRODUCT_STATUS, PRODUCT_CATEGORIES, PRODUCT_CONDITIONS } = require('../config/appConstants');

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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parsePrice(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeSearchTokens(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(token => token.trim())
    .filter(token => token.length >= 2)
    .slice(0, 6);
}

function buildKeywordFilter(tokens) {
  if (!tokens.length) return null;

  return {
    $and: tokens.map((token) => {
      const regex = new RegExp(escapeRegExp(token), 'i');
      return {
        $or: [
          { title: regex },
          { description: regex },
          { aiDescription: regex },
          { category: regex },
          { condition: regex },
          { 'location.address': regex }
        ]
      };
    })
  };
}

function buildSearchScoreExpression(tokens) {
  const scoreTerms = tokens.flatMap((token) => {
    const regex = escapeRegExp(token);
    return [
      { $cond: [{ $regexMatch: { input: { $ifNull: ['$title', ''] }, regex, options: 'i' } }, 10, 0] },
      { $cond: [{ $regexMatch: { input: { $ifNull: ['$description', ''] }, regex, options: 'i' } }, 4, 0] },
      { $cond: [{ $regexMatch: { input: { $ifNull: ['$aiDescription', ''] }, regex, options: 'i' } }, 3, 0] },
      { $cond: [{ $regexMatch: { input: { $ifNull: ['$category', ''] }, regex, options: 'i' } }, 2, 0] },
      { $cond: [{ $regexMatch: { input: { $ifNull: ['$condition', ''] }, regex, options: 'i' } }, 1, 0] },
      { $cond: [{ $regexMatch: { input: { $ifNull: ['$location.address', ''] }, regex, options: 'i' } }, 1, 0] }
    ];
  });

  return scoreTerms.length ? { $add: scoreTerms } : 0;
}

async function findSearchProducts({ query, page, limit, currentUserId }) {
  const rawQ = String(query.q || '').trim().replace(/\s+/g, ' ');
  const tokens = normalizeSearchTokens(rawQ);
  const q = tokens.length ? rawQ : '';
  const rawCategory = String(query.category || '').trim();
  const category = PRODUCT_CATEGORIES.includes(rawCategory) ? rawCategory : '';
  const rawCondition = String(query.condition || '').trim();
  const condition = PRODUCT_CONDITIONS.includes(rawCondition) ? rawCondition : '';
  let minPrice = parsePrice(query.minPrice);
  let maxPrice = parsePrice(query.maxPrice);
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }

  const allowedSorts = new Set(['relevance', 'newest', 'price-asc', 'price-desc', 'rating']);
  const rawSort = String(query.sort || (q ? 'relevance' : 'newest')).trim();
  const canUseRequestedSort = allowedSorts.has(rawSort) && (q || rawSort !== 'relevance');
  const sort = canUseRequestedSort ? rawSort : (q ? 'relevance' : 'newest');

  const blockedSellerIds = await User.distinct('_id', { banned: true });
  if (currentUserId) blockedSellerIds.push(currentUserId);

  const filter = {
    status: PRODUCT_STATUS.ACTIVE,
    $or: [{ quantity: { $gt: 0 } }, { quantity: { $exists: false } }]
  };

  if (category) filter.category = category;
  if (condition) filter.condition = condition;
  if (minPrice !== null || maxPrice !== null) {
    filter.price = {};
    if (minPrice !== null) filter.price.$gte = minPrice;
    if (maxPrice !== null) filter.price.$lte = maxPrice;
  }
  if (blockedSellerIds.length) {
    filter.seller = { $nin: blockedSellerIds };
  }

  const keywordFilter = buildKeywordFilter(tokens);
  const queryFilter = keywordFilter ? { $and: [filter, keywordFilter] } : filter;
  const skip = (page - 1) * limit;
  let productsPromise;

  if (q && sort === 'relevance') {
    productsPromise = Product.aggregate([
      { $match: queryFilter },
      { $addFields: { searchScore: buildSearchScoreExpression(tokens) } },
      { $sort: { searchScore: -1, ratingAverage: -1, ratingCount: -1, createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: 'seller',
          foreignField: '_id',
          as: 'seller'
        }
      },
      { $unwind: { path: '$seller', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          searchScore: 0,
          'seller.googleId': 0,
          'seller.__v': 0
        }
      }
    ]);
  } else {
    const sortMap = {
      newest: { createdAt: -1 },
      'price-asc': { price: 1, createdAt: -1 },
      'price-desc': { price: -1, createdAt: -1 },
      rating: { ratingAverage: -1, ratingCount: -1, createdAt: -1 }
    };
    productsPromise = Product.find(queryFilter)
      .sort(sortMap[sort] || sortMap.newest)
      .skip(skip)
      .limit(limit)
      .populate('seller', 'name nickname avatar university rating ratingCount totalSales')
      .lean();
  }

  return Promise.all([
    productsPromise,
    Product.countDocuments(queryFilter)
  ]).then(([products, total]) => ({
    products,
    total,
    sort,
    q,
    category,
    condition,
    minPrice: minPrice === null ? NaN : minPrice,
    maxPrice: maxPrice === null ? NaN : maxPrice
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

  const topSellers = await getAdminTopSellers(5, now);

  return { stats, topSellers };
}

async function getAdminTopSellers(limit = 5, now = new Date()) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 5, 20));
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const completedAtOrCreatedAt = { $ifNull: ['$completedAt', '$createdAt'] };

  return Order.aggregate([
    {
      $match: {
        status: ORDER_STATUS.COMPLETED,
        $expr: {
          $and: [
            { $gte: [completedAtOrCreatedAt, startOfMonth] },
            { $lt: [completedAtOrCreatedAt, startOfNextMonth] }
          ]
        }
      }
    },
    { $group: { _id: '$seller', totalRevenue: { $sum: '$priceSnapshot' }, totalOrders: { $sum: 1 } } },
    { $sort: { totalRevenue: -1 } },
    { $limit: normalizedLimit },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'sellerInfo' } },
    { $unwind: '$sellerInfo' },
    {
      $project: {
        _id: 0,
        sellerId: '$_id',
        name: {
          $let: {
            vars: {
              nickname: { $trim: { input: { $ifNull: ['$sellerInfo.nickname', ''] } } },
              fullName: { $trim: { input: { $ifNull: ['$sellerInfo.name', ''] } } }
            },
            in: {
              $cond: [
                { $ne: ['$$nickname', ''] },
                '$$nickname',
                {
                  $cond: [
                    { $ne: ['$$fullName', ''] },
                    '$$fullName',
                    'Unknown seller'
                  ]
                }
              ]
            }
          }
        },
        university: '$sellerInfo.university',
        rating: { $ifNull: ['$sellerInfo.rating', 0] },
        totalRevenue: 1,
        totalOrders: 1
      }
    }
  ]);
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
  getAdminTopSellers,
  getSellerDashboardSnapshot,
  findSellerOrders,
  getProductOrderCounts,
  findBuyerOrders,
  findOrderTrackingDetail,
  findLatestPaymentForOrder
};
